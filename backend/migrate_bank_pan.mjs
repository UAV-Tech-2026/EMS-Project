import pool from "./db.js";

async function migrate() {
  try {
    await pool.query(`
      ALTER TABLE employees
        ADD COLUMN IF NOT EXISTS account_number VARCHAR(20),
        ADD COLUMN IF NOT EXISTS pan_number     VARCHAR(10)
    `);
    console.log("✓ Migration complete: account_number and pan_number added to employees");
  } catch (err) {
    console.error("✗ Migration failed:", err.message);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

migrate();
