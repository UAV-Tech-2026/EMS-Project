import pool from './db.js';
try {
  const r1 = await pool.query("SELECT COUNT(*) as total FROM attendance");
  console.log("TOTAL ATTENDANCE ROWS:", r1.rows[0].total);

  const r2 = await pool.query("SELECT user_id, attendance_date::text, status FROM attendance ORDER BY attendance_date DESC LIMIT 20");
  console.log("LAST 20 RECORDS:");
  r2.rows.forEach(r => console.log(JSON.stringify(r)));

  const r3 = await pool.query("SELECT id, fullname, role FROM users LIMIT 15");
  console.log("USERS:");
  r3.rows.forEach(u => console.log(JSON.stringify(u)));
} catch(e) {
  console.error("ERROR:", e.message);
}
process.exit(0);
