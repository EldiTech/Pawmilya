const express = require('express');
const db = require('../config/database');
const { authenticateAdmin } = require('../middleware/auth');
// Removed file-based upload - now using base64 images stored in database

const router = express.Router();

// Use proper authentication middleware for all admin routes
router.use(authenticateAdmin);

// ==================== HELPER: LOG RESCUE HISTORY ====================
const logRescueHistory = async (rescueId, action, previousStatus, newStatus, performedByType, performedById, performedByName, details = null) => {
  try {
    await db.query(
      `INSERT INTO rescue_history (rescue_id, action, previous_status, new_status, performed_by_type, performed_by_id, performed_by_name, details)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [rescueId, action, previousStatus, newStatus, performedByType, performedById, performedByName, details ? JSON.stringify(details) : null]
    );
  } catch (error) {
    console.error('Failed to log rescue history:', error);
    // Don't throw - logging failure shouldn't block main operation
  }
};

// ==================== DASHBOARD ====================

// Get dashboard statistics
router.get('/dashboard/stats', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        (SELECT COUNT(*) FROM pets) as total_pets,
        (SELECT COUNT(*) FROM pets WHERE status = 'available') as available_pets,
        (SELECT COUNT(*) FROM adoption_applications WHERE status = 'approved') as total_adoptions,
        (SELECT COUNT(*) FROM adoption_applications WHERE status = 'pending') as pending_adoptions,
        (SELECT COUNT(*) FROM rescue_reports WHERE status IN ('new', 'in_progress')) as active_rescues,
        (SELECT COUNT(*) FROM rescue_reports WHERE status = 'rescued') as completed_rescues,
        (SELECT COUNT(*) FROM users WHERE status = 'active') as active_users,
        (SELECT COUNT(*) FROM users) as total_users
    `);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ error: 'Failed to get dashboard stats' });
  }
});

// ==================== PETS MANAGEMENT ====================

const ALLOWED_PET_UPDATE_FIELDS = {
  name: 'name',
  category_id: 'category_id',
  breed_id: 'breed_id',
  breed_name: 'breed_name',
  age_years: 'age_years',
  age_months: 'age_months',
  gender: 'gender',
  size: 'size',
  weight_kg: 'weight_kg',
  color: 'color',
  description: 'description',
  medical_history: 'medical_history',
  vaccination_status: 'vaccination_status',
  is_neutered: 'is_neutered',
  is_house_trained: 'is_house_trained',
  is_good_with_kids: 'is_good_with_kids',
  is_good_with_other_pets: 'is_good_with_other_pets',
  temperament: 'temperament',
  special_needs: 'special_needs',
  status: 'status',
  is_featured: 'is_featured',
  shelter_id: 'shelter_id',
  location: 'location',
  latitude: 'latitude',
  longitude: 'longitude',
  adoption_fee: 'adoption_fee',
};

// Get pet categories (creates defaults if none exist)
router.get('/pet-categories', async (req, res) => {
  try {
    // Check if categories exist
    let result = await db.query('SELECT * FROM pet_categories ORDER BY id');
    
    // If no categories exist, create defaults with explicit IDs
    if (result.rows.length === 0) {
      await db.query(`
        INSERT INTO pet_categories (id, name, description, icon) VALUES 
        (1, 'Dog', 'Canine companions', 'paw'),
        (2, 'Cat', 'Feline friends', 'paw'),
        (3, 'Bird', 'Feathered pets', 'paw'),
        (4, 'Rabbit', 'Small mammals', 'paw'),
        (5, 'Other', 'Other animals', 'paw')
        ON CONFLICT (id) DO NOTHING
      `);
      result = await db.query('SELECT * FROM pet_categories ORDER BY id');
    }
    
    res.json(result.rows);
  } catch (error) {
    console.error('Get pet categories error:', error);
    res.status(500).json({ error: 'Failed to get pet categories' });
  }
});

