const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { logger } = require('../config/logger');
const { createPaymentTransaction } = require('../utils/paymentTransactions');
const { retrieveCheckoutSession } = require('../config/paymongo');

let paymentTransactionsTableCache = null;
let paymentTransactionsTableCheckedAt = 0;

const hasPaymentTransactionsTable = async () => {
  const now = Date.now();
  if (paymentTransactionsTableCache !== null && (now - paymentTransactionsTableCheckedAt) < 30000) {
    return paymentTransactionsTableCache;
  }

  try {
    const result = await db.query(`SELECT to_regclass('public.payment_transactions') AS table_name`);
    paymentTransactionsTableCache = Boolean(result.rows[0]?.table_name);
    paymentTransactionsTableCheckedAt = now;
    return paymentTransactionsTableCache;
  } catch (error) {
    logger.warn('Could not check payment_transactions table existence', { error: error.message });
    paymentTransactionsTableCache = false;
    paymentTransactionsTableCheckedAt = now;
    return false;
  }
};

const createPaymentTransactionSafe = async (payload) => {
  try {
    const hasTable = await hasPaymentTransactionsTable();
    if (!hasTable) {
      logger.warn('Skipping payment transaction insert because payment_transactions table is missing');
      return null;
    }

    return await createPaymentTransaction(payload);
  } catch (error) {
    if (error?.message && error.message.includes('relation "payment_transactions" does not exist')) {
      paymentTransactionsTableCache = false;
      logger.warn('Skipping payment transaction insert because table is missing at runtime');
      return null;
    }

    throw error;
  }
};

// Input sanitisation helpers
const sanitizeString = (val, maxLen = 500) => {
  if (val === null || val === undefined) return null;
  return String(val).trim().slice(0, maxLen);
};

const isPayMongoSessionPaid = (session) => {
  const status = String(session?.attributes?.status || '').toLowerCase();
  if (status === 'paid' || status === 'succeeded') {
    return true;
  }

  // Some checkout responses expose nested payment objects instead of a final session status.
  const payments = Array.isArray(session?.attributes?.payments) ? session.attributes.payments : [];
  return payments.some((payment) => {
    const paymentStatus = String(payment?.attributes?.status || payment?.status || '').toLowerCase();
    return paymentStatus === 'paid' || paymentStatus === 'succeeded';
  });
};

// Middleware: verify user is an approved shelter manager
const verifyShelterManager = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Check if user has an approved shelter application with a created shelter
    const result = await db.query(
      `SELECT sa.created_shelter_id, s.id as shelter_id, s.name as shelter_name
       FROM shelter_applications sa
       JOIN shelters s ON s.id = sa.created_shelter_id
       WHERE sa.user_id = $1 AND sa.status = 'approved' AND sa.created_shelter_id IS NOT NULL
       ORDER BY sa.created_at DESC LIMIT 1`,
      [userId]
    );

    // Also check via managed_shelter_id on users table
    if (result.rows.length === 0) {
      const userResult = await db.query(
        `SELECT u.managed_shelter_id, s.id as shelter_id, s.name as shelter_name
         FROM users u
         JOIN shelters s ON s.id = u.managed_shelter_id
         WHERE u.id = $1 AND u.managed_shelter_id IS NOT NULL`,
        [userId]
      );

      if (userResult.rows.length === 0) {
        return res.status(403).json({ error: 'You are not a shelter manager' });
      }

      req.shelter = {
        id: userResult.rows[0].shelter_id,
        name: userResult.rows[0].shelter_name,
      };
      return next();
    }

    req.shelter = {
      id: result.rows[0].shelter_id,
      name: result.rows[0].shelter_name,
    };
    next();
  } catch (error) {
    logger.error('Error verifying shelter manager:', { error: error.message, userId: req.user?.id });
    res.status(500).json({ error: 'Failed to verify shelter manager status' });
  }
};

