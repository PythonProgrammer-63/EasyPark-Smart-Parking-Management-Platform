const express = require('express');
const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const router = express.Router();
const { query, queryOne, run, pool } = require('../database/db');
const { authenticateToken, optionalAuth, requireRole } = require('../middleware/auth');
const { provisionParkingSlots, synchronizeSlotInventory } = require('../services/parkingSlots');
const { isParkingOpenNow, isValidParkingTime } = require('../services/parkingHours');

function validateGoogleMapsUrl(value) {
  if (value == null || value === '') return null;
  if (typeof value !== 'string') return undefined;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    const isGoogleMapsHost = host === 'maps.app.goo.gl'
      || host === 'goo.gl'
      || host === 'google.com'
      || host === 'google.co.in'
      || host.endsWith('.google.com')
      || /^maps\.google\.(?:co\.)?[a-z]{2,3}$/.test(host);
    return url.protocol === 'https:' && isGoogleMapsHost ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null;
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c;
  return Math.round(d * 10) / 10;
}

function getAvailabilityStatus(availableSpaces, isOpenNow) {
  if (!isOpenNow) {
    return { status: 'Closed', color: 'red', code: 'closed' };
  }
  if (availableSpaces > 5) {
    return { status: 'Available', color: 'green', code: 'available' };
  } else if (availableSpaces > 0) {
    return { status: 'Limited', color: 'amber', code: 'limited' };
  } else {
    return { status: 'Full', color: 'red', code: 'full' };
  }
}

router.post('/:id/payment-qr', authenticateToken, requireRole('operator', 'admin'), async (req, res) => {
  let savedQrPath;
  let qrSaved = false;
  try {
    const parking = await queryOne('SELECT id, operator_id, payment_qr_url FROM parkings WHERE id = ?', [req.params.id]);
    if (!parking) return res.status(404).json({ error: 'Parking location not found.' });
    if (req.user.role !== 'admin' && parking.operator_id !== req.user.id) {
      return res.status(403).json({ error: 'You are not authorized to manage this parking QR.' });
    }

    const image = typeof req.body.image === 'string' ? req.body.image : '';
    const match = image.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/);
    if (!match) return res.status(400).json({ error: 'Choose a JPEG, PNG, or WebP QR image.' });

    const [, contentType, encodedImage] = match;
    const imageBuffer = Buffer.from(encodedImage, 'base64');
    if (imageBuffer.length === 0 || imageBuffer.length > 5 * 1024 * 1024) {
      return res.status(413).json({ error: 'Payment QR images must be 5 MB or smaller.' });
    }

    const hasValidSignature = contentType === 'image/jpeg'
      ? imageBuffer[0] === 0xff && imageBuffer[1] === 0xd8 && imageBuffer[2] === 0xff
      : contentType === 'image/png'
        ? imageBuffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
        : imageBuffer.toString('ascii', 0, 4) === 'RIFF'
          && imageBuffer.toString('ascii', 8, 12) === 'WEBP';
    if (!hasValidSignature) return res.status(400).json({ error: 'The selected file is not a valid image.' });

    const extension = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[contentType];
    const uploadDirectory = path.join(__dirname, '../uploads/payment-qrs');
    const filename = `parking-${parking.id}-${crypto.randomUUID()}.${extension}`;
    savedQrPath = path.join(uploadDirectory, filename);
    await fs.mkdir(uploadDirectory, { recursive: true });
    await fs.writeFile(savedQrPath, imageBuffer, { flag: 'wx' });

    const paymentQrUrl = `/uploads/payment-qrs/${filename}`;
    await run('UPDATE parkings SET payment_qr_url = ? WHERE id = ?', [paymentQrUrl, parking.id]);
    qrSaved = true;

    if (parking.payment_qr_url?.startsWith('/uploads/payment-qrs/')) {
      const previousFilename = path.basename(parking.payment_qr_url);
      if (previousFilename !== filename) {
        fs.unlink(path.join(uploadDirectory, previousFilename)).catch((error) => {
          if (error.code !== 'ENOENT') console.error('Unable to remove old payment QR image:', error);
        });
      }
    }

    return res.json({ message: 'Business payment QR saved.', payment_qr_url: paymentQrUrl });
  } catch (err) {
    if (savedQrPath && !qrSaved) {
      await fs.unlink(savedQrPath).catch((cleanupError) => {
        if (cleanupError.code !== 'ENOENT') console.error('Unable to remove failed payment QR upload:', cleanupError);
      });
    }
    console.error('Save parking payment QR error:', err);
    return res.status(500).json({ error: 'Unable to save this parking payment QR.' });
  }
});

