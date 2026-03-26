const express = require('express');
const db = require('../config/database');
const { authenticateToken, authenticateAdmin } = require('../middleware/auth');

const router = express.Router();

const toTitleCase = (value) => {
  if (!value) return 'Rescued Animal';
  return String(value)
    .trim()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
};

const resolveCategoryId = async (client, animalType) => {
  if (!animalType) return null;

  const categoryResult = await client.query(
    `SELECT id
     FROM pet_categories
     WHERE LOWER(name) = LOWER($1)
        OR LOWER(name) = LOWER($2)
     ORDER BY CASE WHEN LOWER(name) = LOWER($1) THEN 0 ELSE 1 END
     LIMIT 1`,
    [animalType, animalType.endsWith('s') ? animalType.slice(0, -1) : `${animalType}s`]
  );

  return categoryResult.rows[0]?.id || null;
};

const syncShelterCurrentCount = async (client, shelterId) => {
  await client.query(
    `UPDATE shelters s
     SET current_count = (
       SELECT COUNT(*)::INTEGER
       FROM pets p
       WHERE p.shelter_id = $1
     ),
     updated_at = CURRENT_TIMESTAMP
     WHERE s.id = $1`,
    [shelterId]
  );
};

const createShelterIntakePet = async (client, transfer) => {
  const categoryId = await resolveCategoryId(client, transfer.animal_type || '');
  const petName = `${toTitleCase(transfer.animal_type || 'Rescued Animal')} #${transfer.rescue_report_id || transfer.id}`;
  const shelterLocation = [transfer.shelter_address, transfer.shelter_city].filter(Boolean).join(', ');

  const insertResult = await client.query(
    `INSERT INTO pets (
      name,
      category_id,
      breed_name,
      gender,
      description,
      medical_history,
      status,
      shelter_id,
      location,
      images,
      adoption_fee,
      created_by,
      updated_by,
      created_at,
      updated_at
    ) VALUES (
      $1,
      $2,
      $3,
      $4,
      $5,
      $6,
      'available',
      $7,
      $8,
      $9,
      0,
      $10,
      $11,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
    RETURNING id`,
    [
      petName,
      categoryId,
      'Unknown Breed',
      'Unknown',
      transfer.animal_description || 'Rescued animal transferred to shelter care.',
      transfer.animal_condition ? `Condition on intake: ${transfer.animal_condition}` : null,
      transfer.shelter_id,
      shelterLocation || transfer.shelter_name || 'Shelter',
      transfer.images || null,
      transfer.requester_id || null,
      transfer.requester_id || null,
    ]
  );

  return insertResult.rows[0]?.id || null;
};

// =====================================================
// USER ROUTES - For rescuers requesting shelter transfers
// =====================================================

