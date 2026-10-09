const { pool } = require('../database/db');

const HOLD_MINUTES = 10;

function createSlotCode(parkingId, number) {
  return `EP-${parkingId}-${String(number).padStart(4, '0')}`;
}

async function synchronizeSlotInventory(connection, parkingId, totalSpaces, availableSpaces) {
  const [slots] = await connection.query(
    'SELECT id, slot_code, status FROM parking_slots WHERE parking_id = ? ORDER BY id FOR UPDATE',
    [parkingId]
  );
  const activeCount = slots.filter((slot) => slot.status === 'held' || slot.status === 'booked').length;
  if (totalSpaces < activeCount || availableSpaces < 0 || availableSpaces > totalSpaces - activeCount) {
    throw new Error('Space totals cannot be lower than active bookings or exceed unbooked capacity.');
  }

  let nextNumber = 1;
  for (const slot of slots) {
    const match = slot.slot_code.match(/-(\d+)$/);
    if (match) nextNumber = Math.max(nextNumber, Number(match[1]) + 1);
  }
  while (slots.length < totalSpaces) {
    const status = 'unavailable';
    const [result] = await connection.query(
      'INSERT INTO parking_slots (parking_id, slot_code, status) VALUES (?, ?, ?)',
      [parkingId, createSlotCode(parkingId, nextNumber++), status]
    );
    slots.push({ id: result.insertId, status });
  }

  const availableCount = slots.filter((slot) => slot.status === 'available').length;
  let difference = availableSpaces - availableCount;
  for (const slot of slots) {
    if (difference > 0 && slot.status === 'unavailable') {
      await connection.query("UPDATE parking_slots SET status = 'available' WHERE id = ?", [slot.id]);
      slot.status = 'available';
      difference -= 1;
    } else if (difference < 0 && slot.status === 'available') {
      await connection.query("UPDATE parking_slots SET status = 'unavailable' WHERE id = ?", [slot.id]);
      slot.status = 'unavailable';
      difference += 1;
    }
    if (difference === 0) break;
  }
}

async function withParkingTransaction(parkingId, callback) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [parkings] = await connection.query(
      'SELECT id, total_spaces, available_spaces FROM parkings WHERE id = ? FOR UPDATE',
      [parkingId]
    );
    if (parkings.length === 0) {
      await connection.rollback();
      return { parking: null };
    }
    const result = await callback(connection, parkings[0]);
    await connection.commit();
    return { parking: parkings[0], result };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function releaseExpiredHolds(connection, parkingId) {
  const [expiredSlots] = await connection.query(
    "SELECT id FROM parking_slots WHERE parking_id = ? AND status = 'held' AND hold_expires_at <= NOW() FOR UPDATE",
    [parkingId]
  );
  if (expiredSlots.length === 0) return 0;

  await connection.query(
    "UPDATE payments SET status = 'Failed' WHERE parking_slot_id IN (?) AND status = 'Pending'",
    [expiredSlots.map((slot) => slot.id)]
  );
  await connection.query(
    `UPDATE parking_slots
     SET status = 'available', held_by_user_id = NULL, hold_token = NULL,
         hold_order_id = NULL, hold_expires_at = NULL, vehicle_number = NULL, duration_hours = NULL
     WHERE id IN (?)`,
    [expiredSlots.map((slot) => slot.id)]
  );
  await connection.query(
    'UPDATE parkings SET available_spaces = LEAST(total_spaces, available_spaces + ?) WHERE id = ?',
    [expiredSlots.length, parkingId]
  );
  return expiredSlots.length;
}

async function expireAllSlotHolds() {
  const connection = await pool.getConnection();
  try {
    const [rows] = await connection.query(
      "SELECT DISTINCT parking_id FROM parking_slots WHERE status = 'held' AND hold_expires_at <= NOW() ORDER BY parking_id"
    );
    for (const row of rows) {
      await connection.beginTransaction();
      try {
        await connection.query('SELECT id FROM parkings WHERE id = ? FOR UPDATE', [row.parking_id]);
        await releaseExpiredHolds(connection, row.parking_id);
        await connection.commit();
      } catch (error) {
        await connection.rollback();
        throw error;
      }
    }
  } finally {
    connection.release();
  }
}

async function provisionParkingSlots(parkingId, totalSpaces, availableSpaces) {
  return withParkingTransaction(parkingId, async (connection) => {
    await synchronizeSlotInventory(connection, parkingId, totalSpaces, availableSpaces);
  });
}

module.exports = {
  HOLD_MINUTES,
  createSlotCode,
  expireAllSlotHolds,
  releaseExpiredHolds,
  synchronizeSlotInventory,
  withParkingTransaction,
  provisionParkingSlots
};