// Get all pets (admin view)
router.get('/pets', async (req, res) => {
  try {
    const { status, search, limit = 50, offset = 0 } = req.query;

    let query = `
      SELECT p.id, p.name, p.gender, p.status, p.size, p.color,
             p.age_years, p.age_months,
             CASE WHEN p.age_years > 0 THEN p.age_years || ' years' ELSE p.age_months || ' months' END as age,
             COALESCE(b.name, p.breed_name) as breed,
             pc.name as type,
             p.description, p.medical_history, p.vaccination_status,
             p.is_neutered, p.is_house_trained, p.is_good_with_kids, p.is_good_with_other_pets,
             p.special_needs, p.location, p.adoption_fee, p.is_featured,
             COALESCE(
               (SELECT image_url FROM pet_images WHERE pet_id = p.id AND is_primary = TRUE LIMIT 1),
               (SELECT image_url FROM pet_images WHERE pet_id = p.id ORDER BY display_order LIMIT 1),
               CASE WHEN p.images IS NOT NULL AND array_length(p.images, 1) > 0 THEN p.images[1] ELSE NULL END
             ) as image,
             p.created_at
      FROM pets p
      LEFT JOIN breeds b ON p.breed_id = b.id
      LEFT JOIN pet_categories pc ON p.category_id = pc.id
      WHERE 1=1
    `;

    const params = [];
    let paramIndex = 1;

    if (status && status !== 'all') {
      query += ` AND p.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (search) {
      query += ` AND p.name ILIKE $${paramIndex}`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    query += ` ORDER BY p.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Admin get pets error:', error);
    res.status(500).json({ error: 'Failed to get pets' });
  }
});

// Create new pet
router.post('/pets', async (req, res) => {
  try {
    const {
      name, category_id, breed_id, breed_name, age_years, age_months,
      gender, size, weight_kg, color, description, medical_history,
      vaccination_status, is_neutered, is_house_trained, is_good_with_kids,
      is_good_with_other_pets, temperament, special_needs, status,
      is_featured, shelter_id, location, latitude, longitude, adoption_fee, images
    } = req.body;

    console.log('Creating pet:', name, 'with', images ? images.length : 0, 'images');

    // Ensure pet categories exist (use explicit IDs to match frontend)
    await db.query(`
      INSERT INTO pet_categories (id, name, description, icon) VALUES 
      (1, 'Dog', 'Canine companions', 'paw'),
      (2, 'Cat', 'Feline friends', 'paw'),
      (3, 'Bird', 'Feathered pets', 'paw'),
      (4, 'Rabbit', 'Small mammals', 'paw'),
      (5, 'Other', 'Other animals', 'paw')
      ON CONFLICT (id) DO NOTHING
    `);

    // Use provided category_id or default to null
    const finalCategoryId = category_id || null;

    const result = await db.query(
      `INSERT INTO pets (
        name, category_id, breed_id, breed_name, age_years, age_months,
        gender, size, weight_kg, color, description, medical_history,
        vaccination_status, is_neutered, is_house_trained, is_good_with_kids,
        is_good_with_other_pets, temperament, special_needs, status,
        is_featured, shelter_id, location, latitude, longitude, adoption_fee,
        created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27)
      RETURNING id`,
      [
        name, finalCategoryId, breed_id, breed_name, age_years || 0, age_months || 0,
        gender, size, weight_kg, color, description, medical_history,
        vaccination_status, is_neutered, is_house_trained, is_good_with_kids,
        is_good_with_other_pets, temperament || [], special_needs, status || 'available',
        is_featured || false, shelter_id, location, latitude, longitude, adoption_fee || 0,
        req.admin.id
      ]
    );

    const petId = result.rows[0].id;
    console.log('Pet created with ID:', petId);

    // Add images if provided
    if (images && images.length > 0) {
      console.log('Inserting', images.length, 'images for pet', petId);
      for (let i = 0; i < images.length; i++) {
        await db.query(
          'INSERT INTO pet_images (pet_id, image_url, is_primary, display_order) VALUES ($1, $2, $3, $4)',
          [petId, images[i], i === 0, i]
        );
        console.log('Inserted image', i + 1, 'for pet', petId);
      }
    } else {
      console.log('No images to insert for pet', petId);
    }

    // Log activity
    await db.query(
      `INSERT INTO admin_activity_logs (admin_id, action, entity_type, entity_id, details)
       VALUES ($1, 'create_pet', 'pet', $2, $3)`,
      [req.admin.id, petId, JSON.stringify({ name })]
    );

    res.status(201).json({ message: 'Pet created successfully', id: petId });
  } catch (error) {
    console.error('Create pet error:', error);
    res.status(500).json({ error: 'Failed to create pet' });
  }
});

// Upload pet images - accepts base64 images and stores in database
router.post('/pets/upload-images', async (req, res) => {
  try {
    console.log('Received upload-images request');
    const { images } = req.body;
    
    console.log('Images received:', images ? images.length : 0, 'images');
    
    if (!images || !Array.isArray(images) || images.length === 0) {
      console.log('No images in request body');
      return res.status(400).json({ error: 'No images provided' });
    }

    // Validate that all images are base64 encoded
    const validImages = images.filter(img => 
      typeof img === 'string' && img.startsWith('data:image')
    );

    console.log('Valid base64 images:', validImages.length);

    if (validImages.length === 0) {
      return res.status(400).json({ error: 'Invalid image format. Please provide base64 encoded images.' });
    }

    // Return the base64 images directly (they'll be stored in the database when creating/updating pet)
    console.log('Returning', validImages.length, 'images');
    res.json({ success: true, images: validImages });
  } catch (error) {
    console.error('Upload pet images error:', error);
    res.status(500).json({ error: 'Failed to process images' });
  }
});

// Update pet
router.put('/pets/:id', async (req, res) => {
  try {
    const petId = req.params.id;
    const updates = req.body;

    const inputFields = Object.keys(updates).filter(k => k !== 'id' && k !== 'images');
    if (inputFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const disallowedFields = inputFields.filter((field) => !ALLOWED_PET_UPDATE_FIELDS[field]);
    if (disallowedFields.length > 0) {
      return res.status(400).json({
        error: 'Invalid field(s) for update',
        invalidFields: disallowedFields,
      });
    }

    // Build dynamic query only from server-controlled whitelist mappings.
    const fields = inputFields.map((field) => ALLOWED_PET_UPDATE_FIELDS[field]);

    const setClause = fields.map((f, i) => `${f} = $${i + 1}`).join(', ');
    const values = inputFields.map((f) => updates[f]);
    values.push(req.admin.id, petId);

    await db.query(
      `UPDATE pets SET ${setClause}, updated_by = $${fields.length + 1}, updated_at = NOW() WHERE id = $${fields.length + 2}`,
      values
    );

    // Log activity
    await db.query(
      `INSERT INTO admin_activity_logs (admin_id, action, entity_type, entity_id, details)
       VALUES ($1, 'update_pet', 'pet', $2, $3)`,
      [req.admin.id, petId, JSON.stringify(updates)]
    );

    res.json({ message: 'Pet updated successfully' });
  } catch (error) {
    console.error('Update pet error:', error);
    res.status(500).json({ error: 'Failed to update pet' });
  }
});

// Delete pet
router.delete('/pets/:id', async (req, res) => {
  try {
    const petId = req.params.id;

    // Get pet name for logging
    const pet = await db.query('SELECT name FROM pets WHERE id = $1', [petId]);

    await db.query('DELETE FROM pets WHERE id = $1', [petId]);

    // Log activity
    await db.query(
      `INSERT INTO admin_activity_logs (admin_id, action, entity_type, entity_id, details)
       VALUES ($1, 'delete_pet', 'pet', $2, $3)`,
      [req.admin.id, petId, JSON.stringify({ name: pet.rows[0]?.name })]
    );

    res.json({ message: 'Pet deleted successfully' });
  } catch (error) {
    console.error('Delete pet error:', error);
    res.status(500).json({ error: 'Failed to delete pet' });
  }
});

// ==================== USERS MANAGEMENT ====================

// Get all users
router.get('/users', async (req, res) => {
  try {
    const { search, status, limit = 50, offset = 0 } = req.query;

    let query = `
      SELECT id, email, full_name, phone, avatar_url, status, created_at
      FROM users WHERE 1=1
    `;

    const params = [];
    let paramIndex = 1;

    if (search) {
      query += ` AND (full_name ILIKE $${paramIndex} OR email ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (status) {
      query += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Admin get users error:', error);
    res.status(500).json({ error: 'Failed to get users' });
  }
});

// Suspend/Activate user
router.put('/users/:id/status', async (req, res) => {
  try {
    const { status, reason } = req.body;
    const userId = req.params.id;

    if (!['active', 'suspended'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    await db.query(
      `UPDATE users SET 
        status = $1, 
        suspended_at = $2, 
        suspended_by = $3, 
        suspension_reason = $4,
        updated_at = NOW()
       WHERE id = $5`,
      [
        status,
        status === 'suspended' ? new Date() : null,
        status === 'suspended' ? req.admin.id : null,
        status === 'suspended' ? reason : null,
        userId
      ]
    );

    // If suspending, revoke all user verifications (rescuer status, etc.)
    if (status === 'suspended') {
      // Revoke rescuer application if approved
      await db.query(
        `UPDATE rescuer_applications 
         SET status = 'revoked', 
             reviewed_at = NOW()
         WHERE user_id = $1 AND status = 'approved'`,
        [userId]
      );

      // Update user role back to 'user' if they were a rescuer
      await db.query(
        `UPDATE users SET role = 'user' WHERE id = $1 AND role = 'rescuer'`,
        [userId]
      );
    }

    // Log activity
    await db.query(
      `INSERT INTO admin_activity_logs (admin_id, action, entity_type, entity_id, details)
       VALUES ($1, $2, 'user', $3, $4)`,
      [req.admin.id, status === 'suspended' ? 'suspend_user' : 'activate_user', userId, JSON.stringify({ reason })]
    );

    res.json({ message: `User ${status === 'suspended' ? 'suspended' : 'activated'} successfully` });
  } catch (error) {
    console.error('Update user status error:', error);
    res.status(500).json({ error: 'Failed to update user status' });
  }
});

// Create new user (admin)
router.post('/users', async (req, res) => {
  try {
    const { email, password, full_name, phone, status = 'active' } = req.body;

    if (!email || !password || !full_name) {
      return res.status(400).json({ error: 'Email, password, and full name are required' });
    }

    // Check if email exists
    const existing = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    // Check if phone number exists (if provided)
    if (phone) {
      const phoneCheck = await db.query('SELECT id FROM users WHERE phone = $1', [phone]);
      if (phoneCheck.rows.length > 0) {
        return res.status(400).json({ error: 'Phone number already registered' });
      }
    }

    // Hash password
    const bcrypt = require('bcrypt');
    const hashedPassword = await bcrypt.hash(password, 12);

    const result = await db.query(
      `INSERT INTO users (email, password_hash, full_name, phone, status, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING id, email, full_name, phone, status, created_at`,
      [email, hashedPassword, full_name, phone, status]
    );

    // Log activity
    await db.query(
      `INSERT INTO admin_activity_logs (admin_id, action, entity_type, entity_id, details)
       VALUES ($1, 'create_user', 'user', $2, $3)`,
      [req.admin.id, result.rows[0].id, JSON.stringify({ email, full_name })]
    );

    res.status(201).json({ message: 'User created successfully', user: result.rows[0] });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Update user (admin)
router.put('/users/:id', async (req, res) => {
  try {
    const { full_name, email, phone, status } = req.body;
    const userId = req.params.id;

    // Check if user exists
    const existing = await db.query('SELECT id FROM users WHERE id = $1', [userId]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // If email changed, check for duplicates
    if (email) {
      const emailCheck = await db.query('SELECT id FROM users WHERE email = $1 AND id != $2', [email, userId]);
      if (emailCheck.rows.length > 0) {
        return res.status(400).json({ error: 'Email already exists' });
      }
    }

    // If phone changed, check for duplicates
    if (phone) {
      const phoneCheck = await db.query('SELECT id FROM users WHERE phone = $1 AND id != $2', [phone, userId]);
      if (phoneCheck.rows.length > 0) {
        return res.status(400).json({ error: 'Phone number already registered' });
      }
    }

    const result = await db.query(
      `UPDATE users SET 
        full_name = COALESCE($1, full_name),
        email = COALESCE($2, email),
        phone = COALESCE($3, phone),
        status = COALESCE($4, status),
        updated_at = NOW()
       WHERE id = $5
       RETURNING id, email, full_name, phone, status`,
      [full_name, email, phone, status, userId]
    );

    // Log activity
    await db.query(
      `INSERT INTO admin_activity_logs (admin_id, action, entity_type, entity_id, details)
       VALUES ($1, 'update_user', 'user', $2, $3)`,
      [req.admin.id, userId, JSON.stringify({ full_name, email, phone, status })]
    );

    res.json({ message: 'User updated successfully', user: result.rows[0] });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Delete user (admin)
router.delete('/users/:id', async (req, res) => {
  const client = await db.pool.connect();
  try {
    const userId = req.params.id;

    // Get user info for logging
    const user = await client.query('SELECT email, full_name FROM users WHERE id = $1', [userId]);
    if (user.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    await client.query('BEGIN');

    // Detach shelter manager relationships to satisfy FK constraints.
    await client.query('UPDATE shelters SET manager_id = NULL WHERE manager_id = $1', [userId]);
    await client.query('UPDATE users SET managed_shelter_id = NULL WHERE id = $1', [userId]);

    // Delete user-owned rescues unless they were already transferred/handled by others.
    await client.query(
      `DELETE FROM rescue_reports rr
       WHERE rr.reporter_id = $1
         AND COALESCE(rr.rescuer_id::text, $1::text) = $1::text
         AND NOT EXISTS (
           SELECT 1
           FROM shelter_transfer_requests str
           WHERE str.rescue_report_id = rr.id
             AND str.status IN ('approved', 'accepted', 'in_transit', 'arrived_at_shelter', 'completed')
         )`,
      [userId]
    );

    // Preserve transferred rescues but remove personal reporter details of deleted user.
    await client.query(
      `UPDATE rescue_reports
       SET reporter_id = NULL,
           reporter_name = 'Deleted User',
           reporter_phone = NULL,
           reporter_email = NULL,
           updated_at = NOW()
       WHERE reporter_id = $1`,
      [userId]
    );

    // Remove deleted user from rescuer assignment on remaining rescues.
    await client.query('UPDATE rescue_reports SET rescuer_id = NULL WHERE rescuer_id = $1', [userId]);

    // Delete user-created pets unless already transferred to another adopter.
    await client.query(
      `DELETE FROM pets p
       WHERE p.created_by::text = $1::text
         AND NOT (
           p.status = 'adopted'
           OR EXISTS (
             SELECT 1
             FROM adoption_applications aa
             WHERE aa.pet_id = p.id
               AND aa.status = 'approved'
               AND aa.user_id IS NOT NULL
               AND aa.user_id::text <> $1::text
           )
         )`,
      [userId]
    );

    // Preserve transferred pets but remove creator/updater ownership traces.
    await client.query(
      `UPDATE pets
       SET created_by = CASE WHEN created_by::text = $1::text THEN NULL ELSE created_by END,
           updated_by = CASE WHEN updated_by::text = $1::text THEN NULL ELSE updated_by END,
           updated_at = NOW()
       WHERE created_by::text = $1::text OR updated_by::text = $1::text`,
      [userId]
    );

    // Keep transferred shelter requests but remove requester link if user is deleted.
    await client.query(
      `DELETE FROM shelter_transfer_requests
       WHERE requester_id = $1
         AND status IN ('pending', 'rejected', 'cancelled')`,
      [userId]
    );
    await client.query(
      `UPDATE shelter_transfer_requests
       SET requester_id = NULL,
           updated_at = NOW()
       WHERE requester_id = $1`,
      [userId]
    );

    // Delete related rescuer applications first
    await client.query('DELETE FROM rescuer_applications WHERE user_id = $1', [userId]);

    // Delete related shelter applications
    await client.query('DELETE FROM shelter_applications WHERE user_id = $1', [userId]);
    
    // Delete related notifications
    await client.query('DELETE FROM notifications WHERE user_id = $1', [userId]);

    // Set user_id to NULL for adoption applications
    await client.query('UPDATE adoption_applications SET user_id = NULL WHERE user_id = $1', [userId]);

    // Delete user saved pets
    await client.query('DELETE FROM user_saved_pets WHERE user_id = $1', [userId]);

    // Delete user (cascade will handle related records if set up)
    await client.query('DELETE FROM users WHERE id = $1', [userId]);

    // Log activity
    await client.query(
      `INSERT INTO admin_activity_logs (admin_id, action, entity_type, entity_id, details)
       VALUES ($1, 'delete_user', 'user', $2, $3)`,
      [req.admin.id, userId, JSON.stringify({ email: user.rows[0].email, full_name: user.rows[0].full_name })]
    );

    await client.query('COMMIT');

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  } finally {
    client.release();
  }
});

// ==================== ADOPTIONS MANAGEMENT ====================

// Get all adoption applications
router.get('/adoptions', async (req, res) => {
  try {
    const { status, limit = 50, offset = 0 } = req.query;

    let query = `
      SELECT a.id, a.status, a.submitted_at, a.approved_at,
             a.living_situation, a.has_yard, a.yard_fenced, a.rental_allows_pets,
             a.household_members, a.has_children, a.children_ages,
             a.has_other_pets, a.other_pets_details,
             a.previous_pet_experience, a.reason_for_adoption, a.work_schedule,
             a.emergency_contact_name, a.emergency_contact_phone,
             a.veterinarian_name, a.veterinarian_phone,
             a.additional_notes, a.review_notes, a.rejection_reason,
             a.payment_completed, a.payment_amount, a.payment_date,
             a.payment_method, a.paymongo_checkout_id,
             CASE WHEN a.payment_completed = TRUE THEN TRUE ELSE FALSE END as payment_admin_verified,
             a.delivery_status, a.delivery_full_name, a.delivery_phone,
             a.delivery_address, a.delivery_city, a.delivery_postal_code,
             a.delivery_notes, a.delivery_scheduled_date, a.delivery_tracking_notes,
             u.full_name as applicant, u.email as applicant_email, u.phone as applicant_phone,
             p.name as pet, p.breed_name as pet_breed, p.gender as pet_gender,
             p.age_years as pet_age_years, p.age_months as pet_age_months,
             p.adoption_fee,
             pc.name as pet_species,
             COALESCE(
               (SELECT image_url FROM pet_images WHERE pet_id = p.id AND is_primary = TRUE LIMIT 1),
               (SELECT image_url FROM pet_images WHERE pet_id = p.id ORDER BY display_order LIMIT 1),
               CASE WHEN p.images IS NOT NULL AND array_length(p.images, 1) > 0 THEN p.images[1] ELSE NULL END
             ) as pet_image
      FROM adoption_applications a
      JOIN users u ON a.user_id = u.id
      JOIN pets p ON a.pet_id = p.id
      LEFT JOIN pet_categories pc ON p.category_id = pc.id
      WHERE p.shelter_id IS NULL
    `;

    const params = [];
    let paramIndex = 1;

    if (status && status !== 'all') {
      query += ` AND a.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    query += ` ORDER BY a.submitted_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Admin get adoptions error:', error);
    res.status(500).json({ error: 'Failed to get adoptions' });
  }
});

// Update adoption application status
router.put('/adoptions/:id/status', async (req, res) => {
  try {
    const { status, review_notes, rejection_reason } = req.body;
    const appId = req.params.id;

    if (!['pending', 'reviewing', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const result = await db.query(
      `UPDATE adoption_applications SET 
        status = $1, 
        review_notes = $2,
        rejection_reason = $3,
        approved_at = $4,
        updated_at = NOW()
       WHERE id = $5
       RETURNING pet_id, user_id`,
      [
        status,
        review_notes,
        rejection_reason,
        status === 'approved' ? new Date() : null,
        appId
      ]
    );

    // Update pet status based on adoption status
    if (result.rows.length > 0) {
      const petId = result.rows[0].pet_id;
      const userId = result.rows[0].user_id;
      let petStatus = 'available';
      if (status === 'approved') petStatus = 'pending'; // stays pending until payment
      else if (status === 'reviewing' || status === 'pending') petStatus = 'pending';

      await db.query('UPDATE pets SET status = $1 WHERE id = $2', [petStatus, petId]);

      // Send notification to user
      if (userId) {
        const pet = await db.query('SELECT name FROM pets WHERE id = $1', [petId]);
        const petName = pet.rows[0]?.name || 'your pet';
        let notifTitle, notifMessage, notifType;

        if (status === 'approved') {
          notifTitle = 'Adoption Approved! 🎉';
          notifMessage = `Great news! Your adoption application for ${petName} has been approved. Please proceed to payment to complete the adoption.`;
          notifType = 'adoption_update';
        } else if (status === 'rejected') {
          notifTitle = 'Application Update';
          notifMessage = `Your adoption application for ${petName} was not approved.${rejection_reason ? ' Reason: ' + rejection_reason : ''}`;
          notifType = 'adoption_update';
        }

        if (notifTitle) {
          try {
            await db.query(
              `INSERT INTO notifications (user_id, type, title, message, data) VALUES ($1, $2, $3, $4, $5)`,
              [userId, notifType, notifTitle, notifMessage, JSON.stringify({ adoption_id: appId, pet_id: petId })]
            );
          } catch (notifError) {
            console.error('Failed to create notification:', notifError);
          }
        }
      }
    }

    // Log activity
    await db.query(
      `INSERT INTO admin_activity_logs (admin_id, action, entity_type, entity_id, details)
       VALUES ($1, $2, 'adoption', $3, $4)`,
      [req.admin.id, `${status}_adoption`, appId, JSON.stringify({ review_notes })]
    );

    res.json({ message: `Application ${status}` });
  } catch (error) {
    console.error('Update adoption status error:', error);
    res.status(500).json({ error: 'Failed to update application' });
  }
});

// Manually mark payment as completed (Admin)
router.put('/adoptions/:id/payment', async (req, res) => {
  try {
    const appId = req.params.id;
    
    // Get application info
    const appCheck = await db.query(
      `SELECT a.id, a.status, a.pet_id, a.user_id, a.payment_completed, a.paymongo_checkout_id, a.payment_method
       FROM adoption_applications a
       WHERE a.id = $1`,
      [appId]
    );

    if (appCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Application not found' });
    }

    const application = appCheck.rows[0];

    if (application.payment_completed) {
      return res.status(400).json({ error: 'Payment is already marked as completed' });
    }

    if (application.status !== 'approved') {
      return res.status(400).json({ error: 'Only approved applications can have payment completed' });
    }

    // Determine payment method: if a checkout session exists, it's online payment
    const resolvedMethod = application.paymongo_checkout_id ? 'paymongo' : (application.payment_method || 'manual');

    // Update application to mark payment completed.
    // We expose payment_admin_verified as a derived field in SELECTs for schema compatibility.
    await db.query(
      `UPDATE adoption_applications SET 
        payment_completed = true,
        payment_date = COALESCE(payment_date, NOW()),
        payment_method = $2,
        updated_at = NOW()
       WHERE id = $1`,
      [appId, resolvedMethod]
    );

    // Update pet status to adopted
    await db.query('UPDATE pets SET status = $1 WHERE id = $2', ['adopted', application.pet_id]);

    // Send notification to user
    if (application.user_id) {
      const pet = await db.query('SELECT name FROM pets WHERE id = $1', [application.pet_id]);
      const petName = pet.rows[0]?.name || 'your pet';
      
      try {
        await db.query(
          `INSERT INTO notifications (user_id, type, title, message, data) VALUES ($1, $2, $3, $4, $5)`,
          [
            application.user_id, 
            'payment_confirmed', 
            'Payment Confirmed! 🎉', 
            `Your payment for the adoption of ${petName} has been confirmed by the admin!`, 
            JSON.stringify({ adoption_id: appId, pet_id: application.pet_id })
          ]
        );
      } catch (notifError) {
        console.error('Failed to create notification:', notifError);
      }
    }

    // Log activity
    await db.query(
      `INSERT INTO admin_activity_logs (admin_id, action, entity_type, entity_id, details)
       VALUES ($1, 'confirm_payment', 'adoption', $2, $3)`,
      [req.admin.id, appId, JSON.stringify({ previous_status: application.payment_completed })]
    );

    res.json({ success: true, message: 'Payment confirmed successfully' });
  } catch (error) {
    console.error('Confirm payment error:', error);
    res.status(500).json({ error: 'Failed to confirm payment' });
  }
});

// Delete adoption application
router.delete('/adoptions/:id', async (req, res) => {
  try {
    const appId = req.params.id;

    // Get application info for logging
    const appCheck = await db.query(
      `SELECT a.id, a.status, a.pet_id, p.name as pet_name, u.full_name as applicant_name
       FROM adoption_applications a
       JOIN pets p ON a.pet_id = p.id
       LEFT JOIN users u ON a.user_id = u.id
       WHERE a.id = $1`,
      [appId]
    );

    if (appCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Application not found' });
    }

    const application = appCheck.rows[0];

    // If application was pending, reset pet status to available
    if (application.status === 'pending' || application.status === 'reviewing') {
      await db.query('UPDATE pets SET status = $1 WHERE id = $2', ['available', application.pet_id]);
    }

    // Delete the application
    await db.query('DELETE FROM adoption_applications WHERE id = $1', [appId]);

    // Log activity
    await db.query(
      `INSERT INTO admin_activity_logs (admin_id, action, entity_type, entity_id, details)
       VALUES ($1, 'delete_adoption', 'adoption', $2, $3)`,
      [req.admin.id, appId, JSON.stringify({ 
        pet_name: application.pet_name, 
        applicant_name: application.applicant_name,
        previous_status: application.status
      })]
    );

    res.json({ message: 'Application deleted successfully' });
  } catch (error) {
    console.error('Delete adoption error:', error);
    res.status(500).json({ error: 'Failed to delete application' });
  }
});

// ==================== DELIVERY MANAGEMENT ====================

// Get all deliveries (paid adoptions with delivery info)
router.get('/deliveries', async (req, res) => {
  try {
    const { status, limit = 100, offset = 0 } = req.query;

    let query = `
      SELECT a.id, a.status, a.payment_completed, a.payment_amount, a.payment_date,
             a.payment_method, a.paymongo_checkout_id,
             a.delivery_status, a.delivery_full_name, a.delivery_phone,
             a.delivery_address, a.delivery_city, a.delivery_postal_code,
             a.delivery_notes, a.delivery_scheduled_date, a.delivery_actual_date,
             a.delivery_tracking_notes, a.delivery_updated_at,
             p.name as pet_name, p.adoption_fee,
             COALESCE(
               (SELECT image_url FROM pet_images WHERE pet_id = p.id AND is_primary = TRUE LIMIT 1),
               (SELECT image_url FROM pet_images WHERE pet_id = p.id ORDER BY display_order LIMIT 1),
               CASE WHEN p.images IS NOT NULL AND array_length(p.images, 1) > 0 THEN p.images[1] ELSE NULL END
             ) as pet_image,
             u.full_name as applicant_name, u.email as applicant_email
      FROM adoption_applications a
      JOIN pets p ON a.pet_id = p.id
      LEFT JOIN users u ON a.user_id = u.id
      WHERE a.payment_completed = true AND p.shelter_id IS NULL
    `;

    const params = [];
    let paramIndex = 1;

    if (status && status !== 'all') {
      query += ` AND a.delivery_status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    query += ` ORDER BY a.payment_date DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Admin get deliveries error:', error);
    res.status(500).json({ error: 'Failed to get deliveries' });
  }
});

// Get delivery stats
router.get('/deliveries/stats', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        COUNT(*) FILTER (WHERE a.payment_completed = true) as total_deliveries,
        COUNT(*) FILTER (WHERE a.payment_completed = true AND a.delivery_status = 'processing') as processing,
        COUNT(*) FILTER (WHERE a.payment_completed = true AND a.delivery_status = 'preparing') as preparing,
        COUNT(*) FILTER (WHERE a.payment_completed = true AND a.delivery_status = 'out_for_delivery') as out_for_delivery,
        COUNT(*) FILTER (WHERE a.payment_completed = true AND a.delivery_status = 'delivered') as delivered,
        COUNT(*) FILTER (WHERE a.payment_completed = true AND a.delivery_status = 'cancelled') as cancelled,
        COALESCE(SUM(COALESCE(a.payment_amount, p.adoption_fee, 0)) FILTER (WHERE a.payment_completed = true), 0) as total_revenue
      FROM adoption_applications a
      LEFT JOIN pets p ON a.pet_id = p.id
      WHERE p.shelter_id IS NULL
    `);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Delivery stats error:', error);
    res.status(500).json({ error: 'Failed to get delivery stats' });
  }
});

// Update delivery status
router.put('/deliveries/:id/status', async (req, res) => {
  try {
    const { delivery_status, delivery_scheduled_date, delivery_tracking_notes } = req.body;
    const appId = req.params.id;

    const validStatuses = ['processing', 'preparing', 'out_for_delivery', 'delivered', 'cancelled'];
    if (delivery_status && !validStatuses.includes(delivery_status)) {
      return res.status(400).json({ error: 'Invalid delivery status' });
    }

    let updateQuery = `UPDATE adoption_applications SET delivery_updated_at = NOW(), updated_at = NOW()`;
    const params = [];
    let paramIndex = 1;

    if (delivery_status) {
      updateQuery += `, delivery_status = $${paramIndex}`;
      params.push(delivery_status);
      paramIndex++;

      if (delivery_status === 'delivered') {
        updateQuery += `, delivery_actual_date = NOW()`;
      }
    }

    if (delivery_scheduled_date !== undefined) {
      updateQuery += `, delivery_scheduled_date = $${paramIndex}`;
      params.push(delivery_scheduled_date || null);
      paramIndex++;
    }

    if (delivery_tracking_notes !== undefined) {
      updateQuery += `, delivery_tracking_notes = $${paramIndex}`;
      params.push(delivery_tracking_notes || null);
      paramIndex++;
    }

    updateQuery += ` WHERE id = $${paramIndex} AND payment_completed = true RETURNING id, delivery_status, user_id, pet_id`;
    params.push(appId);

    const result = await db.query(updateQuery, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Delivery not found or payment not completed' });
    }

    // Send notification to user about delivery update
    const row = result.rows[0];
    if (row.user_id && delivery_status) {
      const pet = await db.query('SELECT name FROM pets WHERE id = $1', [row.pet_id]);
      const petName = pet.rows[0]?.name || 'your pet';
      const statusLabels = {
        processing: 'is being processed',
        preparing: 'is being prepared for delivery',
        out_for_delivery: 'is on the way to you! 🚗',
        delivered: 'has been delivered! Welcome your new family member! 🎉',
        cancelled: 'delivery has been cancelled',
      };

      try {
        await db.query(
          `INSERT INTO notifications (user_id, type, title, message, data) VALUES ($1, $2, $3, $4, $5)`,
          [
            row.user_id,
            'adoption_update',
            delivery_status === 'delivered' ? 'Pet Delivered! 🎉' : 'Delivery Update',
            `Your adoption of ${petName} ${statusLabels[delivery_status] || 'has been updated'}.`,
            JSON.stringify({ adoption_id: appId, delivery_status }),
          ]
        );
      } catch (notifError) {
        console.error('Failed to create delivery notification:', notifError);
      }
    }

    // Log activity
    await db.query(
      `INSERT INTO admin_activity_logs (admin_id, action, entity_type, entity_id, details)
       VALUES ($1, 'update_delivery', 'adoption', $2, $3)`,
      [req.admin.id, appId, JSON.stringify({ delivery_status, delivery_tracking_notes })]
    );

    res.json({ success: true, message: 'Delivery updated successfully' });
  } catch (error) {
    console.error('Update delivery error:', error);
    res.status(500).json({ error: 'Failed to update delivery' });
  }
});

// ==================== RESCUE MANAGEMENT ====================

// Get all rescue reports
router.get('/rescues', async (req, res) => {
  try {
    const { status, limit = 50, offset = 0 } = req.query;

    let query = `
      SELECT r.id, r.title, r.description, r.animal_type, r.urgency, r.status, 
             r.location_description, r.city, r.images, r.created_at,
             r.reporter_id, r.reporter_name, r.reporter_phone, r.reporter_email,
             r.rescuer_id, r.completion_photo, r.submitted_for_verification_at, r.resolution_notes,
             r.rescuer_adoption_status, r.rescuer_adopted_at, r.rescuer_adoption_notes,
             u.full_name as rescuer_name, u.phone as rescuer_phone, u.email as rescuer_email
      FROM rescue_reports r
      LEFT JOIN users u ON r.rescuer_id = u.id
      WHERE 1=1
    `;

    const params = [];
    let paramIndex = 1;

    if (status && status !== 'all') {
      query += ` AND r.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    query += ` ORDER BY 
      CASE WHEN r.status = 'pending_verification' THEN 0 ELSE 1 END,
      CASE r.urgency WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'normal' THEN 3 ELSE 4 END,
      r.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Admin get rescues error:', error);
    res.status(500).json({ error: 'Failed to get rescue reports' });
  }
});

// Update rescue report status
router.put('/rescues/:id/status', async (req, res) => {
  try {
    const { status, resolution_notes } = req.body;
    const reportId = parseInt(req.params.id);

    const validStatuses = ['new', 'in_progress', 'on_the_way', 'arrived', 'pending_verification', 'rescued', 'closed', 'false_report', 'cannot_complete'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    // Get previous status
    const prev = await db.query('SELECT status FROM rescue_reports WHERE id = $1', [reportId]);
    if (prev.rows.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }
    const previousStatus = prev.rows[0].status;

    // Build dynamic update based on status
    let updateQuery = `UPDATE rescue_reports SET status = $1::VARCHAR, updated_at = NOW()`;
    const params = [status];
    let paramIndex = 2;

    // Add timestamp based on status
    if (status === 'in_progress') {
      updateQuery += `, acknowledged_at = COALESCE(acknowledged_at, NOW())`;
    } else if (status === 'rescued') {
      updateQuery += `, rescued_at = COALESCE(rescued_at, NOW()), verified_at = NOW(), verified_by = ${req.admin.id}`;
    } else if (status === 'closed' || status === 'false_report') {
      updateQuery += `, closed_at = COALESCE(closed_at, NOW())`;
    }

    // Add resolution notes if provided
    if (resolution_notes) {
      updateQuery += `, resolution_notes = $${paramIndex}`;
      params.push(resolution_notes);
      paramIndex++;
    }

    updateQuery += ` WHERE id = $${paramIndex}`;
    params.push(reportId);

    await db.query(updateQuery, params);

    // Log history
    await logRescueHistory(
      reportId,
      'status_changed',
      previousStatus,
      status,
      'admin',
      req.admin.id,
      req.admin.full_name || 'Admin',
      { resolution_notes, changed_by: 'admin_panel' }
    );

    console.log(`Rescue report ${reportId} status updated: ${previousStatus} -> ${status}`);

    res.json({ 
      success: true,
      message: `Report marked as ${status}`,
      previousStatus,
      newStatus: status
    });
  } catch (error) {
    console.error('Update rescue status error:', error);
    res.status(500).json({ error: 'Failed to update report', details: error.message });
  }
});

// Admin verify/approve rescue completion
router.put('/rescues/:id/verify', async (req, res) => {
  try {
    const reportId = parseInt(req.params.id);
    const { action, notes } = req.body; // action: 'approve' or 'reject'

    // Get the rescue report
    const reportResult = await db.query(
      'SELECT * FROM rescue_reports WHERE id = $1',
      [reportId]
    );

    if (reportResult.rows.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const report = reportResult.rows[0];

    if (report.status !== 'pending_verification') {
      return res.status(400).json({ error: 'Report is not pending verification' });
    }

    if (action === 'approve') {
      // Approve the rescue - mark as officially rescued
      await db.query(
        `UPDATE rescue_reports 
         SET status = 'rescued',
             verified_at = NOW(),
             verified_by = $1,
             verification_notes = $2,
             resolved_at = NOW(),
             updated_at = NOW()
         WHERE id = $3`,
        [req.admin.id, notes || 'Approved by admin', reportId]
      );

      // Log admin activity
      await db.query(
        `INSERT INTO admin_activity_logs (admin_id, action, entity_type, entity_id, details)
         VALUES ($1, 'verify_rescue', 'rescue_report', $2, $3)`,
        [req.admin.id, reportId, JSON.stringify({ action: 'approve', notes })]
      );

      // Log rescue history
      await logRescueHistory(
        reportId,
        'verification_approved',
        'pending_verification',
        'rescued',
        'admin',
        req.admin.id,
        req.admin.full_name || 'Admin',
        { notes, action: 'approved' }
      );

      res.json({
        success: true,
        message: 'Rescue verified and approved successfully. The rescue is now officially marked as completed.',
        status: 'rescued'
      });
    } else if (action === 'reject') {
      // Reject - send back to arrived status for rescuer to resubmit
      await db.query(
        `UPDATE rescue_reports 
         SET status = 'arrived',
             verification_notes = $1,
             updated_at = NOW()
         WHERE id = $2`,
        [notes || 'Verification rejected. Please provide clearer proof photo.', reportId]
      );

      // Log admin activity
      await db.query(
        `INSERT INTO admin_activity_logs (admin_id, action, entity_type, entity_id, details)
         VALUES ($1, 'reject_rescue_verification', 'rescue_report', $2, $3)`,
        [req.admin.id, reportId, JSON.stringify({ action: 'reject', notes })]
      );

      // Log rescue history
      await logRescueHistory(
        reportId,
        'verification_rejected',
        'pending_verification',
        'arrived',
        'admin',
        req.admin.id,
        req.admin.full_name || 'Admin',
        { notes, reason: notes || 'Please provide clearer proof photo' }
      );

      res.json({
        success: true,
        message: 'Verification rejected. Rescuer will be notified to resubmit.',
        status: 'arrived'
      });
    } else {
      return res.status(400).json({ error: 'Invalid action. Use "approve" or "reject".' });
    }
  } catch (error) {
    console.error('Verify rescue error:', error);
    res.status(500).json({ error: 'Failed to verify rescue', details: error.message });
  }
});

// Get rescues pending verification
router.get('/rescues/pending-verification', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT r.*, 
             u.full_name as rescuer_name,
             u.phone as rescuer_phone
      FROM rescue_reports r
      LEFT JOIN users u ON r.rescuer_id = u.id
      WHERE r.status = 'pending_verification'
      ORDER BY r.submitted_for_verification_at ASC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Get pending verification error:', error);
    res.status(500).json({ error: 'Failed to get pending verifications' });
  }
});

// Get rescue history/mission logs
router.get('/rescues/:id/history', async (req, res) => {
  try {
    const rescueId = parseInt(req.params.id);

    // Get rescue history
    const historyResult = await db.query(`
      SELECT * FROM rescue_history
      WHERE rescue_id = $1
      ORDER BY created_at DESC
    `, [rescueId]);

    // Also get the rescue report creation as the first event
    const rescueResult = await db.query(`
      SELECT r.created_at, r.reporter_name, r.reporter_id,
             u.full_name as reporter_full_name
      FROM rescue_reports r
      LEFT JOIN users u ON r.reporter_id = u.id
      WHERE r.id = $1
    `, [rescueId]);

    let history = historyResult.rows;

    // Add the creation event if we have rescue data
    if (rescueResult.rows.length > 0) {
      const rescue = rescueResult.rows[0];
      const reporterName = rescue.reporter_full_name || rescue.reporter_name || 'Anonymous';
      
      // Check if 'created' entry already exists
      const hasCreatedEntry = history.some(h => h.action === 'created');
      if (!hasCreatedEntry) {
        history.push({
          id: 0,
          rescue_id: rescueId,
          action: 'created',
          previous_status: null,
          new_status: 'new',
          performed_by_type: rescue.reporter_id ? 'user' : 'guest',
          performed_by_id: rescue.reporter_id,
          performed_by_name: reporterName,
          details: { type: 'initial_report' },
          created_at: rescue.created_at
        });
      }
    }

    // Sort by created_at descending
    history.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    res.json(history);
  } catch (error) {
    console.error('Get rescue history error:', error);
    res.status(500).json({ error: 'Failed to get rescue history' });
  }
});

// Update rescue report details
router.put('/rescues/:id', async (req, res) => {
  try {
    const reportId = parseInt(req.params.id);
    const {
      title,
      description,
      animal_type,
      location_description,
      city,
      urgency,
      status
    } = req.body;

    // Get previous values for history logging
    const prevResult = await db.query('SELECT * FROM rescue_reports WHERE id = $1', [reportId]);
    if (prevResult.rows.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }
    const prevReport = prevResult.rows[0];

    const updateFields = [];
    const params = [];
    let paramIndex = 1;
    const changes = {};

    if (title !== undefined && title !== prevReport.title) {
      updateFields.push(`title = $${paramIndex}`);
      params.push(title);
      paramIndex++;
      changes.title = { from: prevReport.title, to: title };
    }
    if (description !== undefined && description !== prevReport.description) {
      updateFields.push(`description = $${paramIndex}`);
      params.push(description);
      paramIndex++;
      changes.description = { from: prevReport.description?.substring(0, 50), to: description?.substring(0, 50) };
    }
    if (animal_type !== undefined && animal_type !== prevReport.animal_type) {
      updateFields.push(`animal_type = $${paramIndex}`);
      params.push(animal_type);
      paramIndex++;
      changes.animal_type = { from: prevReport.animal_type, to: animal_type };
    }
    if (location_description !== undefined && location_description !== prevReport.location_description) {
      updateFields.push(`location_description = $${paramIndex}`);
      params.push(location_description);
      paramIndex++;
      changes.location_description = { from: prevReport.location_description, to: location_description };
    }
    if (city !== undefined && city !== prevReport.city) {
      updateFields.push(`city = $${paramIndex}`);
      params.push(city);
      paramIndex++;
      changes.city = { from: prevReport.city, to: city };
    }
    if (urgency !== undefined && urgency !== prevReport.urgency) {
      updateFields.push(`urgency = $${paramIndex}`);
      params.push(urgency);
      paramIndex++;
      changes.urgency = { from: prevReport.urgency, to: urgency };
    }
    if (status !== undefined && status !== prevReport.status) {
      updateFields.push(`status = $${paramIndex}::VARCHAR`);
      params.push(status);
      paramIndex++;
      changes.status = { from: prevReport.status, to: status };
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updateFields.push(`updated_at = NOW()`);

    const query = `UPDATE rescue_reports SET ${updateFields.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
    params.push(reportId);

    const result = await db.query(query, params);

    // Log rescue history
    await logRescueHistory(
      reportId,
      'admin_edit',
      prevReport.status,
      status || prevReport.status,
      'admin',
      req.admin.id,
      req.admin.full_name || 'Admin',
      { changes, fields_updated: Object.keys(changes) }
    );

    res.json({
      success: true,
      message: 'Report updated successfully',
      report: result.rows[0]
    });
  } catch (error) {
    console.error('Update rescue report error:', error);
    res.status(500).json({ error: 'Failed to update report', details: error.message });
  }
});

// Delete rescue report
router.delete('/rescues/:id', async (req, res) => {
  try {
    const reportId = parseInt(req.params.id);

    const result = await db.query('DELETE FROM rescue_reports WHERE id = $1 RETURNING id', [reportId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }

    console.log(`Rescue report ${reportId} deleted by admin ${req.admin.id}`);

    res.json({
      success: true,
      message: 'Report deleted successfully'
    });
  } catch (error) {
    console.error('Delete rescue report error:', error);
    res.status(500).json({ error: 'Failed to delete report', details: error.message });
  }
});

// Get rescues with pending rescuer adoption requests
router.get('/rescues/adoption-requests', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT r.id, r.title, r.description, r.animal_type, r.urgency, r.status,
             r.location_description, r.city, r.images, r.created_at,
             r.rescuer_id, r.rescuer_adoption_status, r.rescuer_adopted_at, r.rescuer_adoption_notes,
             u.full_name as rescuer_name, u.phone as rescuer_phone, u.email as rescuer_email
      FROM rescue_reports r
      LEFT JOIN users u ON r.rescuer_id = u.id
      WHERE r.rescuer_adoption_status = 'requested'
      ORDER BY r.rescuer_adopted_at ASC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Get adoption requests error:', error);
    res.status(500).json({ error: 'Failed to get adoption requests' });
  }
});

// Approve or reject rescuer adoption request
router.put('/rescues/:id/adoption-status', async (req, res) => {
  try {
    const reportId = parseInt(req.params.id);
    const { action, notes } = req.body;

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action. Use "approve" or "reject".' });
    }

    // Get the rescue report
    const reportResult = await db.query(
      'SELECT * FROM rescue_reports WHERE id = $1',
      [reportId]
    );

    if (reportResult.rows.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const report = reportResult.rows[0];

    if (report.rescuer_adoption_status !== 'requested') {
      return res.status(400).json({ error: 'No pending adoption request for this rescue.' });
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected';
    const adminNotes = notes || (action === 'approve' 
      ? 'Adoption request approved by admin.' 
      : 'Adoption request rejected by admin.');

    // Update the rescue report
    const result = await db.query(
      `UPDATE rescue_reports 
       SET rescuer_adoption_status = $1,
           rescuer_adoption_notes = $2,
           updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [newStatus, adminNotes, reportId]
    );

    // Log rescue history
    await logRescueHistory(
      reportId,
      action === 'approve' ? 'rescuer_adoption_approved' : 'rescuer_adoption_rejected',
      report.status,
      report.status,
      'admin',
      req.admin.id,
      req.admin.full_name || 'Admin',
      { action, notes: adminNotes, rescuer_id: report.rescuer_id }
    );

    // Get rescuer info for the response
    const rescuerResult = await db.query(
      'SELECT full_name, email, phone FROM users WHERE id = $1',
      [report.rescuer_id]
    );
    const rescuer = rescuerResult.rows[0] || {};

    console.log(`✅ Rescuer adoption ${action}d for rescue ${reportId} by admin ${req.admin.id}`);

    res.json({
      success: true,
      message: action === 'approve' 
        ? `Adoption approved! ${rescuer.full_name || 'Rescuer'} can now adopt the rescued animal.`
        : `Adoption request rejected. ${rescuer.full_name || 'Rescuer'} will be notified.`,
      report: result.rows[0],
      rescuer
    });
  } catch (error) {
    console.error('Update adoption status error:', error);
    res.status(500).json({ error: 'Failed to update adoption status', details: error.message });
  }
});

// ==================== RESCUER APPLICATIONS ====================

// Get all rescuer applications
router.get('/rescuer-applications', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT ra.*, 
             u.email as email,
             u.full_name as user_full_name,
             u.avatar_url
      FROM rescuer_applications ra
      LEFT JOIN users u ON ra.user_id = u.id
      ORDER BY 
        CASE WHEN ra.status = 'pending' THEN 0 ELSE 1 END,
        ra.created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching rescuer applications:', error);
    res.status(500).json({ error: 'Failed to fetch applications' });
  }
});

// Delete a specific rescuer application
router.delete('/rescuer-applications/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await db.query('DELETE FROM rescuer_applications WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Application not found' });
    }
    
    console.log(`Rescuer application ${id} deleted by admin ${req.admin?.id || 'system'}`);
    
    res.json({ success: true, message: 'Application deleted successfully' });
  } catch (error) {
    console.error('Error deleting rescuer application:', error);
    res.status(500).json({ error: 'Failed to delete application' });
  }
});

