const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../config/database');
const { authenticateToken, authenticateTokenAllowSuspended, authenticateAdmin } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validation');
const { logger } = require('../config/logger');

const router = express.Router();

// Note: user_saved_pets table is defined in schema.sql
// Runtime table creation has been removed - use migrations instead

// Get all users (admin only - protected endpoint)
router.get('/all', authenticateAdmin, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, email, full_name, phone, avatar_url, status, created_at
       FROM users ORDER BY created_at DESC`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({ error: 'Failed to get users' });
  }
});

// Check user status (for suspension check) - allows suspended users to check their status
router.get('/status', authenticateTokenAllowSuspended, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, status, suspension_reason, suspended_at
       FROM users WHERE id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];
    res.json({
      status: user.status,
      suspended: user.status === 'suspended',
      suspension_reason: user.suspension_reason,
      suspended_at: user.suspended_at
    });
  } catch (error) {
    console.error('Get user status error:', error);
    res.status(500).json({ error: 'Failed to get user status' });
  }
});

// Get user profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, email, full_name, phone, avatar_url, address, city, state, 
              date_of_birth, bio, status, role, created_at
       FROM users WHERE id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

// Update user profile
router.put('/profile', authenticateToken, validate(schemas.updateProfile), async (req, res) => {
  try {
    const { full_name, phone, address, city, state, date_of_birth, bio } = req.body;

    const result = await db.query(
      `UPDATE users SET 
        full_name = COALESCE($1, full_name),
        phone = COALESCE($2, phone),
        address = COALESCE($3, address),
        city = COALESCE($4, city),
        state = COALESCE($5, state),
        date_of_birth = COALESCE($6, date_of_birth),
        bio = COALESCE($7, bio),
        updated_at = NOW()
       WHERE id = $8
       RETURNING id, email, full_name, phone, avatar_url, address, city, state, bio`,
      [full_name, phone, address, city, state, date_of_birth, bio, req.user.id]
    );

    res.json({ message: 'Profile updated', user: result.rows[0] });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Upload avatar - stores base64 in database
router.post('/avatar', authenticateToken, async (req, res) => {
  try {
    const { avatar } = req.body;

    if (!avatar) {
      return res.status(400).json({ error: 'No image data provided' });
    }

    // Validate base64 image (should start with data:image)
    if (!avatar.startsWith('data:image')) {
      return res.status(400).json({ error: 'Invalid image format. Please provide a base64 encoded image.' });
    }

    // Check image size (limit to ~2MB base64 which is ~1.5MB actual image)
    if (avatar.length > 2 * 1024 * 1024) {
      return res.status(400).json({ error: 'Image too large. Please use an image smaller than 1.5MB.' });
    }

    // Update user's avatar_url in database with base64 data
    const result = await db.query(
      `UPDATE users SET avatar_url = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, email, full_name, avatar_url`,
      [avatar, req.user.id]
    );

    res.json({ 
      message: 'Avatar uploaded successfully', 
      avatar_url: avatar,
      user: result.rows[0] 
    });
  } catch (error) {
    console.error('Upload avatar error:', error);
    res.status(500).json({ error: 'Failed to upload avatar' });
  }
});

// Change password
router.put('/change-password', authenticateToken, validate(schemas.changePassword), async (req, res) => {
  try {
    const { current_password, new_password } = req.body;

    // Get user's current password hash
    const userResult = await db.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [req.user.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify current password
    const validPassword = await bcrypt.compare(current_password, userResult.rows[0].password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Hash new password with higher cost factor
    const newPasswordHash = await bcrypt.hash(new_password, 12);

    // Update password
    await db.query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [newPasswordHash, req.user.id]
    );

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    logger.error('Change password error:', { error: error.message, userId: req.user?.id });
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// Get user's saved pets
router.get('/favorites', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT p.id, p.name, p.gender, p.size,
              CASE WHEN p.age_years > 0 THEN p.age_years || ' years' ELSE p.age_months || ' months' END as age,
              p.breed_name as breed,
              p.location, p.status,
              (SELECT image_url FROM pet_images WHERE pet_id = p.id AND is_primary = TRUE LIMIT 1) as image,
              usp.created_at as saved_at
       FROM user_saved_pets usp
       JOIN pets p ON usp.pet_id = p.id
       WHERE usp.user_id = $1
       ORDER BY usp.created_at DESC`,
      [req.user.id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get favorites error:', error);
    res.status(500).json({ error: 'Failed to get favorites' });
  }
});