// Get active shelters that are accepting pets
router.get('/available-shelters', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        s.id, 
        s.name, 
        s.description,
        s.address, 
        s.city, 
        s.state,
        s.phone, 
        s.email,
        s.logo_url,
        s.logo_image,
        s.cover_image_url,
        s.cover_image,
        s.latitude, 
        s.longitude,
        s.operating_hours,
        s.shelter_type,
        s.animals_accepted,
        s.services_offered,
        s.shelter_capacity,
        s.current_count,
        s.is_verified,
        s.verification_status,
        CASE 
          WHEN s.shelter_capacity IS NOT NULL AND s.shelter_capacity > 0 
          THEN s.shelter_capacity - COALESCE(s.current_count, 0)
          ELSE NULL 
        END as available_slots,
        (SELECT image_data FROM shelter_images WHERE shelter_id = s.id AND image_type = 'logo' ORDER BY display_order LIMIT 1) as logo_image_data,
        (SELECT image_data FROM shelter_images WHERE shelter_id = s.id AND image_type = 'cover' ORDER BY display_order LIMIT 1) as cover_image_data
      FROM shelters s
      WHERE s.is_active = TRUE 
        AND (
          s.shelter_capacity IS NULL 
          OR s.shelter_capacity = 0 
          OR s.current_count < s.shelter_capacity
        )
      ORDER BY 
        CASE s.verification_status WHEN 'verified' THEN 0 ELSE 1 END,
        s.name ASC
    `);

    // Process shelters to include best available image
    const shelters = result.rows.map(shelter => {
      const processedShelter = { ...shelter };
      
      // Set the cover image
      processedShelter.display_cover = shelter.cover_image || shelter.cover_image_data || 
                                       shelter.cover_image_url || shelter.logo_image || 
                                       shelter.logo_image_data || shelter.logo_url;
      
      // Set the logo
      processedShelter.display_logo = shelter.logo_image || shelter.logo_image_data || shelter.logo_url;
      
      // Calculate status
      if (shelter.shelter_capacity && shelter.shelter_capacity > 0) {
        const available = shelter.shelter_capacity - (shelter.current_count || 0);
        processedShelter.is_accepting = available > 0;
        processedShelter.capacity_status = available > 5 ? 'available' : available > 0 ? 'limited' : 'full';
      } else {
        processedShelter.is_accepting = true;
        processedShelter.capacity_status = 'available';
      }
      
      return processedShelter;
    });

    res.json(shelters);
  } catch (error) {
    console.error('Get available shelters error:', error);
    res.status(500).json({ error: 'Failed to get available shelters' });
  }
});

// Create a shelter transfer request
router.post('/request', authenticateToken, async (req, res) => {
  try {
    const {
      rescue_report_id,
      shelter_id,
      notes,
      urgency = 'normal'
    } = req.body;

    const requester_id = req.user.id;

    // Validate required fields
    if (!rescue_report_id || !shelter_id) {
      return res.status(400).json({ error: 'Rescue report ID and shelter ID are required' });
    }

    // Verify the rescue report exists and belongs to the user (as rescuer)
    const rescueResult = await db.query(
      `SELECT id, title, description, animal_type, condition, images, rescuer_id, status
       FROM rescue_reports WHERE id = $1`,
      [rescue_report_id]
    );

    if (rescueResult.rows.length === 0) {
      return res.status(404).json({ error: 'Rescue report not found' });
    }

    const rescue = rescueResult.rows[0];

    // Only the rescuer who completed the mission can request transfer
    if (rescue.rescuer_id !== requester_id) {
      return res.status(403).json({ error: 'Only the assigned rescuer can request shelter transfer' });
    }

    // Rescue must be in completed status
    if (rescue.status !== 'rescued' && rescue.status !== 'resolved') {
      return res.status(400).json({ error: 'Rescue must be completed before transferring to shelter' });
    }

    // Verify the shelter exists and is active
    const shelterResult = await db.query(
      `SELECT id, name, manager_id, shelter_capacity, current_count FROM shelters 
       WHERE id = $1 AND is_active = TRUE`,
      [shelter_id]
    );

    if (shelterResult.rows.length === 0) {
      return res.status(404).json({ error: 'Shelter not found or not active' });
    }

    const shelter = shelterResult.rows[0];

    // Check if shelter has capacity
    if (shelter.shelter_capacity && shelter.shelter_capacity > 0) {
      if ((shelter.current_count || 0) >= shelter.shelter_capacity) {
        return res.status(400).json({ error: 'Shelter is at full capacity' });
      }
    }

    // Check for existing pending request for this rescue
    const existingRequest = await db.query(
      `SELECT id FROM shelter_transfer_requests 
       WHERE rescue_report_id = $1 AND status IN ('pending', 'approved', 'accepted', 'in_transit', 'arrived_at_shelter')`,
      [rescue_report_id]
    );

    if (existingRequest.rows.length > 0) {
      return res.status(400).json({ error: 'A transfer request already exists for this rescue' });
    }

    // Create the transfer request
    const insertResult = await db.query(
      `INSERT INTO shelter_transfer_requests (
        rescue_report_id, shelter_id, requester_id,
        animal_type, animal_description, animal_condition, images,
        notes, urgency, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending')
      RETURNING *`,
      [
        rescue_report_id,
        shelter_id,
        requester_id,
        rescue.animal_type,
        rescue.description,
        rescue.condition,
        rescue.images,
        notes,
        urgency
      ]
    );

    const transferRequest = insertResult.rows[0];

    // Create notification for shelter owner (if exists)
    const requesterResult = await db.query(
      'SELECT full_name FROM users WHERE id = $1',
      [requester_id]
    );
    const requesterName = requesterResult.rows[0]?.full_name || 'A rescuer';

    // Notify the shelter manager if they exist in users table
    if (shelter.manager_id) {
      try {
        await db.query(
          `INSERT INTO notifications (user_id, type, title, message, data)
           VALUES ($1, 'shelter_transfer', 'New Shelter Transfer Request', $2, $3)`,
          [
            shelter.manager_id,
            `${requesterName} has requested to transfer a rescued ${rescue.animal_type || 'animal'} to ${shelter.name}`,
            JSON.stringify({
              transfer_request_id: transferRequest.id,
              rescue_report_id: rescue_report_id,
              shelter_id: shelter_id
            })
          ]
        );
      } catch (notifError) {
        // Log but don't fail the request if notification fails
        console.error('Failed to create notification for shelter owner:', notifError.message);
      }
    }

    res.status(201).json({
      success: true,
      message: 'Shelter transfer request submitted successfully',
      transfer_request: transferRequest
    });

  } catch (error) {
    console.error('Create shelter transfer request error:', error);
    res.status(500).json({ error: 'Failed to create shelter transfer request' });
  }
});

// Get user's transfer requests
router.get('/my-requests', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT 
        str.*,
        s.name as shelter_name,
        s.address as shelter_address,
        s.phone as shelter_phone,
        rr.title as rescue_title,
        COALESCE(rr.location_description, 'Location not specified') as rescue_location
       FROM shelter_transfer_requests str
       LEFT JOIN shelters s ON str.shelter_id = s.id
       LEFT JOIN rescue_reports rr ON str.rescue_report_id = rr.id
       WHERE str.requester_id = $1
       ORDER BY str.created_at DESC`,
      [req.user.id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get my transfer requests error:', error);
    res.status(500).json({ error: 'Failed to get transfer requests' });
  }
});

