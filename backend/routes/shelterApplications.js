const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken, authenticateAdmin } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validation');
const { logger } = require('../config/logger');

// GET all shelter applications (admin only)
router.get('/', authenticateAdmin, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        sa.*,
        u.email as user_email,
        u.full_name as user_name
      FROM shelter_applications sa
      LEFT JOIN users u ON sa.user_id = u.id
      ORDER BY sa.created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    logger.error('Error fetching shelter applications:', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch shelter applications' });
  }
});

// POST create new shelter application (authenticated users only)
router.post('/', authenticateToken, validate(schemas.shelterApplication), async (req, res) => {
  try {
    const {
      shelter_name,
      shelter_type,
      description,
      address,
      city,
      state,
      latitude,
      longitude,
      contact_person_name,
      phone,
      email,
      animals_accepted,
      shelter_capacity,
      services_offered,
      operating_hours,
      logo_image,
      cover_image,
      business_permit,
      registration_certificate,
      government_id,
      other_documents,
    } = req.body;

    const user_id = req.user.id;

    // Get user info
    const userResult = await db.query('SELECT email, full_name, phone FROM users WHERE id = $1', [user_id]);
    if (userResult.rows.length === 0) {
      return res.status(400).json({ error: 'User not found. Please log in and try again.' });
    }
    const userInfo = userResult.rows[0];

    // Check if user already has an application
    const existingApp = await db.query(
      `SELECT id, status FROM shelter_applications 
       WHERE user_id = $1 OR applicant_email = $2
       ORDER BY created_at DESC LIMIT 1`,
      [user_id, userInfo.email]
    );

    if (existingApp.rows.length > 0) {
      const existing = existingApp.rows[0];

      if (existing.status === 'pending') {
        return res.status(400).json({ error: 'You already have a pending shelter application' });
      } else if (existing.status === 'approved') {
        return res.status(400).json({ error: 'You already have an approved shelter' });
      }

      // If rejected or revoked, update the existing application to re-apply
      const result = await db.query(`
        UPDATE shelter_applications 
        SET user_id = $1, applicant_name = $2, applicant_email = $3, applicant_phone = $4,
            shelter_name = $5, shelter_type = $6, description = $7, 
            address = $8, city = $9, state = $10,
            latitude = $11, longitude = $12,
            contact_person_name = $13, phone = $14, email = $15,
            animals_accepted = $16, shelter_capacity = $17, services_offered = $18,
            operating_hours = $19, logo_image = $20, cover_image = $21,
            business_permit = $22, registration_certificate = $23, government_id = $24,
            other_documents = $25,
            status = 'pending', admin_feedback = NULL, reviewed_at = NULL,
            created_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = $26
        RETURNING *
      `, [
        user_id, contact_person_name || userInfo.full_name, userInfo.email, phone || userInfo.phone,
        shelter_name, shelter_type || 'private', description,
        address, city, state,
        latitude, longitude,
        contact_person_name || userInfo.full_name, phone || userInfo.phone, email || userInfo.email,
        animals_accepted || '{}', shelter_capacity || 0, services_offered || '{}',
        operating_hours, logo_image, cover_image,
        business_permit, registration_certificate, government_id, other_documents,
        existing.id
      ]);

      return res.status(201).json(result.rows[0]);
    }

    // Insert new application
    const result = await db.query(`
      INSERT INTO shelter_applications 
        (user_id, applicant_name, applicant_email, applicant_phone,
         shelter_name, shelter_type, description, 
         address, city, state, latitude, longitude,
         contact_person_name, phone, email,
         animals_accepted, shelter_capacity, services_offered,
         operating_hours, logo_image, cover_image,
         business_permit, registration_certificate, government_id, other_documents,
         status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, 'pending')
      RETURNING *
    `, [
      user_id, contact_person_name || userInfo.full_name, userInfo.email, phone || userInfo.phone,
      shelter_name, shelter_type || 'private', description,
      address, city, state, latitude, longitude,
      contact_person_name || userInfo.full_name, phone || userInfo.phone, email || userInfo.email,
      animals_accepted || '{}', shelter_capacity || 0, services_offered || '{}',
      operating_hours, logo_image, cover_image,
      business_permit, registration_certificate, government_id, other_documents
    ]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    logger.error('Error creating shelter application:', { error: error.message, userId: req.user?.id });
    res.status(500).json({ error: 'Failed to submit shelter application' });
  }
});

// GET current user's shelter application status (authenticated)
router.get('/my-application', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const userResult = await db.query('SELECT email FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) {
      return res.json({ hasApplication: false });
    }
    const userEmail = userResult.rows[0].email;

    const result = await db.query(
      `SELECT * FROM shelter_applications 
       WHERE user_id = $1 OR applicant_email = $2
       ORDER BY created_at DESC LIMIT 1`,
      [userId, userEmail]
    );

    if (result.rows.length === 0) {
      return res.json({ hasApplication: false });
    }

    res.json({ hasApplication: true, application: result.rows[0] });
  } catch (error) {
    logger.error('Error fetching shelter application:', { error: error.message, userId: req.user?.id });
    res.status(500).json({ error: 'Failed to fetch application' });
  }
});

