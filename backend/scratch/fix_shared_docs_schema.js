const pkg = require("pg");
const { Pool } = pkg;
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.join(__dirname, "../.env") });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function fixSchema() {
  const client = await pool.connect();
  try {
    console.log("Checking shared_documents table...");
    
    
    const checkRes = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='shared_documents' AND column_name='target_user_id'
    `);

    if (checkRes.rows.length === 0) {
      console.log("Column 'target_user_id' is missing. Adding it now...");
      await client.query(`
        ALTER TABLE shared_documents 
        ADD COLUMN target_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL
      `);
      console.log("✓ Column 'target_user_id' added successfully.");
    } else {
      console.log("✓ Column 'target_user_id' already exists.");
    }

  } catch (err) {
    console.error("Error fixing schema:", err.message);
  } finally {
    client.release();
    pool.end();
  }
}

fixSchema();
