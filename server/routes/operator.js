const express = require('express');
const router = express.Router();
const { query, queryOne, run } = require('../database/db');
const { authenticateToken, requireRole } = require('../middleware/auth');

router.use(authenticateToken);
router.use(requireRole('operator', 'admin'));

function parkingScope(req) {
  return req.user.role === 'admin'
    ? { where: '', params: [] }
    : { where: 'WHERE p.operator_id = ?', params: [req.user.id] };
}

// Operator Dashboard Stats
router.get('/stats', async (req, res) => {
  try {
    const scope = parkingScope(req);
    const parkings = await query(
      req.user.role === 'admin' ? 'SELECT * FROM parkings' : 'SELECT * FROM parkings WHERE operator_id = ?',
      req.user.role === 'admin' ? [] : [req.user.id]
    );

    const totalParkings = parkings.length;
    const totalSpaces = parkings.reduce((sum, p) => sum + p.total_spaces, 0);
    const totalAvailable = parkings.reduce((sum, p) => sum + p.available_spaces, 0);
    const totalOccupied = totalSpaces - totalAvailable;
    const occupancyRate = totalSpaces > 0 ? Math.round((totalOccupied / totalSpaces) * 100) : 0;

    const reviews = await query(`
      SELECT r.*, p.name as parking_name, u.name as user_name
      FROM reviews r
      JOIN parkings p ON r.parking_id = p.id
      JOIN users u ON r.user_id = u.id
      ${scope.where}
      ORDER BY r.created_at DESC
    `, scope.params);

    const totalReviews = reviews.length;
    const avgRating = totalReviews > 0
      ? Math.round((reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews) * 10) / 10
      : 0;

    const reports = await query(`
      SELECT rep.*, p.name as parking_name, u.name as user_name, u.email as user_email
      FROM reports rep
      JOIN parkings p ON rep.parking_id = p.id
      JOIN users u ON rep.user_id = u.id
      ${scope.where}
      ORDER BY rep.created_at DESC
    `, scope.params);

    const pendingReportsCount = reports.filter(r => r.status === 'pending').length;

    const payments = await query(`
      SELECT pay.*, p.name as parking_name, u.name as user_name
      FROM payments pay
      JOIN parkings p ON pay.parking_id = p.id
      JOIN users u ON pay.user_id = u.id
      ${scope.where}
      ORDER BY pay.created_at DESC
    `, scope.params);

    const totalEarnings = payments
      .filter(pay => pay.status === 'Success')
      .reduce((sum, pay) => sum + parseFloat(pay.amount || 0), 0);

    return res.json({
      stats: {
        totalParkings,
        totalSpaces,
        totalAvailable,
        totalOccupied,
        occupancyRate,
        totalReviews,
        avgRating,
        pendingReportsCount,
        totalEarnings
      },
      recentReviews: reviews.slice(0, 5),
      recentReports: reports.slice(0, 5),
      recentPayments: payments.slice(0, 5)
    });
  } catch (err) {
    console.error('Operator stats error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// Get Operator's parkings
router.get('/parkings', async (req, res) => {
  try {
    const scope = parkingScope(req);
    const parkings = await query(`
      SELECT p.*,
        (SELECT COUNT(*) FROM reviews r WHERE r.parking_id = p.id) as review_count,
        (SELECT AVG(r.rating) FROM reviews r WHERE r.parking_id = p.id) as avg_rating,
        (SELECT COUNT(*) FROM reports rep WHERE rep.parking_id = p.id AND rep.status = 'pending') as pending_reports
      FROM parkings p
      ${scope.where}
      ORDER BY p.id DESC
    `, scope.params);

    const enriched = await Promise.all(parkings.map(async (p) => {
      const photos = await query('SELECT id, photo_url, photo_type, caption FROM parking_photos WHERE parking_id = ?', [p.id]);
      return {
        ...p,
        photos,
        primary_photo: photos[0]?.photo_url || 'https://images.unsplash.com/photo-1590674899484-d5640e854abe?auto=format&fit=crop&w=1200&q=80',
        avg_rating: p.avg_rating ? Math.round(p.avg_rating * 10) / 10 : 0
      };
    }));

    return res.json({ parkings: enriched });
  } catch (err) {
    console.error('Operator parkings error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// Get all reviews for operator's locations
router.get('/reviews', async (req, res) => {
  try {
    const scope = parkingScope(req);
    const reviews = await query(`
      SELECT r.*, p.name as parking_name, u.name as user_name, u.avatar_url as user_avatar
      FROM reviews r
      JOIN parkings p ON r.parking_id = p.id
      JOIN users u ON r.user_id = u.id
      ${scope.where}
      ORDER BY r.created_at DESC
    `, scope.params);

    return res.json({ reviews });
  } catch (err) {
    console.error('Operator reviews error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// Get all reports for operator's locations
router.get('/reports', async (req, res) => {
  try {
    const scope = parkingScope(req);
    const reports = await query(`
      SELECT rep.*, p.name as parking_name, u.name as user_name, u.email as user_email
      FROM reports rep
      JOIN parkings p ON rep.parking_id = p.id
      JOIN users u ON rep.user_id = u.id
      ${scope.where}
      ORDER BY rep.created_at DESC
    `, scope.params);

    return res.json({ reports });
  } catch (err) {
    console.error('Operator reports error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// Update report status
router.patch('/reports/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['pending', 'reviewed', 'resolved'].includes(status)) {
      return res.status(400).json({ error: 'Status must be pending, reviewed, or resolved.' });
    }

    const report = req.user.role === 'admin'
      ? await queryOne('SELECT id FROM reports WHERE id = ?', [id])
      : await queryOne(`
          SELECT rep.id FROM reports rep
          JOIN parkings p ON rep.parking_id = p.id
          WHERE rep.id = ? AND p.operator_id = ?
        `, [id, req.user.id]);

    if (!report) {
      return res.status(403).json({ error: 'Unauthorized.' });
    }

    await run('UPDATE reports SET status = ? WHERE id = ?', [status, id]);
    return res.json({ message: `Report marked as ${status}.` });
  } catch (err) {
    console.error('Update report status error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