// GET shelter manager status (check if user manages a shelter)
router.get('/status', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Check via shelter applications
    const appResult = await db.query(
      `SELECT sa.*, s.name as shelter_name
       FROM shelter_applications sa
       LEFT JOIN shelters s ON s.id = sa.created_shelter_id
       WHERE sa.user_id = $1
       ORDER BY sa.created_at DESC LIMIT 1`,
      [userId]
    );

    // Check via managed_shelter_id
    const userResult = await db.query(
      `SELECT managed_shelter_id FROM users WHERE id = $1`,
      [userId]
    );

    const managedShelterId = userResult.rows[0]?.managed_shelter_id;

    if (appResult.rows.length > 0 && appResult.rows[0].status === 'approved' && appResult.rows[0].created_shelter_id) {
      return res.json({
        isManager: true,
        shelterId: appResult.rows[0].created_shelter_id,
        shelterName: appResult.rows[0].shelter_name,
      });
    }

    if (managedShelterId) {
      const shelterResult = await db.query('SELECT id, name FROM shelters WHERE id = $1', [managedShelterId]);
      if (shelterResult.rows.length > 0) {
        return res.json({
          isManager: true,
          shelterId: shelterResult.rows[0].id,
          shelterName: shelterResult.rows[0].name,
        });
      }
    }

    res.json({ isManager: false });
  } catch (error) {
    logger.error('Error checking shelter manager status:', { error: error.message });
    res.status(500).json({ error: 'Failed to check manager status' });
  }
});

// GET managed shelter details
router.get('/my-shelter', authenticateToken, verifyShelterManager, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT s.*, 
        (SELECT COUNT(*) FROM pets WHERE shelter_id = s.id) as pet_count,
        (SELECT COUNT(*) FROM pets WHERE shelter_id = s.id AND status = 'available') as available_pet_count
       FROM shelters s WHERE s.id = $1`,
      [req.shelter.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Shelter not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Error fetching managed shelter:', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch shelter details' });
  }
});

// PUT update managed shelter info
router.put('/my-shelter', authenticateToken, verifyShelterManager, async (req, res) => {
  try {
    const {
      name, description, address, city, state, phone, email,
      operating_hours, shelter_capacity, animals_accepted, services_offered,
      mission_statement, contact_person_name, logo_image, cover_image,
    } = req.body;

    // Basic input validation
    if (name !== undefined && (typeof name !== 'string' || name.trim().length < 2 || name.length > 200)) {
      return res.status(400).json({ error: 'Name must be 2-200 characters' });
    }
    if (email !== undefined && email !== null && email !== '') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ error: 'Invalid email format' });
      }
    }
    if (phone !== undefined && phone !== null && phone !== '') {
      const phoneRegex = /^(\+63|0)?[0-9]{10,11}$/;
      if (!phoneRegex.test(phone)) {
        return res.status(400).json({ error: 'Invalid phone format' });
      }
    }
    if (shelter_capacity !== undefined && shelter_capacity !== null) {
      const cap = parseInt(shelter_capacity);
      if (isNaN(cap) || cap < 0 || cap > 10000) {
        return res.status(400).json({ error: 'Shelter capacity must be between 0 and 10,000' });
      }
    }
    if (description !== undefined && description !== null && description.length > 2000) {
      return res.status(400).json({ error: 'Description cannot exceed 2000 characters' });
    }
    if (address !== undefined && address !== null && address.length > 500) {
      return res.status(400).json({ error: 'Address cannot exceed 500 characters' });
    }

    const result = await db.query(`
      UPDATE shelters SET
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        address = COALESCE($3, address),
        city = COALESCE($4, city),
        state = COALESCE($5, state),
        phone = COALESCE($6, phone),
        email = COALESCE($7, email),
        operating_hours = COALESCE($8, operating_hours),
        shelter_capacity = COALESCE($9, shelter_capacity),
        animals_accepted = COALESCE($10, animals_accepted),
        services_offered = COALESCE($11, services_offered),
        mission_statement = COALESCE($12, mission_statement),
        contact_person_name = COALESCE($13, contact_person_name),
        logo_image = COALESCE($14, logo_image),
        cover_image = COALESCE($15, cover_image),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $16
      RETURNING *
    `, [
      sanitizeString(name, 200), sanitizeString(description, 2000),
      sanitizeString(address, 500), sanitizeString(city, 100),
      sanitizeString(state, 100), sanitizeString(phone, 20),
      sanitizeString(email, 255),
      sanitizeString(operating_hours, 500), shelter_capacity,
      animals_accepted, services_offered,
      sanitizeString(mission_statement, 2000),
      sanitizeString(contact_person_name, 100),
      logo_image, cover_image,
      req.shelter.id
    ]);

    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Error updating shelter:', { error: error.message });
    res.status(500).json({ error: 'Failed to update shelter' });
  }
});

// GET pets in managed shelter
router.get('/pets', authenticateToken, verifyShelterManager, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT p.*,
        COALESCE(
          (SELECT pi.image_url FROM pet_images pi WHERE pi.pet_id = p.id AND pi.is_primary = TRUE LIMIT 1),
          (SELECT pi.image_url FROM pet_images pi WHERE pi.pet_id = p.id ORDER BY pi.display_order LIMIT 1),
          CASE WHEN p.images IS NOT NULL AND array_length(p.images, 1) > 0 THEN p.images[1] ELSE NULL END
        ) as image,
        pc.name as category_name
       FROM pets p
       LEFT JOIN pet_categories pc ON pc.id = p.category_id
       WHERE p.shelter_id = $1
       ORDER BY p.created_at DESC`,
      [req.shelter.id]
    );

    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('Error fetching shelter pets:', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch shelter pets' });
  }
});

