import express from "express";
import multer from "multer";
import pool from "../db.js";
import bcrypt from "bcryptjs";
import { verifyToken, isAdminOrSuper, isSuperAdmin } from "../middleware/authMiddleware.js";
import { generateUavId } from "./authRoutes.js";

const router = express.Router();

const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ storage });

router.get("/stats", verifyToken, async (req, res) => {
  try {
    const role = req.user.role?.toLowerCase();
    const ALLOWED_ADMINS = ["super_admin", "admin"];
    const isAdminType = role && role.includes("admin");
    if (!isAdminType) {
      return res.status(403).json({ msg: "Access denied" });
    }

    const today = new Date().toISOString().split("T")[0];
    
    let deptFilter = "";
    let pendingRequestsQuery = `
      (SELECT COUNT(*) FROM leaves WHERE status = 'pending') +
      (SELECT COUNT(*) FROM payslip_requests WHERE status = 'pending') +
      (SELECT COUNT(*) FROM general_requests WHERE status = 'pending')
    `;

    const statsRes = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM users u WHERE u.role = 'employee' ${deptFilter.replace("u.", "")}) AS total_employees,
        (SELECT COUNT(*) FROM users u WHERE u.role = 'intern' ${deptFilter.replace("u.", "")}) AS total_interns,
        (SELECT COUNT(*) FROM users u WHERE u.role = 'admin' ${deptFilter.replace("u.", "")}) AS total_admins,
        (SELECT COUNT(*) FROM tasks) AS total_tasks,
        (SELECT COUNT(*) FROM attendance a JOIN users u ON a.user_id = u.id
         WHERE a.attendance_date = $1 AND a.status = 'Present' ${deptFilter}) AS present_today,
        (${pendingRequestsQuery}) AS pending_requests
    `, [today]);

    const data = statsRes.rows[0];

    res.json({
      totalEmployees:  parseInt(data.total_employees) || 0,
      totalInterns:    parseInt(data.total_interns) || 0,
      totalAdmins:     parseInt(data.total_admins) || 0,
      activeEmployees: parseInt(data.total_employees) || 0,
      totalTasks:      parseInt(data.total_tasks) || 0,
      presentToday:    parseInt(data.present_today) || 0,
      pendingRequests: parseInt(data.pending_requests) || 0,
    });

  } catch (err) {
    console.error("Dashboard Stats Error:", err);
    res.status(500).json({ msg: "Server error" });
  }
});


router.post("/enroll", verifyToken, isAdminOrSuper, async (req, res) => {
  const { 
    username, password, fullname, email, role, employee_uav_id, designation, 
    aadhar_proof, address_proof, total_cl, total_ml
  } = req.body;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Drop unique constraints on users email/username if present
    try {
      await client.query("ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key");
      await client.query("ALTER TABLE users DROP CONSTRAINT IF EXISTS users_username_key");
    } catch (e) {}

    let uavIdToUse = employee_uav_id;
    if (!uavIdToUse || !uavIdToUse.trim()) {
      uavIdToUse = await generateUavId(role || 'employee');
    } else {
      uavIdToUse = uavIdToUse.trim().toUpperCase();
      const idCheck = await client.query(
        "SELECT id FROM employees WHERE employee_uav_id = $1",
        [uavIdToUse]
      );
      if (idCheck.rows.length > 0) {
        await client.query("ROLLBACK");
        return res.status(409).json({
          msg: `Employee ID "${uavIdToUse}" is already taken. Please choose a different one.`,
        });
      }
    }

    const effectiveUsername = `${(username || email).trim().toLowerCase()}_${uavIdToUse.toLowerCase()}`;
    const userRes = await client.query(
      "INSERT INTO users (username, password, fullname, email, role, status) VALUES ($1, $2, $3, $4, $5, 'Active') RETURNING id",
      [effectiveUsername, hashedPassword, fullname, email.trim(), role || 'employee']
    );
    const userId = userRes.rows[0].id;
    await client.query(
      `INSERT INTO employees 
        (user_id, employee_uav_id, fullname, designation, adhar_path, address_path, status, total_cl, total_ml) 
       VALUES ($1, $2, $3, $4, $5, $6, 'active', $7, $8)`,
      [
        userId, uavIdToUse, fullname, designation, aadhar_proof || null, address_proof || null,
        total_cl != null ? parseFloat(total_cl) : 12,
        total_ml != null ? parseFloat(total_ml) : 12
      ]
    );
    await client.query("COMMIT");
    res.status(201).json({ msg: "Employee enrolled successfully" });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ msg: err.message });
  } finally {
    client.release();
  }
});



router.get("/attendance-today", verifyToken, async (req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0];
    const role = req.user.role?.toLowerCase();
    
    let query = `
      SELECT
        COUNT(*) FILTER (WHERE a.status = 'Present') AS present_today
      FROM users u
      LEFT JOIN attendance a
        ON a.user_id = u.id AND a.attendance_date = $1
      WHERE u.role IN ('employee', 'intern', 'admin', 'super_admin')
    `;
    const params = [today];
    
    

    const result = await pool.query(query, params);

    res.json({
      presentToday: parseInt(result.rows[0].present_today) || 0,
    });

  } catch (err) {
    console.error("ATTENDANCE TODAY ERROR:", err.message);
    res.status(500).json({ msg: "Server error" });
  }
});

router.get("/recent", verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT e.fullname, e.designation, e.employee_uav_id, e.created_at 
       FROM employees e 
       ORDER BY e.created_at DESC 
       LIMIT 5`
    );
    res.json(result.rows);
  } catch (err) {
    console.error("RECENT EMPLOYEES ERROR:", err.message);
    res.status(500).json({ msg: "Server error" });
  }
});

