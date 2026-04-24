import pool from "./db.js";

async function clearProfilePics() {
  try {
    const res = await pool.query("UPDATE users SET profile_pic = NULL WHERE role != 'super_admin'");
    console.log(`✅ Cleared ${res.rowCount} profile picture entries.`);
    process.exit(0);
  } catch (err) {
    console.error("❌ Error clearing profile pictures:", err);
    process.exit(1);
  }
}

clearProfilePics();
