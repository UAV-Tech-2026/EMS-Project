import pool from "./db.js";

async function checkRoles() {
  try {
    const res = await pool.query("SELECT DISTINCT role FROM users");
    console.log("ROLES IN DB:");
    console.table(res.rows);
    const users = await pool.query("SELECT fullname, role FROM users WHERE role LIKE '%admin%'");
    console.log("ADMIN USERS:");
    console.table(users.rows);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
checkRoles();
