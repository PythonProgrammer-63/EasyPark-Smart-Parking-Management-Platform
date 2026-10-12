const bcrypt = require('bcryptjs');
const { initDb, run, pool } = require('./db');

async function provisionAdminDemo() {
  await initDb();

  // Kept server-side so neither the hash nor the credential is bundled into
  // the client. This account is intended for local/demo environments only.
  const passwordHash = bcrypt.hashSync('Demo123', 10);
  await run(`
    INSERT INTO users (name, username, email, password_hash, phone, role, avatar_url)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      name = VALUES(name),
      email = VALUES(email),
      password_hash = VALUES(password_hash),
      phone = VALUES(phone),
      role = VALUES(role),
      avatar_url = VALUES(avatar_url)
  `, [
    'EasyPark Administrator',
    'demoacc',
    'demoacc@easypark.local',
    passwordHash,
    '',
    'admin',
    null
  ]);

  console.log('Admin demo account provisioned.');
}

provisionAdminDemo()
  .catch((error) => {
    console.error('Unable to provision admin demo account:', error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
