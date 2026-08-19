/**
 * debug_uava001.js
 * Diagnoses why a specific user is missing from the directory.
 * Run: node debug_uava001.js
 */
import 'dotenv/config';
import pkg from 'pg';
const { Pool } = pkg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  try {
    console.log("\n=== 1. Search in employees table by ID ===");
    const e1 = await pool.query(
      `SELECT * FROM employees WHERE employee_uav_id ILIKE '%UAVA001%' OR employee_uav_id ILIKE '%001%'`
    );
    console.log("employees rows:", e1.rows);

    console.log("\n=== 2. All users with role=admin ===");
    const u1 = await pool.query(
      `SELECT u.id, u.fullname, u.role, u.department, u.username, e.employee_uav_id, e.status
       FROM users u
       LEFT JOIN employees e ON u.id = e.user_id
       WHERE u.role = 'admin'`
    );
    console.log("admin users:", u1.rows);

    console.log("\n=== 3. All users (no filter) ===");
    const u2 = await pool.query(
      `SELECT u.id, u.fullname, u.role, u.department, e.employee_uav_id, e.status
       FROM users u
       LEFT JOIN employees e ON u.id = e.user_id
       ORDER BY u.id`
    );
    console.log("all users:", u2.rows);

    console.log("\n=== 4. INNER JOIN check (old query — missing users will disappear here) ===");
    const u3 = await pool.query(
      `SELECT u.id, u.fullname, u.role, e.employee_uav_id
       FROM users u
       JOIN employees e ON u.id = e.user_id
       WHERE u.role IN ('employee','intern','admin')`
    );
    console.log("INNER JOIN result:", u3.rows);

    console.log("\n=== 5. LEFT JOIN check (new fixed query) ===");
    const u4 = await pool.query(
      `SELECT u.id, u.fullname, u.role, COALESCE(e.employee_uav_id,'') AS employee_uav_id
       FROM users u
       LEFT JOIN employees e ON u.id = e.user_id
       WHERE u.role IN ('employee','intern','admin')`
    );
    console.log("LEFT JOIN result:", u4.rows);

  } catch (err) {
    console.error("Error:", err.message);
  } finally {
    await pool.end();
  }
}

run();
