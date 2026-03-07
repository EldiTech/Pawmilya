const express = require('express');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get all available pets (public)
router.get('/', async (req, res) => {
  try {
    const { category, breed, size, gender, search, limit = 20, offset = 0 } = req.query;

    let query = `
      SELECT p.id, p.name, p.gender, p.size, p.color,
             CASE WHEN p.age_years > 0 THEN p.age_years || ' years' ELSE p.age_months || ' months' END as age,
             p.breed_name as breed,
             pc.name as species,
             p.location, p.status, p.is_featured, p.description, p.adoption_fee,
             p.vaccination_status, p.is_neutered, p.is_house_trained,
             p.is_good_with_kids, p.is_good_with_other_pets, p.special_needs,
             COALESCE(
               (SELECT image_url FROM pet_images WHERE pet_id = p.id AND is_primary = TRUE LIMIT 1),
               (SELECT image_url FROM pet_images WHERE pet_id = p.id ORDER BY display_order LIMIT 1),
               CASE WHEN p.images IS NOT NULL AND array_length(p.images, 1) > 0 THEN p.images[1] ELSE NULL END
             ) as image,
             p.created_at
      FROM pets p
      LEFT JOIN pet_categories pc ON p.category_id = pc.id
      WHERE p.status = 'available'
    `;

    const params = [];
    let paramIndex = 1;

    if (breed) {
      query += ` AND p.breed_name ILIKE $${paramIndex}`;
      params.push(`%${breed}%`);
      paramIndex++;
    }

    if (size) {
      query += ` AND p.size = $${paramIndex}`;
      params.push(size);
      paramIndex++;
    }

    if (gender) {
      query += ` AND p.gender = $${paramIndex}`;
      params.push(gender);
      paramIndex++;
    }

    if (search) {
      query += ` AND (p.name ILIKE $${paramIndex} OR p.location ILIKE $${paramIndex} OR p.breed_name ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    query += ` ORDER BY p.is_featured DESC, p.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Get pets error:', error);
    res.status(500).json({ error: 'Failed to get pets' });
  }
});

// Get featured pets (public)
router.get('/featured', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT p.id, p.name, p.gender, p.size, p.color,
             CASE WHEN p.age_years > 0 THEN p.age_years || ' years' ELSE p.age_months || ' months' END as age,
             p.breed_name as breed,
             pc.name as species,
             p.location, p.description, p.adoption_fee,
             p.vaccination_status, p.is_neutered, p.is_house_trained,
             p.is_good_with_kids, p.is_good_with_other_pets, p.special_needs,
             COALESCE(
               (SELECT image_url FROM pet_images WHERE pet_id = p.id AND is_primary = TRUE LIMIT 1),
               (SELECT image_url FROM pet_images WHERE pet_id = p.id ORDER BY display_order LIMIT 1),
               CASE WHEN p.images IS NOT NULL AND array_length(p.images, 1) > 0 THEN p.images[1] ELSE NULL END
             ) as image
      FROM pets p
      LEFT JOIN pet_categories pc ON p.category_id = pc.id
      WHERE p.status = 'available' AND p.is_featured = TRUE
      ORDER BY p.created_at DESC
      LIMIT 10
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Get featured pets error:', error);
    res.status(500).json({ error: 'Failed to get featured pets' });
  }
});

// Get pet categories
router.get('/categories', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT id, name, description, icon
      FROM pet_categories
      ORDER BY name
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ error: 'Failed to get categories' });
  }
});

// Get breeds by category
router.get('/breeds/:categoryId', async (req, res) => {
  try {
    const { categoryId } = req.params;
    const result = await db.query(`
      SELECT id, name, description
      FROM breeds
      WHERE category_id = $1
      ORDER BY name
    `, [categoryId]);
    res.json(result.rows);
  } catch (error) {
    console.error('Get breeds error:', error);
    res.status(500).json({ error: 'Failed to get breeds' });
  }
});

// Get single pet by ID
router.get('/:id', async (req, res) => {
  try {
    const petResult = await db.query(`
      SELECT p.*, 
             p.breed_name as breed,
             s.name as shelter_name, s.phone as shelter_phone, s.address as shelter_address
      FROM pets p
      LEFT JOIN shelters s ON p.shelter_id = s.id
      WHERE p.id = $1
    `, [req.params.id]);

    if (petResult.rows.length === 0) {
      return res.status(404).json({ error: 'Pet not found' });
    }

    const pet = petResult.rows[0];
    // Images are already included in pet.images array column

    res.json(pet);
  } catch (error) {
    console.error('Get pet error:', error);
    res.status(500).json({ error: 'Failed to get pet' });
  }
});

module.exports = router;
