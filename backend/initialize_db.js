import pool from "./db.js";
import bcrypt from "bcryptjs";

async function initialize() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    
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

    
    await client.query(`
      CREATE TABLE IF NOT EXISTS employees (
        id SERIAL PRIMARY KEY,
        employee_uav_id VARCHAR(50) UNIQUE NOT NULL,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        fullname VARCHAR(100),
        designation VARCHAR(100),
        department VARCHAR(100),
        phone VARCHAR(20),
        adhar_path TEXT,
        address_path TEXT,
        account_number VARCHAR(20),
        pan_number VARCHAR(10),
        basic_salary NUMERIC DEFAULT 0,
        hra NUMERIC DEFAULT 0,
        epf_amount NUMERIC DEFAULT 0,
        pt_amount NUMERIC DEFAULT 0,
        total_cl INTEGER DEFAULT 12,
        total_ml INTEGER DEFAULT 12,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    
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
        certificate_path TEXT,
        approved_by INTEGER REFERENCES users(id),
        approved_at TIMESTAMP,
        applied_at TIMESTAMP DEFAULT NOW()
      )
    `);

    
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
        ot_hours NUMERIC DEFAULT 0,
        UNIQUE (user_id, attendance_date)
      )
    `);

    
    await client.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255),
        assigned_to INTEGER REFERENCES users(id),
        assigned_by INTEGER REFERENCES users(id),
        reviewed_by INTEGER REFERENCES users(id),
        target_date VARCHAR(50),
        start_date DATE,
        due_date DATE,
        end_date DATE,
        status VARCHAR(50) DEFAULT 'Pending',
        days_taken INTEGER,
        depends_on INTEGER REFERENCES tasks(id),
        parent_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
        description TEXT,
        link TEXT,
        assignment_date DATE DEFAULT CURRENT_DATE
      )
    `);

   
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

   
    await client.query(`
      CREATE TABLE IF NOT EXISTS payroll_history (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        month VARCHAR(7), 
        from_date DATE,
        to_date DATE,
        basic NUMERIC DEFAULT 0,
        hra NUMERIC DEFAULT 0,
        gross NUMERIC DEFAULT 0,
        epf NUMERIC DEFAULT 0,
        pt NUMERIC DEFAULT 0,
        lop NUMERIC DEFAULT 0,
        ot_pay NUMERIC DEFAULT 0,
        net_salary NUMERIC DEFAULT 0,
        present_days NUMERIC DEFAULT 0,
        lop_days NUMERIC DEFAULT 0,
        status VARCHAR(20) DEFAULT 'approved',
        approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, month)
      )
    `);

    
    await client.query(`
      CREATE TABLE IF NOT EXISTS meetings (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        meeting_date DATE NOT NULL,
        start_time TIME NOT NULL,
        end_time TIME NOT NULL,
        meeting_link TEXT,
        status VARCHAR(20) DEFAULT 'Pending',
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        started_at TIMESTAMP,
        minutes_of_meeting TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_permissions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        feature_name VARCHAR(100) NOT NULL,
        can_read BOOLEAN DEFAULT FALSE,
        can_write BOOLEAN DEFAULT FALSE,
        UNIQUE (user_id, feature_name)
      )
    `);

    
    await client.query(`
      CREATE TABLE IF NOT EXISTS bulletins (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) DEFAULT 'Bulletin',
        content TEXT NOT NULL,
        author_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    
    await client.query(`
      CREATE TABLE IF NOT EXISTS shared_documents (
        id SERIAL PRIMARY KEY,
        shared_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        document_name VARCHAR(255),
        file_name VARCHAR(255),
        file_path TEXT,
        file_size BIGINT DEFAULT 0,
        file_type VARCHAR(100),
        target_role VARCHAR(50) DEFAULT 'admin',
        target_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        message TEXT DEFAULT '',
        shared_at TIMESTAMP DEFAULT NOW()
      )
    `);

    
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