router.get("/list", verifyToken, async (req, res) => {
  try {
    const roleMatch = req.user.role?.toLowerCase();
    let query = `
      SELECT 
        u.id, u.username, u.fullname, u.role, u.email,
        COALESCE(e.phone, u.phone) AS phone,
        e.department,
        e.employee_uav_id, e.designation, e.created_at
      FROM users u
      LEFT JOIN employees e ON u.id = e.user_id
    `;
    const params = [];

    if (roleMatch === "employee" || roleMatch === "intern") {
      params.push(req.user.id);
      query += ` WHERE u.id = $${params.length}`;
    }
    

    query += " ORDER BY u.fullname ASC";

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error("EMPLOYEE LIST ERROR:", err.message);
    res.status(500).json({ error: "Fetch failed" });
  }
});

router.get("/my-profile", verifyToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        e.*,
        u.email,
        u.profile_pic
      FROM employees e
      INNER JOIN users u ON e.user_id = u.id
      WHERE e.user_id = $1
    `, [req.user.id]);
    
    if (result.rows.length === 0) return res.status(404).json({ msg: "Profile not found" });
    res.json(result.rows[0]);
  } catch (err) {
    console.error("MY PROFILE ERROR:", err.message);
    res.status(500).json({ msg: "Server error" });
  }
});


router.put("/update-profile", verifyToken, async (req, res) => {
  const { fullname, phone, email } = req.body;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    
    const userRes = await client.query("SELECT phone, role FROM users WHERE id = $1", [req.user.id]);
    const currentPhone = userRes.rows[0]?.phone;
    const userRole = userRes.rows[0]?.role;
    
    let phoneChanged = false;
    if (phone && phone !== currentPhone) {
      phoneChanged = true;
    }

    if (email && (userRole === 'admin' || userRole === 'superadmin')) {
      await client.query(
        "UPDATE users SET fullname = $1, phone = $2, email = $3 WHERE id = $4",
        [fullname, phone, email, req.user.id]
      );
      await client.query(
        "UPDATE employees SET fullname = $1, phone = $2, email = $3 WHERE user_id = $4",
        [fullname, phone, email, req.user.id]
      );
    } else {
      await client.query(
        "UPDATE users SET fullname = $1, phone = $2 WHERE id = $3",
        [fullname, phone, req.user.id]
      );
      await client.query(
        "UPDATE employees SET fullname = $1, phone = $2 WHERE user_id = $3",
        [fullname, phone, req.user.id]
      );
    }

    if (phoneChanged) {
     
      await client.query(
        "UPDATE users SET totp_secret = NULL, totp_secret_temp = NULL WHERE id = $1",
        [req.user.id]
      );
    }

    await client.query("COMMIT");
    res.json({ msg: "Profile updated successfully" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("UPDATE PROFILE ERROR:", err.message);
    res.status(500).json({ msg: "Server error" });
  } finally {
    client.release();
  }
});


router.post("/upload-profile-pic", verifyToken, isSuperAdmin, upload.single("profile_pic"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ msg: "No image uploaded" });
    
    const imageUrl = `/uploads/${req.file.filename}`;
    const targetUserId = req.body.target_user_id || req.user.id;
    
    await pool.query(
      "UPDATE users SET profile_pic = $1 WHERE id = $2",
      [imageUrl, targetUserId]
    );
    
    res.json({ 
      msg: targetUserId === req.user.id ? "Your photo updated!" : "User photo updated!",
      profilePic: imageUrl
    });
  } catch (err) {
    console.error("UPLOAD PIC ERROR:", err.message);
    res.status(500).json({ msg: "Server error" });
  }
});

router.get("/my-activity", verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT action, created_at FROM activity_logs WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10",
      [req.user.id]
    );
    res.json(result.rows.map(row => `${row.action} on ${new Date(row.created_at).toLocaleDateString()}`));
  } catch (err) {
    res.status(500).json({ msg: "Server error" });
  }
});


router.get("/admin-list", verifyToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT u.id, u.fullname, u.username, u.role, u.department
      FROM users u
      WHERE u.role IN ('super_admin', 'admin')
      ORDER BY
        CASE u.role WHEN 'super_admin' THEN 1 WHEN 'admin' THEN 2 ELSE 3 END,
        u.fullname ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("ADMIN LIST ERROR:", err.message);
    res.status(500).json({ msg: "Server error" });
  }
});

router.get("/all-assignable", verifyToken, async (req, res) => {
  try {
    let query = `
      SELECT 
        u.id, u.fullname, u.role, u.department, e.designation,
        e.employee_uav_id 
      FROM users u
      LEFT JOIN employees e ON u.id = e.user_id
      WHERE u.role IN ('employee', 'intern', 'admin', 'super_admin')
    `;
    const params = [];

    

    query += `
      ORDER BY
        CASE u.role
          WHEN 'super_admin' THEN 1
          WHEN 'admin'       THEN 2
          WHEN 'employee'    THEN 4
          WHEN 'intern'      THEN 5
        END,
        u.fullname ASC
    `;
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error("ALL ASSIGNABLE ERROR:", err.message);
    res.status(500).json({ msg: err.message });
  }
});

router.patch("/status/:id", verifyToken, isAdminOrSuper, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body; 
  
  if (!status || !['active', 'inactive'].includes(status.toLowerCase())) {
    return res.status(400).json({ msg: "Invalid status value" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    
    const userStatus = status.toLowerCase() === 'active' ? 'Active' : 'Inactive';
    await client.query("UPDATE users SET status = $1 WHERE id = $2", [userStatus, id]);

    const empStatus = status.toLowerCase();
    await client.query("UPDATE employees SET status = $1 WHERE user_id = $2", [empStatus, id]);

    await client.query("COMMIT");
    res.json({ msg: `Status updated to ${status}` });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("STATUS UPDATE ERROR:", err.message);
    res.status(500).json({ msg: "Server error" });
  } finally {
    client.release();
  }
});

router.patch("/reset-password/:id", verifyToken, isAdminOrSuper, async (req, res) => {
  const { id } = req.params;
  const { new_password } = req.body;

  if (!new_password || new_password.length < 6) {
    return res.status(400).json({ msg: "Password must be at least 6 characters" });
  }

  try {
    const hashedPassword = await bcrypt.hash(new_password, 10);
    const result = await pool.query(
      "UPDATE users SET password = $1 WHERE id = $2 RETURNING id",
      [hashedPassword, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ msg: "User not found" });
    }

    res.json({ msg: "Password updated successfully" });
  } catch (err) {
    console.error("RESET PASSWORD ERROR:", err.message);
    res.status(500).json({ msg: "Server error" });
  }
});

router.get("/all-activity-logs", verifyToken, isAdminOrSuper, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT al.id, al.user_id, al.action, al.created_at, u.fullname, u.username, u.role
      FROM activity_logs al
      LEFT JOIN users u ON al.user_id = u.id
      ORDER BY al.created_at DESC
      LIMIT 100
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("ALL ACTIVITY LOGS ERROR:", err.message);
    res.status(500).json({ msg: "Server error" });
  }
});

// GET /employees/get/:id — fetch full employee details for edit modal
router.get("/get/:id", verifyToken, isAdminOrSuper, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(`
      SELECT
        u.id, u.fullname, u.email, u.role, u.phone, u.profile_pic, u.status,
        e.employee_uav_id, e.designation, e.department, e.phone AS emp_phone,
        e.adhar_path, e.address_path,
        e.account_number, e.ifsc_code, e.bank_name, e.branch_name, e.pan_number,
        e.basic_salary, e.hra, e.epf_amount, e.pt_amount,
        e.police_certificate, e.medical_certificate,
        e.offer_letter_path, e.nda_path, e.hr_docs_path,
        e.assigned_admin_id, e.experiences, e.custom_fields,
        e.title
      FROM users u
      LEFT JOIN employees e ON u.id = e.user_id
      WHERE u.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ msg: "Employee not found" });
    }

    const row = result.rows[0];
    // Merge phone — prefer employees table phone if available
    const merged = {
      ...row,
      phone: row.emp_phone || row.phone || "",
      experiences: row.experiences || [],
      custom_fields: row.custom_fields || {}
    };
    res.json(merged);
  } catch (err) {
    console.error("GET EMPLOYEE BY ID ERROR:", err.message);
    res.status(500).json({ msg: "Server error" });
  }
});

