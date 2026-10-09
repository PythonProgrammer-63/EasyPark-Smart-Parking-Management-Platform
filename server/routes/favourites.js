const express = require('express');
const router = express.Router();
const { query, queryOne, run } = require('../database/db');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

// Get all favourites for logged in user
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const items = await query(`
      SELECT f.id as fav_id, f.created_at as saved_at, p.*,
        (SELECT COUNT(*) FROM reviews r WHERE r.parking_id = p.id) as review_count,
        (SELECT AVG(r.rating) FROM reviews r WHERE r.parking_id = p.id) as avg_rating
      FROM favourites f
      JOIN parkings p ON f.parking_id = p.id
      WHERE f.user_id = ?
      ORDER BY f.created_at DESC
    `, [userId]);

    const enriched = await Promise.all(items.map(async (p) => {
      const photos = await query('SELECT id, photo_url, photo_type, caption FROM parking_photos WHERE parking_id = ? ORDER BY id ASC', [p.id]);
      const primaryPhoto = photos.length > 0 ? photos[0].photo_url : 'https://images.unsplash.com/photo-1506521781263-d8422e82f27a?auto=format&fit=crop&w=1200&q=80';

      return {
        ...p,
        is_favourite: true,
        photos,
        primary_photo: primaryPhoto,
        avg_rating: p.avg_rating ? Math.round(p.avg_rating * 10) / 10 : 4.5,
        review_count: p.review_count || 0
      };
    }));

    return res.json({ favourites: enriched });
  } catch (err) {
    console.error('Get favourites error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// Toggle / Add favourite
router.post('/:parkingId', async (req, res) => {
  try {
    const userId = req.user.id;
    const parkingId = req.params.parkingId;

    const parking = await queryOne('SELECT id, name FROM parkings WHERE id = ?', [parkingId]);
    if (!parking) {
      return res.status(404).json({ error: 'Parking location not found.' });
    }

    const existing = await queryOne('SELECT id FROM favourites WHERE user_id = ? AND parking_id = ?', [userId, parkingId]);
    if (existing) {
      await run('DELETE FROM favourites WHERE id = ?', [existing.id]);
      return res.json({ message: 'Removed from favourites', is_favourite: false });
    } else {
      await run('INSERT INTO favourites (user_id, parking_id) VALUES (?, ?)', [userId, parkingId]);
      return res.json({ message: 'Added to favourites', is_favourite: true });
    }
  } catch (err) {
    console.error('Toggle favourite error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// Delete favourite directly
router.delete('/:parkingId', async (req, res) => {
  try {
    const userId = req.user.id;
    const parkingId = req.params.parkingId;
    await run('DELETE FROM favourites WHERE user_id = ? AND parking_id = ?', [userId, parkingId]);
    return res.json({ message: 'Removed from favourites', is_favourite: false });
  } catch (err) {
    console.error('Delete favourite error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;