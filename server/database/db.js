const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'soham',
  database: process.env.DB_NAME || 'easypark',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  multipleStatements: true
});

async function initDb() {
  try {
    const conn = await pool.getConnection();
    console.log(`🔌 Connected to MySQL Database: "${process.env.DB_NAME || 'easypark'}" on ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || '3306'}`);
    
    const schemaPath = path.join(__dirname, 'schema.sql');
    if (fs.existsSync(schemaPath)) {
      const schemaSql = fs.readFileSync(schemaPath, 'utf8');
      await conn.query(schemaSql);
      // Migrate databases created before username-based login was available.
      const [usernameColumns] = await conn.query("SHOW COLUMNS FROM users LIKE 'username'");
      if (usernameColumns.length === 0) {
        await conn.query('ALTER TABLE users ADD COLUMN username VARCHAR(50) UNIQUE AFTER name');
      }
      const [normalizedPhoneColumns] = await conn.query("SHOW COLUMNS FROM users LIKE 'phone_normalized'");
      if (normalizedPhoneColumns.length === 0) {
        await conn.query(`
          ALTER TABLE users
          ADD COLUMN phone_normalized VARCHAR(50)
            GENERATED ALWAYS AS (NULLIF(REGEXP_REPLACE(phone, '[^0-9]', ''), '')) STORED,
          ADD UNIQUE KEY uq_users_phone_normalized (phone_normalized)
        `);
      } else {
        const [phoneIndexes] = await conn.query("SHOW INDEX FROM users WHERE Key_name = 'uq_users_phone_normalized'");
        if (phoneIndexes.length === 0) {
          await conn.query('ALTER TABLE users ADD UNIQUE KEY uq_users_phone_normalized (phone_normalized)');
        }
      }
      const [paymentMethodColumns] = await conn.query("SHOW COLUMNS FROM payments LIKE 'payment_method'");
      if (!paymentMethodColumns[0].Type.includes("'Paytm Wallet'")) {
        await conn.query("ALTER TABLE payments MODIFY payment_method ENUM('UPI', 'Card', 'Cash', 'Paytm Wallet') NOT NULL");
      }
      const [paymentQrColumns] = await conn.query("SHOW COLUMNS FROM parkings LIKE 'payment_qr_url'");
      if (paymentQrColumns.length === 0) {
        await conn.query('ALTER TABLE parkings ADD COLUMN payment_qr_url TEXT NULL AFTER daily_price');
      }
      const [googleMapsColumns] = await conn.query("SHOW COLUMNS FROM parkings LIKE 'google_maps_url'");
      if (googleMapsColumns.length === 0) {
        await conn.query('ALTER TABLE parkings ADD COLUMN google_maps_url TEXT NULL AFTER longitude');
      }
      const [parkingSlotColumns] = await conn.query("SHOW COLUMNS FROM payments LIKE 'parking_slot_id'");
      if (parkingSlotColumns.length === 0) {
        await conn.query(`
          ALTER TABLE payments
          ADD COLUMN parking_slot_id INT NULL,
          ADD INDEX idx_payments_parking_slot (parking_slot_id),
          ADD CONSTRAINT fk_payments_parking_slot
            FOREIGN KEY (parking_slot_id) REFERENCES parking_slots(id) ON DELETE SET NULL
        `);
      }

      const [historySlotColumns] = await conn.query("SHOW COLUMNS FROM parking_history LIKE 'parking_slot_id'");
      if (historySlotColumns.length === 0) {
        await conn.query('ALTER TABLE parking_history ADD COLUMN parking_slot_id INT NULL AFTER parking_id');
      }
      const [historySlotIndexes] = await conn.query("SHOW INDEX FROM parking_history WHERE Key_name = 'idx_parking_history_slot'");
      if (historySlotIndexes.length === 0) {
        await conn.query('ALTER TABLE parking_history ADD INDEX idx_parking_history_slot (parking_slot_id, user_id, action_type)');
      }
      const [pushStatusColumns] = await conn.query("SHOW COLUMNS FROM notifications LIKE 'push_status'");
      if (pushStatusColumns.length === 0) {
        await conn.query(`
          ALTER TABLE notifications
          ADD COLUMN push_status ENUM('pending', 'sent', 'skipped', 'failed') NOT NULL DEFAULT 'pending' AFTER is_read,
          ADD COLUMN push_attempts TINYINT UNSIGNED NOT NULL DEFAULT 0 AFTER push_status,
          ADD COLUMN push_available_at DATETIME NULL AFTER push_attempts,
          ADD COLUMN push_error VARCHAR(255) NULL AFTER push_available_at
        `);
        await conn.query("UPDATE notifications SET push_status = 'sent'");
      }
      const [pushQueueIndexes] = await conn.query("SHOW INDEX FROM notifications WHERE Key_name = 'idx_notifications_push_queue'");
      if (pushQueueIndexes.length === 0) {
        await conn.query('ALTER TABLE notifications ADD INDEX idx_notifications_push_queue (push_status, push_available_at, id)');
      }
      await conn.query("UPDATE parking_slots SET booked_by_user_id = NULL WHERE status <> 'booked'");
      await conn.query("UPDATE parking_slots SET held_by_user_id = NULL WHERE status <> 'held'");
      const [bookedUserIndexes] = await conn.query("SHOW INDEX FROM parking_slots WHERE Key_name = 'unique_booked_user_slot'");
      if (bookedUserIndexes.length === 0) {
        await conn.query('ALTER TABLE parking_slots ADD UNIQUE KEY unique_booked_user_slot (booked_by_user_id)');
      }
      const [heldUserIndexes] = await conn.query("SHOW INDEX FROM parking_slots WHERE Key_name = 'unique_held_user_slot'");
      if (heldUserIndexes.length === 0) {
        await conn.query('ALTER TABLE parking_slots ADD UNIQUE KEY unique_held_user_slot (held_by_user_id)');
      }
      await conn.query(`
        INSERT INTO parking_history (user_id, parking_id, parking_slot_id, action_type, price_paid, created_at)
        SELECT s.booked_by_user_id, s.parking_id, s.id, 'booked',
          COALESCE((SELECT pay.amount FROM payments pay WHERE pay.parking_slot_id = s.id ORDER BY pay.id DESC LIMIT 1), 0),
          COALESCE(s.booked_at, NOW())
        FROM parking_slots s
        WHERE s.status = 'booked' AND s.booked_by_user_id IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM parking_history h
            WHERE h.parking_slot_id = s.id AND h.user_id = s.booked_by_user_id
              AND h.action_type IN ('booked', 'paid', 'released')
          )
      `);

      const [parkings] = await conn.query('SELECT id, total_spaces, available_spaces FROM parkings');
      for (const parking of parkings) {
        const [existingSlots] = await conn.query(
          'SELECT slot_code, status FROM parking_slots WHERE parking_id = ? ORDER BY id',
          [parking.id]
        );
        let availableCount = existingSlots.filter((slot) => slot.status === 'available').length;
        let nextNumber = 1;
        for (const slot of existingSlots) {
          const match = slot.slot_code.match(/-(\d+)$/);
          if (match) nextNumber = Math.max(nextNumber, Number(match[1]) + 1);
        }
        const totalSpaces = Math.max(0, Number(parking.total_spaces));
        const targetAvailable = Math.max(0, Math.min(totalSpaces, Number(parking.available_spaces)));
        while (existingSlots.length < totalSpaces) {
          const status = availableCount < targetAvailable ? 'available' : 'unavailable';
          await conn.query(
            'INSERT INTO parking_slots (parking_id, slot_code, status) VALUES (?, ?, ?)',
            [parking.id, `EP-${parking.id}-${String(nextNumber++).padStart(4, '0')}`, status]
          );
          existingSlots.push({ status });
          if (status === 'available') availableCount += 1;
        }
        if (availableCount !== targetAvailable) {
          const statusesToChange = availableCount < targetAvailable ? 'unavailable' : 'available';
          const newStatus = statusesToChange === 'unavailable' ? 'available' : 'unavailable';
          const changesNeeded = Math.abs(targetAvailable - availableCount);
          const [changeableSlots] = await conn.query(
            'SELECT id FROM parking_slots WHERE parking_id = ? AND status = ? ORDER BY id LIMIT ?',
            [parking.id, statusesToChange, changesNeeded]
          );
          for (const slot of changeableSlots) {
            await conn.query('UPDATE parking_slots SET status = ? WHERE id = ?', [newStatus, slot.id]);
          }
        }
      }
      console.log('✅ MySQL schema verified & tables ready.');
    }
    conn.release();
  } catch (err) {
    console.error('❌ Failed to initialize MySQL Database:', err.message);
    throw err;
  }
}

async function query(sql, params = []) {
  const [rows] = await pool.query(sql, params);
  return rows;
}

async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

async function run(sql, params = []) {
  const [result] = await pool.query(sql, params);
  return { lastInsertRowid: result.insertId, changes: result.affectedRows };
}

module.exports = {
  initDb,
  query,
  queryOne,
  run,
  pool
};
