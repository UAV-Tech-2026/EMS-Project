import express from "express";
import multer from "multer";
import pool from "../db.js";
import bcrypt from "bcryptjs";
import { verifyToken, isAdminOrSuper, isSuperAdmin, isHRAdminOrSuper } from "../middleware/authMiddleware.js";
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
      totalEmployees: parseInt(data.total_employees) || 0,
      totalInterns: parseInt(data.total_interns) || 0,
      totalAdmins: parseInt(data.total_admins) || 0,
      activeEmployees: parseInt(data.total_employees) || 0,
      totalTasks: parseInt(data.total_tasks) || 0,
      presentToday: parseInt(data.present_today) || 0,
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
    aadhar_proof, address_proof // links from frontend
  } = req.body;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const hashedPassword = await bcrypt.hash(password, 10);


    // Drop unique constraints on users email/username if present
    try {
      await client.query("ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key");
      await client.query("ALTER TABLE users DROP CONSTRAINT IF EXISTS users_username_key");
    } catch (e) { }

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
        (user_id, employee_uav_id, fullname, designation, adhar_path, address_path, status) 
       VALUES ($1, $2, $3, $4, $5, $6, 'active')`,
      [userId, uavIdToUse, fullname, designation, aadhar_proof || null, address_proof || null]
    );
    await client.query(
      "INSERT INTO activity_logs (user_id, action) VALUES ($1, $2)",
      [req.user.id, `Enrolled new employee ${fullname} (${uavIdToUse})`]
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
  const { fullname, phone } = req.body;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");


    const userRes = await client.query("SELECT phone FROM users WHERE id = $1", [req.user.id]);
    const currentPhone = userRes.rows[0]?.phone;

    let phoneChanged = false;
    if (phone && phone !== currentPhone) {
      phoneChanged = true;
    }

    await client.query(
      "UPDATE users SET fullname = $1, phone = $2 WHERE id = $3",
      [fullname, phone, req.user.id]
    );

    await client.query(
      "UPDATE employees SET fullname = $1, phone = $2 WHERE user_id = $3",
      [fullname, phone, req.user.id]
    );

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

router.get("/all-activity-logs", verifyToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT a.id, a.action, a.created_at, u.fullname, u.role, u.username
      FROM activity_logs a
      LEFT JOIN users u ON a.user_id = u.id
      ORDER BY a.created_at DESC
      LIMIT 100
    `);
    res.json(result.rows);
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

router.get("/get/:id", verifyToken, isHRAdminOrSuper, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT 
         u.id, u.username, u.fullname, u.email, u.phone, u.role, u.department, u.status AS status,
         e.title, e.employee_uav_id, e.designation, e.adhar_path, e.address_path, e.account_number,
         e.ifsc_code, e.bank_name, e.branch_name, e.pan_number,
         e.basic_salary, e.hra, e.epf_amount, e.pt_amount, e.police_certificate, e.medical_certificate,
         e.offer_letter_path, e.nda_path, e.hr_docs_path, e.assigned_admin_id,
         e.experiences, e.custom_fields
       FROM users u
       LEFT JOIN employees e ON u.id = e.user_id
       WHERE u.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ msg: "Employee not found" });
    }

    const row = result.rows[0];
    if (typeof row.experiences === "string") {
      try { row.experiences = JSON.parse(row.experiences); } catch (e) { row.experiences = []; }
    }
    if (!row.experiences || !Array.isArray(row.experiences)) {
      row.experiences = [];
    }

    if (typeof row.custom_fields === "string") {
      try { row.custom_fields = JSON.parse(row.custom_fields); } catch (e) { row.custom_fields = {}; }
    }
    if (!row.custom_fields || typeof row.custom_fields !== "object") {
      row.custom_fields = {};
    }

    res.json(row);
  } catch (err) {
    console.error("GET EMPLOYEE DETAIL ERROR:", err.message);
    res.status(500).json({ msg: "Server error" });
  }
});

router.put("/edit/:id", verifyToken, isHRAdminOrSuper, async (req, res) => {
  const { id } = req.params;
  const {
    title, fullname, phone, email, role, department,
    designation, adhar_path, address_path, account_number,
    ifsc_code, bank_name, branch_name, pan_number,
    basic_salary, hra, epf_amount, pt_amount, police_certificate, medical_certificate,
    offer_letter_path, nda_path, hr_docs_path, assigned_admin_id,
    experiences, custom_fields
  } = req.body;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Fetch current employee_uav_id to sync username
    const empRes = await client.query("SELECT employee_uav_id FROM employees WHERE user_id = $1", [id]);
    const uavId = empRes.rows[0]?.employee_uav_id;
    let usernameUpdate = "";
    const params = [fullname, phone, email, role, department, id];
    if (uavId) {
      const newUsername = `${email.trim().toLowerCase()}_${uavId.toLowerCase()}`;
      usernameUpdate = ", username = $7";
      params.push(newUsername);
    }

    // 1. Update users table
    await client.query(
      `UPDATE users 
       SET fullname = $1, phone = $2, email = $3, role = $4, department = $5 ${usernameUpdate}
       WHERE id = $6`,
      params
    );

    // 2. Update employees table
    await client.query(
      `UPDATE employees 
       SET title = $1, fullname = $2, phone = $3, designation = $4, department = $5, 
           adhar_path = $6, address_path = $7, account_number = $8, ifsc_code = $9,
           bank_name = $10, branch_name = $11, pan_number = $12,
           basic_salary = $13, hra = $14, epf_amount = $15, pt_amount = $16,
           police_certificate = $17, medical_certificate = $18,
           offer_letter_path = $19, nda_path = $20, hr_docs_path = $21,
           assigned_admin_id = $22,
           experiences = $23,
           custom_fields = $24
       WHERE user_id = $25`,
      [
        title || 'Mr.', fullname, phone, designation, department,
        adhar_path || null, address_path || null, account_number || null, ifsc_code || null,
        bank_name || null, branch_name || null, pan_number || null,
        parseFloat(basic_salary) || 0, parseFloat(hra) || 0,
        parseFloat(epf_amount) || 0, parseFloat(pt_amount) || 0,
        police_certificate || null, medical_certificate || null,
        offer_letter_path || null, nda_path || null, hr_docs_path || null,
        assigned_admin_id ? parseInt(assigned_admin_id, 10) : null,
        JSON.stringify(Array.isArray(experiences) ? experiences : []),
        JSON.stringify(custom_fields && typeof custom_fields === 'object' ? custom_fields : {}),
        id
      ]
    );

    // 3. Insert Activity Log
    await client.query(
      "INSERT INTO activity_logs (user_id, action) VALUES ($1, $2)",
      [req.user.id, `Updated employee profile for ${fullname} (${uavId || id})`]
    );

    await client.query("COMMIT");
    res.json({ msg: "Employee details updated successfully" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("EDIT EMPLOYEE ERROR:", err.message);
    res.status(500).json({ msg: "Server error: " + err.message });
  } finally {
    client.release();
  }
});

export default router;
