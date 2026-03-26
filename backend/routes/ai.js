const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const db = require('../config/database');

const router = express.Router();

const DEFAULT_GEMINI_MODELS = ['gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-2.0-flash-lite'];

// ─── Dynamic app context for AI assistant ───────────────────
router.get('/context', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Run all queries in parallel
    const [
      petStats,
      shelterStats,
      categoryList,
      userAdoptions,
      userRescues,
      userProfile,
      recentPets,
      shelterList,
    ] = await Promise.all([
      // Pet statistics
      db.query(`
        SELECT
          COUNT(*) FILTER (WHERE status = 'available') AS available,
          COUNT(*) FILTER (WHERE status = 'pending')   AS pending,
          COUNT(*) FILTER (WHERE status = 'adopted')   AS adopted,
          COUNT(*)                                      AS total,
          COALESCE(MIN(adoption_fee), 0)                AS min_fee,
          COALESCE(MAX(adoption_fee), 0)                AS max_fee,
          COALESCE(ROUND(AVG(adoption_fee), 2), 0)      AS avg_fee
        FROM pets
      `),
      // Shelter statistics
      db.query(`
        SELECT
          COUNT(*) FILTER (WHERE is_active = true)  AS active,
          COUNT(*) FILTER (WHERE is_verified = true) AS verified,
          COUNT(*)                                    AS total,
          COALESCE(SUM(current_count), 0)             AS total_animals,
          COALESCE(SUM(shelter_capacity), 0)           AS total_capacity
        FROM shelters
      `),
      // Available categories
      db.query(`
        SELECT c.name, COUNT(p.id) AS pet_count
        FROM pet_categories c
        LEFT JOIN pets p ON p.category_id = c.id AND p.status = 'available'
        GROUP BY c.id, c.name ORDER BY pet_count DESC
      `),
      // Current user's adoptions
      db.query(`
        SELECT aa.status, p.name AS pet_name
        FROM adoption_applications aa
        LEFT JOIN pets p ON p.id = aa.pet_id
        WHERE aa.user_id = $1
        ORDER BY aa.created_at DESC LIMIT 5
      `, [userId]),
      // Current user's rescue reports
      db.query(`
        SELECT status, title, urgency
        FROM rescue_reports
        WHERE reporter_id = $1
        ORDER BY created_at DESC LIMIT 5
      `, [userId]),
      // Current user's profile
      db.query(`
        SELECT role, full_name, city, two_factor_enabled
        FROM users WHERE id = $1
      `, [userId]),
      // Recently added available pets (for recommendations)
      db.query(`
        SELECT p.name, p.breed_name, p.gender, p.age_years, p.age_months,
               p.adoption_fee, c.name AS category, s.name AS shelter_name, s.city AS shelter_city
        FROM pets p
        LEFT JOIN pet_categories c ON c.id = p.category_id
        LEFT JOIN shelters s ON s.id = p.shelter_id
        WHERE p.status = 'available'
        ORDER BY p.created_at DESC LIMIT 8
      `),
      // Shelter directory
      db.query(`
        SELECT name, city, shelter_type AS type, is_verified, current_count, shelter_capacity AS max_capacity
        FROM shelters WHERE is_active = true
        ORDER BY is_verified DESC, name LIMIT 15
      `),
    ]);

    const pets = petStats.rows[0];
    const shelters = shelterStats.rows[0];
    const profile = userProfile.rows[0] || {};

    res.json({
      petStats: {
        available: parseInt(pets.available),
        pending: parseInt(pets.pending),
        adopted: parseInt(pets.adopted),
        total: parseInt(pets.total),
        feeRange: { min: parseFloat(pets.min_fee), max: parseFloat(pets.max_fee), avg: parseFloat(pets.avg_fee) },
      },
      shelterStats: {
        active: parseInt(shelters.active),
        verified: parseInt(shelters.verified),
        total: parseInt(shelters.total),
        totalAnimals: parseInt(shelters.total_animals),
        totalCapacity: parseInt(shelters.total_capacity),
      },
      categories: categoryList.rows,
      recentPets: recentPets.rows,
      shelters: shelterList.rows,
      userActivity: {
        adoptions: userAdoptions.rows,
        rescues: userRescues.rows,
      },
      userProfile: {
        name: profile.full_name,
        role: profile.role,
        city: profile.city,
        twoFactorEnabled: profile.two_factor_enabled,
      },
    });
  } catch (error) {
    console.error('AI context error:', error);
    res.status(500).json({ error: 'Failed to load app context' });
  }
});

router.post('/chat', authenticateToken, async (req, res) => {
  try {
    const geminiApiKey = process.env.GEMINI_API_KEY;

    if (!geminiApiKey) {
      return res.status(500).json({ error: 'Gemini service is not configured' });
    }

    const { model, requestBody } = req.body;

    if (!requestBody || !Array.isArray(requestBody.contents) || requestBody.contents.length === 0) {
      return res.status(400).json({ error: 'Invalid AI request payload' });
    }

    const allowedModels = process.env.GEMINI_MODELS
      ? process.env.GEMINI_MODELS.split(',').map((m) => m.trim()).filter(Boolean)
      : DEFAULT_GEMINI_MODELS;

    const selectedModel = allowedModels.includes(model) ? model : allowedModels[0];
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${geminiApiKey}`;

    const geminiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    const responseText = await geminiResponse.text();

    if (!geminiResponse.ok) {
      return res.status(geminiResponse.status).json({
        error: 'Gemini request failed',
        details: responseText,
      });
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (error) {
      return res.status(502).json({ error: 'Invalid response from Gemini service' });
    }

    return res.json(data);
  } catch (error) {
    console.error('AI chat proxy error:', error);
    return res.status(500).json({ error: 'AI service unavailable' });
  }
});

module.exports = router;
