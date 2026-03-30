import pool from "./db.js";

async function checkColumns() {
  try {
    const res = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users'
    `);
    console.log("Users Columns:", res.rows.map(r => r.column_name));

    const res2 = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'leaves'
    `);
    console.log("Leaves Columns:", res2.rows.map(r => r.column_name));
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}

checkColumns();