router.delete('/:id/payment-qr', authenticateToken, requireRole('operator', 'admin'), async (req, res) => {
  try {
    const parking = await queryOne('SELECT id, operator_id, payment_qr_url FROM parkings WHERE id = ?', [req.params.id]);
    if (!parking) return res.status(404).json({ error: 'Parking location not found.' });
    if (req.user.role !== 'admin' && parking.operator_id !== req.user.id) {
      return res.status(403).json({ error: 'You are not authorized to manage this parking QR.' });
    }

    await run('UPDATE parkings SET payment_qr_url = NULL WHERE id = ?', [parking.id]);
    if (parking.payment_qr_url?.startsWith('/uploads/payment-qrs/')) {
      await fs.unlink(path.join(__dirname, '../uploads/payment-qrs', path.basename(parking.payment_qr_url)))
        .catch((err) => {
          if (err.code !== 'ENOENT') throw err;
        });
    }
    return res.json({ message: 'Business payment QR removed.' });
  } catch (err) {
    console.error('Remove parking payment QR error:', err);
    return res.status(500).json({ error: 'Unable to remove this parking payment QR.' });
  }
});

// Get all parkings
router.get('/', optionalAuth, async (req, res) => {
  try {
    const {
      search,
      lat,
      lng,
      parking_type,
      price_filter,
      max_distance,
      is_covered,
      is_open,
      has_cctv,
      has_security,
      has_ev_charging
    } = req.query;

    const userLat = lat ? parseFloat(lat) : null;
    const userLng = lng ? parseFloat(lng) : null;

    let sql = `
      SELECT p.*,
        u.name as operator_name,
        u.phone as operator_phone,
        (SELECT COUNT(*) FROM reviews r WHERE r.parking_id = p.id) as review_count,
        (SELECT AVG(r.rating) FROM reviews r WHERE r.parking_id = p.id) as avg_rating
      FROM parkings p
      JOIN users u ON p.operator_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      sql += ` AND (p.name LIKE ? OR p.area LIKE ? OR p.city LIKE ? OR p.address LIKE ? OR p.landmark LIKE ?)`;
      params.push(term, term, term, term, term);
    }

    if (parking_type && parking_type !== 'All') {
      sql += ` AND p.parking_type = ?`;
      params.push(parking_type);
    }

    if (price_filter === 'free') {
      sql += ` AND p.is_free = 1`;
    } else if (price_filter === 'paid') {
      sql += ` AND p.is_free = 0`;
    }

    if (is_covered === 'true' || is_covered === '1') {
      sql += ` AND p.is_covered = 1`;
    }
    if (is_open === 'true' || is_open === '1') {
      sql += ` AND p.is_open = 1`;
    }
    if (has_cctv === 'true' || has_cctv === '1') {
      sql += ` AND p.has_cctv = 1`;
    }
    if (has_security === 'true' || has_security === '1') {
      sql += ` AND p.has_security = 1`;
    }
    if (has_ev_charging === 'true' || has_ev_charging === '1') {
      sql += ` AND p.has_ev_charging = 1`;
    }

    sql += ` ORDER BY p.id DESC`;

    const rawParkings = await query(sql, params);

    const userFavourites = req.user
      ? (await query('SELECT parking_id FROM favourites WHERE user_id = ?', [req.user.id])).map(f => f.parking_id)
      : [];

    let enriched = await Promise.all(rawParkings.map(async (p) => {
      const photos = await query('SELECT id, photo_url, photo_type, caption FROM parking_photos WHERE parking_id = ? ORDER BY id ASC', [p.id]);
      const primaryPhoto = photos.length > 0
        ? photos[0].photo_url
        : 'https://images.unsplash.com/photo-1506521781263-d8422e82f27a?auto=format&fit=crop&w=1200&q=80';

      const distance = (userLat !== null && userLng !== null)
        ? calculateDistance(userLat, userLng, p.latitude, p.longitude)
        : null;

      const isOpenNow = isParkingOpenNow(p.opening_time, p.closing_time);
      const availability = getAvailabilityStatus(p.available_spaces, isOpenNow);

      return {
        ...p,
        google_maps_url: p.google_maps_url || null,
        is_open_now: isOpenNow,
        is_favourite: userFavourites.includes(p.id),
        photos,
        primary_photo: primaryPhoto,
        distance,
        availability,
        avg_rating: p.avg_rating ? Math.round(p.avg_rating * 10) / 10 : 4.5,
        review_count: p.review_count || 0
      };
    }));

    if (max_distance && userLat !== null && userLng !== null) {
      const maxDistNum = parseFloat(max_distance);
      if (!isNaN(maxDistNum)) {
        enriched = enriched.filter(p => p.distance !== null && p.distance <= maxDistNum);
      }
    }

    if (price_filter === 'low_to_high') {
      enriched.sort((a, b) => a.hourly_price - b.hourly_price);
    } else if (price_filter === 'high_to_low') {
      enriched.sort((a, b) => b.hourly_price - a.hourly_price);
    } else if (userLat !== null && userLng !== null) {
      enriched.sort((a, b) => (a.distance || 9999) - (b.distance || 9999));
    }

    return res.json({ parkings: enriched, count: enriched.length });
  } catch (err) {
    console.error('Fetch parkings error:', err);
    return res.status(500).json({ error: 'Internal server error while fetching parkings.' });
  }
});

// Single parking details
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { lat, lng } = req.query;
    const userLat = lat ? parseFloat(lat) : null;
    const userLng = lng ? parseFloat(lng) : null;

    const parking = await queryOne(`
      SELECT p.*,
        u.name as operator_name,
        u.phone as operator_phone,
        u.email as operator_email,
        (SELECT COUNT(*) FROM reviews r WHERE r.parking_id = p.id) as review_count,
        (SELECT AVG(r.rating) FROM reviews r WHERE r.parking_id = p.id) as avg_rating
      FROM parkings p
      JOIN users u ON p.operator_id = u.id
      WHERE p.id = ?
    `, [id]);

    if (!parking) {
      return res.status(404).json({ error: 'Parking location not found.' });
    }

    const photos = await query('SELECT id, photo_url, photo_type, caption FROM parking_photos WHERE parking_id = ? ORDER BY id ASC', [id]);
    
    const reviews = await query(`
      SELECT r.id, r.rating, r.comment, r.created_at, u.name as user_name, u.avatar_url as user_avatar
      FROM reviews r
      JOIN users u ON r.user_id = u.id
      WHERE r.parking_id = ?
      ORDER BY r.created_at DESC
    `, [id]);

    let is_favourite = false;
    if (req.user) {
      const fav = await queryOne('SELECT id FROM favourites WHERE user_id = ? AND parking_id = ?', [req.user.id, id]);
      is_favourite = !!fav;

      if (req.user.role === 'driver') {
        await run(`
          INSERT INTO parking_history (user_id, parking_id, action_type, price_paid)
          VALUES (?, ?, 'viewed', 0)
        `, [req.user.id, id]);
      }
    }

    const distance = (userLat !== null && userLng !== null)
      ? calculateDistance(userLat, userLng, parking.latitude, parking.longitude)
      : null;

    const isOpenNow = isParkingOpenNow(parking.opening_time, parking.closing_time);
    const availability = getAvailabilityStatus(parking.available_spaces, isOpenNow);

    return res.json({
      parking: {
        ...parking,
        google_maps_url: parking.google_maps_url || null,
        is_open_now: isOpenNow,
        is_favourite,
        photos,
        reviews,
        distance,
        availability,
        avg_rating: parking.avg_rating ? Math.round(parking.avg_rating * 10) / 10 : 0,
        review_count: parking.review_count || 0
      }
    });
  } catch (err) {
    console.error('Get parking details error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// Operator: Add New Parking
router.post('/', authenticateToken, requireRole('operator'), async (req, res) => {
  try {
    const {
      name, address, city, area, landmark, latitude, longitude, google_maps_url, entrance_location,
      parking_type, contact_number, opening_time, closing_time, total_spaces, available_spaces,
      hourly_price, two_hour_price, five_hour_price, daily_price, is_free,
      is_covered, is_open, has_cctv, has_security, has_ev_charging, photos
    } = req.body;

    if (!name || !address || !city || !area || latitude == null || longitude == null || !total_spaces || !contact_number) {
      return res.status(400).json({ error: 'Please provide all required parking details.' });
    }
    const mapUrl = validateGoogleMapsUrl(google_maps_url);
    if (mapUrl === undefined) {
      return res.status(400).json({ error: 'Enter a valid HTTPS Google Maps link.' });
    }
    if (!isValidParkingTime(opening_time || '07:00') || !isValidParkingTime(closing_time || '23:00')) {
      return res.status(400).json({ error: 'Enter valid opening and closing times.' });
    }

    const totSpaces = parseInt(total_spaces, 10);
    const availSpaces = available_spaces !== undefined ? parseInt(available_spaces, 10) : totSpaces;

    const insertResult = await run(`
      INSERT INTO parkings (
        operator_id, name, address, city, area, landmark, latitude, longitude, google_maps_url, entrance_location,
        parking_type, contact_number, opening_time, closing_time, total_spaces, available_spaces,
        hourly_price, two_hour_price, five_hour_price, daily_price, is_free, is_covered, is_open,
        has_cctv, has_security, has_ev_charging
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      req.user.id,
      name.trim(),
      address.trim(),
      city.trim(),
      area.trim(),
      landmark ? landmark.trim() : '',
      parseFloat(latitude),
      parseFloat(longitude),
      mapUrl,
      entrance_location ? entrance_location.trim() : 'Main Entrance Gate',
      parking_type || 'Public',
      contact_number.trim(),
      opening_time || '07:00',
      closing_time || '23:00',
      totSpaces,
      availSpaces,
      parseFloat(hourly_price || 0),
      two_hour_price ? parseFloat(two_hour_price) : parseFloat(hourly_price || 0) * 1.8,
      five_hour_price ? parseFloat(five_hour_price) : parseFloat(hourly_price || 0) * 4,
      daily_price ? parseFloat(daily_price) : parseFloat(hourly_price || 0) * 8,
      is_free ? 1 : 0,
      is_covered ? 1 : 0,
      is_open ? 1 : 0,
      has_cctv ? 1 : 0,
      has_security ? 1 : 0,
      has_ev_charging ? 1 : 0
    ]);

    const parkingId = insertResult.lastInsertRowid;
    await provisionParkingSlots(parkingId, totSpaces, availSpaces);

    if (Array.isArray(photos) && photos.length > 0) {
      for (const p of photos) {
        if (p.url || p.photo_url) {
          await run(`
            INSERT INTO parking_photos (parking_id, photo_url, photo_type, caption)
            VALUES (?, ?, ?, ?)
          `, [
            parkingId,
            p.url || p.photo_url,
            p.type || p.photo_type || 'general',
            p.caption || ''
          ]);
        }
      }
    } else {
      await run(`
        INSERT INTO parking_photos (parking_id, photo_url, photo_type, caption)
        VALUES (?, 'https://images.unsplash.com/photo-1590674899484-d5640e854abe?auto=format&fit=crop&w=1200&q=80', 'entrance', 'Main Entrance Gate')
      `, [parkingId]);
    }

    const createdParking = await queryOne('SELECT * FROM parkings WHERE id = ?', [parkingId]);

    return res.status(201).json({
      message: 'Parking added successfully and is immediately available for drivers!',
      parking: createdParking
    });
  } catch (err) {
    console.error('Add parking error:', err);
    return res.status(500).json({ error: 'Internal server error while adding parking.' });
  }
});