// Add pet to favorites
router.post('/favorites', authenticateToken, async (req, res) => {
  try {
    const { pet_id } = req.body;

    await db.query(
      'INSERT INTO user_saved_pets (user_id, pet_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [req.user.id, pet_id]
    );

    res.json({ message: 'Pet added to favorites' });
  } catch (error) {
    console.error('Add favorite error:', error);
    res.status(500).json({ error: 'Failed to add favorite' });
  }
});

// Remove pet from favorites
router.delete('/favorites/:petId', authenticateToken, async (req, res) => {
  try {
    await db.query(
      'DELETE FROM user_saved_pets WHERE user_id = $1 AND pet_id = $2',
      [req.user.id, req.params.petId]
    );

    res.json({ message: 'Pet removed from favorites' });
  } catch (error) {
    console.error('Remove favorite error:', error);
    res.status(500).json({ error: 'Failed to remove favorite' });
  }
});

// Get user's adoption applications
router.get('/applications', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT a.id, a.status, a.submitted_at, a.reviewed_at,
              p.name as pet_name, 
              (SELECT image_url FROM pet_images WHERE pet_id = p.id AND is_primary = TRUE LIMIT 1) as pet_image
       FROM adoption_applications a
       JOIN pets p ON a.pet_id = p.id
       WHERE a.user_id = $1
       ORDER BY a.submitted_at DESC`,
      [req.user.id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get applications error:', error);
    res.status(500).json({ error: 'Failed to get applications' });
  }
});

// Get user's notifications
router.get('/notifications', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, type, title, message, is_read, created_at
       FROM notifications
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [req.user.id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: 'Failed to get notifications' });
  }
});

// Get unread notifications count
router.get('/notifications/unread-count', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT COUNT(*) as count
       FROM notifications
       WHERE user_id = $1 AND is_read = FALSE`,
      [req.user.id]
    );

    res.json({ count: parseInt(result.rows[0].count) });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ error: 'Failed to get unread count' });
  }
});

// Mark notification as read
router.put('/notifications/:id/read', authenticateToken, async (req, res) => {
  try {
    await db.query(
      `UPDATE notifications SET is_read = TRUE, read_at = NOW()
       WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id]
    );

    res.json({ message: 'Notification marked as read' });
  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

// Mark all notifications as read
router.put('/notifications/read-all', authenticateToken, async (req, res) => {
  try {
    await db.query(
      `UPDATE notifications SET is_read = TRUE, read_at = NOW()
       WHERE user_id = $1 AND is_read = FALSE`,
      [req.user.id]
    );

    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Mark all read error:', error);
    res.status(500).json({ error: 'Failed to mark all as read' });
  }
});

// Create notification (for internal use - requires admin authentication or internal call)
// This endpoint should only be called by other backend routes, not directly from frontend
router.post('/notifications/create', authenticateToken, async (req, res) => {
  try {
    const { user_id, type, title, message, data } = req.body;
    
    // Only allow creating notifications for self or if user is admin/rescuer
    if (req.user.id !== user_id && req.user.role !== 'admin' && req.user.role !== 'rescuer') {
      return res.status(403).json({ error: 'Not authorized to create notifications for other users' });
    }
    
    const result = await db.query(
      `INSERT INTO notifications (user_id, type, title, message, data)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [user_id, type, title, message, data ? JSON.stringify(data) : null]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create notification error:', error);
    res.status(500).json({ error: 'Failed to create notification' });
  }
});

module.exports = router;
