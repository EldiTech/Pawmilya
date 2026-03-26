const express = require('express');
const db = require('../config/database');
const { authenticateToken, optionalAuth } = require('../middleware/auth');
// Removed file-based upload - now using base64 images stored in database

const router = express.Router();

// Note: All rescue_reports columns are now defined in schema.sql
// Runtime column creation has been removed - use migrations instead

// Helper function to log rescue history
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

// Get all rescue reports (public view - limited info)
router.get('/', async (req, res) => {
  try {
    const { status, urgency, limit = 20, offset = 0 } = req.query;

    let query = `
      SELECT id, title, description, animal_type, urgency, status,
             location_description, city, latitude, longitude, images, created_at,
             reporter_id, reporter_name, reporter_phone, reporter_email
      FROM rescue_reports
      WHERE status != 'false_report'
    `;

    const params = [];
    let paramIndex = 1;

    if (status) {
      query += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (urgency) {
      query += ` AND urgency = $${paramIndex}`;
      params.push(urgency);
      paramIndex++;
    }

    query += ` ORDER BY 
      CASE urgency 
        WHEN 'critical' THEN 1 
        WHEN 'high' THEN 2 
        WHEN 'normal' THEN 3 
        WHEN 'low' THEN 4 
      END,
      created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Get rescue reports error:', error);
    res.status(500).json({ error: 'Failed to get rescue reports' });
  }
});

// Get rescue statistics
router.get('/stats', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        COUNT(*) FILTER (WHERE status IN ('new', 'in_progress')) as active,
        COUNT(*) FILTER (WHERE status = 'rescued') as rescued,
        (SELECT COUNT(*) FROM users WHERE role = 'rescuer') as volunteers
      FROM rescue_reports
    `);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Failed to get statistics' });
  }
});

// Get active rescue mission for the current user (rescuer)
// Returns the current in-progress rescue mission that locks the user
router.get('/my-active-mission', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Find any active rescue mission assigned to this rescuer
    // Active statuses: in_progress, on_the_way, arrived, pending_verification
    const result = await db.query(`
      SELECT 
        r.*,
        rep.full_name as reporter_name,
        rep.phone as reporter_phone,
        rep.email as reporter_email,
        res.full_name as rescuer_name
      FROM rescue_reports r
      LEFT JOIN users rep ON r.reporter_id = rep.id
      LEFT JOIN users res ON r.rescuer_id = res.id
      WHERE r.rescuer_id = $1 
        AND r.status IN ('in_progress', 'on_the_way', 'arrived', 'pending_verification')
      ORDER BY r.responded_at DESC
      LIMIT 1
    `, [userId]);

    if (result.rows.length > 0) {
      const mission = result.rows[0];
      
      // Parse images if stored as JSON string
      if (mission.images && typeof mission.images === 'string') {
        try {
          mission.images = JSON.parse(mission.images);
        } catch (e) {
          mission.images = [];
        }
      }
      
      // Get first image as image_url for display
      if (mission.images && mission.images.length > 0) {
        mission.image_url = mission.images[0];
      }
      
      // Use location_description as location if not present
      if (!mission.location) {
        mission.location = mission.location_description || mission.city;
      }

      res.json({ mission, hasActiveMission: true });
    } else {
      res.json({ mission: null, hasActiveMission: false });
    }
  } catch (error) {
    console.error('Get active mission error:', error);
    res.status(500).json({ error: 'Failed to get active mission' });
  }
});

