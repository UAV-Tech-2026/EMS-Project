import 'dotenv/config';
import bcrypt from 'bcryptjs';
import pkg from 'pg';

const { Pool } = pkg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const run = async () => {
  try {
    // Add mobile column if it doesn't exist yet
    await pool.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS mobile VARCHAR(15)
    `);

    // Check if superadmin already exists
    const { rows } = await pool.query(
      "SELECT id FROM users WHERE role = 'super_admin' LIMIT 1"
    );

    if (rows.length > 0) {
      console.log('✅ Superadmin already exists, skipping seed.');
      return;
    }

    const hash = await bcrypt.hash(
      process.env.SUPERADMIN_PASSWORD || 'changeme123',
      10
    );

    await pool.query(
      `INSERT INTO users (username, fullname, name, password, role, mobile)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        'superadmin',
        'Super Admin',
        'Super Admin',
        hash,
        'super_admin',
        process.env.SUPERADMIN_MOBILE,
      ]
    );

    console.log('✅ Superadmin created! Mobile:', process.env.SUPERADMIN_MOBILE);
    console.log('📱 On first login, scan the QR code with Google Authenticator.');
  } catch (err) {
    console.error('❌ Seed failed:', err.message);
  } finally {
    await pool.end();
  }
};

export {run};