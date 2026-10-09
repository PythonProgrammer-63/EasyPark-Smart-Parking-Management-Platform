const express = require('express');
const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const router = express.Router();
const { query, queryOne, run, pool } = require('../database/db');
const { authenticateToken, requireRole } = require('../middleware/auth');
const {
  HOLD_MINUTES,
  releaseExpiredHolds,
  withParkingTransaction
} = require('../services/parkingSlots');
const { isParkingOpenNow } = require('../services/parkingHours');

router.use(authenticateToken);

router.get('/parkings/:parkingId/slots', async (req, res) => {
  try {
    const { parking, result: slots } = await withParkingTransaction(req.params.parkingId, async (connection, lockedParking) => {
      await releaseExpiredHolds(connection, req.params.parkingId);
      if (!isParkingOpenNow(lockedParking.opening_time, lockedParking.closing_time)) {
        return { slots: [], available_spaces: 0 };
      }
      const [availableSlots] = await connection.query(
        "SELECT id, slot_code FROM parking_slots WHERE parking_id = ? AND status = 'available' ORDER BY id",
        [req.params.parkingId]
      );
      const [availability] = await connection.query(
        'SELECT available_spaces FROM parkings WHERE id = ?',
        [req.params.parkingId]
      );
      return { slots: availableSlots, available_spaces: availability[0].available_spaces };
    });
    if (!parking) return res.status(404).json({ error: 'Parking location not found.' });
    return res.json({ slots: slots.slots, available_spaces: slots.available_spaces });
  } catch (err) {
    console.error('Get parking slots error:', err);
    return res.status(500).json({ error: 'Unable to load available parking slots.' });
  }
});

router.get('/operator/bookings', requireRole('operator', 'admin'), async (req, res) => {
  try {
    const bookings = await query(`
      SELECT s.id AS slot_id, s.slot_code, s.vehicle_number, s.duration_hours, s.booked_at,
             p.id AS parking_id, p.name AS parking_name, u.name AS customer_name, u.email AS customer_email,
             pay.id AS payment_id, pay.status AS payment_status, pay.payment_method,
             pay.amount AS payment_amount, pay.transaction_id,
             proof.payer_name, proof.verification_status AS proof_status
      FROM parking_slots s
      JOIN parkings p ON p.id = s.parking_id
      JOIN users u ON u.id = s.booked_by_user_id
      LEFT JOIN payments pay ON pay.id = (
        SELECT MAX(latest_payment.id)
        FROM payments latest_payment
        WHERE latest_payment.parking_slot_id = s.id
      )
      LEFT JOIN payment_proofs proof ON proof.payment_id = pay.id
      WHERE (? = 'admin' OR p.operator_id = ?) AND s.status = 'booked'
      ORDER BY s.booked_at DESC
    `, [req.user.role, req.user.id]);
    return res.json({ bookings });
  } catch (err) {
    console.error('Get operator bookings error:', err);
    return res.status(500).json({ error: 'Unable to load active slot bookings.' });
  }
});

router.get('/operator/payment-proofs/:paymentId/image', requireRole('operator', 'admin'), async (req, res) => {
  try {
    const paymentId = Number(req.params.paymentId);
    if (!Number.isInteger(paymentId) || paymentId < 1) {
      return res.status(400).json({ error: 'A valid payment ID is required.' });
    }
    const proof = await queryOne(`
      SELECT p.operator_id, proof.screenshot_filename
      FROM payments pay
      JOIN parkings p ON p.id = pay.parking_id
      JOIN payment_proofs proof ON proof.payment_id = pay.id
      WHERE pay.id = ?
    `, [paymentId]);
    if (!proof) return res.status(404).json({ error: 'Payment screenshot not found.' });
    if (req.user.role !== 'admin' && proof.operator_id !== req.user.id) {
      return res.status(403).json({ error: 'You are not authorized to view this payment screenshot.' });
    }

    const filename = path.basename(proof.screenshot_filename);
    const imagePath = path.resolve(__dirname, '../uploads/payment-proofs', filename);
    await fs.access(imagePath);
    const contentType = filename.endsWith('.png')
      ? 'image/png'
      : filename.endsWith('.webp')
        ? 'image/webp'
        : 'image/jpeg';
    res.set('Cache-Control', 'private, no-store');
    return res.type(contentType).sendFile(imagePath, (err) => {
      if (err && !res.headersSent) {
        console.error('Serve payment screenshot error:', err);
        res.status(500).json({ error: 'Unable to load this payment screenshot.' });
      }
    });
  } catch (err) {
    if (err.code === 'ENOENT') return res.status(404).json({ error: 'Payment screenshot not found.' });
    console.error('Get payment screenshot error:', err);
    return res.status(500).json({ error: 'Unable to load this payment screenshot.' });
  }
});