// Create rescue report
router.post('/', optionalAuth, async (req, res) => {
  try {
    const {
      title,
      description,
      animal_type,
      condition,
      urgency,
      location_description,
      address,
      city,
      latitude,
      longitude,
      images,
      reporter_name,
      reporter_phone,
      reporter_email,
    } = req.body;

    // Validate required fields
    if (!title || !description || !location_description) {
      return res.status(400).json({ error: 'Title, description, and location are required' });
    }

    // Ensure images is an array or null for PostgreSQL
    const imagesArray = Array.isArray(images) ? images : (images ? [images] : null);

    console.log('📍 Creating rescue report with auth data:', { 
      userId: req.user?.id || 'NO USER ID',
      hasAuthHeader: !!req.headers['authorization'],
      authHeader: req.headers['authorization']?.substring(0, 20) + '...',
      reporterName: reporter_name,
      title, 
      animal_type, 
      urgency, 
      location_description,
      latitude,
      longitude,
      address,
      city,
      images: imagesArray?.length || 0 
    });

    const result = await db.query(
      `INSERT INTO rescue_reports (
        reporter_id, reporter_name, reporter_phone, reporter_email,
        title, description, animal_type, estimated_count, condition, urgency,
        location_description, address, city, latitude, longitude, images
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING id, title, status, urgency, images, created_at, reporter_id`,
      [
        req.user?.id || null,
        reporter_name,
        reporter_phone,
        reporter_email,
        title,
        description,
        animal_type || 'unknown',
        req.body.estimated_count || 1,
        condition || 'unknown',
        urgency || 'normal',
        location_description,
        address,
        city,
        latitude,
        longitude,
        imagesArray,
      ]
    );

    console.log('✅ Rescue report created with reporter_id:', result.rows[0].reporter_id);

    // Log history for report creation
    const reportId = result.rows[0].id;
    await logRescueHistory(
      reportId,
      'created',
      null,
      'new',
      req.user?.id ? 'user' : 'guest',
      req.user?.id || null,
      reporter_name || 'Anonymous',
      { animal_type, urgency, location: location_description }
    );

    console.log('✅ Rescue report created successfully:', {
      id: result.rows[0].id,
      title: result.rows[0].title,
      hasLocation: !!(latitude && longitude),
      hasAddress: !!location_description,
    });

    res.status(201).json({
      message: 'Rescue report submitted successfully',
      report: result.rows[0],
    });
  } catch (error) {
    console.error('Create rescue report error:', error);
    console.error('Error details:', error.message);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      error: 'Failed to submit rescue report',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Create rescue report with images - accepts base64 images stored in database
router.post('/with-images', optionalAuth, async (req, res) => {
  try {
    const {
      title,
      description,
      animal_type,
      estimated_count,
      condition,
      urgency,
      location_description,
      address,
      city,
      latitude,
      longitude,
      reporter_name,
      reporter_phone,
      reporter_email,
      images, // Array of base64 image strings
    } = req.body;

    // Validate required fields
    if (!title || !description || !location_description) {
      return res.status(400).json({ error: 'Title, description, and location are required' });
    }

    // Validate and filter base64 images
    const validImages = (images || []).filter(img => 
      typeof img === 'string' && img.startsWith('data:image')
    );

    const result = await db.query(
      `INSERT INTO rescue_reports (
        reporter_id, reporter_name, reporter_phone, reporter_email,
        title, description, animal_type, estimated_count, condition, urgency,
        location_description, address, city, latitude, longitude, images
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING id, title, status, urgency, images, created_at`,
      [
        req.user?.id || null,
        reporter_name,
        reporter_phone,
        reporter_email,
        title,
        description,
        animal_type || 'unknown',
        estimated_count || 1,
        condition || 'unknown',
        urgency || 'normal',
        location_description,
        address,
        city,
        latitude,
        longitude,
        validImages,
      ]
    );

    res.status(201).json({
      message: 'Rescue report submitted successfully',
      report: result.rows[0],
    });
  } catch (error) {
    console.error('Create rescue report with images error:', error);
    res.status(500).json({ error: 'Failed to submit rescue report' });
  }
});

// Get single rescue report
router.get('/:id', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT r.*, 
              u.full_name as reporter_user_name
       FROM rescue_reports r
       LEFT JOIN users u ON r.reporter_id = u.id
       WHERE r.id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get rescue report error:', error);
    res.status(500).json({ error: 'Failed to get report' });
  }
});

// Volunteer to help
router.post('/:id/volunteer', authenticateToken, async (req, res) => {
  try {
    const reportId = req.params.id;

    // Check if user is a volunteer
    let volunteer = await db.query(
      'SELECT id FROM rescue_volunteers WHERE user_id = $1',
      [req.user.id]
    );

    // If not a volunteer, create volunteer record
    if (volunteer.rows.length === 0) {
      volunteer = await db.query(
        'INSERT INTO rescue_volunteers (user_id) VALUES ($1) RETURNING id',
        [req.user.id]
      );
    }

    const volunteerId = volunteer.rows[0].id;

    // Create assignment
    await db.query(
      `INSERT INTO volunteer_assignments (report_id, volunteer_id, status)
       VALUES ($1, $2, 'accepted')
       ON CONFLICT DO NOTHING`,
      [reportId, volunteerId]
    );

    res.json({ message: 'Thank you for volunteering!' });
  } catch (error) {
    console.error('Volunteer error:', error);
    res.status(500).json({ error: 'Failed to register as volunteer' });
  }
});

// Upload images for a rescue report - accepts base64 images
router.post('/:id/images', optionalAuth, async (req, res) => {
  try {
    const reportId = req.params.id;
    const { images } = req.body;
    
    if (!images || !Array.isArray(images) || images.length === 0) {
      return res.status(400).json({ error: 'No images provided' });
    }

    // Validate and filter base64 images
    const validImages = images.filter(img => 
      typeof img === 'string' && img.startsWith('data:image')
    );

    if (validImages.length === 0) {
      return res.status(400).json({ error: 'Invalid image format. Please provide base64 encoded images.' });
    }

    // Get existing images
    const existingResult = await db.query(
      'SELECT images FROM rescue_reports WHERE id = $1',
      [reportId]
    );

    if (existingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const existingImages = existingResult.rows[0].images || [];
    const allImages = [...existingImages, ...validImages];

    // Update the report with new images
    await db.query(
      'UPDATE rescue_reports SET images = $1, updated_at = NOW() WHERE id = $2',
      [allImages, reportId]
    );

    res.json({
      message: 'Images uploaded successfully',
      images: validImages,
      allImages: allImages,
    });
  } catch (error) {
    console.error('Upload images error:', error);
    res.status(500).json({ error: 'Failed to upload images' });
  }
});

// Rescuer accepts/responds to a rescue report
router.put('/:id/respond', authenticateToken, async (req, res) => {
  try {
    const reportId = req.params.id;
    const { action, decline_reason } = req.body;
    const rescuerId = req.user.id;

    // Get the report details
    const reportResult = await db.query(
      'SELECT * FROM rescue_reports WHERE id = $1',
      [reportId]
    );

    if (reportResult.rows.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const report = reportResult.rows[0];

    if (action === 'decline') {
      // Log the decline in history
      await logRescueHistory(
        reportId,
        'rescuer_declined',
        report.status,
        report.status,
        'rescuer',
        rescuerId,
        req.user?.full_name || 'Rescuer',
        { reason: decline_reason }
      );
      console.log(`Rescuer ${rescuerId} declined rescue ${reportId}: ${decline_reason}`);
      return res.json({ 
        message: 'Rescue declined',
        declined: true
      });
    }

    // Accept the rescue - update status to in_progress
    await db.query(
      `UPDATE rescue_reports 
       SET status = 'in_progress', 
           rescuer_id = $1, 
           responded_at = NOW(),
           updated_at = NOW()
       WHERE id = $2`,
      [rescuerId, reportId]
    );

    // Log rescue accepted in history
    await logRescueHistory(
      reportId,
      'rescuer_assigned',
      report.status,
      'in_progress',
      'rescuer',
      rescuerId,
      req.user?.full_name || 'Rescuer',
      { action: 'accepted', rescuer_name: req.user?.full_name || 'Rescuer' }
    );

    // Determine if requester is registered or guest
    const isRegisteredUser = !!report.reporter_id;

    res.json({
      message: isRegisteredUser 
        ? 'You accepted the rescue. Requester has been notified.' 
        : 'You accepted the rescue. Please contact the requester if possible.',
      accepted: true,
      requesterType: isRegisteredUser ? 'registered' : 'guest',
      contactInfo: isRegisteredUser ? null : {
        name: report.reporter_name,
        phone: report.reporter_phone,
        email: report.reporter_email
      }
    });
  } catch (error) {
    console.error('Respond to rescue error:', error);
    res.status(500).json({ error: 'Failed to respond to rescue' });
  }
});

// Update rescue status with guided workflow
// Statuses flow: pending -> on_the_way -> arrived -> pending_verification -> rescued (after admin approval)
router.put('/:id/status', authenticateToken, async (req, res) => {
  try {
    const reportId = req.params.id;
    const { status, notes, completion_photo } = req.body;
    const rescuerId = req.user.id;

    console.log(`📋 Status update request: rescueId=${reportId}, newStatus=${status}, userId=${req.user?.id}`);

    // Updated valid statuses for guided workflow
    const validStatuses = ['in_progress', 'on_the_way', 'arrived', 'pending_verification', 'rescued', 'completed', 'cannot_complete', 'closed', 'pending'];
    if (!validStatuses.includes(status)) {
      console.log(`❌ Invalid status: ${status}`);
      return res.status(400).json({ error: `Invalid status: ${status}` });
    }

    // Get the report to check requester type and current status
    const reportResult = await db.query(
      'SELECT reporter_id, reporter_phone, reporter_email, status as current_status, rescuer_id FROM rescue_reports WHERE id = $1',
      [reportId]
    );

    if (reportResult.rows.length === 0) {
      console.log(`❌ Report not found: ${reportId}`);
      return res.status(404).json({ error: 'Report not found' });
    }

    const report = reportResult.rows[0];
    const isRegisteredUser = !!report.reporter_id;

    if (report.rescuer_id && report.rescuer_id !== rescuerId) {
      return res.status(403).json({ error: 'You are not assigned to this rescue' });
    }
    
    console.log(`📋 Current report state: currentStatus=${report.current_status}, rescuerId=${report.rescuer_id}`);

    // Validate status transitions for guided workflow
    const validTransitions = {
      'pending': ['in_progress'],
      'in_progress': ['on_the_way', 'cannot_complete', 'pending'],
      'on_the_way': ['arrived', 'cannot_complete', 'pending'],
      'arrived': ['pending_verification', 'cannot_complete', 'pending'],
      'pending_verification': ['rescued', 'arrived'], // Admin can approve (rescued) or reject back to arrived
      'rescued': ['closed'],
      'completed': ['closed'],
    };

    // Check if transition is valid (skip validation for admin or initial states)
    const currentStatus = report.current_status;
    if (currentStatus && validTransitions[currentStatus] && !validTransitions[currentStatus].includes(status)) {
      // Allow the transition anyway but log it
      console.log(`⚠️ Warning: Non-standard transition from ${currentStatus} to ${status} for rescue ${reportId}`);
    }

    // Update the status
    let updateQuery = `
      UPDATE rescue_reports 
      SET status = $1, 
          resolution_notes = COALESCE($2, resolution_notes),
          updated_at = NOW()
    `;
    const params = [status, notes];
    let paramIndex = 3;

    if (!report.rescuer_id) {
      updateQuery += `, rescuer_id = $${paramIndex}`;
      params.push(rescuerId);
      paramIndex++;
    }

    // Add timestamps based on status
    if (status === 'on_the_way') {
      updateQuery += `, responded_at = COALESCE(responded_at, NOW())`;
    } else if (status === 'arrived') {
      updateQuery += `, arrived_at = NOW()`;
    } else if (status === 'pending_verification') {
      // Rescuer submitted for verification - store photo proof
      updateQuery += `, submitted_for_verification_at = NOW()`;
    } else if (status === 'rescued' || status === 'completed') {
      updateQuery += `, resolved_at = NOW(), verified_at = NOW()`;
    }

    if (completion_photo) {
      updateQuery += `, completion_photo = $${paramIndex}`;
      params.push(completion_photo);
      paramIndex++;
    }

    updateQuery += ` WHERE id = $${paramIndex} RETURNING *`;
    params.push(reportId);

    console.log(`📋 Executing status update query for rescue ${reportId}`);
    const result = await db.query(updateQuery, params);
    
    if (result.rows.length === 0) {
      console.log(`❌ No rows updated for rescue ${reportId}`);
      return res.status(404).json({ error: 'Failed to update - report not found' });
    }
    
    console.log(`✅ Status updated successfully: ${reportId} -> ${status}`);

    // Log rescue history
    let historyAction = 'status_changed';
    if (status === 'on_the_way') historyAction = 'rescuer_on_the_way';
    else if (status === 'arrived') historyAction = 'rescuer_arrived';
    else if (status === 'pending_verification') historyAction = 'submitted_for_verification';
    else if (status === 'rescued' || status === 'completed') historyAction = 'rescue_completed';
    else if (status === 'cannot_complete') historyAction = 'cannot_complete';

    await logRescueHistory(
      reportId,
      historyAction,
      currentStatus,
      status,
      'rescuer',
      req.user?.id,
      req.user?.full_name || 'Rescuer',
      { notes, has_completion_photo: !!completion_photo, rescuer_name: req.user?.full_name || 'Rescuer' }
    );

    // Prepare response message based on status and user type
    let message = '';
    switch (status) {
      case 'on_the_way':
        message = isRegisteredUser 
          ? 'Requester notified that you are on the way!' 
          : 'Status updated. You are on the way to the rescue location.';
        break;
      case 'arrived':
        message = isRegisteredUser 
          ? 'Requester notified that you have arrived.' 
          : 'Status updated to arrived at location.';
        break;
      case 'pending_verification':
        message = 'Rescue submitted for admin verification. Your proof photo has been uploaded and is awaiting approval.';
        break;
      case 'rescued':
      case 'completed':
        message = isRegisteredUser 
          ? 'Rescue verified and completed! Requester has been notified.' 
          : 'Rescue verified and completed! Thank you for your service.';
        break;
      case 'cannot_complete':
        message = isRegisteredUser 
          ? 'Requester notified. Reason has been sent.' 
          : 'Status updated. Note has been stored.';
        break;
      default:
        message = 'Status updated successfully.';
    }

    res.json({
      message,
      report: result.rows[0],
      requesterType: isRegisteredUser ? 'registered' : 'guest',
      requiresVerification: status === 'pending_verification'
    });
  } catch (error) {
    console.error('❌ Update rescue status error:', error);
    res.status(500).json({
      error: process.env.NODE_ENV === 'production'
        ? 'Internal server error'
        : `Failed to update status: ${error.message}`,
    });
  }
});

// Get rescuer's assigned rescues
router.get('/rescuer/my-rescues', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT rr.*, 
              str.id as shelter_transfer_request_id,
              str.status as shelter_transfer_status,
              str.shelter_id as transferred_shelter_id,
              s.name as transferred_shelter_name,
              s.address as transferred_shelter_address,
              s.city as transferred_shelter_city,
              s.latitude as transferred_shelter_latitude,
              s.longitude as transferred_shelter_longitude
       FROM rescue_reports rr
       LEFT JOIN shelter_transfer_requests str ON str.rescue_report_id = rr.id 
         AND str.status IN ('approved', 'accepted', 'in_transit', 'arrived_at_shelter', 'completed')
       LEFT JOIN shelters s ON s.id = str.shelter_id
       WHERE rr.rescuer_id = $1 
       ORDER BY 
         CASE rr.status 
           WHEN 'in_progress' THEN 1
           WHEN 'on_the_way' THEN 2
           WHEN 'arrived' THEN 3 
           WHEN 'pending_verification' THEN 4
           ELSE 5 
         END,
         rr.created_at DESC`,
      [req.user.id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get my rescues error:', error);
    res.status(500).json({ error: 'Failed to get your rescues' });
  }
});

// Upload completion photo proof for rescue verification - accepts base64 image
router.post('/:id/completion-photo', authenticateToken, async (req, res) => {
  try {
    const reportId = req.params.id;
    const { photo, notes } = req.body;
    
    // Verify the rescuer owns this rescue
    const reportResult = await db.query(
      'SELECT rescuer_id, status FROM rescue_reports WHERE id = $1',
      [reportId]
    );

    if (reportResult.rows.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const report = reportResult.rows[0];
    
    if (report.rescuer_id !== req.user.id) {
      return res.status(403).json({ error: 'You are not assigned to this rescue' });
    }

    if (!photo || !photo.startsWith('data:image')) {
      return res.status(400).json({ error: 'No valid photo provided. Please provide a base64 encoded image.' });
    }

    // Get completion notes from request body (if provided)
    const completionNotes = notes || '';

    // Update the report with completion photo and change status to pending_verification
    // Clear any previous cancellation notes and replace with completion notes
    const result = await db.query(
      `UPDATE rescue_reports 
       SET completion_photo = $1, 
           status = 'pending_verification',
           resolution_notes = $3,
           submitted_for_verification_at = NOW(),
           updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [photo, reportId, completionNotes]
    );

    res.json({
      success: true,
      message: 'Photo uploaded successfully. Rescue submitted for admin verification.',
      photoUrl: photo,
      report: result.rows[0]
    });
  } catch (error) {
    console.error('Upload completion photo error:', error);
    res.status(500).json({ error: 'Failed to upload photo' });
  }
});