// Update delivery progress for an approved transfer (rescuer)
router.put('/:id/delivery-status', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    const allowedStatuses = ['in_transit', 'arrived_at_shelter', 'completed'];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        error: 'Invalid status. Allowed values: in_transit, arrived_at_shelter, completed'
      });
    }

    const requestResult = await db.query(
      `SELECT str.*, s.name as shelter_name, s.address as shelter_address, s.city as shelter_city
       FROM shelter_transfer_requests str
       LEFT JOIN shelters s ON str.shelter_id = s.id
       WHERE str.id = $1 AND str.requester_id = $2`,
      [id, req.user.id]
    );

    if (requestResult.rows.length === 0) {
      return res.status(404).json({ error: 'Transfer request not found' });
    }

    const transfer = requestResult.rows[0];
    const currentStatus = transfer.status;

    const transitionMap = {
      approved: 'in_transit',
      accepted: 'in_transit',
      in_transit: 'arrived_at_shelter',
      arrived_at_shelter: 'completed'
    };

    if (currentStatus === 'completed') {
      return res.status(400).json({ error: 'Transfer is already completed' });
    }

    // Allow idempotent retry
    if (currentStatus === status) {
      return res.json({
        success: true,
        message: 'Delivery status already up to date',
        transfer_request: transfer
      });
    }

    const expectedNextStatus = transitionMap[currentStatus];
    if (!expectedNextStatus || expectedNextStatus !== status) {
      return res.status(400).json({
        error: `Invalid transition from ${currentStatus} to ${status}`
      });
    }

    const client = await db.pool.connect();
    let updateResult;
    try {
      await client.query('BEGIN');

      if (status === 'completed') {
        updateResult = await client.query(
          `UPDATE shelter_transfer_requests
           SET status = 'completed',
               completed_at = CURRENT_TIMESTAMP,
               completion_notes = COALESCE($1, completion_notes),
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $2
           RETURNING *`,
          [notes || null, id]
        );

        const createdPetId = await createShelterIntakePet(client, transfer);

        await syncShelterCurrentCount(client, transfer.shelter_id);

        await client.query(
          `INSERT INTO notifications (user_id, type, title, message, data)
           VALUES ($1, 'shelter_transfer', 'Transfer Completed', $2, $3)`,
          [
            transfer.requester_id,
            `Delivery confirmed. The rescued animal has been turned over to ${transfer.shelter_name || 'the shelter'}.`,
            JSON.stringify({ transfer_request_id: id, status: 'completed', pet_id: createdPetId })
          ]
        );
      } else {
        updateResult = await client.query(
          `UPDATE shelter_transfer_requests
           SET status = $1,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $2
           RETURNING *`,
          [status, id]
        );
      }

      await client.query('COMMIT');
    } catch (txError) {
      await client.query('ROLLBACK');
      throw txError;
    } finally {
      client.release();
    }

    const message = status === 'in_transit'
      ? 'Delivery trip started. Navigate to the shelter and update your progress.'
      : status === 'arrived_at_shelter'
        ? 'Arrival recorded. Confirm handover when complete.'
        : 'Transfer completed successfully.';

    res.json({
      success: true,
      message,
      transfer_request: updateResult.rows[0]
    });
  } catch (error) {
    console.error('Update delivery status error:', error);
    res.status(500).json({ error: 'Failed to update delivery status' });
  }
});

