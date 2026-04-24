import pool from './db.js';

async function addDepartmentColumn() {
  try {
    console.log("Adding department column to users table...");
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS department VARCHAR(255);");
    console.log("Successfully added to users.");

    console.log("Adding department column to employees table...");
    await pool.query("ALTER TABLE employees ADD COLUMN IF NOT EXISTS department VARCHAR(255);");
    console.log("Successfully added to employees.");
    
    process.exit(0);
  } catch (error) {
    console.error("Error adding department column:", error);
    process.exit(1);
  }
}

addDepartmentColumn();