// PUT /employees/edit/:id — update full employee details from edit modal
router.put("/edit/:id", verifyToken, isAdminOrSuper, async (req, res) => {
  const { id } = req.params;
  const {
    title, fullname, phone, email, role, department, designation,
    adhar_path, address_path,
    account_number, ifsc_code, bank_name, branch_name, pan_number,
    basic_salary, hra, epf_amount, pt_amount,
    police_certificate, medical_certificate,
    offer_letter_path, nda_path, hr_docs_path,
    assigned_admin_id, experiences, custom_fields,
    total_cl, total_ml
  } = req.body;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Update users table
    await client.query(
      `UPDATE users SET fullname = $1, email = $2, role = $3 WHERE id = $4`,
      [fullname, email, role, id]
    );

    // Update employees table (upsert approach — update where user_id matches)
    await client.query(`
      UPDATE employees SET
        title = $1, fullname = $2, phone = $3, department = $4, designation = $5,
        adhar_path = $6, address_path = $7,
        account_number = $8, ifsc_code = $9, bank_name = $10, branch_name = $11, pan_number = $12,
        basic_salary = $13, hra = $14, epf_amount = $15, pt_amount = $16,
        police_certificate = $17, medical_certificate = $18,
        offer_letter_path = $19, nda_path = $20, hr_docs_path = $21,
        assigned_admin_id = $22, experiences = $23, custom_fields = $24,
        total_cl = COALESCE($26, total_cl), total_ml = COALESCE($27, total_ml)
      WHERE user_id = $25
    `, [
      title || "Mr.", fullname, phone, department, designation,
      adhar_path, address_path,
      account_number, ifsc_code, bank_name, branch_name, pan_number,
      parseFloat(basic_salary) || 0,
      parseFloat(hra) || 0,
      parseFloat(epf_amount) || 0,
      parseFloat(pt_amount) || 0,
      police_certificate, medical_certificate,
      offer_letter_path, nda_path, hr_docs_path,
      assigned_admin_id ? parseInt(assigned_admin_id) : null,
      JSON.stringify(experiences || []),
      JSON.stringify(custom_fields || {}),
      id,
      total_cl != null ? parseFloat(total_cl) : null,
      total_ml != null ? parseFloat(total_ml) : null
    ]);

    await client.query("COMMIT");
    res.json({ msg: "Employee updated successfully" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("EDIT EMPLOYEE ERROR:", err.message);
    res.status(500).json({ msg: "Failed to update employee details" });
  } finally {
    client.release();
  }
});

router.put("/leave-balances/:id", verifyToken, isAdminOrSuper, async (req, res) => {
  const { id } = req.params;
  const { total_cl, total_ml } = req.body;
  try {
    await pool.query(
      `UPDATE employees SET total_cl = $1, total_ml = $2 WHERE user_id = $3`,
      [parseFloat(total_cl) || 0, parseFloat(total_ml) || 0, id]
    );
    res.json({ msg: "Leave balances updated successfully" });
  } catch (err) {
    console.error("UPDATE LEAVE BALANCES ERROR:", err.message);
    res.status(500).json({ msg: "Server error" });
  }
});

export default router;