// Allowlist for pet update fields (shelter manager)
const ALLOWED_PET_UPDATE_FIELDS = {
  name: { type: 'string', maxLen: 100 },
  category_id: { type: 'integer' },
  breed_name: { type: 'string', maxLen: 100 },
  age_years: { type: 'integer' },
  age_months: { type: 'integer' },
  gender: { type: 'string', maxLen: 10 },
  size: { type: 'string', maxLen: 20 },
  weight_kg: { type: 'number' },
  color: { type: 'string', maxLen: 100 },
  description: { type: 'text', maxLen: 2000 },
  medical_history: { type: 'text', maxLen: 2000 },
  vaccination_status: { type: 'string', maxLen: 50 },
  is_neutered: { type: 'boolean' },
  is_house_trained: { type: 'boolean' },
  is_good_with_kids: { type: 'boolean' },
  is_good_with_other_pets: { type: 'boolean' },
  special_needs: { type: 'text', maxLen: 2000 },
  status: { type: 'string', maxLen: 30 },
  location: { type: 'string', maxLen: 255 },
  adoption_fee: { type: 'number' },
};

// PUT update a pet in managed shelter
router.put('/pets/:id', authenticateToken, verifyShelterManager, async (req, res) => {
  try {
    const petId = parseInt(req.params.id);
    if (isNaN(petId)) {
      return res.status(400).json({ error: 'Invalid pet ID' });
    }

    // Verify pet belongs to this shelter
    const petCheck = await db.query(
      'SELECT id FROM pets WHERE id = $1 AND shelter_id = $2',
      [petId, req.shelter.id]
    );
    if (petCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Pet not found in your shelter' });
    }

    const { images, ...updates } = req.body;

    // Build dynamic update from allowlisted fields
    const setClauses = [];
    const values = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (!ALLOWED_PET_UPDATE_FIELDS[key]) continue;
      const spec = ALLOWED_PET_UPDATE_FIELDS[key];

      let sanitized = value;
      if (spec.type === 'string' || spec.type === 'text') {
        sanitized = sanitizeString(value, spec.maxLen);
      } else if (spec.type === 'integer') {
        sanitized = value === null || value === '' ? null : parseInt(value);
        if (sanitized !== null && isNaN(sanitized)) continue;
      } else if (spec.type === 'number') {
        sanitized = value === null || value === '' ? null : parseFloat(value);
        if (sanitized !== null && isNaN(sanitized)) continue;
      } else if (spec.type === 'boolean') {
        sanitized = value === true || value === 'true';
      }

      setClauses.push(`${key} = $${paramIndex}`);
      values.push(sanitized);
      paramIndex++;
    }

    if (setClauses.length === 0 && (!images || !Array.isArray(images))) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      // Update pet fields if any
      if (setClauses.length > 0) {
        setClauses.push(`updated_at = CURRENT_TIMESTAMP`);
        setClauses.push(`updated_by = $${paramIndex}`);
        values.push(req.user.id);
        paramIndex++;

        values.push(petId);
        await client.query(
          `UPDATE pets SET ${setClauses.join(', ')} WHERE id = $${paramIndex}`,
          values
        );
      }

      // Handle images if provided
      if (images && Array.isArray(images) && images.length > 0) {
        // Remove existing images
        await client.query('DELETE FROM pet_images WHERE pet_id = $1', [petId]);

        // Insert new images
        for (let i = 0; i < images.length; i++) {
          const imgData = images[i];
          if (typeof imgData !== 'string') continue;
          await client.query(
            `INSERT INTO pet_images (pet_id, image_url, is_primary, display_order)
             VALUES ($1, $2, $3, $4)`,
            [petId, imgData, i === 0, i]
          );
        }
      }

      await client.query('COMMIT');

      // Fetch updated pet
      const result = await client.query(
        `SELECT p.*,
          COALESCE(
            (SELECT pi.image_url FROM pet_images pi WHERE pi.pet_id = p.id AND pi.is_primary = TRUE LIMIT 1),
            (SELECT pi.image_url FROM pet_images pi WHERE pi.pet_id = p.id ORDER BY pi.display_order LIMIT 1)
          ) as image,
          pc.name as category_name
         FROM pets p
         LEFT JOIN pet_categories pc ON pc.id = p.category_id
         WHERE p.id = $1`,
        [petId]
      );

      res.json({ success: true, data: result.rows[0] });
    } catch (txError) {
      await client.query('ROLLBACK');
      throw txError;
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error('Error updating shelter pet:', { error: error.message, petId: req.params.id });
    res.status(500).json({ error: 'Failed to update pet' });
  }
});

