const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken, authenticateAdmin } = require('../middleware/auth');
const { logger } = require('../config/logger');
const { validate, schemas } = require('../middleware/validation');

// Note: Tables are defined in schema.sql
// Runtime table creation has been removed - use migrations instead

// GET all rescuer applications (admin only)
router.get('/', authenticateAdmin, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        ra.*,
        u.email as user_email,
        u.full_name as user_name
      FROM rescuer_applications ra
      LEFT JOIN users u ON ra.user_id = u.id
      ORDER BY ra.created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    logger.error('Error fetching rescuer applications:', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch applications' });
  }
});

// POST create new rescuer application (authenticated users only)
router.post('/', authenticateToken, validate(schemas.rescuerApplication), async (req, res) => {
  try {
    const {
      full_name,
      phone,
      address,
      city,
      experience,
      reason,
      availability,
      transportation_type,
      latitude,
      longitude
    } = req.body;
    
    // Use authenticated user's ID (prevents IDOR attacks)
    const user_id = req.user.id;
    
    // Get user's email to store with the application
    const userResult = await db.query('SELECT email FROM users WHERE id = $1', [user_id]);
    if (userResult.rows.length === 0) {
      return res.status(400).json({ 
        error: 'User not found. Please log in and try again.' 
      });
    }
    const userEmail = userResult.rows[0].email;

    // Check if user already has an application (check by user_id OR email for safety)
    const existingApp = await db.query(
      `SELECT id, status, user_id FROM rescuer_applications 
       WHERE user_id = $1 OR email = $2
       ORDER BY created_at DESC LIMIT 1`,
      [user_id, userEmail]
    );

    if (existingApp.rows.length > 0) {
      const existingAppId = existingApp.rows[0].id;
      const status = existingApp.rows[0].status;
      
      if (status === 'pending') {
        return res.status(400).json({ 
          error: 'You already have a pending rescuer application' 
        });
      } else if (status === 'approved') {
        return res.status(400).json({ 
          error: 'You are already an approved rescuer' 
        });
      }
      
      // If rejected or revoked, update the existing application by its ID
      const result = await db.query(`
        UPDATE rescuer_applications 
        SET user_id = $1, full_name = $2, phone = $3, address = $4, city = $5, 
            experience = $6, reason = $7, availability = $8, 
            transportation_type = $9, latitude = $10, longitude = $11,
            email = $12,
            status = 'pending', reviewed_at = NULL, revoked_at = NULL, rejection_reason = NULL,
            created_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = $13
        RETURNING *
      `, [user_id, full_name, phone, address, city, experience, reason, availability, transportation_type, latitude, longitude, userEmail, existingAppId]);
      
      return res.status(201).json(result.rows[0]);
    }

    // Insert new application if user doesn't have one
    const result = await db.query(`
      INSERT INTO rescuer_applications 
        (user_id, full_name, phone, email, address, city, experience, reason, availability, transportation_type, latitude, longitude, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'pending')
      RETURNING *
    `, [user_id, full_name, phone, userEmail, address, city, experience, reason, availability, transportation_type, latitude, longitude]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    logger.error('Error creating rescuer application:', { error: error.message, userId: req.user?.id });
    res.status(500).json({ error: 'Failed to submit application' });
  }
});

// GET current user's rescuer application status (authenticated)
router.get('/my-application', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get the user's email
    const userResult = await db.query(
      'SELECT email FROM users WHERE id = $1',
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      return res.json({ hasApplication: false });
    }
    
    const userEmail = userResult.rows[0].email;
    
    // Check for rescuer application
    const result = await db.query(
      `SELECT * FROM rescuer_applications 
       WHERE user_id = $1 AND (email = $2 OR email IS NULL)
       ORDER BY created_at DESC LIMIT 1`,
      [userId, userEmail]
    );
    
    if (result.rows.length === 0) {
      return res.json({ hasApplication: false });
    }
    
    res.json({ hasApplication: true, application: result.rows[0] });
  } catch (error) {
    logger.error('Error fetching user application:', { error: error.message, userId: req.user?.id });
    res.status(500).json({ error: 'Failed to fetch application' });
  }
});

// GET user's rescuer application status by ID (admin only - for admin panel)
router.get('/user/:userId', authenticateAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    
    // First, get the user's email to verify the application belongs to them
    const userResult = await db.query(
      'SELECT email FROM users WHERE id = $1',
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      return res.json({ hasApplication: false });
    }
    
    const userEmail = userResult.rows[0].email;
    
    // Check for rescuer application that matches both user_id AND email
    // This prevents users from inheriting applications from deleted accounts
    const result = await db.query(
      `SELECT * FROM rescuer_applications 
       WHERE user_id = $1 AND (email = $2 OR email IS NULL)
       ORDER BY created_at DESC LIMIT 1`,
      [userId, userEmail]
    );
    
    if (result.rows.length === 0) {
      return res.json({ hasApplication: false });
    }
    
    res.json({ hasApplication: true, application: result.rows[0] });
  } catch (error) {
    logger.error('Error fetching user application:', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch application' });
  }
});

module.exports = router;