router.post('/operator/payments/:paymentId/confirm-manual', requireRole('operator', 'admin'), async (req, res) => {
  let connection;
  try {
    const paymentId = Number(req.params.paymentId);
    if (!Number.isInteger(paymentId) || paymentId < 1) {
      return res.status(400).json({ error: 'A valid payment ID is required.' });
    }

    const paymentReference = await queryOne(
      'SELECT parking_id FROM payments WHERE id = ?',
      [paymentId]
    );
    if (!paymentReference) return res.status(404).json({ error: 'Payment not found.' });

    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [parkings] = await connection.query(
      'SELECT id, operator_id FROM parkings WHERE id = ? FOR UPDATE',
      [paymentReference.parking_id]
    );
    const [payments] = await connection.query(
      `SELECT id, user_id, parking_id, parking_slot_id, payment_method, status, amount
       FROM payments WHERE id = ? AND parking_id = ? FOR UPDATE`,
      [paymentId, paymentReference.parking_id]
    );
    if (parkings.length === 0 || payments.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Payment not found.' });
    }
    if (req.user.role !== 'admin' && parkings[0].operator_id !== req.user.id) {
      await connection.rollback();
      return res.status(403).json({ error: 'You are not authorized to confirm this payment.' });
    }

    const payment = payments[0];
    if (!['Cash', 'UPI'].includes(payment.payment_method) || payment.status !== 'Pending') {
      await connection.rollback();
      return res.status(409).json({ error: 'Only pending cash or QR/UPI payments can be marked as received.' });
    }

    if (payment.payment_method === 'UPI') {
      const [proofs] = await connection.query(
        `SELECT id FROM payment_proofs
         WHERE payment_id = ? AND verification_status = 'Pending' FOR UPDATE`,
        [payment.id]
      );
      if (proofs.length === 0) {
        await connection.rollback();
        return res.status(409).json({ error: 'This UPI payment has no pending screenshot to verify.' });
      }
      await connection.query(
        "UPDATE payment_proofs SET verification_status = 'Verified', reviewed_by = ?, reviewed_at = NOW() WHERE id = ?",
        [req.user.id, proofs[0].id]
      );
    }

    await connection.query("UPDATE payments SET status = 'Success' WHERE id = ?", [payment.id]);
    await connection.query(`
      INSERT INTO notifications (user_id, title, message, type)
      VALUES (?, ?, ?, 'payment')
    `, [
      payment.user_id,
      'Payment Received',
      `The operator confirmed receipt of your ₹${payment.amount} ${payment.payment_method} payment.`
    ]);
    await connection.commit();
    return res.json({ message: 'Payment marked as received.', status: 'Success' });
  } catch (err) {
    if (connection) await connection.rollback();
    console.error('Confirm manual payment error:', err);
    return res.status(500).json({ error: 'Unable to confirm this payment.' });
  } finally {
    if (connection) connection.release();
  }
});

router.post('/operator/payments/:paymentId/reject-upi', requireRole('operator', 'admin'), async (req, res) => {
  let connection;
  try {
    const paymentId = Number(req.params.paymentId);
    if (!Number.isInteger(paymentId) || paymentId < 1) {
      return res.status(400).json({ error: 'A valid payment ID is required.' });
    }
    const paymentReference = await queryOne(
      'SELECT parking_id FROM payments WHERE id = ?',
      [paymentId]
    );
    if (!paymentReference) return res.status(404).json({ error: 'Payment not found.' });

    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [parkings] = await connection.query(
      'SELECT id, operator_id FROM parkings WHERE id = ? FOR UPDATE',
      [paymentReference.parking_id]
    );
    const [payments] = await connection.query(
      `SELECT id, user_id, parking_id, parking_slot_id, payment_method, status
       FROM payments WHERE id = ? AND parking_id = ? FOR UPDATE`,
      [paymentId, paymentReference.parking_id]
    );
    if (!parkings.length || !payments.length) {
      await connection.rollback();
      return res.status(404).json({ error: 'Payment not found.' });
    }
    if (req.user.role !== 'admin' && parkings[0].operator_id !== req.user.id) {
      await connection.rollback();
      return res.status(403).json({ error: 'You are not authorized to reject this payment.' });
    }

    const payment = payments[0];
    if (payment.payment_method !== 'UPI' || payment.status !== 'Pending' || !payment.parking_slot_id) {
      await connection.rollback();
      return res.status(409).json({ error: 'Only a pending QR/UPI payment can be rejected.' });
    }
    const [proofs] = await connection.query(
      `SELECT id FROM payment_proofs
       WHERE payment_id = ? AND verification_status = 'Pending' FOR UPDATE`,
      [payment.id]
    );
    if (!proofs.length) {
      await connection.rollback();
      return res.status(409).json({ error: 'This UPI payment has no pending screenshot to review.' });
    }

    const [slots] = await connection.query(
      `SELECT id, parking_id, status FROM parking_slots
       WHERE id = ? AND parking_id = ? FOR UPDATE`,
      [payment.parking_slot_id, payment.parking_id]
    );
    if (!slots.length || slots[0].status !== 'booked') {
      await connection.rollback();
      return res.status(409).json({ error: 'The booked slot could not be released.' });
    }

    await connection.query(
      "UPDATE payment_proofs SET verification_status = 'Rejected', reviewed_by = ?, reviewed_at = NOW() WHERE id = ?",
      [req.user.id, proofs[0].id]
    );
    await connection.query("UPDATE payments SET status = 'Failed' WHERE id = ?", [payment.id]);
    await connection.query(
      `UPDATE parking_slots
       SET status = 'available', booked_by_user_id = NULL, vehicle_number = NULL,
           duration_hours = NULL, booked_at = NULL
       WHERE id = ?`,
      [slots[0].id]
    );
    await connection.query(
      'UPDATE parkings SET available_spaces = LEAST(total_spaces, available_spaces + 1) WHERE id = ?',
      [payment.parking_id]
    );
    await connection.query(`
      INSERT INTO notifications (user_id, title, message, type)
      VALUES (?, ?, ?, 'payment')
    `, [
      payment.user_id,
      'UPI Payment Could Not Be Verified',
      'The operator could not verify your UPI screenshot. The slot was released; contact the parking operator before submitting a new booking.'
    ]);
    await connection.commit();
    return res.json({ message: 'UPI payment rejected and slot released.', status: 'Failed' });
  } catch (err) {
    if (connection) await connection.rollback();
    console.error('Reject UPI payment error:', err);
    return res.status(500).json({ error: 'Unable to reject this UPI payment.' });
  } finally {
    if (connection) connection.release();
  }
});

