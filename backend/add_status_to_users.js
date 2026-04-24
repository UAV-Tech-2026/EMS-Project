import pool from "./db.js";

async function addStatusColumn() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    
    
    const checkRes = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='users' AND column_name='status'
    `);
    
    if (checkRes.rows.length === 0) {
      await client.query("ALTER TABLE users ADD COLUMN status VARCHAR(20) DEFAULT 'Active'");
      console.log("✓ Added 'status' column to 'users' table.");
    } else {
      console.log("! 'status' column already exists in 'users' table.");
    }
    
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Failed to add column:", err.message);
  } finally {
    client.release();
    process.exit(0);
  }
}

addStatusColumn();
