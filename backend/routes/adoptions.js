const express = require('express');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validation');
const { logger } = require('../config/logger');

const router = express.Router();

// Create adoption application
router.post('/', authenticateToken, validate(schemas.adoptionApplication), async (req, res) => {
  try {
    const {
      pet_id,
      living_situation,
      has_yard,
      yard_fenced,
      rental_allows_pets,
      household_members,
      has_children,
      children_ages,
      has_other_pets,
      other_pets_details,
      previous_pet_experience,
      reason_for_adoption,
      work_schedule,
      emergency_contact_name,
      emergency_contact_phone,
      veterinarian_name,
      veterinarian_phone,
      additional_notes,
    } = req.body;

    // Check if pet exists and is available
    const petCheck = await db.query('SELECT status FROM pets WHERE id = $1', [pet_id]);
    if (petCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Pet not found' });
    }
    if (petCheck.rows[0].status !== 'available') {
      return res.status(400).json({ error: 'Pet is not available for adoption' });
    }

    // Check for existing application
    const existingApp = await db.query(
      `SELECT id FROM adoption_applications 
       WHERE pet_id = $1 AND user_id = $2 AND status NOT IN ('rejected', 'cancelled')`,
      [pet_id, req.user.id]
    );
    if (existingApp.rows.length > 0) {
      return res.status(409).json({ error: 'You already have an application for this pet' });
    }

    const result = await db.query(
      `INSERT INTO adoption_applications (
        pet_id, user_id, living_situation, has_yard, yard_fenced, rental_allows_pets,
        household_members, has_children, children_ages, has_other_pets, other_pets_details,
        previous_pet_experience, reason_for_adoption, work_schedule,
        emergency_contact_name, emergency_contact_phone, veterinarian_name, veterinarian_phone,
        additional_notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
      RETURNING id, status, submitted_at`,
      [
        pet_id, req.user.id, living_situation, has_yard, yard_fenced, rental_allows_pets,
        household_members, has_children, children_ages, has_other_pets, other_pets_details,
        previous_pet_experience, reason_for_adoption, work_schedule,
        emergency_contact_name, emergency_contact_phone, veterinarian_name, veterinarian_phone,
        additional_notes,
      ]
    );

    // Update pet status to pending
    await db.query('UPDATE pets SET status = $1 WHERE id = $2', ['pending', pet_id]);

    res.status(201).json({
      message: 'Adoption application submitted successfully',
      application: result.rows[0],
    });
  } catch (error) {
    console.error('Create application error:', error);
    res.status(500).json({ error: 'Failed to submit application' });
  }
});

// Get user's applications
router.get('/my-applications', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT a.id, a.status, a.submitted_at, a.review_notes,
              a.payment_completed, a.payment_amount, a.payment_date,
              a.delivery_full_name, a.delivery_phone, a.delivery_address,
              a.delivery_city, a.delivery_postal_code, a.delivery_notes,
              a.delivery_status, a.delivery_scheduled_date, a.delivery_actual_date,
              a.delivery_tracking_notes, a.delivery_updated_at,
              a.living_situation, a.has_yard, a.yard_fenced, a.rental_allows_pets,
              a.household_members, a.has_children, a.children_ages, a.has_other_pets,
              a.other_pets_details, a.previous_pet_experience, a.reason_for_adoption,
              a.work_schedule, a.emergency_contact_name, a.emergency_contact_phone,
              a.veterinarian_name, a.veterinarian_phone, a.additional_notes,
              p.id as pet_id, p.name as pet_name, p.adoption_fee, p.age_years, p.age_months, p.gender, p.size,
              pc.name as species,
              COALESCE(b.name, p.breed_name) as breed,
              COALESCE(
                (SELECT image_url FROM pet_images WHERE pet_id = p.id AND is_primary = TRUE LIMIT 1),
                (SELECT image_url FROM pet_images WHERE pet_id = p.id ORDER BY display_order LIMIT 1),
                CASE WHEN p.images IS NOT NULL AND array_length(p.images, 1) > 0 THEN p.images[1] ELSE NULL END
              ) as pet_image,
              s.name as shelter_name
       FROM adoption_applications a
       JOIN pets p ON a.pet_id = p.id
       LEFT JOIN pet_categories pc ON p.category_id = pc.id
       LEFT JOIN breeds b ON p.breed_id = b.id
       LEFT JOIN shelters s ON p.shelter_id = s.id
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

// Get single application
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT a.*, 
              p.name as pet_name,
              CASE WHEN p.images IS NOT NULL AND array_length(p.images, 1) > 0 THEN p.images[1] ELSE NULL END as pet_image
       FROM adoption_applications a
       JOIN pets p ON a.pet_id = p.id
       WHERE a.id = $1 AND a.user_id = $2`,
      [req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Application not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get application error:', error);
    res.status(500).json({ error: 'Failed to get application' });
  }
});

// Cancel application
router.put('/:id/cancel', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      `UPDATE adoption_applications 
       SET status = 'cancelled', updated_at = NOW()
       WHERE id = $1 AND user_id = $2 AND status IN ('pending', 'reviewing')
       RETURNING id, status, pet_id`,
      [req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Application not found or cannot be cancelled' });
    }

    // Update pet status back to available
    await db.query('UPDATE pets SET status = $1 WHERE id = $2', ['available', result.rows[0].pet_id]);

    res.json({ message: 'Application cancelled', application: result.rows[0] });
  } catch (error) {
    console.error('Cancel application error:', error);
    res.status(500).json({ error: 'Failed to cancel application' });
  }
});

// Submit payment and delivery details for approved adoption
router.post('/:id/payment', authenticateToken, async (req, res) => {
  try {
    const { deliveryDetails, paymentAmount } = req.body;
    const applicationId = req.params.id;

    // Verify the application belongs to the user and is approved
    const appCheck = await db.query(
      `SELECT a.id, a.status, a.pet_id, p.name as pet_name
       FROM adoption_applications a
       JOIN pets p ON a.pet_id = p.id
       WHERE a.id = $1 AND a.user_id = $2`,
      [applicationId, req.user.id]
    );

    if (appCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Application not found' });
    }

    if (appCheck.rows[0].status !== 'approved') {
      return res.status(400).json({ error: 'Application must be approved before payment' });
    }

    // Update application with payment and delivery details, set initial delivery status
    const result = await db.query(
      `UPDATE adoption_applications 
       SET payment_completed = true,
           payment_amount = $1,
           payment_date = NOW(),
           delivery_full_name = $2,
           delivery_phone = $3,
           delivery_address = $4,
           delivery_city = $5,
           delivery_postal_code = $6,
           delivery_notes = $7,
           delivery_status = 'processing',
           delivery_updated_at = NOW(),
           updated_at = NOW()
       WHERE id = $8
       RETURNING id, status, payment_completed, delivery_status`,
      [
        paymentAmount,
        deliveryDetails.fullName,
        deliveryDetails.phone,
        deliveryDetails.address,
        deliveryDetails.city,
        deliveryDetails.postalCode,
        deliveryDetails.notes,
        applicationId
      ]
    );

    // Update pet status to adopted
    await db.query('UPDATE pets SET status = $1 WHERE id = $2', ['adopted', appCheck.rows[0].pet_id]);

    res.json({
      success: true,
      message: 'Payment confirmed and delivery details saved',
      application: result.rows[0],
    });
  } catch (error) {
    console.error('Payment submission error:', error);
    res.status(500).json({ error: 'Failed to process payment' });
  }
});

module.exports = router;