router.post('/operator/bookings/:slotId/release', requireRole('operator', 'admin'), async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [slotReferences] = await connection.query(
      'SELECT parking_id FROM parking_slots WHERE id = ?',
      [req.params.slotId]
    );
    if (slotReferences.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Parking slot not found.' });
    }
    const [parkings] = await connection.query(
      'SELECT operator_id FROM parkings WHERE id = ? FOR UPDATE',
      [slotReferences[0].parking_id]
    );
    const [slots] = await connection.query(
      `SELECT id, parking_id, status FROM parking_slots
       WHERE id = ? AND parking_id = ? FOR UPDATE`,
      [req.params.slotId, slotReferences[0].parking_id]
    );
    if (parkings.length === 0 || slots.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Parking slot not found.' });
    }
    const slot = slots[0];
    if (req.user.role !== 'admin' && parkings[0].operator_id !== req.user.id) {
      await connection.rollback();
      return res.status(403).json({ error: 'You are not authorized to release this parking slot.' });
    }
    if (slot.status !== 'booked') {
      await connection.rollback();
      return res.status(409).json({ error: 'This parking slot is not currently booked.' });
    }

    await connection.query(
      `UPDATE parking_slots
       SET status = 'available', booked_by_user_id = NULL, vehicle_number = NULL,
           duration_hours = NULL, booked_at = NULL
       WHERE id = ?`,
      [slot.id]
    );
    await connection.query(
      'UPDATE parkings SET available_spaces = LEAST(total_spaces, available_spaces + 1) WHERE id = ?',
      [slot.parking_id]
    );
    await connection.commit();
    return res.json({ message: `Slot ${slot.id} released and available for booking.` });
  } catch (err) {
    if (connection) await connection.rollback();
    console.error('Release operator booking error:', err);
    return res.status(500).json({ error: 'Unable to release this parking slot.' });
  } finally {
    if (connection) connection.release();
  }
});

router.post('/slots/:slotId/hold/renew', async (req, res) => {
  const { hold_token } = req.body;
  if (typeof hold_token !== 'string' || !hold_token) {
    return res.status(400).json({ error: 'Slot hold token is required.' });
  }
  try {
    const result = await query(
      `UPDATE parking_slots
       SET hold_expires_at = DATE_ADD(NOW(), INTERVAL ${HOLD_MINUTES} MINUTE)
       WHERE id = ? AND status = 'held' AND held_by_user_id = ?
         AND hold_token = ? AND hold_expires_at > NOW()`,
      [req.params.slotId, req.user.id, hold_token]
    );
    if (result.affectedRows === 0) {
      return res.status(409).json({ error: 'This slot hold has expired. Please select a slot again.' });
    }
    return res.json({ message: 'Slot hold extended.' });
  } catch (err) {
    console.error('Renew slot hold error:', err);
    return res.status(500).json({ error: 'Unable to extend the slot hold.' });
  }
});

router.post('/slots/:slotId/hold/release', async (req, res) => {
  const { hold_token } = req.body;
  if (typeof hold_token !== 'string' || !hold_token) {
    return res.status(400).json({ error: 'Slot hold token is required.' });
  }
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [rows] = await connection.query(
      'SELECT parking_id FROM parking_slots WHERE id = ?',
      [req.params.slotId]
    );
    if (rows.length === 0) {
      await connection.rollback();
      return res.json({ released: false });
    }
    await connection.query('SELECT id FROM parkings WHERE id = ? FOR UPDATE', [rows[0].parking_id]);
    await releaseExpiredHolds(connection, rows[0].parking_id);
    const [slots] = await connection.query(
      `SELECT id FROM parking_slots
       WHERE id = ? AND status = 'held' AND held_by_user_id = ? AND hold_token = ?
       FOR UPDATE`,
      [req.params.slotId, req.user.id, hold_token]
    );
    if (slots.length === 0) {
      await connection.commit();
      return res.json({ released: false });
    }
    await connection.query(
      "UPDATE payments SET status = 'Failed' WHERE parking_slot_id = ? AND status = 'Pending'",
      [req.params.slotId]
    );
    await connection.query(
      `UPDATE parking_slots
       SET status = 'available', held_by_user_id = NULL, hold_token = NULL,
           hold_order_id = NULL, hold_expires_at = NULL, vehicle_number = NULL, duration_hours = NULL
       WHERE id = ?`,
      [req.params.slotId]
    );
    await connection.query(
      'UPDATE parkings SET available_spaces = LEAST(total_spaces, available_spaces + 1) WHERE id = ?',
      [rows[0].parking_id]
    );
    await connection.commit();
    return res.json({ released: true });
  } catch (err) {
    if (connection) await connection.rollback();
    console.error('Release slot hold error:', err);
    return res.status(500).json({ error: 'Unable to release this slot hold.' });
  } finally {
    if (connection) connection.release();
  }
});