// Submit rescue for verification with notes
router.post('/:id/submit-verification', authenticateToken, async (req, res) => {
  try {
    const reportId = req.params.id;
    const { notes, completion_photo } = req.body;
    
    // Verify the rescuer owns this rescue
    const reportResult = await db.query(
      'SELECT rescuer_id, status FROM rescue_reports WHERE id = $1',
      [reportId]
    );

    if (reportResult.rows.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const report = reportResult.rows[0];
    
    if (report.rescuer_id !== req.user.id) {
      return res.status(403).json({ error: 'You are not assigned to this rescue' });
    }

    // Validate that photo proof is provided
    if (!completion_photo) {
      return res.status(400).json({ error: 'Completion photo is required for verification' });
    }

    // Update the report status to pending_verification
    const result = await db.query(
      `UPDATE rescue_reports 
       SET completion_photo = $1,
           resolution_notes = COALESCE($2, resolution_notes),
           status = 'pending_verification',
           submitted_for_verification_at = NOW(),
           updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [completion_photo, notes, reportId]
    );

    res.json({
      success: true,
      message: 'Rescue submitted for admin verification. You will be notified once approved.',
      report: result.rows[0]
    });
  } catch (error) {
    console.error('Submit verification error:', error);
    res.status(500).json({ error: 'Failed to submit for verification' });
  }
});

// Rescuer adopts a rescued animal
router.post('/:id/rescuer-adopt', authenticateToken, async (req, res) => {
  try {
    const reportId = req.params.id;
    const { notes } = req.body;
    
    // Verify the rescuer owns this rescue
    const reportResult = await db.query(
      'SELECT rescuer_id, status, title, animal_type, rescuer_adoption_status FROM rescue_reports WHERE id = $1',
      [reportId]
    );

    if (reportResult.rows.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const report = reportResult.rows[0];
    
    // Only allow the assigned rescuer to adopt
    if (report.rescuer_id !== req.user.id) {
      return res.status(403).json({ error: 'You are not assigned to this rescue' });
    }

    // Only allow adoption for verified/rescued status
    const adoptableStatuses = ['rescued', 'verified', 'closed'];
    if (!adoptableStatuses.includes(report.status)) {
      return res.status(400).json({ 
        error: `Cannot adopt from a rescue with status '${report.status}'. The rescue must be completed first.` 
      });
    }

    // Check if already adopted or has pending request
    if (report.rescuer_adoption_status === 'approved') {
      return res.status(400).json({ error: 'This animal has already been adopted.' });
    }

    if (report.rescuer_adoption_status === 'requested') {
      return res.status(400).json({ error: 'You already have a pending adoption request for this animal.' });
    }

    // Update the rescue with adoption request
    const result = await db.query(
      `UPDATE rescue_reports 
       SET rescuer_adoption_status = 'requested',
           rescuer_adopted_at = NOW(),
           rescuer_adoption_notes = $1,
           updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [notes || 'Rescuer wishes to adopt this rescued animal.', reportId]
    );

    // Log rescue history
    await logRescueHistory(
      reportId,
      'rescuer_adoption_requested',
      report.status,
      report.status,
      'rescuer',
      req.user.id,
      req.user?.full_name || 'Rescuer',
      { notes: notes || 'Rescuer wishes to adopt this rescued animal.', animal_type: report.animal_type }
    );

    console.log(`✅ Rescuer ${req.user.id} requested to adopt rescued animal from rescue ${reportId}`);

    res.json({
      success: true,
      message: 'Adoption request submitted! The admin team will review and contact you shortly.',
      report: result.rows[0]
    });
  } catch (error) {
    console.error('Rescuer adoption error:', error);
    res.status(500).json({ error: 'Failed to submit adoption request' });
  }
});

// Cancel rescue mission - rescuer abandons the rescue
router.put('/:id/cancel', authenticateToken, async (req, res) => {
  try {
    const reportId = req.params.id;
    const { reason } = req.body;
    
    // Verify the rescuer owns this rescue
    const reportResult = await db.query(
      'SELECT rescuer_id, status, title FROM rescue_reports WHERE id = $1',
      [reportId]
    );

    if (reportResult.rows.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const report = reportResult.rows[0];
    
    // Only allow the assigned rescuer to cancel
    if (report.rescuer_id !== req.user.id) {
      return res.status(403).json({ error: 'You are not assigned to this rescue' });
    }

    // Only allow cancellation for active statuses
    const cancellableStatuses = ['in_progress', 'on_the_way', 'arrived'];
    if (!cancellableStatuses.includes(report.status)) {
      return res.status(400).json({ 
        error: `Cannot cancel a rescue with status '${report.status}'. Only active rescues can be cancelled.` 
      });
    }

    // Reset the rescue back to 'new' status so other rescuers can pick it up
    const result = await db.query(
      `UPDATE rescue_reports 
       SET status = 'new',
           rescuer_id = NULL,
           responded_at = NULL,
           arrived_at = NULL,
           resolution_notes = $1,
           updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [`Cancelled by rescuer. Reason: ${reason || 'No reason provided'}`, reportId]
    );

    // Log rescue history
    await logRescueHistory(
      reportId,
      'rescuer_cancelled',
      report.status,
      'new',
      'rescuer',
      req.user.id,
      req.user?.full_name || 'Rescuer',
      { reason: reason || 'No reason provided', previous_status: report.status }
    );

    console.log(`✅ Rescue ${reportId} cancelled by rescuer ${req.user.id}. Reset to 'new' status.`);

    res.json({
      success: true,
      message: 'Rescue cancelled and released back to the queue.',
      report: result.rows[0]
    });
  } catch (error) {
    console.error('Cancel rescue error:', error);
    res.status(500).json({ error: 'Failed to cancel rescue' });
  }
});

module.exports = router;
