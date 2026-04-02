import pool from "../db.js";

export const ensureSchema = async () => {
  console.log("🛠  Checking database schema consistency...");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1. users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        fullname VARCHAR(100),
        name VARCHAR(100),
        email VARCHAR(100) UNIQUE,
        phone VARCHAR(20),
        mobile VARCHAR(15),
        role VARCHAR(50) DEFAULT 'employee',
        totp_secret VARCHAR(255),
        totp_secret_temp VARCHAR(255),
        profile_pic TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // 2. employees table
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
        status VARCHAR(20) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // 3. leaves table
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

    // 4. attendance table — uses attendance_date to match routes
    await client.query(`
      CREATE TABLE IF NOT EXISTS attendance (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        employee_uav_id VARCHAR(50),
        attendance_date DATE NOT NULL,
        status VARCHAR(20) DEFAULT 'Present',
        check_in TIME,
        check_out TIME,
        hours_worked VARCHAR(20),
        marked_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, attendance_date)
      )
    `);

    // 5. tasks table
    await client.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        assigned_to INTEGER REFERENCES users(id),
        assigned_by INTEGER REFERENCES users(id),
        reviewed_by INTEGER REFERENCES users(id),
        depends_on INTEGER REFERENCES users(id),
        man_hours VARCHAR(50),
        start_date DATE,
        due_date DATE,
        end_date DATE,
        status VARCHAR(50) DEFAULT 'Pending',
        days_taken VARCHAR(50),
        link TEXT,
        assignment_date DATE DEFAULT CURRENT_DATE,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // 6. activity_logs table
    await client.query(`
      CREATE TABLE IF NOT EXISTS activity_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        action TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Patch missing columns safely
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS mobile VARCHAR(15)`);
    await client.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active'`);
    await client.query(`ALTER TABLE attendance ADD COLUMN IF NOT EXISTS hours_worked VARCHAR(20)`);
    await client.query(`ALTER TABLE attendance ADD COLUMN IF NOT EXISTS marked_by INTEGER REFERENCES users(id)`);
    await client.query(`ALTER TABLE leaves ADD COLUMN IF NOT EXISTS applied_at TIMESTAMP DEFAULT NOW()`);
    await client.query(`ALTER TABLE leaves ADD COLUMN IF NOT EXISTS employee_uav_id VARCHAR(50)`);
    await client.query(`ALTER TABLE leaves ADD COLUMN IF NOT EXISTS name VARCHAR(100)`);



    // dpr_entries table
    await client.query(`
      CREATE TABLE IF NOT EXISTS dpr_entries (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        dpr_date DATE NOT NULL,
        project VARCHAR(100),
        project_code VARCHAR(50),
        location VARCHAR(100) DEFAULT 'Office',
        clock_in TIME,
        clock_out TIME,
        requirement TEXT DEFAULT 'N/A',
        remarks TEXT DEFAULT 'N/A',
        updated_at TIMESTAMP DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, dpr_date)
      )
    `);

    // dpr_tasks table
    await client.query(`
      CREATE TABLE IF NOT EXISTS dpr_tasks (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        dpr_date DATE NOT NULL,
        start_time TIME,
        end_time TIME,
        task_code VARCHAR(50),
        summary TEXT,
        equipment TEXT,
        personnel TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query("COMMIT");
    console.log("✅ Database schema is healthy and up-to-date.");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Critical: Database schema Repair failed:", {
      message: err.message,
      detail: err.detail,
      table: err.table,
      constraint: err.constraint
    });
  } finally {
    client.release();
  }
};