// GET transfer requests for managed shelter
router.get('/transfers', authenticateToken, verifyShelterManager, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT str.*, rr.title as rescue_title, rr.description as rescue_description,
              u.full_name as requester_name
       FROM shelter_transfer_requests str
       JOIN rescue_reports rr ON rr.id = str.rescue_report_id
       LEFT JOIN users u ON u.id = str.requester_id
       WHERE str.shelter_id = $1
       ORDER BY str.created_at DESC`,
      [req.shelter.id]
    );

    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('Error fetching shelter transfers:', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch transfer requests' });
  }
});

// PATCH approve/reject transfer request
router.patch('/transfers/:id', authenticateToken, verifyShelterManager, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;
    const normalizedStatus = status === 'accepted' ? 'approved' : status;

    // Keep backward compatibility with old clients that still send `accepted`.
    if (!['approved', 'rejected'].includes(normalizedStatus)) {
      return res.status(400).json({ error: 'Status must be approved or rejected' });
    }

    // Verify the transfer request belongs to this shelter
    const transferResult = await db.query(
      'SELECT * FROM shelter_transfer_requests WHERE id = $1 AND shelter_id = $2',
      [id, req.shelter.id]
    );

    if (transferResult.rows.length === 0) {
      return res.status(404).json({ error: 'Transfer request not found' });
    }

    const transfer = transferResult.rows[0];
    if (transfer.status !== 'pending') {
      return res.status(400).json({ error: `Only pending requests can be updated (current: ${transfer.status})` });
    }

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      const result = await client.query(
        `UPDATE shelter_transfer_requests 
         SET status = $1,
             review_notes = $2,
             reviewed_by = $3,
             reviewed_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $4
         RETURNING *`,
        [normalizedStatus, notes || null, req.user.id, id]
      );

      const notifTitle = normalizedStatus === 'approved' ? 'Transfer Request Approved' : 'Transfer Request Rejected';
      const notifMessage = normalizedStatus === 'approved'
        ? `${req.shelter.name} has approved your transfer request.`
        : `${req.shelter.name} has rejected your transfer request.${notes ? ` Reason: ${notes}` : ''}`;

      await client.query(
        `INSERT INTO notifications (user_id, type, title, message, data)
         VALUES ($1, 'shelter_transfer', $2, $3, $4)`,
        [
          transfer.requester_id,
          notifTitle,
          notifMessage,
          JSON.stringify({
            transfer_request_id: transfer.id,
            shelter_id: transfer.shelter_id,
            status: normalizedStatus,
          }),
        ]
      );

      await client.query('COMMIT');
      res.json(result.rows[0]);
    } catch (txError) {
      await client.query('ROLLBACK');
      throw txError;
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error('Error updating transfer request:', { error: error.message });
    res.status(500).json({ error: 'Failed to update transfer request' });
  }
});

// ==================== ADOPTION MANAGEMENT ====================

// GET manager-only payment overview for this shelter
router.get('/payments-overview', authenticateToken, verifyShelterManager, async (req, res) => {
  try {
    const includePaymentTransactions = await hasPaymentTransactionsTable();

    const summaryResult = await db.query(
      `SELECT
         COUNT(*)::int AS paid_adoptions,
         COUNT(DISTINCT a.pet_id)::int AS adopted_pets,
         COUNT(DISTINCT a.user_id)::int AS unique_adopters,
         COALESCE(SUM(COALESCE(a.payment_amount, p.adoption_fee, 0)), 0)::numeric(10,2) AS total_revenue,
         COALESCE(SUM(
           CASE
             WHEN a.payment_method = 'paymongo' OR a.paymongo_checkout_id IS NOT NULL
             THEN COALESCE(a.payment_amount, p.adoption_fee, 0)
             ELSE 0
           END
         ), 0)::numeric(10,2) AS online_revenue,
         COALESCE(SUM(
           CASE
             WHEN a.payment_method != 'paymongo' AND a.paymongo_checkout_id IS NULL
             THEN COALESCE(a.payment_amount, p.adoption_fee, 0)
             ELSE 0
           END
         ), 0)::numeric(10,2) AS manual_revenue
       FROM adoption_applications a
       JOIN pets p ON p.id = a.pet_id
       WHERE p.shelter_id = $1 AND a.payment_completed = true`,
      [req.shelter.id]
    );

    const recentResult = includePaymentTransactions
      ? await db.query(
          `SELECT
             a.id AS adoption_id,
             p.id AS pet_id,
             p.name AS pet_name,
             u.id AS customer_id,
             u.full_name AS customer_name,
             COALESCE(a.payment_amount, p.adoption_fee, 0)::numeric(10,2) AS amount,
             COALESCE(a.payment_method, CASE WHEN a.paymongo_checkout_id IS NOT NULL THEN 'paymongo' ELSE 'manual' END) AS payment_method,
             a.paymongo_checkout_id,
             pt.id AS transaction_id,
             pt.payment_provider,
             pt.provider_reference,
             COALESCE(a.payment_date, pt.paid_at, a.updated_at) AS paid_at
           FROM adoption_applications a
           JOIN pets p ON p.id = a.pet_id
           JOIN users u ON u.id = a.user_id
           LEFT JOIN LATERAL (
             SELECT pt_inner.id, pt_inner.payment_provider, pt_inner.provider_reference, pt_inner.paid_at
             FROM payment_transactions pt_inner
             WHERE pt_inner.adoption_application_id = a.id
             ORDER BY pt_inner.paid_at DESC NULLS LAST, pt_inner.id DESC
             LIMIT 1
           ) pt ON TRUE
           WHERE p.shelter_id = $1 AND a.payment_completed = true
           ORDER BY COALESCE(a.payment_date, pt.paid_at, a.updated_at) DESC
           LIMIT 25`,
          [req.shelter.id]
        )
      : await db.query(
          `SELECT
             a.id AS adoption_id,
             p.id AS pet_id,
             p.name AS pet_name,
             u.id AS customer_id,
             u.full_name AS customer_name,
             COALESCE(a.payment_amount, p.adoption_fee, 0)::numeric(10,2) AS amount,
             COALESCE(a.payment_method, CASE WHEN a.paymongo_checkout_id IS NOT NULL THEN 'paymongo' ELSE 'manual' END) AS payment_method,
             a.paymongo_checkout_id,
             NULL::integer AS transaction_id,
             NULL::text AS payment_provider,
             NULL::text AS provider_reference,
             COALESCE(a.payment_date, a.updated_at) AS paid_at
           FROM adoption_applications a
           JOIN pets p ON p.id = a.pet_id
           JOIN users u ON u.id = a.user_id
           WHERE p.shelter_id = $1 AND a.payment_completed = true
           ORDER BY COALESCE(a.payment_date, a.updated_at) DESC
           LIMIT 25`,
          [req.shelter.id]
        );

    res.json({
      success: true,
      data: {
        summary: summaryResult.rows[0] || {
          paid_adoptions: 0,
          adopted_pets: 0,
          unique_adopters: 0,
          total_revenue: 0,
          online_revenue: 0,
          manual_revenue: 0,
        },
        recentPayments: recentResult.rows || [],
      },
    });
  } catch (error) {
    logger.error('Shelter manager payment overview error:', { error: error.message, shelterId: req.shelter?.id });
    res.status(500).json({ error: 'Failed to get payment overview' });
  }
});

// GET adoption applications for this shelter's pets
router.get('/adoptions', authenticateToken, verifyShelterManager, async (req, res) => {
  try {
    const { status, limit = 50, offset = 0 } = req.query;
    const includePaymentTransactions = await hasPaymentTransactionsTable();

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
             ${includePaymentTransactions ? 'pt.id' : 'NULL::integer'} AS transaction_id,
             ${includePaymentTransactions ? 'pt.payment_provider' : 'NULL::text'} AS payment_provider,
             ${includePaymentTransactions ? 'pt.provider_reference' : 'NULL::text'} AS provider_reference,
             ${includePaymentTransactions ? 'pt.paid_at' : 'NULL::timestamp'} AS transaction_paid_at,
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
      ${includePaymentTransactions ? `LEFT JOIN LATERAL (
        SELECT pt_inner.id, pt_inner.payment_provider, pt_inner.provider_reference, pt_inner.paid_at
        FROM payment_transactions pt_inner
        WHERE pt_inner.adoption_application_id = a.id
        ORDER BY pt_inner.paid_at DESC NULLS LAST, pt_inner.id DESC
        LIMIT 1
      ) pt ON TRUE` : ''}
      WHERE p.shelter_id = $1
    `;

    const params = [req.shelter.id];
    let paramIndex = 2;

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
    logger.error('Shelter manager get adoptions error:', { error: error.message, shelterId: req.shelter?.id });
    res.status(500).json({ error: 'Failed to get adoptions' });
  }
});

