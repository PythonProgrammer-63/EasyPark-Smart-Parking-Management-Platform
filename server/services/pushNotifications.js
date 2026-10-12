const webpush = require('web-push');
const { pool } = require('../database/db');

let pushReady = false;
let draining = false;

function getVapidPublicKey() {
  return process.env.VAPID_PUBLIC_KEY || null;
}

function configureWebPush() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) return false;

  webpush.setVapidDetails(subject, publicKey, privateKey);
  return true;
}

async function deliverNotification(notification) {
  const [subscriptions] = await pool.query(
    'SELECT id, subscription_json FROM push_subscriptions WHERE user_id = ?',
    [notification.user_id]
  );
  if (subscriptions.length === 0) return { delivered: true, skipped: true };

  const outcomes = await Promise.all(subscriptions.map(async (row) => {
    try {
      await webpush.sendNotification(JSON.parse(row.subscription_json), JSON.stringify({
        title: notification.title,
        body: notification.message,
        notificationId: notification.id,
        url: '/'
      }), { TTL: 60 * 60 * 24 * 7, urgency: 'high' });
    } catch (error) {
      if (error.statusCode === 404 || error.statusCode === 410) {
        await pool.query('DELETE FROM push_subscriptions WHERE id = ?', [row.id]);
        return true;
      }
      console.error(`Push delivery failed for notification ${notification.id}:`, error.statusCode || error.message);
      return false;
    }
  }));

  return { delivered: outcomes.every(Boolean), skipped: false };
}

async function drainNotificationQueue() {
  if (!pushReady || draining) return;
  draining = true;
  try {
    const [notifications] = await pool.query(`
      SELECT id, user_id, title, message, push_attempts
      FROM notifications
      WHERE push_status = 'pending'
        AND (push_available_at IS NULL OR push_available_at <= NOW())
      ORDER BY id ASC
      LIMIT 100
    `);
    for (const notification of notifications) {
      const result = await deliverNotification(notification);
      const attempts = Number(notification.push_attempts) + 1;
      const failedPermanently = !result.delivered && attempts >= 5;
      const status = result.skipped ? 'skipped' : result.delivered ? 'sent' : failedPermanently ? 'failed' : 'pending';
      const retryAt = status === 'pending'
        ? new Date(Date.now() + Math.min(60 * 60 * 1000, 15 * 1000 * (2 ** attempts)))
        : null;
      const errorMessage = status === 'failed' ? 'Push delivery failed after repeated attempts.' : null;
      await pool.query(
        `UPDATE notifications
         SET push_status = ?, push_attempts = ?, push_available_at = ?, push_error = ?
         WHERE id = ? AND push_status = 'pending'`,
        [status, attempts, retryAt, errorMessage, notification.id]
      );
    }
  } catch (error) {
    console.error('Push notification queue error:', error.message);
  } finally {
    draining = false;
  }
}

async function startPushNotificationDelivery() {
  if (!configureWebPush()) {
    console.warn('Web Push is disabled: configure VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, and VAPID_SUBJECT.');
    return;
  }
  pushReady = true;
  const timer = setInterval(drainNotificationQueue, 1500);
  timer.unref();
  drainNotificationQueue();
  console.log('Web Push notification delivery is ready.');
}

module.exports = { getVapidPublicKey, startPushNotificationDelivery };
