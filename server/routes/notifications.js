const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { query, run } = require('../database/db');
const { authenticateToken } = require('../middleware/auth');
const { getVapidPublicKey } = require('../services/pushNotifications');

router.use(authenticateToken);

router.get('/push/public-key', (req, res) => {
  const publicKey = getVapidPublicKey();
  if (!publicKey) return res.status(503).json({ error: 'Device push notifications are not configured on this server.' });
  return res.json({ publicKey });
});

router.post('/push/subscriptions', async (req, res) => {
  try {
    const subscription = req.body?.subscription;
    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return res.status(400).json({ error: 'A valid device push subscription is required.' });
    }
    const endpointUrl = new URL(subscription.endpoint);
    if (endpointUrl.protocol !== 'https:') {
      return res.status(400).json({ error: 'Push subscription endpoints must use HTTPS.' });
    }
    const endpointHash = crypto.createHash('sha256').update(subscription.endpoint).digest('hex');
    await run(`
      INSERT INTO push_subscriptions (user_id, endpoint_hash, subscription_json)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE user_id = VALUES(user_id), subscription_json = VALUES(subscription_json)
    `, [req.user.id, endpointHash, JSON.stringify(subscription)]);
    return res.json({ message: 'Device notifications enabled.' });
  } catch (err) {
    console.error('Save push subscription error:', err);
    return res.status(500).json({ error: 'Unable to enable device notifications.' });
  }
});

router.delete('/push/subscriptions', async (req, res) => {
  try {
    const endpoint = req.body?.endpoint;
    if (!endpoint) return res.status(400).json({ error: 'The device push endpoint is required.' });
    const endpointHash = crypto.createHash('sha256').update(endpoint).digest('hex');
    await run('DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint_hash = ?', [req.user.id, endpointHash]);
    return res.json({ message: 'Device notifications disabled.' });
  } catch (err) {
    console.error('Remove push subscription error:', err);
    return res.status(500).json({ error: 'Unable to disable device notifications.' });
  }
});

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