// PUT update adoption application status (approve/reject)
router.put('/adoptions/:id/status', authenticateToken, verifyShelterManager, async (req, res) => {
  try {
    const { status, review_notes, rejection_reason } = req.body;
    const appId = req.params.id;

    if (!['pending', 'reviewing', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    // Verify the application's pet belongs to this shelter
    const appCheck = await db.query(
      `SELECT a.id, a.pet_id, a.user_id
       FROM adoption_applications a
       JOIN pets p ON a.pet_id = p.id
       WHERE a.id = $1 AND p.shelter_id = $2`,
      [appId, req.shelter.id]
    );

    if (appCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Application not found for your shelter' });
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

    if (result.rows.length > 0) {
      const petId = result.rows[0].pet_id;
      const userId = result.rows[0].user_id;
      let petStatus = 'available';
      if (status === 'approved') petStatus = 'pending';
      else if (status === 'reviewing' || status === 'pending') petStatus = 'pending';

      await db.query('UPDATE pets SET status = $1 WHERE id = $2', [petStatus, petId]);

      // Send notification to user
      if (userId) {
        const pet = await db.query('SELECT name FROM pets WHERE id = $1', [petId]);
        const petName = pet.rows[0]?.name || 'your pet';
        let notifTitle, notifMessage, notifType;

        if (status === 'approved') {
          notifTitle = 'Adoption Approved!';
          notifMessage = `Great news! ${req.shelter.name} has approved your adoption application for ${petName}. Please proceed to payment to complete the adoption.`;
          notifType = 'adoption_update';
        } else if (status === 'rejected') {
          notifTitle = 'Application Update';
          notifMessage = `Your adoption application for ${petName} from ${req.shelter.name} was not approved.${rejection_reason ? ' Reason: ' + rejection_reason : ''}`;
          notifType = 'adoption_update';
        }

        if (notifTitle) {
          try {
            await db.query(
              `INSERT INTO notifications (user_id, type, title, message, data) VALUES ($1, $2, $3, $4, $5)`,
              [userId, notifType, notifTitle, notifMessage, JSON.stringify({ adoption_id: appId, pet_id: petId, shelter_id: req.shelter.id })]
            );
          } catch (notifError) {
            logger.error('Failed to create notification:', { error: notifError.message });
          }
        }
      }
    }

    res.json({ message: `Application ${status}` });
  } catch (error) {
    logger.error('Shelter manager update adoption status error:', { error: error.message });
    res.status(500).json({ error: 'Failed to update application' });
  }
});

// PUT confirm payment for an approved adoption
router.put('/adoptions/:id/payment', authenticateToken, verifyShelterManager, async (req, res) => {
  try {
    const appId = req.params.id;

    // Verify the application's pet belongs to this shelter
    const appCheck = await db.query(
      `SELECT a.id, a.status, a.pet_id, a.user_id, a.payment_completed,
              a.paymongo_checkout_id, a.payment_method, a.payment_amount,
              p.adoption_fee
       FROM adoption_applications a
       JOIN pets p ON a.pet_id = p.id
       WHERE a.id = $1 AND p.shelter_id = $2`,
      [appId, req.shelter.id]
    );

    if (appCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Application not found for your shelter' });
    }

    const application = appCheck.rows[0];

    if (application.payment_completed) {
      return res.status(400).json({ error: 'Payment is already marked as completed' });
    }

    if (application.status !== 'approved') {
      return res.status(400).json({ error: 'Only approved applications can have payment completed' });
    }

    const resolvedMethod = application.paymongo_checkout_id ? 'paymongo' : (application.payment_method || 'manual');

    await db.query(
      `UPDATE adoption_applications SET
        payment_completed = true,
        payment_date = COALESCE(payment_date, NOW()),
        payment_method = $2,
        delivery_status = COALESCE(delivery_status, 'processing'),
        delivery_updated_at = COALESCE(delivery_updated_at, NOW()),
        updated_at = NOW()
       WHERE id = $1`,
      [appId, resolvedMethod]
    );

    await db.query('UPDATE pets SET status = $1 WHERE id = $2', ['adopted', application.pet_id]);

    await createPaymentTransactionSafe({
      adoptionId: parseInt(appId, 10),
      petId: application.pet_id,
      customerUserId: application.user_id,
      shelterId: req.shelter.id,
      amount: application.payment_amount != null ? application.payment_amount : application.adoption_fee,
      paymentProvider: application.paymongo_checkout_id ? 'paymongo' : 'internal',
      providerReference: application.paymongo_checkout_id || null,
      paymentMethod: resolvedMethod,
      status: 'paid',
      notes: 'Payment marked completed by shelter manager',
      metadata: {
        confirmed_by_user_id: req.user.id,
        source: 'shelter_manager_confirm',
      },
    });

    // Notify user
    if (application.user_id) {
      const pet = await db.query('SELECT name FROM pets WHERE id = $1', [application.pet_id]);
      const petName = pet.rows[0]?.name || 'your pet';

      try {
        await db.query(
          `INSERT INTO notifications (user_id, type, title, message, data) VALUES ($1, $2, $3, $4, $5)`,
          [
            application.user_id,
            'payment_confirmed',
            'Payment Confirmed!',
            `Your payment for the adoption of ${petName} has been confirmed by ${req.shelter.name}!`,
            JSON.stringify({ adoption_id: appId, pet_id: application.pet_id, shelter_id: req.shelter.id })
          ]
        );
      } catch (notifError) {
        logger.error('Failed to create notification:', { error: notifError.message });
      }
    }

    res.json({ success: true, message: 'Payment confirmed successfully' });
  } catch (error) {
    logger.error('Shelter manager confirm payment error:', { error: error.message });
    res.status(500).json({ error: 'Failed to confirm payment' });
  }
});

// PUT verify PayMongo payment for an approved adoption (manager-side reconciliation)
router.put('/adoptions/:id/verify-payment', authenticateToken, verifyShelterManager, async (req, res) => {
  try {
    const appId = req.params.id;

    const appCheck = await db.query(
      `SELECT a.id, a.status, a.pet_id, a.user_id, a.payment_completed,
              a.paymongo_checkout_id, a.payment_method, a.payment_amount,
              p.adoption_fee
       FROM adoption_applications a
       JOIN pets p ON a.pet_id = p.id
       WHERE a.id = $1 AND p.shelter_id = $2`,
      [appId, req.shelter.id]
    );

    if (appCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Application not found for your shelter' });
    }

    const application = appCheck.rows[0];

    if (application.payment_completed) {
      return res.json({ success: true, status: 'paid', message: 'Payment already confirmed' });
    }

    if (application.status !== 'approved') {
      return res.status(400).json({ error: 'Only approved applications can be verified' });
    }

    if (!application.paymongo_checkout_id) {
      return res.status(400).json({ error: 'No PayMongo checkout session found for this application' });
    }

    const session = await retrieveCheckoutSession(application.paymongo_checkout_id);
    const sessionStatus = session?.attributes?.status || 'unknown';

    if (!isPayMongoSessionPaid(session)) {
      return res.json({ success: false, status: sessionStatus, message: 'Payment not yet completed' });
    }

    const paymentAmountFromSession = session?.attributes?.line_items?.[0]?.amount
      ? session.attributes.line_items[0].amount / 100
      : null;
    const resolvedAmount = paymentAmountFromSession || application.payment_amount || application.adoption_fee || 0;

    await db.query(
      `UPDATE adoption_applications SET
        payment_completed = true,
        payment_amount = COALESCE(payment_amount, $2),
        payment_date = COALESCE(payment_date, NOW()),
        payment_method = 'paymongo',
        delivery_status = COALESCE(delivery_status, 'processing'),
        delivery_updated_at = COALESCE(delivery_updated_at, NOW()),
        updated_at = NOW()
       WHERE id = $1`,
      [appId, resolvedAmount]
    );

    await db.query('UPDATE pets SET status = $1 WHERE id = $2', ['adopted', application.pet_id]);

    await createPaymentTransactionSafe({
      adoptionId: parseInt(appId, 10),
      petId: application.pet_id,
      customerUserId: application.user_id,
      shelterId: req.shelter.id,
      amount: resolvedAmount,
      paymentProvider: 'paymongo',
      providerReference: application.paymongo_checkout_id,
      paymentMethod: 'paymongo',
      status: 'paid',
      notes: 'Payment verified from PayMongo by shelter manager reconciliation',
      metadata: {
        verified_by_user_id: req.user.id,
        session_status: sessionStatus,
        source: 'shelter_manager_verify_payment',
      },
    });

    if (application.user_id) {
      const pet = await db.query('SELECT name FROM pets WHERE id = $1', [application.pet_id]);
      const petName = pet.rows[0]?.name || 'your pet';

      try {
        await db.query(
          `INSERT INTO notifications (user_id, type, title, message, data) VALUES ($1, $2, $3, $4, $5)`,
          [
            application.user_id,
            'payment_confirmed',
            'Payment Confirmed!',
            `Your payment for the adoption of ${petName} has been confirmed by ${req.shelter.name}!`,
            JSON.stringify({ adoption_id: appId, pet_id: application.pet_id, shelter_id: req.shelter.id })
          ]
        );
      } catch (notifError) {
        logger.error('Failed to create notification:', { error: notifError.message });
      }
    }

    res.json({ success: true, status: 'paid', message: 'Payment verified and confirmed successfully' });
  } catch (error) {
    logger.error('Shelter manager verify payment error:', { error: error.message });
    res.status(500).json({ error: 'Failed to verify payment' });
  }
});

// PUT update delivery status for a paid shelter adoption
router.put('/deliveries/:id/status', authenticateToken, verifyShelterManager, async (req, res) => {
  try {
    const { delivery_status, delivery_scheduled_date, delivery_tracking_notes } = req.body;
    const appId = req.params.id;

    const validStatuses = ['processing', 'preparing', 'out_for_delivery', 'delivered', 'cancelled'];
    if (delivery_status && !validStatuses.includes(delivery_status)) {
      return res.status(400).json({ error: 'Invalid delivery status' });
    }

    // Verify the application's pet belongs to this shelter
    const appCheck = await db.query(
      `SELECT a.id FROM adoption_applications a
       JOIN pets p ON a.pet_id = p.id
       WHERE a.id = $1 AND p.shelter_id = $2 AND a.payment_completed = true`,
      [appId, req.shelter.id]
    );

    if (appCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Delivery not found for your shelter' });
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

    updateQuery += ` WHERE id = $${paramIndex} RETURNING id, delivery_status, user_id, pet_id`;
    params.push(appId);

    const result = await db.query(updateQuery, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Failed to update delivery' });
    }

    // Send notification
    const row = result.rows[0];
    if (row.user_id && delivery_status) {
      const pet = await db.query('SELECT name FROM pets WHERE id = $1', [row.pet_id]);
      const petName = pet.rows[0]?.name || 'your pet';
      const statusLabels = {
        processing: 'is being processed',
        preparing: 'is being prepared for delivery',
        out_for_delivery: 'is on the way to you!',
        delivered: 'has been delivered! Welcome your new family member!',
        cancelled: 'delivery has been cancelled',
      };

      try {
        await db.query(
          `INSERT INTO notifications (user_id, type, title, message, data) VALUES ($1, $2, $3, $4, $5)`,
          [
            row.user_id,
            'adoption_update',
            delivery_status === 'delivered' ? 'Pet Delivered!' : 'Delivery Update',
            `Your adoption of ${petName} from ${req.shelter.name} ${statusLabels[delivery_status] || 'has been updated'}.`,
            JSON.stringify({ adoption_id: appId, delivery_status, shelter_id: req.shelter.id }),
          ]
        );
      } catch (notifError) {
        logger.error('Failed to create delivery notification:', { error: notifError.message });
      }
    }

    res.json({ success: true, message: 'Delivery updated successfully' });
  } catch (error) {
    logger.error('Shelter manager update delivery error:', { error: error.message });
    res.status(500).json({ error: 'Failed to update delivery' });
  }
});

module.exports = router;