function calculateParkingCharge(parking, durationHours) {
  const duration = Number(durationHours);
  const prices = {
    1: Number(parking.hourly_price),
    2: Number(parking.two_hour_price) || Number(parking.hourly_price) * 1.8,
    5: Number(parking.five_hour_price) || Number(parking.hourly_price) * 4,
    24: Number(parking.daily_price) || Number(parking.hourly_price) * 8
  };

  if (!Object.hasOwn(prices, duration)) return null;
  return Number(parking.is_free) ? 0 : prices[duration];
}

async function getParkingCharge(parkingId, durationHours) {
  const parking = await queryOne(`
    SELECT id, name, operator_id, opening_time, closing_time, hourly_price, two_hour_price, five_hour_price, daily_price, is_free, payment_qr_url
    FROM parkings WHERE id = ?
  `, [parkingId]);
  if (!parking) return { error: 'Parking location not found.', status: 404 };

  const amount = calculateParkingCharge(parking, durationHours);
  if (amount === null || amount <= 0) {
    return { error: 'Select a valid paid parking duration.', status: 400 };
  }
  return { parking, amount, duration: Number(durationHours) };
}

async function releaseOwnedSlotHold(slotId, userId, holdToken) {
  const rows = await query('SELECT parking_id FROM parking_slots WHERE id = ?', [slotId]);
  if (rows.length === 0) return false;
  const { result } = await withParkingTransaction(rows[0].parking_id, async (connection) => {
    await releaseExpiredHolds(connection, rows[0].parking_id);
    const [slots] = await connection.query(
      `SELECT id FROM parking_slots
       WHERE id = ? AND status = 'held' AND held_by_user_id = ? AND hold_token = ?
       FOR UPDATE`,
      [slotId, userId, holdToken]
    );
    if (slots.length === 0) return false;

    await connection.query(
      "UPDATE payments SET status = 'Failed' WHERE parking_slot_id = ? AND status = 'Pending'",
      [slotId]
    );
    await connection.query(
      `UPDATE parking_slots
       SET status = 'available', held_by_user_id = NULL, hold_token = NULL,
           hold_order_id = NULL, hold_expires_at = NULL, vehicle_number = NULL, duration_hours = NULL
       WHERE id = ?`,
      [slotId]
    );
    await connection.query(
      'UPDATE parkings SET available_spaces = LEAST(total_spaces, available_spaces + 1) WHERE id = ?',
      [rows[0].parking_id]
    );
    return true;
  });
  return result;
}