// Operator: Update Parking Details
router.put('/:id', authenticateToken, requireRole('operator'), async (req, res) => {
  let connection;
  try {
    const { id } = req.params;
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [parkings] = await connection.query('SELECT * FROM parkings WHERE id = ? FOR UPDATE', [id]);
    const existing = parkings[0];

    if (!existing) {
      await connection.rollback();
      return res.status(404).json({ error: 'Parking not found.' });
    }

    if (existing.operator_id !== req.user.id) {
      await connection.rollback();
      return res.status(403).json({ error: 'You are not authorized to edit this parking.' });
    }

    const {
      name, address, city, area, landmark, latitude, longitude, google_maps_url, entrance_location,
      parking_type, contact_number, opening_time, closing_time, total_spaces, available_spaces,
      hourly_price, two_hour_price, five_hour_price, daily_price, is_free,
      is_covered, is_open, has_cctv, has_security, has_ev_charging, photos
    } = req.body;

    const mapUrl = google_maps_url === undefined
      ? existing.google_maps_url
      : validateGoogleMapsUrl(google_maps_url);
    if (mapUrl === undefined) {
      await connection.rollback();
      return res.status(400).json({ error: 'Enter a valid HTTPS Google Maps link.' });
    }
    if (
      !isValidParkingTime(opening_time === undefined ? existing.opening_time : opening_time)
      || !isValidParkingTime(closing_time === undefined ? existing.closing_time : closing_time)
    ) {
      await connection.rollback();
      return res.status(400).json({ error: 'Enter valid opening and closing times.' });
    }

    await connection.query(`
      UPDATE parkings SET
        name = ?, address = ?, city = ?, area = ?, landmark = ?,
        latitude = ?, longitude = ?, google_maps_url = ?, entrance_location = ?, parking_type = ?,
        contact_number = ?, opening_time = ?, closing_time = ?,
        total_spaces = ?, available_spaces = ?, hourly_price = ?,
        two_hour_price = ?, five_hour_price = ?, daily_price = ?,
        is_free = ?, is_covered = ?, is_open = ?, has_cctv = ?,
        has_security = ?, has_ev_charging = ?
      WHERE id = ?
    `, [
      name || existing.name,
      address || existing.address,
      city || existing.city,
      area || existing.area,
      landmark !== undefined ? landmark : existing.landmark,
      latitude != null ? parseFloat(latitude) : existing.latitude,
      longitude != null ? parseFloat(longitude) : existing.longitude,
      mapUrl,
      entrance_location !== undefined ? entrance_location : existing.entrance_location,
      parking_type || existing.parking_type,
      contact_number || existing.contact_number,
      opening_time !== undefined ? opening_time : existing.opening_time,
      closing_time !== undefined ? closing_time : existing.closing_time,
      total_spaces != null ? parseInt(total_spaces, 10) : existing.total_spaces,
      available_spaces != null ? parseInt(available_spaces, 10) : existing.available_spaces,
      hourly_price != null ? parseFloat(hourly_price) : existing.hourly_price,
      two_hour_price != null ? parseFloat(two_hour_price) : existing.two_hour_price,
      five_hour_price != null ? parseFloat(five_hour_price) : existing.five_hour_price,
      daily_price != null ? parseFloat(daily_price) : existing.daily_price,
      is_free !== undefined ? (is_free ? 1 : 0) : existing.is_free,
      is_covered !== undefined ? (is_covered ? 1 : 0) : existing.is_covered,
      is_open !== undefined ? (is_open ? 1 : 0) : existing.is_open,
      has_cctv !== undefined ? (has_cctv ? 1 : 0) : existing.has_cctv,
      has_security !== undefined ? (has_security ? 1 : 0) : existing.has_security,
      has_ev_charging !== undefined ? (has_ev_charging ? 1 : 0) : existing.has_ev_charging,
      id
    ]);
    await synchronizeSlotInventory(
      connection,
      id,
      total_spaces != null ? parseInt(total_spaces, 10) : existing.total_spaces,
      available_spaces != null ? parseInt(available_spaces, 10) : existing.available_spaces
    );
    await connection.commit();
    connection.release();
    connection = null;

    if (Array.isArray(photos)) {
      await run('DELETE FROM parking_photos WHERE parking_id = ?', [id]);
      for (const p of photos) {
        if (p.url || p.photo_url) {
          await run(`
            INSERT INTO parking_photos (parking_id, photo_url, photo_type, caption)
            VALUES (?, ?, ?, ?)
          `, [id, p.url || p.photo_url, p.type || p.photo_type || 'general', p.caption || '']);
        }
      }
    }

    const updated = await queryOne('SELECT * FROM parkings WHERE id = ?', [id]);
    return res.json({ message: 'Parking updated successfully', parking: updated });
  } catch (err) {
    if (connection) await connection.rollback();
    console.error('Update parking error:', err);
    return res.status(500).json({ error: 'Internal server error while updating parking.' });
  } finally {
    if (connection) connection.release();
  }
});

