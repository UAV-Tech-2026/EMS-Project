/**
 * update_to_utpla001.js
 * Updates the BMD admin to have ID 'UTPLA001' and role 'admin' in the database.
 * Run on server: node update_to_utpla001.js
 */
import 'dotenv/config';
import pkg from 'pg';
const { Pool } = pkg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function fixUser() {
  const client = await pool.connect();
  try {
    console.log("Connecting to database...");

    // Check users in BMD department or with CEO/Promoter designation
    const check = await client.query(`
      SELECT u.id, u.fullname, u.role, u.department, e.employee_uav_id, e.designation
      FROM users u
      LEFT JOIN employees e ON u.id = e.user_id
      WHERE u.department ILIKE '%BMD%' OR u.department ILIKE '%Business Management%'
      ORDER BY u.id
    `);

    console.log("\nCurrent BMD Users in DB:", check.rows);

    if (check.rows.length === 0) {
      console.log("No BMD users found. Please enroll the user first via Control Panel -> Enroll.");
      return;
    }

    // Identify the target user:
    // If Moukthik Kiran Reddy (CEO) exists, promote to UTPLA001
    // Otherwise promote the first BMD user
    let target = check.rows.find(r => r.fullname.toLowerCase().includes("moukthik")) || check.rows[0];

    console.log(`\nPromoting [${target.fullname}] (User ID: ${target.id}) to Admin with ID UTPLA001...`);

    await client.query("BEGIN");

    // 1. Update role in users table
    await client.query(
      "UPDATE users SET role = 'admin' WHERE id = $1",
      [target.id]
    );

    // 2. Update employee_uav_id in employees table
    await client.query(
      "UPDATE employees SET employee_uav_id = 'UTPLA001' WHERE user_id = $1",
      [target.id]
    );

    await client.query("COMMIT");

    console.log("✅ Successfully updated in database!");

    // Verify
    const verify = await client.query(`
      SELECT u.id, u.fullname, u.role, u.department, e.employee_uav_id, e.designation
      FROM users u
      LEFT JOIN employees e ON u.id = e.user_id
      WHERE u.id = $1
    `, [target.id]);

    console.log("\nVerified User Record:", verify.rows[0]);

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Error updating database:", err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

fixUser();