// Create a Razorpay order. The secret remains exclusively on the server.
router.post('/razorpay/order', async (req, res) => {
  let activeHold;
  try {
    const { parking_id, slot_id, duration_hours, vehicle_number, payment_method } = req.body;
    if (typeof vehicle_number !== 'string' || !vehicle_number.trim()) {
      return res.status(400).json({ error: 'Vehicle registration number is required.' });
    }
    if (payment_method !== 'Card') {
      return res.status(400).json({ error: 'Razorpay Checkout is only used for card payments. Use the parking business QR for UPI.' });
    }
    if (!Number.isInteger(Number(slot_id)) || Number(slot_id) < 1) {
      return res.status(400).json({ error: 'Choose an available parking slot before paying.' });
    }
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      return res.status(503).json({ error: 'Online payments are not configured. Add Razorpay test or live keys on the server.' });
    }

    const charge = await getParkingCharge(parking_id, duration_hours);
    if (charge.error) return res.status(charge.status).json({ error: charge.error });
    const amountInPaise = Math.round(charge.amount * 100);
    if (!Number.isSafeInteger(amountInPaise) || amountInPaise < 100) {
      return res.status(400).json({ error: 'Razorpay payments must be at least ₹1.00.' });
    }

    const holdToken = crypto.randomUUID();
    const hold = await withParkingTransaction(charge.parking.id, async (connection, lockedParking) => {
      if (!isParkingOpenNow(lockedParking.opening_time, lockedParking.closing_time)) {
        return { error: `Parking is closed. Its hours are ${lockedParking.opening_time} to ${lockedParking.closing_time}.` };
      }
      await releaseExpiredHolds(connection, charge.parking.id);
      const [currentParkingRows] = await connection.query(
        'SELECT available_spaces FROM parkings WHERE id = ?',
        [charge.parking.id]
      );
      if (currentParkingRows[0].available_spaces < 1) return { error: 'No parking slots are currently available.' };

      const [slots] = await connection.query(
        `SELECT id, slot_code FROM parking_slots
         WHERE id = ? AND parking_id = ? AND status = 'available'
         FOR UPDATE`,
        [slot_id, charge.parking.id]
      );
      if (slots.length === 0) return { error: 'This parking slot was just taken. Please choose another slot.' };

      await connection.query(
        `UPDATE parking_slots
         SET status = 'held', held_by_user_id = ?, hold_token = ?,
             hold_expires_at = DATE_ADD(NOW(), INTERVAL ${HOLD_MINUTES} MINUTE),
             vehicle_number = ?, duration_hours = ?
         WHERE id = ?`,
        [req.user.id, holdToken, vehicle_number.trim().toUpperCase(), charge.duration, slot_id]
      );
      await connection.query(
        'UPDATE parkings SET available_spaces = available_spaces - 1 WHERE id = ?',
        [charge.parking.id]
      );
      return { slot_code: slots[0].slot_code, slot_id: slots[0].id, total_spaces: lockedParking.total_spaces };
    });
    if (!hold.parking) return res.status(404).json({ error: 'Parking location not found.' });
    if (hold.result?.error) return res.status(409).json({ error: hold.result.error });
    activeHold = { slot_id: hold.result.slot_id, hold_token: holdToken };

    const receipt = `ep_${req.user.id}_${Date.now()}`;
    const razorpayResponse = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      signal: AbortSignal.timeout(15000),
      headers: {
        Authorization: `Basic ${Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        amount: amountInPaise,
        currency: 'INR',
        receipt,
        notes: {
          parking_id: String(charge.parking.id),
          user_id: String(req.user.id),
          slot_code: hold.result.slot_code
        }
      })
    });
    const responseBody = await razorpayResponse.text();
    let razorpayOrder;
    try {
      razorpayOrder = JSON.parse(responseBody);
    } catch {
      console.error(`Razorpay order API returned non-JSON content (HTTP ${razorpayResponse.status}).`);
      await releaseOwnedSlotHold(activeHold.slot_id, req.user.id, activeHold.hold_token);
      activeHold = null;
      return res.status(502).json({ error: 'Razorpay returned an unexpected response. Please try again later.' });
    }
    if (!razorpayResponse.ok) {
      await releaseOwnedSlotHold(activeHold.slot_id, req.user.id, activeHold.hold_token);
      activeHold = null;
      const razorpayError = razorpayOrder.error || {};
      if (razorpayResponse.status === 401 || razorpayError.description === 'Authentication failed') {
        console.error('Razorpay rejected the configured API credentials.');
        return res.status(503).json({
          error: 'Razorpay rejected the configured API credentials. Check that the Key ID and Key Secret are an active matching pair for the same Test or Live mode, then restart the server.',
          code: 'RAZORPAY_AUTH_FAILED'
        });
      }
      console.error('Razorpay order API error:', {
        status: razorpayResponse.status,
        code: razorpayError.code || 'UNKNOWN',
        description: razorpayError.description || 'No error description'
      });
      return res.status(502).json({
        error: razorpayError.description || 'Unable to create the payment order. Please try again.',
        code: razorpayError.code || 'RAZORPAY_ORDER_FAILED'
      });
    }

    const savedOrder = await withParkingTransaction(charge.parking.id, async (connection) => {
      const [paymentResult] = await connection.query(`
        INSERT INTO payments (user_id, parking_id, amount, payment_method, transaction_id, parking_slot_id, status, duration_hours)
        VALUES (?, ?, ?, ?, ?, ?, 'Pending', ?)
      `, [req.user.id, charge.parking.id, charge.amount, payment_method, razorpayOrder.id, activeHold.slot_id, charge.duration]);
      const [slotResult] = await connection.query(
        `UPDATE parking_slots SET hold_order_id = ?
         WHERE id = ? AND status = 'held' AND held_by_user_id = ? AND hold_token = ? AND hold_expires_at > NOW()`,
        [razorpayOrder.id, activeHold.slot_id, req.user.id, activeHold.hold_token]
      );
      if (slotResult.affectedRows === 0) {
        await connection.query("UPDATE payments SET status = 'Failed' WHERE id = ?", [paymentResult.insertId]);
        return false;
      }
      return true;
    });
    if (!savedOrder.result) {
      activeHold = null;
      return res.status(409).json({ error: 'The slot hold expired before checkout started. Please choose a slot again.' });
    }

    const responseHold = activeHold;
    activeHold = null;
    return res.status(201).json({
      order: {
        id: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        key_id: process.env.RAZORPAY_KEY_ID,
        parking_name: charge.parking.name,
        vehicle_number: vehicle_number || 'N/A',
        slot_id: hold.result.slot_id,
        slot_code: hold.result.slot_code,
        hold_token: responseHold.hold_token
      },
      hold_expires_in_seconds: HOLD_MINUTES * 60
    });
  } catch (err) {
    if (activeHold) {
      try {
        await releaseOwnedSlotHold(activeHold.slot_id, req.user.id, activeHold.hold_token);
      } catch (releaseError) {
        console.error('Failed to release slot after Razorpay order error:', releaseError);
      }
    }
    console.error('Razorpay order error:', err);
    return res.status(500).json({ error: 'Unable to start the online payment.' });
  }
});

// Razorpay's checkout response is not trusted until its signature is verified here.
router.post('/razorpay/verify', async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    if (
      typeof razorpay_order_id !== 'string' || !razorpay_order_id ||
      typeof razorpay_payment_id !== 'string' || !razorpay_payment_id ||
      typeof razorpay_signature !== 'string' || !/^[a-f\d]{64}$/i.test(razorpay_signature)
    ) {
      return res.status(400).json({ error: 'Incomplete Razorpay payment response.' });
    }
    if (!process.env.RAZORPAY_KEY_SECRET) {
      return res.status(503).json({ error: 'Online payment verification is not configured.' });
    }
    const payment = await queryOne(`
      SELECT pay.*, p.name AS parking_name, p.operator_id, s.slot_code, s.vehicle_number
      FROM payments pay
      JOIN parkings p ON p.id = pay.parking_id
      JOIN parking_slots s ON s.id = pay.parking_slot_id
      WHERE pay.user_id = ? AND pay.transaction_id = ? AND pay.status = 'Pending'
    `, [req.user.id, razorpay_order_id]);
    if (!payment) return res.status(404).json({ error: 'Pending payment order not found.' });

    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '')
      .update(`${payment.transaction_id}|${razorpay_payment_id}`)
      .digest('hex');
    const expectedSignatureBuffer = Buffer.from(expectedSignature, 'hex');
    const receivedSignatureBuffer = Buffer.from(razorpay_signature, 'hex');
    const signatureIsValid = expectedSignatureBuffer.length === receivedSignatureBuffer.length &&
      crypto.timingSafeEqual(expectedSignatureBuffer, receivedSignatureBuffer);
    if (!signatureIsValid) {
      return res.status(400).json({ error: 'Payment verification failed. No charge was recorded.' });
    }

    const booking = await withParkingTransaction(payment.parking_id, async (connection) => {
      const [slots] = await connection.query(
        `SELECT id FROM parking_slots
         WHERE id = ? AND status = 'held' AND held_by_user_id = ?
           AND hold_order_id = ? AND hold_expires_at > NOW()
         FOR UPDATE`,
        [payment.parking_slot_id, req.user.id, razorpay_order_id]
      );
      if (slots.length === 0) return false;

      await connection.query(
        "UPDATE payments SET transaction_id = ?, status = 'Success' WHERE id = ? AND status = 'Pending'",
        [razorpay_payment_id, payment.id]
      );
      await connection.query(
        `UPDATE parking_slots
         SET status = 'booked', held_by_user_id = NULL, hold_token = NULL, hold_order_id = NULL,
             hold_expires_at = NULL, booked_by_user_id = ?, booked_at = NOW()
         WHERE id = ?`,
        [req.user.id, payment.parking_slot_id]
      );
      await connection.query(
        `INSERT INTO parking_history (user_id, parking_id, action_type, price_paid)
         VALUES (?, ?, 'paid', ?)`,
        [req.user.id, payment.parking_id, payment.amount]
      );
      await connection.query(
        `INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, 'payment')`,
        [req.user.id, 'Slot Booking Confirmed', `Slot ${payment.slot_code} at ${payment.parking_name} is booked. Payment ref: ${razorpay_payment_id}`]
      );
      await connection.query(
        `INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, 'payment')`,
        [payment.operator_id, 'Parking Slot Booked', `${req.user.name} booked slot ${payment.slot_code} at ${payment.parking_name}. Ref: ${razorpay_payment_id}`]
      );
      return true;
    });
    if (!booking.result) {
      return res.status(409).json({ error: 'Payment was received after the slot hold expired. Contact the parking operator before retrying.' });
    }

    return res.json({
      message: 'Payment verified successfully.',
      receipt: {
        id: payment.id,
        transaction_id: razorpay_payment_id,
        parking_id: payment.parking_id,
        parking_name: payment.parking_name,
        slot_id: payment.parking_slot_id,
        slot_code: payment.slot_code,
        amount: Number(payment.amount),
        payment_method: payment.payment_method,
        duration_hours: Number(payment.duration_hours),
        vehicle_number: payment.vehicle_number || 'N/A',
        status: 'Success',
        timestamp: new Date().toISOString()
      }
    });
  } catch (err) {
    console.error('Razorpay verification error:', err);
    return res.status(500).json({ error: 'Unable to verify the payment.' });
  }
});

router.post('/free-booking', async (req, res) => {
  try {
    const { parking_id, slot_id, duration_hours, vehicle_number } = req.body;
    const duration = Number(duration_hours);
    if (typeof vehicle_number !== 'string' || !vehicle_number.trim()) {
      return res.status(400).json({ error: 'Vehicle registration number is required.' });
    }
    if (!Number.isInteger(Number(slot_id)) || Number(slot_id) < 1 || ![1, 2, 5, 24].includes(duration)) {
      return res.status(400).json({ error: 'Choose an available slot and valid parking duration.' });
    }
    const parking = await queryOne('SELECT id, name, operator_id, is_free FROM parkings WHERE id = ?', [parking_id]);
    if (!parking) return res.status(404).json({ error: 'Parking location not found.' });
    if (!Number(parking.is_free)) return res.status(400).json({ error: 'This parking location requires payment.' });

    const booking = await withParkingTransaction(parking_id, async (connection, lockedParking) => {
      if (!isParkingOpenNow(lockedParking.opening_time, lockedParking.closing_time)) {
        return { error: `Parking is closed. Its hours are ${lockedParking.opening_time} to ${lockedParking.closing_time}.` };
      }
      await releaseExpiredHolds(connection, parking_id);
      const [slots] = await connection.query(
        `SELECT id, slot_code FROM parking_slots
         WHERE id = ? AND parking_id = ? AND status = 'available'
         FOR UPDATE`,
        [slot_id, parking_id]
      );
      if (slots.length === 0) return null;

      await connection.query(
        `UPDATE parking_slots
         SET status = 'booked', booked_by_user_id = ?, vehicle_number = ?,
             duration_hours = ?, booked_at = NOW()
         WHERE id = ?`,
        [req.user.id, vehicle_number.trim().toUpperCase(), duration, slot_id]
      );
      await connection.query('UPDATE parkings SET available_spaces = available_spaces - 1 WHERE id = ?', [parking_id]);
      await connection.query(
        `INSERT INTO parking_history (user_id, parking_id, action_type, price_paid)
         VALUES (?, ?, 'booked', 0)`,
        [req.user.id, parking_id]
      );
      await connection.query(
        `INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, 'booking')`,
        [req.user.id, 'Slot Booking Confirmed', `Free parking slot ${slots[0].slot_code} at ${parking.name} is booked.`]
      );
      await connection.query(
        `INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, 'booking')`,
        [parking.operator_id, 'Parking Slot Booked', `${req.user.name} booked slot ${slots[0].slot_code} at ${parking.name}.`]
      );
      return slots[0];
    });
    if (!booking.parking) return res.status(404).json({ error: 'Parking location not found.' });
    if (booking.result?.error) return res.status(409).json({ error: booking.result.error });
    if (!booking.result) return res.status(409).json({ error: 'This slot was just taken. Choose another available slot.' });

    return res.status(201).json({
      message: 'Free parking slot booked successfully.',
      receipt: {
        id: booking.result.id,
        parking_id: parking.id,
        parking_name: parking.name,
        slot_id: booking.result.id,
        slot_code: booking.result.slot_code,
        amount: 0,
        payment_method: 'Free',
        duration_hours: duration,
        vehicle_number: vehicle_number.trim().toUpperCase(),
        status: 'Success',
        timestamp: new Date().toISOString()
      }
    });
  } catch (err) {
    console.error('Free slot booking error:', err);
    return res.status(500).json({ error: 'Unable to book this free parking slot.' });
  }
});

router.post('/pay', async (req, res) => {
  let savedProofPath;
  let proofPersisted = false;
  try {
    const {
      parking_id,
      slot_id,
      payment_method,
      duration_hours,
      vehicle_number,
      payer_name,
      payment_screenshot
    } = req.body;

    if (!parking_id || !payment_method) {
      return res.status(400).json({ error: 'Parking ID and payment method are required.' });
    }

    if (!['Cash', 'UPI'].includes(payment_method)) {
      return res.status(400).json({ error: 'Use the business QR for UPI or Razorpay Checkout for card payments.' });
    }

    if (typeof vehicle_number !== 'string' || !vehicle_number.trim()) {
      return res.status(400).json({ error: 'Vehicle registration number is required.' });
    }
    if (!Number.isInteger(Number(slot_id)) || Number(slot_id) < 1) {
      return res.status(400).json({ error: 'Choose an available parking slot before confirming.' });
    }
    const charge = await getParkingCharge(parking_id, duration_hours);
    if (charge.error) return res.status(charge.status).json({ error: charge.error });
    const { parking, amount: payAmount, duration } = charge;
    if (payment_method === 'UPI' && !parking.payment_qr_url) {
      return res.status(400).json({ error: 'This parking facility has not added a business payment QR yet.' });
    }

    let payerName = null;
    let screenshotFilename = null;
    if (payment_method === 'UPI') {
      payerName = typeof payer_name === 'string' ? payer_name.trim() : '';
      if (!payerName || payerName.length > 120) {
        return res.status(400).json({ error: 'Enter the payer name shown in the UPI payment app (maximum 120 characters).' });
      }
      const imageMatch = typeof payment_screenshot === 'string'
        ? payment_screenshot.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/)
        : null;
      if (!imageMatch) {
        return res.status(400).json({ error: 'Upload a screenshot of the completed UPI payment.' });
      }
      const [, contentType, encodedScreenshot] = imageMatch;
      const screenshotBuffer = Buffer.from(encodedScreenshot, 'base64');
      if (screenshotBuffer.length === 0 || screenshotBuffer.length > 5 * 1024 * 1024) {
        return res.status(413).json({ error: 'Payment screenshots must be 5 MB or smaller.' });
      }
      const hasValidSignature = contentType === 'image/jpeg'
        ? screenshotBuffer[0] === 0xff && screenshotBuffer[1] === 0xd8 && screenshotBuffer[2] === 0xff
        : contentType === 'image/png'
          ? screenshotBuffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
          : screenshotBuffer.toString('ascii', 0, 4) === 'RIFF'
            && screenshotBuffer.toString('ascii', 8, 12) === 'WEBP';
      if (!hasValidSignature) {
        return res.status(400).json({ error: 'The selected payment screenshot is not a valid image.' });
      }

      const extension = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[contentType];
      const uploadDirectory = path.join(__dirname, '../uploads/payment-proofs');
      screenshotFilename = `${crypto.randomUUID()}.${extension}`;
      savedProofPath = path.join(uploadDirectory, screenshotFilename);
      await fs.mkdir(uploadDirectory, { recursive: true });
      await fs.writeFile(savedProofPath, screenshotBuffer, { flag: 'wx' });
    }

    const transactionId = `EP-${payment_method.toUpperCase()}-${crypto.randomUUID()}`;
    const booking = await withParkingTransaction(parking_id, async (connection, lockedParking) => {
      if (!isParkingOpenNow(lockedParking.opening_time, lockedParking.closing_time)) {
        return { error: `Parking is closed. Its hours are ${lockedParking.opening_time} to ${lockedParking.closing_time}.` };
      }
      await releaseExpiredHolds(connection, parking_id);
      if (payment_method === 'UPI') {
        const [currentParking] = await connection.query(
          'SELECT payment_qr_url FROM parkings WHERE id = ?',
          [parking_id]
        );
        if (!currentParking[0]?.payment_qr_url) return { error: 'The parking facility no longer has a payment QR configured.' };
      }
      const [slots] = await connection.query(
        `SELECT id, slot_code FROM parking_slots
         WHERE id = ? AND parking_id = ? AND status = 'available'
         FOR UPDATE`,
        [slot_id, parking_id]
      );
      if (slots.length === 0) return null;

      await connection.query(
        `UPDATE parking_slots
         SET status = 'booked', booked_by_user_id = ?, vehicle_number = ?,
             duration_hours = ?, booked_at = NOW()
         WHERE id = ?`,
        [req.user.id, vehicle_number.trim().toUpperCase(), duration, slot_id]
      );
      await connection.query('UPDATE parkings SET available_spaces = available_spaces - 1 WHERE id = ?', [parking_id]);
      const [insertResult] = await connection.query(`
        INSERT INTO payments (user_id, parking_id, amount, payment_method, transaction_id, parking_slot_id, status, duration_hours)
        VALUES (?, ?, ?, ?, ?, ?, 'Pending', ?)
      `, [req.user.id, parking_id, payAmount, payment_method, transactionId, slot_id, duration]);
      if (payment_method === 'UPI') {
        await connection.query(`
          INSERT INTO payment_proofs (payment_id, payer_name, screenshot_filename)
          VALUES (?, ?, ?)
        `, [insertResult.insertId, payerName, screenshotFilename]);
      }
      await connection.query(`
        INSERT INTO parking_history (user_id, parking_id, action_type, price_paid)
        VALUES (?, ?, 'booked', ?)
      `, [req.user.id, parking_id, payAmount]);
      await connection.query(`
        INSERT INTO notifications (user_id, title, message, type)
        VALUES (?, ?, ?, 'payment')
      `, [
        req.user.id,
        payment_method === 'UPI' ? 'QR/UPI Payment Submitted' : 'Cash Payment Processing',
        payment_method === 'UPI'
          ? `Your slot ${slots[0].slot_code} at ${parking.name} is reserved. Your UPI screenshot is waiting for operator verification. Ref: ${transactionId}`
          : `Your slot ${slots[0].slot_code} at ${parking.name} is confirmed. ₹${payAmount} cash is due at the facility. Ref: ${transactionId}`
      ]);
      await connection.query(`
        INSERT INTO notifications (user_id, title, message, type)
        VALUES (?, ?, ?, 'payment')
      `, [
        parking.operator_id,
        payment_method === 'UPI' ? 'UPI Payment Proof Submitted' : 'Cash Payment Pending',
        payment_method === 'UPI'
          ? `${req.user.name} submitted UPI payment proof for ₹${payAmount} at ${parking.name}, slot ${slots[0].slot_code}. Verify the screenshot in the operator dashboard. Ref: ${transactionId}`
          : `₹${payAmount} cash is awaiting collection from ${req.user.name} for ${parking.name}, slot ${slots[0].slot_code}. Ref: ${transactionId}`
      ]);
      return { ...slots[0], paymentId: insertResult.insertId };
    });
    if (!booking.parking) return res.status(404).json({ error: 'Parking location not found.' });
    if (booking.result?.error) return res.status(409).json({ error: booking.result.error });
    if (!booking.result) return res.status(409).json({ error: 'This slot was just taken. Choose another available slot.' });
    proofPersisted = payment_method === 'UPI';

    const receipt = {
      id: booking.result.paymentId,
      transaction_id: transactionId,
      parking_id,
      parking_name: parking.name,
      slot_id: booking.result.id,
      slot_code: booking.result.slot_code,
      amount: payAmount,
      payment_method,
      duration_hours: duration,
      vehicle_number: vehicle_number || 'N/A',
      status: 'Pending',
      timestamp: new Date().toISOString()
    };

    return res.status(201).json({
      message: payment_method === 'UPI'
        ? 'Slot reserved. Your payment screenshot is awaiting operator verification.'
        : 'Slot reserved. Cash payment is awaiting collection.',
      receipt
    });
  } catch (err) {
    console.error('Payment error:', err);
    return res.status(500).json({ error: 'Internal server error while processing payment.' });
  } finally {
    if (savedProofPath && !proofPersisted) {
      await fs.unlink(savedProofPath).catch((err) => {
        if (err.code !== 'ENOENT') console.error('Unable to clean up unlinked payment screenshot:', err);
      });
    }
  }
});

router.get('/history', async (req, res) => {
  try {
    const payments = await query(`
      SELECT pay.*, p.name as parking_name, p.address as parking_address, p.city
      FROM payments pay
      JOIN parkings p ON pay.parking_id = p.id
      WHERE pay.user_id = ?
      ORDER BY pay.created_at DESC
    `, [req.user.id]);

    return res.json({ payments });
  } catch (err) {
    console.error('Get payment history error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