// Operator: Quick Update Live Availability & Pricing
router.patch('/:id/quick-update', authenticateToken, requireRole('operator'), async (req, res) => {
  let connection;
  try {
    const { id } = req.params;
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [parkings] = await connection.query('SELECT * FROM parkings WHERE id = ? FOR UPDATE', [id]);

    if (parkings.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Parking not found.' });
    }
    const existing = parkings[0];

    if (existing.operator_id !== req.user.id) {
      await connection.rollback();
      return res.status(403).json({ error: 'Unauthorized.' });
    }

    const { available_spaces, total_spaces, hourly_price, daily_price } = req.body;

    const newAvail = available_spaces !== undefined ? parseInt(available_spaces, 10) : existing.available_spaces;
    const newTotal = total_spaces !== undefined ? parseInt(total_spaces, 10) : existing.total_spaces;
    const newHourly = hourly_price !== undefined ? parseFloat(hourly_price) : existing.hourly_price;
    const newDaily = daily_price !== undefined ? parseFloat(daily_price) : existing.daily_price;

    await connection.query(`
      UPDATE parkings SET
        available_spaces = ?,
        total_spaces = ?,
        hourly_price = ?,
        daily_price = ?
      WHERE id = ?
    `, [newAvail, newTotal, newHourly, newDaily, id]);
    await synchronizeSlotInventory(connection, id, newTotal, newAvail);
    await connection.commit();

    return res.json({
      message: 'Quick update saved!',
      available_spaces: newAvail,
      total_spaces: newTotal,
      hourly_price: newHourly,
      daily_price: newDaily,
      availability: getAvailabilityStatus(
        newAvail,
        isParkingOpenNow(existing.opening_time, existing.closing_time)
      )
    });
  } catch (err) {
    if (connection) await connection.rollback();
    console.error('Quick update error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  } finally {
    if (connection) connection.release();
  }
});

// Operator: Delete Parking
router.delete('/:id', authenticateToken, requireRole('operator'), async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await queryOne('SELECT * FROM parkings WHERE id = ?', [id]);

    if (!existing) {
      return res.status(404).json({ error: 'Parking not found.' });
    }

    if (existing.operator_id !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized to delete this parking.' });
    }

    await run('DELETE FROM parkings WHERE id = ?', [id]);
    return res.json({ message: 'Parking deleted successfully.' });
  } catch (err) {
    console.error('Delete parking error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
