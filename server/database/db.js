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
