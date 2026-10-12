const express = require('express');
const router = express.Router();
const { query, queryOne, run } = require('../database/db');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const items = await query(`
      SELECT h.id as history_id, h.parking_slot_id, s.slot_code, h.action_type, h.price_paid, h.created_at,
        p.id as parking_id, p.name as parking_name, p.address, p.city, p.area,
        p.hourly_price, p.parking_type
      FROM parking_history h
      JOIN parkings p ON h.parking_id = p.id
      LEFT JOIN parking_slots s ON s.id = h.parking_slot_id
      WHERE h.user_id = ?
      ORDER BY h.created_at DESC
    `, [userId]);

    return res.json({ history: items });
  } catch (err) {
    console.error('Get history error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

router.post('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const { parking_id, action_type, price_paid } = req.body;

    if (!parking_id) {
      return res.status(400).json({ error: 'Parking ID is required.' });
    }

    await run(`
      INSERT INTO parking_history (user_id, parking_id, action_type, price_paid)
      VALUES (?, ?, ?, ?)
    `, [userId, parking_id, action_type || 'visited', price_paid || 0]);

    return res.status(201).json({ message: 'History recorded' });
  } catch (err) {
    console.error('Post history error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const item = await queryOne('SELECT parking_slot_id FROM parking_history WHERE id = ? AND user_id = ?', [id, userId]);
    if (!item) return res.status(404).json({ error: 'History record not found.' });
    if (item.parking_slot_id) {
      return res.status(409).json({ error: 'Booking and release records are retained to track parking slot status.' });
    }
    await run('DELETE FROM parking_history WHERE id = ? AND user_id = ?', [id, userId]);
    return res.json({ message: 'History record removed.' });
  } catch (err) {
    console.error('Delete history error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

router.delete('/', async (req, res) => {
  try {
    const userId = req.user.id;
    await run('DELETE FROM parking_history WHERE user_id = ? AND parking_slot_id IS NULL', [userId]);
    return res.json({ message: 'Activity history cleared. Booking and release records were retained.' });
  } catch (err) {
    console.error('Clear history error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
