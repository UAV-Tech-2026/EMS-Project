import pool from "../db.js";
import bcrypt from "bcryptjs";

export const ensureSchema = async () => {
  console.log("🛠 Checking database schema consistency...");
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
        mobile VARCHAR(15),
        role VARCHAR(50) DEFAULT 'employee',
        totp_secret VARCHAR(255),
        totp_secret_temp VARCHAR(255),
        profile_pic TEXT,
        department VARCHAR(100),
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
        status VARCHAR(20) DEFAULT 'active',
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
        attendance_date DATE NOT NULL,
        status VARCHAR(20) DEFAULT 'Present',
        check_in TIME,
        check_out TIME,
        hours_worked VARCHAR(20),
        ot_hours NUMERIC DEFAULT 0,
        marked_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, attendance_date)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        assigned_to INTEGER REFERENCES users(id),
        assigned_by INTEGER REFERENCES users(id),
        reviewed_by INTEGER REFERENCES users(id),
        depends_on INTEGER REFERENCES tasks(id),
        parent_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
        target_date VARCHAR(50),
        start_date DATE,
        due_date DATE,
        end_date DATE,
        description TEXT,
        status VARCHAR(50) DEFAULT 'Pending',
        days_taken VARCHAR(50),
        link TEXT,
        assignment_date DATE DEFAULT CURRENT_DATE,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS activity_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        action TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS general_requests (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(100),
        description TEXT,
        target_role VARCHAR(50),
        target_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        format VARCHAR(50),
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT NOW()
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

    await client.query(`
      CREATE TABLE IF NOT EXISTS documents (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        document_name VARCHAR(255),
        file_name VARCHAR(255),
        file_path TEXT,
        file_size INTEGER,
        file_type VARCHAR(50),
        uploaded_at TIMESTAMP DEFAULT NOW()
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
        shared_by INTEGER REFERENCES users(id) ON DELETE CASCADE,
        document_name VARCHAR(255),
        file_name VARCHAR(255),
        file_path TEXT,
        file_size INTEGER DEFAULT 0,
        file_type VARCHAR(50),
        target_role VARCHAR(50) DEFAULT 'admin',
        target_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        message TEXT DEFAULT '',
        shared_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        message TEXT NOT NULL,
        type VARCHAR(50) DEFAULT 'info',
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS payroll_history (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        month VARCHAR(7) NOT NULL, -- e.g. '2026-03'
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
        assigned_creator INTEGER REFERENCES users(id) ON DELETE SET NULL,
        started_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    

    const adminCheck = await client.query("SELECT * FROM users WHERE role = 'super_admin'");
    if (adminCheck.rows.length === 0) {
      const hash = await bcrypt.hash("super123", 10);
      await client.query(`
        INSERT INTO users (username, password, fullname, name, email, role, phone)
        VALUES ('superadmin', $1, 'Super Administrator', 'Super Administrator', 'superadmin@uavtech.ai', 'super_admin', '9876543210')
      `, [hash]);
      console.log("✓ Super Admin seeded: superadmin / super123");
    }

    
    await client.query(`
      UPDATE employees e
      SET employee_uav_id = 
        CASE 
          WHEN u.role IN ('employee', 'intern')
            THEN 'UAVE' || LPAD(regexp_replace(e.employee_uav_id, '[^0-9]', '', 'g'), 3, '0')
          WHEN u.role IN ('admin', 'admin_hr', 'hr_admin', 'production_admin')
            THEN 'UAVA' || LPAD(regexp_replace(e.employee_uav_id, '[^0-9]', '', 'g'), 3, '0')
          WHEN u.role = 'super_admin'
            THEN 'UAVS' || LPAD(regexp_replace(e.employee_uav_id, '[^0-9]', '', 'g'), 3, '0')
          ELSE e.employee_uav_id
        END
      FROM users u
      WHERE e.user_id = u.id
        AND (e.employee_uav_id ~ '^UAVTech' OR e.employee_uav_id ~ '^UAV[A-Z]')
    `);
    console.log("✓ Employee IDs verified and corrected");

   

    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS mobile VARCHAR(15)`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS department VARCHAR(100)`);
    await client.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active'`);
    await client.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS department VARCHAR(100)`);
    await client.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS account_number VARCHAR(20)`);
    await client.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS pan_number VARCHAR(10)`);
    await client.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS adhar_path TEXT`);
    await client.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS address_path TEXT`);
    await client.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS total_ml INTEGER DEFAULT 12`);
    
    await client.query(`ALTER TABLE attendance ADD COLUMN IF NOT EXISTS hours_worked VARCHAR(20)`);
    await client.query(`ALTER TABLE attendance ADD COLUMN IF NOT EXISTS marked_by INTEGER REFERENCES users(id)`);
    await client.query(`ALTER TABLE attendance ADD COLUMN IF NOT EXISTS ot_hours NUMERIC DEFAULT 0`);
    
    await client.query(`ALTER TABLE leaves ADD COLUMN IF NOT EXISTS applied_at TIMESTAMP DEFAULT NOW()`);
    await client.query(`ALTER TABLE leaves ADD COLUMN IF NOT EXISTS certificate_path TEXT`);
    await client.query(`ALTER TABLE leaves ADD COLUMN IF NOT EXISTS employee_uav_id VARCHAR(50)`);
    await client.query(`ALTER TABLE leaves ADD COLUMN IF NOT EXISTS name VARCHAR(100)`);

    await client.query(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS parent_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE`);
    await client.query(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS description TEXT`);
    await client.query(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS target_date VARCHAR(50)`);

    await client.query(`ALTER TABLE payroll_history ADD COLUMN IF NOT EXISTS from_date DATE`);
    await client.query(`ALTER TABLE payroll_history ADD COLUMN IF NOT EXISTS to_date DATE`);
    await client.query(`ALTER TABLE payroll_history ADD COLUMN IF NOT EXISTS basic NUMERIC DEFAULT 0`);
    await client.query(`ALTER TABLE payroll_history ADD COLUMN IF NOT EXISTS hra NUMERIC DEFAULT 0`);
    await client.query(`ALTER TABLE payroll_history ADD COLUMN IF NOT EXISTS ot_pay NUMERIC DEFAULT 0`);
    await client.query(`ALTER TABLE payroll_history ADD COLUMN IF NOT EXISTS present_days NUMERIC DEFAULT 0`);
    await client.query(`ALTER TABLE payroll_history ADD COLUMN IF NOT EXISTS lop_days NUMERIC DEFAULT 0`);
    await client.query(`ALTER TABLE payroll_history ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'approved'`);
    await client.query(`ALTER TABLE payroll_history ADD COLUMN IF NOT EXISTS approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL`);

    await client.query(`ALTER TABLE general_requests ADD COLUMN IF NOT EXISTS target_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL`);
    await client.query(`ALTER TABLE general_requests ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending'`);
    await client.query(`ALTER TABLE shared_documents ADD COLUMN IF NOT EXISTS target_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL`);
    await client.query(`ALTER TABLE meetings ADD COLUMN IF NOT EXISTS started_at TIMESTAMP`);
   await client.query(`ALTER TABLE general_requests ADD COLUMN IF NOT EXISTS request_type VARCHAR(50)`);
    await client.query(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS document_code VARCHAR(100)`);
    await client.query(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS output_format_type VARCHAR(200)`);
    await client.query(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS costing NUMERIC DEFAULT 0`);
    await client.query(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS man_hours NUMERIC DEFAULT 0`);

    const colCheckSl = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name='employees' AND column_name='total_sl'
    `);
    if (colCheckSl.rows.length > 0) {
      await client.query(`ALTER TABLE employees RENAME COLUMN total_sl TO total_ml`);
    }

   
    const taskColCheck = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name='tasks' AND column_name='man_hours'
    `);
    if (taskColCheck.rows.length > 0) {
      await client.query(`ALTER TABLE tasks RENAME COLUMN man_hours TO target_date`);
    }

   
    await client.query(`UPDATE users SET profile_pic = NULL WHERE role != 'super_admin'`);
    console.log("✓ Restricted Profile Photo Policy enforced");

    await client.query("COMMIT");
    console.log("✅ Database schema is healthy and up-to-date.");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Critical: Database schema Repair failed:", {
      message: err.message,
      detail: err.detail
    });
  } finally {
    client.release();
  }
};