// Approve rescuer application
router.put('/rescuer-applications/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await db.query(`
      UPDATE rescuer_applications 
      SET status = 'approved', reviewed_at = NOW(), updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Application not found' });
    }

    const application = result.rows[0];

    console.log(`Rescuer application ${id} approved by admin ${req.admin?.id || 'system'}`);

    res.json({ 
      success: true, 
      message: 'Application approved',
      user_id: application.user_id,
      application: application
    });
  } catch (error) {
    console.error('Error approving application:', error);
    res.status(500).json({ error: 'Failed to approve application' });
  }
});

// Reject rescuer application
router.put('/rescuer-applications/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    
    const result = await db.query(`
      UPDATE rescuer_applications 
      SET status = 'rejected', reviewed_at = NOW(), updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Application not found' });
    }

    console.log(`Rescuer application ${id} rejected by admin ${req.admin?.id || 'system'}`);

    res.json({ 
      success: true, 
      message: 'Application rejected',
      user_id: result.rows[0].user_id,
      application: result.rows[0]
    });
  } catch (error) {
    console.error('Error rejecting application:', error);
    res.status(500).json({ error: 'Failed to reject application' });
  }
});

// Remove rescuer verification (revoke approved status)
router.put('/rescuer-applications/:id/revoke', async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    
    const result = await db.query(`
      UPDATE rescuer_applications 
      SET status = 'revoked', 
          revoked_at = NOW(), 
          rejection_reason = $2,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND status = 'approved'
      RETURNING *
    `, [id, reason]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Application not found or not approved' });
    }

    // Update user role back to regular user
    await db.query(
      'UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2',
      ['user', result.rows[0].user_id]
    );

    console.log(`Rescuer application ${id} revoked by admin ${req.admin?.id || 'system'}`);

    res.json({ 
      success: true, 
      message: 'Rescuer verification removed',
      user_id: result.rows[0].user_id,
      application: result.rows[0]
    });
  } catch (error) {
    console.error('Error revoking rescuer application:', error);
    res.status(500).json({ error: 'Failed to revoke rescuer verification' });
  }
});

// Reactivate a revoked rescuer application
router.put('/rescuer-applications/:id/reactivate', async (req, res) => {
  try {
    const { id } = req.params;
    
    // First get the application to find the user_id
    const appResult = await db.query(
      'SELECT * FROM rescuer_applications WHERE id = $1 AND status = $2',
      [id, 'revoked']
    );

    if (appResult.rows.length === 0) {
      return res.status(404).json({ error: 'Application not found or not revoked' });
    }

    const application = appResult.rows[0];

    // Update application status back to approved
    await db.query(`
      UPDATE rescuer_applications 
      SET status = 'approved', 
          revoked_at = NULL,
          rejection_reason = NULL,
          reviewed_at = NOW(), 
          reviewed_by = $1,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [req.admin.id, id]);

    // Update user role back to rescuer
    await db.query(
      'UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2',
      ['rescuer', application.user_id]
    );

    console.log(`Rescuer application ${id} reactivated by admin ${req.admin?.id || 'system'}`);

    res.json({ 
      success: true, 
      message: 'Rescuer verification reactivated',
      user_id: application.user_id
    });
  } catch (error) {
    console.error('Error reactivating rescuer application:', error);
    res.status(500).json({ error: 'Failed to reactivate rescuer verification' });
  }
});

