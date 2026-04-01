import pool from "../db.js";

export const ensureSchema = async () => {
  console.log("🛠  Checking database schema consistency...");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1. Ensure 'users' table exists (needed for foreign keys)
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        fullname VARCHAR(100),
        name VARCHAR(100),
        email VARCHAR(100) UNIQUE,
        phone VARCHAR(20),
        role VARCHAR(50) DEFAULT 'employee',
        totp_secret VARCHAR(255),
        totp_secret_temp VARCHAR(255),
        profile_pic TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // 2. Ensure 'employees' table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS employees (
        id SERIAL PRIMARY KEY,
        employee_uav_id VARCHAR(50) UNIQUE NOT NULL,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        fullname VARCHAR(100),
        designation VARCHAR(100),
        phone VARCHAR(20),
        adhar_path TEXT,
        address_path TEXT,
        basic_salary NUMERIC DEFAULT 0,
        hra NUMERIC DEFAULT 0,
        epf_amount NUMERIC DEFAULT 0,
        pt_amount NUMERIC DEFAULT 0,
        total_cl INTEGER DEFAULT 12,
        total_sl INTEGER DEFAULT 12,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // 3. Ensure 'leaves' table exists
    await client.query(`
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
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS mobile VARCHAR(15)`);

    // 4. Patch missing columns in 'leaves' table
    const columns = [
      { name: "applied_at",      type: "TIMESTAMP DEFAULT NOW()" },
      { name: "employee_uav_id", type: "VARCHAR(50)" },
      { name: "name",            type: "VARCHAR(100)" },
    ];

    for (const col of columns) {
      const colCheck = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'leaves' 
          AND column_name = '${col.name}' 
          AND table_schema = 'public'
      `);
      if (colCheck.rows.length === 0) {
        console.log(`   ➔ Repairing schema: Adding missing column '${col.name}' to 'leaves' table.`);
        await client.query(`ALTER TABLE leaves ADD COLUMN ${col.name} ${col.type}`);
      }
    }

    await client.query("COMMIT");
    console.log("✅ Database schema is healthy and up-to-date.");
  } catch (err) {
    if (client) await client.query("ROLLBACK");
    console.error("❌ Critical: Database schema Repair failed:", {
      message: err.message,
      detail:  err.detail,
      table:   err.table,
      constraint: err.constraint
    });
  } finally {
    client.release();
  }
};
