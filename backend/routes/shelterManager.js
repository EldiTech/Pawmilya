const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { logger } = require('../config/logger');

// Input sanitisation helpers
const sanitizeString = (val, maxLen = 500) => {
  if (val === null || val === undefined) return null;
  return String(val).trim().slice(0, maxLen);
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
        (SELECT pi.image_url FROM pet_images pi WHERE pi.pet_id = p.id LIMIT 1) as image
       FROM pets p 
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

// PATCH accept/reject transfer request
router.patch('/transfers/:id', authenticateToken, verifyShelterManager, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    if (!['accepted', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Status must be accepted or rejected' });
    }

    // Verify the transfer request belongs to this shelter
    const transferResult = await db.query(
      'SELECT * FROM shelter_transfer_requests WHERE id = $1 AND shelter_id = $2',
      [id, req.shelter.id]
    );

    if (transferResult.rows.length === 0) {
      return res.status(404).json({ error: 'Transfer request not found' });
    }

    const result = await db.query(
      `UPDATE shelter_transfer_requests 
       SET status = $1, manager_notes = $2, responded_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`,
      [status, notes, id]
    );

    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Error updating transfer request:', { error: error.message });
    res.status(500).json({ error: 'Failed to update transfer request' });
  }
});

module.exports = router;
