const express = require('express');
const router = express.Router();
const { query, run } = require('../database/db');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

router.get('/', async (req, res) => {
  try {
    const notifications = await query(`
      SELECT * FROM notifications
      WHERE user_id = ?
      ORDER BY created_at DESC
    `, [req.user.id]);

    const unreadCount = notifications.filter(n => !n.is_read).length;

    return res.json({ notifications, unreadCount });
  } catch (err) {
    console.error('Get notifications error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

router.patch('/:id/read', async (req, res) => {
  try {
    const { id } = req.params;
    await run('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?', [id, req.user.id]);
    return res.json({ message: 'Marked as read' });
  } catch (err) {
    console.error('Mark read error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

router.post('/mark-all-read', async (req, res) => {
  try {
    await run('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [req.user.id]);
    return res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    console.error('Mark all read error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await run('DELETE FROM notifications WHERE id = ? AND user_id = ?', [id, req.user.id]);
    return res.json({ message: 'Notification removed' });
  } catch (err) {
    console.error('Delete notification error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;