const express = require('express');
const router = express.Router();
const { query, queryOne, run } = require('../database/db');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

const VALID_REASONS = [
  'Wrong Location',
  'Wrong Price',
  'Parking Closed',
  'Wrong Contact Number',
  'Incorrect Photos',
  'Incorrect Availability',
  'Other'
];

router.post('/:parkingId', async (req, res) => {
  try {
    const { parkingId } = req.params;
    const { reason, description } = req.body;

    if (!reason || !VALID_REASONS.includes(reason)) {
      return res.status(400).json({
        error: `Please select a valid report reason: ${VALID_REASONS.join(', ')}`
      });
    }

    const parking = await queryOne('SELECT id, name, operator_id FROM parkings WHERE id = ?', [parkingId]);
    if (!parking) {
      return res.status(404).json({ error: 'Parking location not found.' });
    }

    const insertResult = await run(`
      INSERT INTO reports (parking_id, user_id, reason, description, status)
      VALUES (?, ?, ?, ?, 'pending')
    `, [parkingId, req.user.id, reason, (description || '').trim()]);

    await run(`
      INSERT INTO notifications (user_id, title, message, type)
      VALUES (?, ?, ?, 'report')
    `, [
      parking.operator_id,
      'Issue Reported on Parking ⚠️',
      `A driver reported "${reason}" for ${parking.name}. Description: "${(description || '').slice(0, 80)}"`
    ]);

    const createdReport = await queryOne('SELECT * FROM reports WHERE id = ?', [insertResult.lastInsertRowid]);

    return res.status(201).json({
      message: 'Report submitted successfully. The parking operator has been alerted to review the information.',
      report: createdReport
    });
  } catch (err) {
    console.error('Submit report error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

router.get('/my-reports', async (req, res) => {
  try {
    const reports = await query(`
      SELECT rep.*, p.name as parking_name, p.address as parking_address
      FROM reports rep
      JOIN parkings p ON rep.parking_id = p.id
      WHERE rep.user_id = ?
      ORDER BY rep.created_at DESC
    `, [req.user.id]);

    return res.json({ reports });
  } catch (err) {
    console.error('Get my reports error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;