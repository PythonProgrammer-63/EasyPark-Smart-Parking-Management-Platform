const express = require('express');
const router = express.Router();
const { query, queryOne, run } = require('../database/db');
const { authenticateToken } = require('../middleware/auth');

router.get('/:parkingId', async (req, res) => {
  try {
    const { parkingId } = req.params;
    const reviews = await query(`
      SELECT r.id, r.rating, r.comment, r.created_at, u.name as user_name, u.avatar_url as user_avatar
      FROM reviews r
      JOIN users u ON r.user_id = u.id
      WHERE r.parking_id = ?
      ORDER BY r.created_at DESC
    `, [parkingId]);

    return res.json({ reviews });
  } catch (err) {
    console.error('Get reviews error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

router.post('/:parkingId', authenticateToken, async (req, res) => {
  try {
    const { parkingId } = req.params;
    const { rating, comment } = req.body;

    const ratingNum = parseInt(rating, 10);
    if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      return res.status(400).json({ error: 'Rating must be a whole number between 1 and 5.' });
    }

    const parking = await queryOne('SELECT id, name, operator_id FROM parkings WHERE id = ?', [parkingId]);
    if (!parking) {
      return res.status(404).json({ error: 'Parking not found.' });
    }

    const insertResult = await run(`
      INSERT INTO reviews (parking_id, user_id, rating, comment)
      VALUES (?, ?, ?, ?)
    `, [parkingId, req.user.id, ratingNum, (comment || '').trim()]);

    await run(`
      INSERT INTO notifications (user_id, title, message, type)
      VALUES (?, ?, ?, 'review')
    `, [
      parking.operator_id,
      'New Customer Review ⭐',
      `${req.user.name} gave ${ratingNum} stars to ${parking.name}: "${(comment || '').slice(0, 60)}..."`
    ]);

    const createdReview = await queryOne(`
      SELECT r.id, r.rating, r.comment, r.created_at, u.name as user_name, u.avatar_url as user_avatar
      FROM reviews r
      JOIN users u ON r.user_id = u.id
      WHERE r.id = ?
    `, [insertResult.lastInsertRowid]);

    return res.status(201).json({
      message: 'Thank you! Your review has been submitted.',
      review: createdReview
    });
  } catch (err) {
    console.error('Post review error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;