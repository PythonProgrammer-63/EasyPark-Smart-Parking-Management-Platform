const express = require('express');
const fs = require('fs/promises');
const path = require('path');
const router = express.Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { query, queryOne, run, pool } = require('../database/db');
const { generateToken, authenticateToken } = require('../middleware/auth');

function getMailTransport() {
  const { SMTP_HOST, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    throw new Error('Password reset email is not configured. Set SMTP_HOST, SMTP_USER, and SMTP_PASS.');
  }

  const port = Number(process.env.SMTP_PORT || 587);
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: process.env.SMTP_SECURE === 'true' || port === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS }
  });
}

function hasValidPhoneNumber(phone) {
  return typeof phone === 'string' && phone.replace(/\D/g, '').length >= 10;
}

// Register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, phone, role, avatar_url } = req.body;

    if (
      typeof name !== 'string' || !name.trim() ||
      typeof email !== 'string' || !email.trim() ||
      typeof password !== 'string' || !password ||
      typeof phone !== 'string' || !phone.trim() ||
      !role
    ) {
      return res.status(400).json({ error: 'Name, email, phone number, password, and role are required.' });
    }

    if (!hasValidPhoneNumber(phone)) {
      return res.status(400).json({ error: 'Phone number must contain at least 10 digits.' });
    }

    if (!['driver', 'operator'].includes(role)) {
      return res.status(400).json({ error: 'Role must be either "driver" or "operator".' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const normalizedPhone = phone.replace(/\D/g, '');
    const existingEmail = await queryOne('SELECT id FROM users WHERE email = ?', [normalizedEmail]);
    if (existingEmail) {
      return res.status(400).json({ error: 'An account with this email already exists.' });
    }
    const existingPhone = await queryOne(
      'SELECT id FROM users WHERE phone_normalized = ?',
      [normalizedPhone]
    );
    if (existingPhone) {
      return res.status(400).json({ error: 'An account with this phone number already exists.' });
    }

    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(password, salt);

    const defaultAvatar = role === 'operator'
      ? 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=200&q=80'
      : 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80';

    const insertResult = await run(`
      INSERT INTO users (name, email, password_hash, phone, role, avatar_url)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      name.trim(),
      normalizedEmail,
      passwordHash,
      phone.trim(),
      role,
      avatar_url || defaultAvatar
    ]);

    const newUser = await queryOne('SELECT id, name, email, phone, role, avatar_url, created_at FROM users WHERE id = ?', [insertResult.lastInsertRowid]);
    
    // Create welcome notification
    await run(`
      INSERT INTO notifications (user_id, title, message, type)
      VALUES (?, ?, ?, ?)
    `, [
      newUser.id,
      'Welcome to EasyPark!',
      role === 'operator'
        ? 'You can now add and manage your parking facilities.'
        : 'Explore nearby parking spots, real-time availability, and get live navigation.',
      'welcome'
    ]);

    const token = generateToken(newUser);
    return res.status(201).json({
      message: 'Account created successfully',
      token,
      user: newUser
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      if (err.message.includes('email')) {
        return res.status(400).json({ error: 'An account with this email already exists.' });
      }
      if (err.message.includes('uq_users_phone_normalized')) {
        return res.status(400).json({ error: 'An account with this phone number already exists.' });
      }
      if (err.message.includes('PRIMARY')) {
        return res.status(409).json({ error: 'The account ID already exists. Please try again.' });
      }
    }
    console.error('Register error:', err);
    return res.status(500).json({ error: 'Internal server error during registration.' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, username, password } = req.body;
    const identifier = (username || email || '').trim();
    if (!identifier || !password) {
      return res.status(400).json({ error: 'Username or email and password are required.' });
    }

    const user = await queryOne(
      'SELECT * FROM users WHERE email = ? OR username = ?',
      [identifier.toLowerCase(), identifier]
    );
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const isMatch = bcrypt.compareSync(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const safeUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      avatar_url: user.avatar_url,
      created_at: user.created_at
    };

    const token = generateToken(safeUser);
    return res.json({
      message: 'Login successful',
      token,
      user: safeUser
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Internal server error during login.' });
  }
});

// Get Current User Profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const user = await queryOne('SELECT id, name, email, phone, role, avatar_url, created_at FROM users WHERE id = ?', [req.user.id]);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }
    return res.json({ user });
  } catch (err) {
    console.error('Get profile error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// Update Profile
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const { name, phone } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Name is required.' });
    }

    if (!hasValidPhoneNumber(phone)) {
      return res.status(400).json({ error: 'Phone number must contain at least 10 digits.' });
    }

    await run(`
      UPDATE users SET name = ?, phone = ? WHERE id = ?
    `, [name.trim(), phone || '', req.user.id]);

    const updatedUser = await queryOne('SELECT id, name, email, phone, role, avatar_url, created_at FROM users WHERE id = ?', [req.user.id]);
    return res.json({ message: 'Profile updated successfully', user: updatedUser });
  } catch (err) {
    console.error('Update profile error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

router.post('/profile/photo', authenticateToken, async (req, res) => {
  let savedPhotoPath;
  let photoSaved = false;
  try {
    const image = typeof req.body.image === 'string' ? req.body.image : '';
    const match = image.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/);
    if (!match) {
      return res.status(400).json({ error: 'Choose a JPEG, PNG, or WebP image.' });
    }

    const [, contentType, encodedImage] = match;
    const imageBuffer = Buffer.from(encodedImage, 'base64');
    if (imageBuffer.length === 0 || imageBuffer.length > 10 * 1024 * 1024) {
      return res.status(413).json({ error: 'Profile photos must be 10 MB or smaller.' });
    }

    const hasValidSignature = contentType === 'image/jpeg'
      ? imageBuffer[0] === 0xff && imageBuffer[1] === 0xd8 && imageBuffer[2] === 0xff
      : contentType === 'image/png'
        ? imageBuffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
        : imageBuffer.toString('ascii', 0, 4) === 'RIFF'
          && imageBuffer.toString('ascii', 8, 12) === 'WEBP';
    if (!hasValidSignature) {
      return res.status(400).json({ error: 'The selected file is not a valid image.' });
    }

    const extension = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[contentType];
    const uploadDirectory = path.join(__dirname, '../uploads/profile-photos');
    const filename = `${crypto.randomUUID()}.${extension}`;
    savedPhotoPath = path.join(uploadDirectory, filename);
    await fs.mkdir(uploadDirectory, { recursive: true });
    await fs.writeFile(savedPhotoPath, imageBuffer, { flag: 'wx' });

    const photoUrl = `/uploads/profile-photos/${filename}`;
    const previousUser = await queryOne('SELECT avatar_url FROM users WHERE id = ?', [req.user.id]);
    const updateResult = await run('UPDATE users SET avatar_url = ? WHERE id = ?', [photoUrl, req.user.id]);
    if (updateResult.changes === 0) {
      throw new Error('Profile photo could not be saved for this account.');
    }
    photoSaved = true;

    const user = await queryOne('SELECT id, name, email, phone, role, avatar_url, created_at FROM users WHERE id = ?', [req.user.id]);

    if (previousUser?.avatar_url?.startsWith('/uploads/profile-photos/')) {
      const previousFilename = path.basename(previousUser.avatar_url);
      if (previousFilename !== filename) {
        fs.unlink(path.join(uploadDirectory, previousFilename)).catch((error) => {
          if (error.code !== 'ENOENT') console.error('Unable to remove old profile photo:', error);
        });
      }
    }

    return res.json({ message: 'Profile photo updated successfully.', user });
  } catch (err) {
    if (savedPhotoPath && !photoSaved) {
      await fs.unlink(savedPhotoPath).catch((cleanupError) => {
        if (cleanupError.code !== 'ENOENT') console.error('Unable to remove failed profile photo upload:', cleanupError);
      });
    }
    console.error('Update profile photo error:', err);
    return res.status(500).json({ error: 'Unable to update your profile photo.' });
  }
});

// Change Password
router.post('/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required.' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters.' });
    }

    const user = await queryOne('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
    if (!user || !bcrypt.compareSync(currentPassword, user.password_hash)) {
      return res.status(400).json({ error: 'Incorrect current password.' });
    }

    const salt = bcrypt.genSaltSync(10);
    const newHash = bcrypt.hashSync(newPassword, salt);
    await run('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, req.user.id]);

    return res.json({ message: 'Password changed successfully.' });
  } catch (err) {
    console.error('Change password error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// Forgot Password
router.post('/forgot-password', async (req, res) => {
  try {
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    if (!email) return res.status(400).json({ error: 'Email is required.' });

    const transport = getMailTransport();
    const user = await queryOne('SELECT id, name, email FROM users WHERE email = ?', [email]);
    if (user) {
      const token = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const appBaseUrl = (process.env.APP_BASE_URL || 'http://localhost:5000').replace(/\/+$/, '');
      const resetUrl = `${appBaseUrl}/#reset_token=${encodeURIComponent(token)}`;

      await run(
        'DELETE FROM password_reset_tokens WHERE user_id = ? AND expires_at <= NOW()',
        [user.id]
      );
      await run(
        'INSERT INTO password_reset_tokens (token_hash, user_id, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 1 HOUR))',
        [tokenHash, user.id]
      );

      try {
        const from = process.env.SMTP_FROM || process.env.SMTP_USER;
        await transport.sendMail({
          from,
          to: user.email,
          subject: 'Reset your EasyPark password',
          text: `Hi ${user.name},\n\nUse this link to reset your EasyPark password. It expires in 1 hour:\n${resetUrl}\n\nIf you did not request this, you can ignore this email.`,
          html: `<p>Hi ${user.name.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char])},</p><p>Use the link below to reset your EasyPark password. It expires in 1 hour.</p><p><a href="${resetUrl}">Reset password</a></p><p>If you did not request this, you can ignore this email.</p>`
        });
      } catch (mailError) {
        await run('DELETE FROM password_reset_tokens WHERE token_hash = ?', [tokenHash]);
        throw mailError;
      }
    }

    return res.json({
      message: 'If this email is registered, a password reset link has been sent.'
    });
  } catch (err) {
    console.error('Forgot password error:', err);
    return res.status(500).json({ error: 'Unable to send a password reset email. Please try again later.' });
  }
});

// Reset password using a single-use, expiring token delivered by email.
router.post('/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;
  if (typeof token !== 'string' || !token || typeof newPassword !== 'string' || !newPassword) {
    return res.status(400).json({ error: 'Reset token and new password are required.' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters.' });
  }

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [tokens] = await connection.query(
      'SELECT user_id FROM password_reset_tokens WHERE token_hash = ? AND expires_at > NOW() FOR UPDATE',
      [tokenHash]
    );
    if (tokens.length === 0) {
      await connection.rollback();
      return res.status(400).json({ error: 'This password reset link is invalid or expired. Request a new one.' });
    }

    const passwordHash = bcrypt.hashSync(newPassword, 10);
    await connection.query('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, tokens[0].user_id]);
    await connection.query('DELETE FROM password_reset_tokens WHERE user_id = ?', [tokens[0].user_id]);
    await connection.commit();
    return res.json({ message: 'Password reset successfully. You can now sign in.' });
  } catch (err) {
    if (connection) await connection.rollback();
    console.error('Reset password error:', err);
    return res.status(500).json({ error: 'Unable to reset password. Please try again.' });
  } finally {
    if (connection) connection.release();
  }
});

module.exports = router;