// Cancel a pending transfer request
router.put('/:id/cancel', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `UPDATE shelter_transfer_requests 
       SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND requester_id = $2 AND status = 'pending'
       RETURNING *`,
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Transfer request not found or cannot be cancelled' });
    }

    res.json({
      success: true,
      message: 'Transfer request cancelled',
      transfer_request: result.rows[0]
    });
  } catch (error) {
    console.error('Cancel transfer request error:', error);
    res.status(500).json({ error: 'Failed to cancel transfer request' });
  }
});

// =====================================================
// ADMIN ROUTES - For managing shelter transfer requests
// =====================================================

// Get all transfer requests (admin)
router.get('/admin/all', authenticateAdmin, async (req, res) => {
  try {
    const { status, shelter_id, limit = 50, offset = 0 } = req.query;

    let query = `
      SELECT 
        str.*,
        s.name as shelter_name,
        s.address as shelter_address,
        s.city as shelter_city,
        s.phone as shelter_phone,
        rr.title as rescue_title,
        rr.location_description as rescue_location,
        rr.images as rescue_images,
        u.full_name as requester_name,
        u.phone as requester_phone,
        u.email as requester_email
       FROM shelter_transfer_requests str
       LEFT JOIN shelters s ON str.shelter_id = s.id
       LEFT JOIN rescue_reports rr ON str.rescue_report_id = rr.id
       LEFT JOIN users u ON str.requester_id = u.id
       WHERE 1=1
    `;

    const params = [];
    let paramIndex = 1;

    if (status) {
      query += ` AND str.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (shelter_id) {
      query += ` AND str.shelter_id = $${paramIndex}`;
      params.push(shelter_id);
      paramIndex++;
    }

    query += ` ORDER BY 
      CASE str.urgency 
        WHEN 'critical' THEN 1 
        WHEN 'high' THEN 2 
        WHEN 'normal' THEN 3 
        WHEN 'low' THEN 4 
      END,
      str.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await db.query(query, params);

    // Get counts by status
    const countsResult = await db.query(`
      SELECT 
        status,
        COUNT(*) as count
      FROM shelter_transfer_requests
      GROUP BY status
    `);

    const counts = {
      total: 0,
      pending: 0,
      approved: 0,
      rejected: 0,
      completed: 0,
      cancelled: 0
    };

    countsResult.rows.forEach(row => {
      counts[row.status] = parseInt(row.count);
      counts.total += parseInt(row.count);
    });

    res.json({
      requests: result.rows,
      counts
    });
  } catch (error) {
    console.error('Get all transfer requests error:', error);
    res.status(500).json({ error: 'Failed to get transfer requests' });
  }
});

// Approve a transfer request (admin)
router.put('/admin/:id/approve', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { review_notes } = req.body;

    // Get the request first
    const requestResult = await db.query(
      `SELECT str.*, s.name as shelter_name, s.current_count, s.shelter_capacity
       FROM shelter_transfer_requests str
       LEFT JOIN shelters s ON str.shelter_id = s.id
       WHERE str.id = $1`,
      [id]
    );

    if (requestResult.rows.length === 0) {
      return res.status(404).json({ error: 'Transfer request not found' });
    }

    const request = requestResult.rows[0];

    if (request.status !== 'pending') {
      return res.status(400).json({ error: 'Only pending requests can be approved' });
    }

    // Update the request
    const updateResult = await db.query(
      `UPDATE shelter_transfer_requests 
       SET status = 'approved', 
           reviewed_by = $1, 
           reviewed_at = CURRENT_TIMESTAMP,
           review_notes = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`,
      [req.admin.id, review_notes, id]
    );

    // Notify the requester
    await db.query(
      `INSERT INTO notifications (user_id, type, title, message, data)
       VALUES ($1, 'shelter_transfer', 'Transfer Request Approved', $2, $3)`,
      [
        request.requester_id,
        `Your request to transfer the rescued animal to ${request.shelter_name} has been approved. Please bring the animal during operating hours.`,
        JSON.stringify({
          transfer_request_id: id,
          status: 'approved'
        })
      ]
    );

    res.json({
      success: true,
      message: 'Transfer request approved',
      transfer_request: updateResult.rows[0]
    });
  } catch (error) {
    console.error('Approve transfer request error:', error);
    res.status(500).json({ error: 'Failed to approve transfer request' });
  }
});