// ==================== SHELTERS MANAGEMENT ====================

// Helper function to get shelter images
const getShelterImages = async (shelterId) => {
  try {
    const result = await db.query(
      'SELECT id, image_data, image_type, display_order, caption, is_primary FROM shelter_images WHERE shelter_id = $1 ORDER BY display_order',
      [shelterId]
    );
    return result.rows;
  } catch (error) {
    console.error('Error getting shelter images:', error);
    return [];
  }
};

// Helper function to save shelter images
const saveShelterImages = async (shelterId, images, imageType = 'gallery') => {
  try {
    // Delete existing images of this type first
    await db.query('DELETE FROM shelter_images WHERE shelter_id = $1 AND image_type = $2', [shelterId, imageType]);
    
    // Insert new images
    for (let i = 0; i < images.length; i++) {
      const image = images[i];
      const imageData = typeof image === 'string' ? image : image.image_data || image.uri;
      
      if (imageData && imageData.startsWith('data:image')) {
        await db.query(
          `INSERT INTO shelter_images (shelter_id, image_data, image_type, display_order, is_primary)
           VALUES ($1, $2, $3, $4, $5)`,
          [shelterId, imageData, imageType, i, i === 0]
        );
      }
    }
    return true;
  } catch (error) {
    console.error('Error saving shelter images:', error);
    return false;
  }
};

