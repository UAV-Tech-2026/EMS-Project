import 'dotenv/config';
import bcrypt from 'bcryptjs';
import pkg from 'pg';
const { Pool } = pkg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const mode = process.argv[2] || 'all-2fa';
  const param1 = process.argv[3];
  const param2 = process.argv[4];

  try {
    if (mode === 'clear-all-2fa') {
      // Clear 2FA for ALL users in database
      await pool.query("UPDATE users SET totp_secret = NULL, totp_secret_temp = NULL");
      console.log("✅ Successfully cleared 2FA for ALL users in the database!");
      console.log("👉 Now any user logging in with their password will see a fresh 2FA setup QR code.");
    } 
    else if (mode === 'set-all-passwords') {
      // Set all user passwords in test database to a single password (default: 123456)
      const pass = param1 || '123456';
      const hash = await bcrypt.hash(pass, 10);
      await pool.query("UPDATE users SET password = $1, totp_secret = NULL, totp_secret_temp = NULL", [hash]);
      console.log(`✅ Successfully updated ALL user passwords in test DB to: "${pass}"!`);
      console.log("✅ Cleared 2FA for ALL users so everyone can log in smoothly.");
    } 
    else {
      // Reset specific user by employee_uav_id or username
      const targetId = mode;
      const newPassword = param1 || 'Admin@1234';

      const hash = await bcrypt.hash(newPassword, 10);
      const empRes = await pool.query(
        "SELECT user_id, employee_uav_id FROM employees WHERE employee_uav_id = $1",
        [targetId.toUpperCase()]
      );

      let userId;
      if (empRes.rows.length > 0) {
        userId = empRes.rows[0].user_id;
      } else {
        const uRes = await pool.query("SELECT id FROM users WHERE username = $1", [targetId]);
        if (uRes.rows.length > 0) userId = uRes.rows[0].id;
      }

      if (!userId) {
        console.error(`❌ User with ID "${targetId}" not found in database.`);
        process.exit(1);
      }

      await pool.query(
        "UPDATE users SET password = $1, totp_secret = NULL, totp_secret_temp = NULL WHERE id = $2",
        [hash, userId]
      );

      console.log(`\n✅ Password for user "${targetId}" reset to: "${newPassword}"`);
      console.log(`✅ 2FA cleared for ${targetId}!`);
    }
  } catch (err) {
    console.error("❌ Error:", err.message);
  } finally {
    await pool.end();
  }
}

main();
