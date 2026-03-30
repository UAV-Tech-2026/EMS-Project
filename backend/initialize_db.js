import pool from "./db.js";
import bcrypt from "bcryptjs";

async function initialize() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1. USERS
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

    // 2. EMPLOYEES
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

    // 3. LEAVES
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

    // 4. ATTENDANCE
    await client.query(`
      CREATE TABLE IF NOT EXISTS attendance (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        employee_uav_id VARCHAR(50),
        attendance_date DATE,
        check_in TIME,
        check_out TIME,
        status VARCHAR(20),
        marked_by INTEGER REFERENCES users(id),
        hours_worked VARCHAR(50),
        UNIQUE (user_id, attendance_date)
      )
    `);

    // 5. TASKS
    await client.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255),
        assigned_to INTEGER REFERENCES users(id),
        assigned_by INTEGER REFERENCES users(id),
        reviewed_by INTEGER REFERENCES users(id),
        man_hours VARCHAR(50),
        start_date DATE,
        due_date DATE,
        end_date DATE,
        status VARCHAR(50) DEFAULT 'Pending',
        days_taken INTEGER,
        depends_on INTEGER REFERENCES users(id),
        link TEXT,
        assignment_date DATE DEFAULT CURRENT_DATE
      )
    `);

    // 6. DPR ENTRIES
    await client.query(`
      CREATE TABLE IF NOT EXISTS dpr_entries (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        dpr_date DATE,
        project VARCHAR(255),
        project_code VARCHAR(100),
        location VARCHAR(100) DEFAULT 'Office',
        clock_in TIME,
        clock_out TIME,
        requirement TEXT,
        remarks TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE (user_id, dpr_date)
      )
    `);

    // 7. DPR TASKS
    await client.query(`
      CREATE TABLE IF NOT EXISTS dpr_tasks (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        dpr_date DATE,
        start_time TIME,
        end_time TIME,
        task_code VARCHAR(100),
        summary TEXT,
        equipment VARCHAR(255),
        personnel VARCHAR(255)
      )
    `);

    // 8. PAYSLIP REQUESTS
    await client.query(`
      CREATE TABLE IF NOT EXISTS payslip_requests (
        id SERIAL PRIMARY KEY,
        requested_by INTEGER REFERENCES users(id),
        employee_id INTEGER REFERENCES users(id),
        month VARCHAR(20),
        status VARCHAR(20) DEFAULT 'pending',
        payslip_url TEXT,
        rejection_reason TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        reviewed_at TIMESTAMP,
        reviewed_by INTEGER REFERENCES users(id)
      )
    `);

    // SEED SUPERADMIN if not exists
    const adminCheck = await client.query("SELECT * FROM users WHERE role = 'super_admin'");
    if (adminCheck.rows.length === 0) {
      const hash = await bcrypt.hash("super123", 10);
      await client.query(`
        INSERT INTO users (username, password, fullname, name, email, role)
        VALUES ('superadmin', $1, 'Super Administrator', 'Super Administrator', 'admin@uavtech.com', 'super_admin')
      `, [hash]);
      console.log("✓ Super Admin seeded: superadmin / super123");
    }

    await client.query("COMMIT");
    console.log("✓ Database initialized successfully with all required tables.");

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Initialization failed:", err.message);
  } finally {
    client.release();
    process.exit(0);
  }
}

initialize();