// Get all shelters (admin view)
router.get('/shelters', async (req, res) => {
  try {
    const { search, status, verification_status, shelter_type, limit = 50, offset = 0 } = req.query;

    let query = `
      SELECT s.id, s.name, s.description, s.mission_statement, s.shelter_type,
             s.address, s.city, s.province, s.state, s.phone, s.email, s.contact_person_name,
             s.logo_url, s.cover_image_url, s.photos, s.google_maps_url,
             s.logo_image, s.cover_image, s.proof_document_image,
             s.latitude, s.longitude, s.operating_hours,
             s.animals_accepted, s.shelter_capacity, s.current_count, s.services_offered,
             s.proof_document_url, s.proof_document_type,
             s.is_active, s.is_verified, s.verification_status, s.rejection_reason,
             s.verified_at, s.verified_by, s.created_at, s.updated_at,
             (SELECT image_data FROM shelter_images WHERE shelter_id = s.id AND image_type = 'logo' ORDER BY display_order LIMIT 1) as logo_image_data,
             (SELECT image_data FROM shelter_images WHERE shelter_id = s.id AND image_type = 'cover' ORDER BY display_order LIMIT 1) as cover_image_data
      FROM shelters s
      WHERE 1=1
    `;

    const params = [];
    let paramIndex = 1;

    if (search) {
      query += ` AND (name ILIKE $${paramIndex} OR city ILIKE $${paramIndex} OR address ILIKE $${paramIndex} OR contact_person_name ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (status === 'active') {
      query += ` AND is_active = TRUE`;
    } else if (status === 'inactive') {
      query += ` AND is_active = FALSE`;
    }

    if (verification_status && verification_status !== 'all') {
      query += ` AND verification_status = $${paramIndex}`;
      params.push(verification_status);
      paramIndex++;
    }

    if (shelter_type && shelter_type !== 'all') {
      query += ` AND shelter_type = $${paramIndex}`;
      params.push(shelter_type);
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Admin get shelters error:', error);
    res.status(500).json({ error: 'Failed to get shelters' });
  }
});

// Get single shelter with images
router.get('/shelters/:id', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT s.*, 
              (SELECT image_data FROM shelter_images WHERE shelter_id = s.id AND image_type = 'logo' ORDER BY display_order LIMIT 1) as logo_image_data,
              (SELECT image_data FROM shelter_images WHERE shelter_id = s.id AND image_type = 'cover' ORDER BY display_order LIMIT 1) as cover_image_data
       FROM shelters s WHERE s.id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Shelter not found' });
    }

    // Get all gallery images
    const images = await getShelterImages(req.params.id);
    const shelter = result.rows[0];
    shelter.gallery_images = images.filter(img => img.image_type === 'gallery');
    
    // Use image from shelter_images table if available, fallback to direct columns
    if (!shelter.logo_image && shelter.logo_image_data) {
      shelter.logo_image = shelter.logo_image_data;
    }
    if (!shelter.cover_image && shelter.cover_image_data) {
      shelter.cover_image = shelter.cover_image_data;
    }

    res.json(shelter);
  } catch (error) {
    console.error('Get shelter error:', error);
    res.status(500).json({ error: 'Failed to get shelter' });
  }
});

// Get pets for a specific shelter (admin view)
router.get('/shelters/:id/pets', async (req, res) => {
  try {
    const shelterId = req.params.id;
    
    // First verify the shelter exists
    const shelterCheck = await db.query('SELECT id, name FROM shelters WHERE id = $1', [shelterId]);
    if (shelterCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Shelter not found' });
    }

    // Get all pets associated with this shelter from the pets table
    const petsResult = await db.query(`
      SELECT 
        p.id,
        p.name,
        pc.name as species,
        p.breed_name,
        COALESCE(b.name, p.breed_name) as breed,
        p.age_years,
        p.age_months,
        CASE 
          WHEN p.age_years > 0 THEN p.age_years || ' year' || CASE WHEN p.age_years > 1 THEN 's' ELSE '' END
          WHEN p.age_months > 0 THEN p.age_months || ' month' || CASE WHEN p.age_months > 1 THEN 's' ELSE '' END
          ELSE 'Unknown'
        END as age_display,
        p.gender,
        p.size,
        p.color,
        p.status,
        p.is_featured,
        p.description,
        p.created_at,
        p.updated_at,
        (SELECT image_url FROM pet_images WHERE pet_id = p.id AND is_primary = TRUE LIMIT 1) as primary_image,
        (SELECT ARRAY_AGG(image_url) FROM pet_images WHERE pet_id = p.id) as images,
        'pet' as source_type
      FROM pets p
      LEFT JOIN breeds b ON p.breed_id = b.id
      LEFT JOIN pet_categories pc ON p.category_id = pc.id
      WHERE p.shelter_id = $1
      ORDER BY 
        CASE p.status 
          WHEN 'available' THEN 0 
          WHEN 'pending' THEN 1 
          ELSE 2 
        END,
        p.created_at DESC
    `, [shelterId]);

    // Get transferred rescue animals (completed transfers to this shelter)
    const transferredResult = await db.query(`
      SELECT 
        rr.id,
        COALESCE(rr.title, 'Rescued Animal #' || rr.id) as name,
        COALESCE(rr.animal_type, str.animal_type, 'Unknown') as species,
        NULL as breed_name,
        NULL as breed,
        NULL as age_years,
        NULL as age_months,
        'Unknown' as age_display,
        NULL as gender,
        NULL as size,
        COALESCE(rr.condition, str.animal_condition) as color,
        'transferred' as status,
        false as is_featured,
        COALESCE(rr.description, str.animal_description) as description,
        str.completed_at as created_at,
        str.updated_at,
        CASE 
          WHEN rr.images IS NOT NULL AND array_length(rr.images, 1) > 0 
          THEN rr.images[1] 
          WHEN str.images IS NOT NULL AND array_length(str.images, 1) > 0 
          THEN str.images[1]
          ELSE NULL 
        END as primary_image,
        COALESCE(rr.images, str.images) as images,
        'rescue_transfer' as source_type,
        str.id as transfer_request_id,
        str.notes as transfer_notes,
        u.full_name as transferred_by
      FROM shelter_transfer_requests str
      LEFT JOIN rescue_reports rr ON str.rescue_report_id = rr.id
      LEFT JOIN users u ON str.requester_id = u.id
      WHERE str.shelter_id = $1 
        AND str.status = 'completed'
      ORDER BY str.completed_at DESC
    `, [shelterId]);

    // Combine both results
    const allPets = [...petsResult.rows, ...transferredResult.rows];

    res.json({
      shelter: shelterCheck.rows[0],
      pets: allPets,
      total: allPets.length,
      from_pets_table: petsResult.rows.length,
      from_transfers: transferredResult.rows.length
    });
  } catch (error) {
    console.error('Get shelter pets error:', error);
    res.status(500).json({ error: 'Failed to get shelter pets' });
  }
});

// Create new shelter with image support
router.post('/shelters', async (req, res) => {
  try {
    const {
      // Basic Information
      name, shelter_type, description, mission_statement,
      // Location & Contact
      address, city, province, state, contact_person_name, phone, email,
      google_maps_url, latitude, longitude,
      // Operations & Services
      animals_accepted, shelter_capacity, current_count, services_offered, operating_hours,
      // Media - Support both URL and base64
      logo_url, cover_image_url, photos,
      logo_image, cover_image, proof_document_image, gallery_images,
      // Verification
      proof_document_url, proof_document_type,
      // Status
      is_active, verification_status
    } = req.body;

    console.log('Creating shelter:', name);
    console.log('Logo image provided:', logo_image ? 'Yes (base64)' : 'No');
    console.log('Cover image provided:', cover_image ? 'Yes (base64)' : 'No');

    if (!name || !address) {
      return res.status(400).json({ error: 'Name and address are required' });
    }

    // Determine final image values - prefer base64 images, fallback to URLs
    const finalLogoUrl = logo_image || logo_url || null;
    const finalCoverUrl = cover_image || cover_image_url || null;
    const finalProofUrl = proof_document_image || proof_document_url || null;

    const result = await db.query(
      `INSERT INTO shelters (
        name, shelter_type, description, mission_statement,
        address, city, province, state, contact_person_name, phone, email,
        google_maps_url, latitude, longitude,
        animals_accepted, shelter_capacity, current_count, services_offered, operating_hours,
        logo_url, cover_image_url, photos,
        logo_image, cover_image, proof_document_image,
        proof_document_url, proof_document_type,
        is_active, is_verified, verification_status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30)
      RETURNING *`,
      [
        name,
        shelter_type || 'private',
        description,
        mission_statement,
        address,
        city,
        province,
        state,
        contact_person_name,
        phone,
        email,
        google_maps_url,
        latitude,
        longitude,
        animals_accepted || ['dogs', 'cats'],
        shelter_capacity || 0,
        current_count || 0,
        services_offered || [],
        operating_hours,
        finalLogoUrl,
        finalCoverUrl,
        photos || [],
        logo_image || null,
        cover_image || null,
        proof_document_image || null,
        finalProofUrl,
        proof_document_type,
        is_active !== false,
        verification_status === 'verified',
        verification_status || 'pending'
      ]
    );

    const shelterId = result.rows[0].id;
    console.log('Shelter created with ID:', shelterId);

    // Save images to shelter_images table as well for redundancy
    if (logo_image && logo_image.startsWith('data:image')) {
      await saveShelterImages(shelterId, [logo_image], 'logo');
      console.log('Logo image saved to shelter_images table');
    }
    if (cover_image && cover_image.startsWith('data:image')) {
      await saveShelterImages(shelterId, [cover_image], 'cover');
      console.log('Cover image saved to shelter_images table');
    }
    if (proof_document_image && proof_document_image.startsWith('data:image')) {
      await saveShelterImages(shelterId, [proof_document_image], 'proof');
      console.log('Proof document saved to shelter_images table');
    }
    if (gallery_images && Array.isArray(gallery_images) && gallery_images.length > 0) {
      await saveShelterImages(shelterId, gallery_images, 'gallery');
      console.log('Gallery images saved:', gallery_images.length);
    }

    // Log activity
    await db.query(
      `INSERT INTO admin_activity_logs (admin_id, action, entity_type, entity_id, details)
       VALUES ($1, 'create_shelter', 'shelter', $2, $3)`,
      [req.admin.id, shelterId, JSON.stringify({ name, shelter_type: shelter_type || 'private' })]
    );

    res.status(201).json({ message: 'Shelter created successfully', shelter: result.rows[0] });
  } catch (error) {
    console.error('Create shelter error:', error);
    res.status(500).json({ error: 'Failed to create shelter' });
  }
});

// Update shelter with image support
router.put('/shelters/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      // Basic Information
      name, shelter_type, description, mission_statement,
      // Location & Contact
      address, city, province, state, contact_person_name, phone, email,
      google_maps_url, latitude, longitude,
      // Operations & Services
      animals_accepted, shelter_capacity, current_count, services_offered, operating_hours,
      // Media - Support both URL and base64
      logo_url, cover_image_url, photos,
      logo_image, cover_image, proof_document_image, gallery_images,
      // Verification
      proof_document_url, proof_document_type,
      // Status
      is_active, verification_status
    } = req.body;

    console.log('Updating shelter:', id);
    console.log('Logo image provided:', logo_image ? 'Yes (base64)' : 'No');
    console.log('Cover image provided:', cover_image ? 'Yes (base64)' : 'No');

    // Determine final image values
    const finalLogoUrl = logo_image || logo_url;
    const finalCoverUrl = cover_image || cover_image_url;
    const finalProofUrl = proof_document_image || proof_document_url;

    const result = await db.query(
      `UPDATE shelters SET
        name = COALESCE($1, name),
        shelter_type = COALESCE($2, shelter_type),
        description = COALESCE($3, description),
        mission_statement = COALESCE($4, mission_statement),
        address = COALESCE($5, address),
        city = COALESCE($6, city),
        province = COALESCE($7, province),
        state = COALESCE($8, state),
        contact_person_name = COALESCE($9, contact_person_name),
        phone = COALESCE($10, phone),
        email = COALESCE($11, email),
        google_maps_url = COALESCE($12, google_maps_url),
        latitude = COALESCE($13, latitude),
        longitude = COALESCE($14, longitude),
        animals_accepted = COALESCE($15, animals_accepted),
        shelter_capacity = COALESCE($16, shelter_capacity),
        current_count = COALESCE($17, current_count),
        services_offered = COALESCE($18, services_offered),
        operating_hours = COALESCE($19, operating_hours),
        logo_url = COALESCE($20, logo_url),
        cover_image_url = COALESCE($21, cover_image_url),
        photos = COALESCE($22, photos),
        logo_image = COALESCE($23, logo_image),
        cover_image = COALESCE($24, cover_image),
        proof_document_image = COALESCE($25, proof_document_image),
        proof_document_url = COALESCE($26, proof_document_url),
        proof_document_type = COALESCE($27, proof_document_type),
        is_active = COALESCE($28, is_active),
        verification_status = COALESCE($29, verification_status),
        updated_at = NOW()
      WHERE id = $30
      RETURNING *`,
      [
        name, shelter_type, description, mission_statement,
        address, city, province, state, contact_person_name, phone, email,
        google_maps_url, latitude, longitude,
        animals_accepted, shelter_capacity, current_count, services_offered, operating_hours,
        finalLogoUrl, finalCoverUrl, photos,
        logo_image || null, cover_image || null, proof_document_image || null,
        finalProofUrl, proof_document_type,
        is_active, verification_status, id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Shelter not found' });
    }

    // Update shelter_images table
    if (logo_image && logo_image.startsWith('data:image')) {
      await saveShelterImages(id, [logo_image], 'logo');
      console.log('Logo image updated in shelter_images table');
    }
    if (cover_image && cover_image.startsWith('data:image')) {
      await saveShelterImages(id, [cover_image], 'cover');
      console.log('Cover image updated in shelter_images table');
    }
    if (proof_document_image && proof_document_image.startsWith('data:image')) {
      await saveShelterImages(id, [proof_document_image], 'proof');
      console.log('Proof document updated in shelter_images table');
    }
    if (gallery_images && Array.isArray(gallery_images) && gallery_images.length > 0) {
      await saveShelterImages(id, gallery_images, 'gallery');
      console.log('Gallery images updated:', gallery_images.length);
    }

    // Log activity
    await db.query(
      `INSERT INTO admin_activity_logs (admin_id, action, entity_type, entity_id, details)
       VALUES ($1, 'update_shelter', 'shelter', $2, $3)`,
      [req.admin.id, id, JSON.stringify({ name: result.rows[0].name })]
    );

    res.json({ message: 'Shelter updated successfully', shelter: result.rows[0] });
  } catch (error) {
    console.error('Update shelter error:', error);
    res.status(500).json({ error: 'Failed to update shelter' });
  }
});

// Delete shelter (permanently removes from database)
router.delete('/shelters/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // First get the shelter name for logging
    const shelterCheck = await db.query('SELECT name FROM shelters WHERE id = $1', [id]);
    
    if (shelterCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Shelter not found' });
    }
    
    const shelterName = shelterCheck.rows[0].name;

    // Delete the shelter permanently
    await db.query('DELETE FROM shelters WHERE id = $1', [id]);

    // Log activity
    await db.query(
      `INSERT INTO admin_activity_logs (admin_id, action, entity_type, entity_id, details)
       VALUES ($1, 'delete_shelter', 'shelter', $2, $3)`,
      [req.admin.id, id, JSON.stringify({ name: shelterName, action: 'permanently_deleted' })]
    );

    res.json({ message: 'Shelter deleted permanently' });
  } catch (error) {
    console.error('Delete shelter error:', error);
    res.status(500).json({ error: 'Failed to delete shelter' });
  }
});

// Update shelter verification status
router.patch('/shelters/:id/verify', async (req, res) => {
  try {
    const { id } = req.params;
    const { verification_status, rejection_reason } = req.body;

    let updateQuery = `
      UPDATE shelters SET
        verification_status = $1,
        is_verified = $2,
        updated_at = NOW()
    `;
    let params = [verification_status, verification_status === 'verified'];

    if (verification_status === 'verified') {
      updateQuery += `, verified_at = NOW(), verified_by = $3, rejection_reason = NULL WHERE id = $4`;
      params.push(req.admin.id, id);
    } else if (verification_status === 'rejected') {
      updateQuery += `, rejection_reason = $3, verified_at = NULL, verified_by = NULL WHERE id = $4`;
      params.push(rejection_reason || 'No reason provided', id);
    } else {
      updateQuery += `, rejection_reason = NULL, verified_at = NULL, verified_by = NULL WHERE id = $3`;
      params.push(id);
    }

    updateQuery += ' RETURNING *';

    const result = await db.query(updateQuery, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Shelter not found' });
    }

    // Log activity
    await db.query(
      `INSERT INTO admin_activity_logs (admin_id, action, entity_type, entity_id, details)
       VALUES ($1, 'verify_shelter', 'shelter', $2, $3)`,
      [req.admin.id, id, JSON.stringify({ verification_status, name: result.rows[0].name })]
    );

    res.json({ 
      message: `Shelter ${verification_status} successfully`, 
      shelter: result.rows[0] 
    });
  } catch (error) {
    console.error('Verify shelter error:', error);
    res.status(500).json({ error: 'Failed to update shelter verification' });
  }
});

// ==================== NOTIFICATIONS ====================

// Create notification
router.post('/notifications', async (req, res) => {
  try {
    const { user_id, type, title, message } = req.body;
    
    const result = await db.query(`
      INSERT INTO notifications (user_id, type, title, message)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [user_id, type, title, message]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating notification:', error);
    res.status(500).json({ error: 'Failed to create notification' });
  }
});

// ==================== DELIVERY MANAGEMENT ====================

// Get all deliveries (paid adoptions with delivery info)
router.get('/deliveries', async (req, res) => {
  try {
    const { status, limit = 50, offset = 0 } = req.query;

    let query = `
      SELECT a.id, a.status as adoption_status, a.submitted_at, a.approved_at,
             a.payment_completed, a.payment_amount, a.payment_date,
             a.delivery_full_name, a.delivery_phone, a.delivery_address,
             a.delivery_city, a.delivery_postal_code, a.delivery_notes,
             a.delivery_status, a.delivery_scheduled_date, a.delivery_actual_date,
             a.delivery_tracking_notes, a.delivery_updated_at,
             u.id as user_id, u.full_name as applicant_name, u.email as applicant_email, u.phone as applicant_phone,
             p.id as pet_id, p.name as pet_name,
             pc.name as species,
             COALESCE(b.name, p.breed_name) as breed,
             COALESCE(
               (SELECT image_url FROM pet_images WHERE pet_id = p.id AND is_primary = TRUE LIMIT 1),
               (SELECT image_url FROM pet_images WHERE pet_id = p.id ORDER BY display_order LIMIT 1),
               CASE WHEN p.images IS NOT NULL AND array_length(p.images, 1) > 0 THEN p.images[1] ELSE NULL END
             ) as pet_image,
             s.name as shelter_name
      FROM adoption_applications a
      JOIN users u ON a.user_id = u.id
      JOIN pets p ON a.pet_id = p.id
      LEFT JOIN pet_categories pc ON p.category_id = pc.id
      LEFT JOIN breeds b ON p.breed_id = b.id
      LEFT JOIN shelters s ON p.shelter_id = s.id
      WHERE a.payment_completed = true
    `;

    const params = [];
    let paramIndex = 1;

    if (status && status !== 'all') {
      query += ` AND a.delivery_status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    query += ` ORDER BY 
      CASE a.delivery_status 
        WHEN 'processing' THEN 1 
        WHEN 'preparing' THEN 2 
        WHEN 'out_for_delivery' THEN 3 
        WHEN 'delivered' THEN 4 
        ELSE 5 
      END,
      a.payment_date DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Admin get deliveries error:', error);
    res.status(500).json({ error: 'Failed to get deliveries' });
  }
});

// Get delivery stats
router.get('/deliveries/stats', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        COUNT(*) FILTER (WHERE payment_completed = true) as total_deliveries,
        COUNT(*) FILTER (WHERE delivery_status = 'processing') as processing,
        COUNT(*) FILTER (WHERE delivery_status = 'preparing') as preparing,
        COUNT(*) FILTER (WHERE delivery_status = 'out_for_delivery') as out_for_delivery,
        COUNT(*) FILTER (WHERE delivery_status = 'delivered') as delivered,
        COALESCE(SUM(payment_amount) FILTER (WHERE payment_completed = true), 0) as total_revenue
      FROM adoption_applications
      WHERE payment_completed = true
    `);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Admin get delivery stats error:', error);
    res.status(500).json({ error: 'Failed to get delivery stats' });
  }
});

// Update delivery status
router.put('/deliveries/:id/status', async (req, res) => {
  try {
    const { delivery_status, delivery_scheduled_date, delivery_tracking_notes } = req.body;
    const applicationId = req.params.id;

    const validStatuses = ['processing', 'preparing', 'out_for_delivery', 'delivered', 'cancelled'];
    if (!validStatuses.includes(delivery_status)) {
      return res.status(400).json({ error: 'Invalid delivery status' });
    }

    // Get current application
    const appCheck = await db.query(
      'SELECT id, payment_completed, user_id FROM adoption_applications WHERE id = $1',
      [applicationId]
    );

    if (appCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Application not found' });
    }

    if (!appCheck.rows[0].payment_completed) {
      return res.status(400).json({ error: 'Cannot update delivery status - payment not completed' });
    }

    // Build update query
    let updateFields = ['delivery_status = $1', 'delivery_updated_at = NOW()', 'updated_at = NOW()'];
    let params = [delivery_status];
    let paramIndex = 2;

    if (delivery_scheduled_date) {
      updateFields.push(`delivery_scheduled_date = $${paramIndex}`);
      params.push(delivery_scheduled_date);
      paramIndex++;
    }

    if (delivery_tracking_notes) {
      updateFields.push(`delivery_tracking_notes = $${paramIndex}`);
      params.push(delivery_tracking_notes);
      paramIndex++;
    }

    if (delivery_status === 'delivered') {
      updateFields.push('delivery_actual_date = NOW()');
    }

    params.push(applicationId);
    const query = `UPDATE adoption_applications SET ${updateFields.join(', ')} WHERE id = $${paramIndex} RETURNING *`;

    const result = await db.query(query, params);

    // Create notification for user
    const statusMessages = {
      processing: 'Your adoption order is being processed.',
      preparing: 'Your new pet is being prepared for delivery!',
      out_for_delivery: 'Great news! Your pet is out for delivery and will arrive soon!',
      delivered: 'Your pet has been delivered! Welcome your new family member!',
    };

    if (statusMessages[delivery_status]) {
      await db.query(
        `INSERT INTO notifications (user_id, type, title, message)
         VALUES ($1, 'delivery_update', 'Delivery Update', $2)`,
        [appCheck.rows[0].user_id, statusMessages[delivery_status]]
      );
    }

    // Log admin activity
    await db.query(
      `INSERT INTO admin_activity_logs (admin_id, action, entity_type, entity_id, details)
       VALUES ($1, $2, 'delivery', $3, $4)`,
      [req.admin.id, `update_delivery_${delivery_status}`, applicationId, JSON.stringify({ delivery_status, delivery_tracking_notes })]
    );

    res.json({ 
      success: true, 
      message: `Delivery status updated to ${delivery_status}`,
      delivery: result.rows[0]
    });
  } catch (error) {
    console.error('Update delivery status error:', error);
    res.status(500).json({ error: 'Failed to update delivery status' });
  }
});

// ==================== ADMIN ACCOUNT MANAGEMENT ====================

// Change admin password
router.post('/change-password', async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const adminId = req.admin.id;

    // Validate inputs
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ 
        success: false,
        message: 'Current password and new password are required' 
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ 
        success: false,
        message: 'New password must be at least 6 characters long' 
      });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({ 
        success: false,
        message: 'New password must be different from current password' 
      });
    }

    // Get current admin password hash
    const adminResult = await db.query(
      'SELECT password_hash FROM admins WHERE id = $1',
      [adminId]
    );

    if (adminResult.rows.length === 0) {
      return res.status(404).json({ 
        success: false,
        message: 'Admin not found' 
      });
    }

    // Verify current password
    const bcrypt = require('bcrypt');
    const isPasswordValid = await bcrypt.compare(currentPassword, adminResult.rows[0].password_hash);

    if (!isPasswordValid) {
      return res.status(401).json({ 
        success: false,
        message: 'Current password is incorrect' 
      });
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, 12);

    // Update password
    await db.query(
      'UPDATE admins SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [newPasswordHash, adminId]
    );

    console.log(`Admin password changed: adminId=${adminId}, email=${req.admin.email}`);

    res.json({ 
      success: true, 
      message: 'Password changed successfully' 
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to change password' 
    });
  }
});

module.exports = router;