// Reject a transfer request (admin)
router.put('/admin/:id/reject', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { rejection_reason, review_notes } = req.body;

    if (!rejection_reason) {
      return res.status(400).json({ error: 'Rejection reason is required' });
    }

    // Get the request first
    const requestResult = await db.query(
      `SELECT str.*, s.name as shelter_name
       FROM shelter_transfer_requests str
       LEFT JOIN shelters s ON str.shelter_id = s.id
       WHERE str.id = $1`,
      [id]
    );

    if (requestResult.rows.length === 0) {
      return res.status(404).json({ error: 'Transfer request not found' });
    }

    const request = requestResult.rows[0];

    if (request.status !== 'pending') {
      return res.status(400).json({ error: 'Only pending requests can be rejected' });
    }

    // Update the request
    const updateResult = await db.query(
      `UPDATE shelter_transfer_requests 
       SET status = 'rejected', 
           reviewed_by = $1, 
           reviewed_at = CURRENT_TIMESTAMP,
           rejection_reason = $2,
           review_notes = $3,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING *`,
      [req.admin.id, rejection_reason, review_notes, id]
    );

    // Notify the requester
    await db.query(
      `INSERT INTO notifications (user_id, type, title, message, data)
       VALUES ($1, 'shelter_transfer', 'Transfer Request Declined', $2, $3)`,
      [
        request.requester_id,
        `Your request to transfer the rescued animal to ${request.shelter_name} was declined. Reason: ${rejection_reason}`,
        JSON.stringify({
          transfer_request_id: id,
          status: 'rejected',
          reason: rejection_reason
        })
      ]
    );

    res.json({
      success: true,
      message: 'Transfer request rejected',
      transfer_request: updateResult.rows[0]
    });
  } catch (error) {
    console.error('Reject transfer request error:', error);
    res.status(500).json({ error: 'Failed to reject transfer request' });
  }
});

