import pool from "./db.js";

async function run() {
  console.log("Checking 'leaves' table...");
  try {
   
    await pool.query(`
      CREATE TABLE IF NOT EXISTS leaves (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        employee_uav_id VARCHAR(50),
        name VARCHAR(100),
        leave_type VARCHAR(20),
        from_date DATE,
        to_date DATE,
        total_days INTEGER,
        reason TEXT,
        status VARCHAR(20) DEFAULT 'pending',
        approved_by INTEGER REFERENCES users(id),
        approved_at TIMESTAMP,
        applied_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log("✓ 'leaves' table is present.");

    
    const colCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'leaves' AND column_name = 'applied_at'
    `);

    if (colCheck.rows.length === 0) {
      console.log("Adding missing 'applied_at' column...");
      await pool.query("ALTER TABLE leaves ADD COLUMN applied_at TIMESTAMP DEFAULT NOW()");
      console.log("✓ Column 'applied_at' added.");
    }

    console.log("Database patch completed successfully.");
  } catch (err) {
    console.error("Column verification failed:", err.message);
  } finally {
    process.exit(0);
  }
}

run();
