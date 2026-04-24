import pool from "./db.js";

async function checkSchema() {
  try {
    const res = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'tasks'
    `);
    console.log("TASKS SCHEMA:");
    console.table(res.rows);
    process.exit(0);
  } catch (err) {
    console.error("SCHEMA CHECK ERROR:", err);
    process.exit(1);
  }
}

checkSchema();