// Mark transfer as completed (admin)
router.put('/admin/:id/complete', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { completion_notes } = req.body;

    // Get the request first
    const requestResult = await db.query(
      `SELECT str.*, s.name as shelter_name, s.id as shelter_id, s.address as shelter_address, s.city as shelter_city
       FROM shelter_transfer_requests str
       LEFT JOIN shelters s ON str.shelter_id = s.id
       WHERE str.id = $1`,
      [id]
    );

    if (requestResult.rows.length === 0) {
      return res.status(404).json({ error: 'Transfer request not found' });
    }

    const request = requestResult.rows[0];

    if (!['approved', 'accepted', 'in_transit', 'arrived_at_shelter'].includes(request.status)) {
      return res.status(400).json({ error: 'Only approved or in-progress requests can be marked as completed' });
    }

    const client = await db.pool.connect();
    let updateResult;
    try {
      await client.query('BEGIN');

      // Update the request
      updateResult = await client.query(
        `UPDATE shelter_transfer_requests 
         SET status = 'completed', 
             completed_at = CURRENT_TIMESTAMP,
             completion_notes = $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
         RETURNING *`,
        [completion_notes, id]
      );

      const createdPetId = await createShelterIntakePet(client, request);

      await syncShelterCurrentCount(client, request.shelter_id);

      // Notify the requester
      await client.query(
        `INSERT INTO notifications (user_id, type, title, message, data)
         VALUES ($1, 'shelter_transfer', 'Transfer Completed', $2, $3)`,
        [
          request.requester_id,
          `The rescued animal has been successfully transferred to ${request.shelter_name}. Thank you for your rescue efforts!`,
          JSON.stringify({
            transfer_request_id: id,
            status: 'completed',
            pet_id: createdPetId
          })
        ]
      );

      await client.query('COMMIT');
    } catch (txError) {
      await client.query('ROLLBACK');
      throw txError;
    } finally {
      client.release();
    }

    res.json({
      success: true,
      message: 'Transfer marked as completed',
      transfer_request: updateResult.rows[0]
    });
  } catch (error) {
    console.error('Complete transfer request error:', error);
    res.status(500).json({ error: 'Failed to complete transfer request' });
  }
});

// Delete transfer request (admin)
router.delete('/admin/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Get the request first to check if it exists and for logging
    const requestResult = await db.query(
      `SELECT str.*, u.full_name as requester_name, s.name as shelter_name
       FROM shelter_transfer_requests str
       LEFT JOIN users u ON str.requester_id = u.id
       LEFT JOIN shelters s ON str.shelter_id = s.id
       WHERE str.id = $1`,
      [id]
    );

    if (requestResult.rows.length === 0) {
      return res.status(404).json({ error: 'Transfer request not found' });
    }

    const request = requestResult.rows[0];

    // Delete the request
    await db.query('DELETE FROM shelter_transfer_requests WHERE id = $1', [id]);

    if (request.shelter_id) {
      await db.query(
        `UPDATE shelters s
         SET current_count = (
           SELECT COUNT(*)::INTEGER
           FROM pets p
           WHERE p.shelter_id = $1
         ),
         updated_at = CURRENT_TIMESTAMP
         WHERE s.id = $1`,
        [request.shelter_id]
      );
    }

    console.log(`Shelter transfer ${id} deleted by admin. Requester: ${request.requester_name}, Shelter: ${request.shelter_name}`);

    res.json({
      success: true,
      message: 'Transfer request deleted successfully'
    });
  } catch (error) {
    console.error('Delete transfer request error:', error);
    res.status(500).json({ error: 'Failed to delete transfer request' });
  }
});

// Get transfer request details (admin)
router.get('/admin/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT 
        str.*,
        s.name as shelter_name,
        s.address as shelter_address,
        s.city as shelter_city,
        s.phone as shelter_phone,
        s.email as shelter_email,
        s.operating_hours as shelter_hours,
        rr.title as rescue_title,
        rr.description as rescue_description,
        COALESCE(rr.location_description, 'Location not specified') as rescue_location,
        rr.images as rescue_images,
        rr.animal_type as rescue_animal_type,
        rr.condition as rescue_condition,
        u.full_name as requester_name,
        u.phone as requester_phone,
        u.email as requester_email,
        reviewer.full_name as reviewer_name
       FROM shelter_transfer_requests str
       LEFT JOIN shelters s ON str.shelter_id = s.id
       LEFT JOIN rescue_reports rr ON str.rescue_report_id = rr.id
       LEFT JOIN users u ON str.requester_id = u.id
       LEFT JOIN admins reviewer ON str.reviewed_by = reviewer.id
       WHERE str.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Transfer request not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get transfer request details error:', error);
    res.status(500).json({ error: 'Failed to get transfer request details' });
  }
});

module.exports = router;
