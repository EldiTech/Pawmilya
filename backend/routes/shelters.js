const express = require('express');
const db = require('../config/database');

const router = express.Router();

// Helper function to get the best available image
const getShelterImageUrl = (shelter, type = 'cover') => {
  if (type === 'cover') {
    // Priority: cover_image (base64) > cover_image_url > logo_image > logo_url
    return shelter.cover_image || shelter.cover_image_url || shelter.cover_image_data || 
           shelter.logo_image || shelter.logo_url || shelter.logo_image_data || null;
  } else if (type === 'logo') {
    // Priority: logo_image (base64) > logo_url > logo_image_data
    return shelter.logo_image || shelter.logo_url || shelter.logo_image_data || null;
  }
  return null;
};

// Get all shelters
router.get('/', async (req, res) => {
  try {
    const { city, limit = 20, offset = 0 } = req.query;

    let query = `
      SELECT s.id, s.name, s.description, s.address, s.city, s.state, s.phone, s.email,
             s.logo_url, s.cover_image_url, s.logo_image, s.cover_image,
             s.latitude, s.longitude, s.operating_hours,
             s.is_verified, s.verification_status, s.current_count, s.shelter_type, 
             s.services_offered, s.animals_accepted, s.shelter_capacity, s.contact_person_name,
             (SELECT image_data FROM shelter_images WHERE shelter_id = s.id AND image_type = 'logo' ORDER BY display_order LIMIT 1) as logo_image_data,
             (SELECT image_data FROM shelter_images WHERE shelter_id = s.id AND image_type = 'cover' ORDER BY display_order LIMIT 1) as cover_image_data
      FROM shelters s
      WHERE s.is_active = TRUE
    `;

    const params = [];
    let paramIndex = 1;

    if (city) {
      query += ` AND s.city ILIKE $${paramIndex}`;
      params.push(`%${city}%`);
      paramIndex++;
    }

    query += ` ORDER BY s.is_verified DESC, s.name LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await db.query(query, params);
    
    // Process each shelter to include the best available image
    const shelters = result.rows.map(shelter => {
      const processedShelter = { ...shelter };
      
      // Set the cover_image_url to the best available image
      const coverImage = shelter.cover_image || shelter.cover_image_data || 
                         shelter.cover_image_url || shelter.logo_image || 
                         shelter.logo_image_data || shelter.logo_url;
      if (coverImage) {
        processedShelter.cover_image_url = coverImage;
      }
      
      // Set the logo_url to the best available logo
      const logoImage = shelter.logo_image || shelter.logo_image_data || shelter.logo_url;
      if (logoImage) {
        processedShelter.logo_url = logoImage;
      }
      
      return processedShelter;
    });
    
    res.json(shelters);
  } catch (error) {
    console.error('Get shelters error:', error);
    res.status(500).json({ error: 'Failed to get shelters' });
  }
});

// Get nearby shelters
router.get('/nearby', async (req, res) => {
  try {
    const { latitude, longitude, radius = 10 } = req.query;

    if (!latitude || !longitude) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    const lat = Number(latitude);
    const lon = Number(longitude);
    const radiusKm = Number(radius);

    if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(radiusKm) || radiusKm <= 0) {
      return res.status(400).json({ error: 'Latitude, longitude, and radius must be valid numbers' });
    }

    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      return res.status(400).json({ error: 'Latitude or longitude is out of range' });
    }

    // Calculate distance using a numerically safe Haversine variant.
    const result = await db.query(`
      WITH shelters_with_distance AS (
        SELECT s.id, s.name, s.address, s.city, s.phone, s.latitude, s.longitude,
               s.logo_url, s.logo_image, s.cover_image, s.cover_image_url, s.is_verified,
               (SELECT image_data FROM shelter_images WHERE shelter_id = s.id AND image_type = 'logo' ORDER BY display_order LIMIT 1) as logo_image_data,
               (
                 6371 * acos(
                   LEAST(
                     1,
                     GREATEST(
                       -1,
                       cos(radians($1)) * cos(radians(s.latitude)) *
                       cos(radians(s.longitude) - radians($2)) +
                       sin(radians($1)) * sin(radians(s.latitude))
                     )
                   )
                 )
               ) AS distance
        FROM shelters s
        WHERE s.is_active = TRUE
          AND s.latitude IS NOT NULL
          AND s.longitude IS NOT NULL
      )
      SELECT *
      FROM shelters_with_distance
      WHERE distance < $3
      ORDER BY distance
      LIMIT 10
    `, [lat, lon, radiusKm]);

    // Process shelters to include best available image
    const shelters = result.rows.map(shelter => {
      const processedShelter = { ...shelter };
      const logoImage = shelter.logo_image || shelter.logo_image_data || shelter.logo_url;
      if (logoImage) {
        processedShelter.logo_url = logoImage;
      }
      return processedShelter;
    });

    res.json(shelters);
  } catch (error) {
    console.error('Get nearby shelters error:', error);
    res.status(500).json({ error: 'Failed to get nearby shelters' });
  }
});

// Get single shelter with all images
router.get('/:id', async (req, res) => {
  try {
    const shelterResult = await db.query(
      `SELECT s.*, 
              (SELECT image_data FROM shelter_images WHERE shelter_id = s.id AND image_type = 'logo' ORDER BY display_order LIMIT 1) as logo_image_data,
              (SELECT image_data FROM shelter_images WHERE shelter_id = s.id AND image_type = 'cover' ORDER BY display_order LIMIT 1) as cover_image_data
       FROM shelters s WHERE s.id = $1 AND s.is_active = TRUE`,
      [req.params.id]
    );

    if (shelterResult.rows.length === 0) {
      return res.status(404).json({ error: 'Shelter not found' });
    }

    const shelter = shelterResult.rows[0];
    
    // Set best available images
    shelter.cover_image_url = shelter.cover_image || shelter.cover_image_data || 
                              shelter.cover_image_url || shelter.logo_image || 
                              shelter.logo_image_data || shelter.logo_url;
    shelter.logo_url = shelter.logo_image || shelter.logo_image_data || shelter.logo_url;

    // Get shelter's pets
    const petsResult = await db.query(`
      SELECT p.id, p.name, p.gender,
             CASE WHEN p.age_years > 0 THEN p.age_years || ' years' ELSE p.age_months || ' months' END as age,
             COALESCE(b.name, p.breed_name) as breed,
             (SELECT image_url FROM pet_images WHERE pet_id = p.id AND is_primary = TRUE LIMIT 1) as image
      FROM pets p
      LEFT JOIN breeds b ON p.breed_id = b.id
      WHERE p.shelter_id = $1 AND p.status = 'available'
      LIMIT 10
    `, [req.params.id]);

    shelter.pets = petsResult.rows;

    res.json(shelter);
  } catch (error) {
    console.error('Get shelter error:', error);
    res.status(500).json({ error: 'Failed to get shelter' });
  }
});

module.exports = router;