// GET user's shelter application by user ID (admin only)
router.get('/user/:userId', authenticateAdmin, async (req, res) => {
  try {
    const { userId } = req.params;

    const userResult = await db.query('SELECT email FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) {
      return res.json({ hasApplication: false });
    }
    const userEmail = userResult.rows[0].email;

    const result = await db.query(
      `SELECT * FROM shelter_applications 
       WHERE user_id = $1 OR applicant_email = $2
       ORDER BY created_at DESC LIMIT 1`,
      [userId, userEmail]
    );

    if (result.rows.length === 0) {
      return res.json({ hasApplication: false });
    }

    res.json({ hasApplication: true, application: result.rows[0] });
  } catch (error) {
    logger.error('Error fetching user shelter application:', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch application' });
  }
});

// PATCH approve or reject a shelter application (admin only)
router.patch('/:id/status', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, admin_feedback } = req.body;

    if (!['approved', 'rejected', 'revoked'].includes(status)) {
      return res.status(400).json({ error: 'Status must be approved, rejected, or revoked' });
    }

    // Fetch the application
    const appResult = await db.query('SELECT * FROM shelter_applications WHERE id = $1', [id]);
    if (appResult.rows.length === 0) {
      return res.status(404).json({ error: 'Shelter application not found' });
    }
    const application = appResult.rows[0];

    // `reviewed_by` references users(id). Admin IDs are from admins(id), so resolve
    // a matching user account by email and store null if none exists.
    const reviewerResult = await db.query('SELECT id FROM users WHERE email = $1 LIMIT 1', [req.admin.email]);
    const reviewerUserId = reviewerResult.rows[0]?.id || null;

    // Prevent re-approving already approved applications
    if (status === 'approved' && application.status === 'approved') {
      return res.status(400).json({ error: 'Application is already approved' });
    }

    // Only pending applications can be approved
    if (status === 'approved' && application.status !== 'pending') {
      return res.status(400).json({ error: `Cannot approve application with status '${application.status}'` });
    }

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      if (status === 'approved') {
        // Create a shelter from the application data
        const shelterResult = await client.query(
          `INSERT INTO shelters
            (name, shelter_type, description, address, city, state, phone, email,
             operating_hours, latitude, longitude, shelter_capacity,
             animals_accepted, services_offered, contact_person_name,
             logo_image, cover_image, manager_id, is_active, is_verified, verification_status)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,true,true,'verified')
           RETURNING *`,
          [
            application.shelter_name,
            application.shelter_type || 'private',
            application.description,
            application.address,
            application.city,
            application.state,
            application.phone,
            application.email,
            application.operating_hours,
            application.latitude,
            application.longitude,
            application.shelter_capacity || 0,
            application.animals_accepted,
            application.services_offered,
            application.contact_person_name,
            application.logo_image,
            application.cover_image,
            application.user_id,
          ]
        );
        const newShelter = shelterResult.rows[0];

        // Link application to the created shelter
        await client.query(
          `UPDATE shelter_applications
           SET status = 'approved', created_shelter_id = $1, admin_feedback = $2,
               reviewed_by = $3, reviewed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
           WHERE id = $4`,
          [newShelter.id, admin_feedback || null, reviewerUserId, id]
        );

        // Set managed_shelter_id on the user so shelterManager routes work
        if (application.user_id) {
          await client.query(
            'UPDATE users SET managed_shelter_id = $1 WHERE id = $2',
            [newShelter.id, application.user_id]
          );
        }

        // Send notification to the applicant
        if (application.user_id) {
          await client.query(
            `INSERT INTO notifications (user_id, type, title, message, data)
             VALUES ($1, 'shelter_approved', 'Shelter Approved!',
                     $2, $3)`,
            [
              application.user_id,
              `Congratulations! Your shelter "${application.shelter_name}" has been approved. You can now manage it from the Shelter tab.`,
              JSON.stringify({ shelter_id: newShelter.id }),
            ]
          );
        }

        await client.query('COMMIT');
        logger.info('Shelter application approved', { applicationId: id, shelterId: newShelter.id, adminId: req.admin.id });
        return res.json({ message: 'Application approved and shelter created', shelter: newShelter });
      }

      // Rejected or revoked
      await client.query(
        `UPDATE shelter_applications
         SET status = $1, admin_feedback = $2, reviewed_by = $3,
             reviewed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE id = $4`,
        [status, admin_feedback || null, reviewerUserId, id]
      );

      // If revoking, also deactivate the shelter and clear the user link
      if (status === 'revoked' && application.created_shelter_id) {
        await client.query('UPDATE shelters SET is_active = false WHERE id = $1', [application.created_shelter_id]);
        if (application.user_id) {
          await client.query('UPDATE users SET managed_shelter_id = NULL WHERE id = $1', [application.user_id]);
        }
      }

      // Notify the user
      if (application.user_id) {
        const notifType = status === 'rejected' ? 'shelter_rejected' : 'shelter_revoked';
        const notifTitle = status === 'rejected' ? 'Shelter Application Not Approved' : 'Shelter Registration Revoked';
        const notifMsg = status === 'rejected'
          ? `Your shelter application for "${application.shelter_name}" was not approved.${admin_feedback ? ' Feedback: ' + admin_feedback : ''}`
          : `Your shelter "${application.shelter_name}" registration has been revoked.${admin_feedback ? ' Reason: ' + admin_feedback : ''}`;

        await client.query(
          `INSERT INTO notifications (user_id, type, title, message) VALUES ($1, $2, $3, $4)`,
          [application.user_id, notifType, notifTitle, notifMsg]
        );
      }

      await client.query('COMMIT');
      logger.info(`Shelter application ${status}`, { applicationId: id, adminId: req.admin.id });
      res.json({ message: `Application ${status}` });
    } catch (txError) {
      await client.query('ROLLBACK');
      throw txError;
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error('Error updating shelter application status:', {
      error: error.message,
      detail: error.detail,
      code: error.code,
      constraint: error.constraint,
      stack: error.stack,
    });
    console.error('Full shelter application status error:', error);
    res.status(500).json({ error: error.detail || error.message || 'Failed to update application status' });
  }
});

// DELETE a shelter application (admin only)
router.delete('/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Fetch the application
    const appResult = await db.query('SELECT * FROM shelter_applications WHERE id = $1', [id]);
    if (appResult.rows.length === 0) {
      return res.status(404).json({ error: 'Shelter application not found' });
    }
    const application = appResult.rows[0];

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      // If the application was approved and a shelter was created, deactivate it and unlink the user
      if (application.status === 'approved' && application.created_shelter_id) {
        await client.query('UPDATE shelters SET is_active = false WHERE id = $1', [application.created_shelter_id]);
        if (application.user_id) {
          await client.query('UPDATE users SET managed_shelter_id = NULL WHERE id = $1 AND managed_shelter_id = $2', [application.user_id, application.created_shelter_id]);
        }
      }

      // Delete the application
      await client.query('DELETE FROM shelter_applications WHERE id = $1', [id]);

      await client.query('COMMIT');
      logger.info('Shelter application deleted', { applicationId: id, adminId: req.admin.id });
      res.json({ message: 'Application deleted successfully' });
    } catch (txError) {
      await client.query('ROLLBACK');
      throw txError;
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error('Error deleting shelter application:', { error: error.message });
    res.status(500).json({ error: 'Failed to delete application' });
  }
});

module.exports = router;
