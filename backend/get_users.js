import pool from "./db.js";

async function getUsers() {
  try {
    const { rows } = await pool.query("SELECT username, role, totp_secret FROM users LIMIT 10");
    console.log(JSON.stringify(rows, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}

getUsers();
