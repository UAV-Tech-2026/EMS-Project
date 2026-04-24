import express from "express";
import multer from "multer";
import pool from "../db.js";
import bcrypt from "bcryptjs";
import { verifyToken, isAdminOrSuper, isSuperAdmin } from "../middleware/authMiddleware.js";

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
    if (role !== "super_admin" && role !== "admin" && role !== "admin_hr") {
      return res.status(403).json({ msg: "Access denied" });
    }

    const today = new Date().toISOString().split("T")[0];
    let deptFilter = "";
    let deptParam = [];

    if (role !== "super_admin") {
      const deptRes = await pool.query("SELECT department FROM users WHERE id=$1", [req.user.id]);
      const dept = deptRes.rows[0]?.department;
      if (dept) {
        deptFilter = `AND u.department = '${dept}'`; // safe — dept comes from DB not user input
        deptParam = [dept];
      }
    }

    const statsRes = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM users u WHERE u.role = 'employee' ${deptFilter.replace("u.", "")}) AS total_employees,
        (SELECT COUNT(*) FROM users u WHERE u.role = 'intern' ${deptFilter.replace("u.", "")}) AS total_interns,
        (SELECT COUNT(*) FROM users u WHERE u.role IN ('admin','admin_hr') ${deptFilter.replace("u.", "")}) AS total_admins,
        (SELECT COUNT(*) FROM tasks) AS total_tasks,
        (SELECT COUNT(*) FROM attendance a JOIN users u ON a.user_id = u.id
         WHERE a.attendance_date = $1 AND a.status = 'Present' ${deptFilter}) AS present_today,
        (
          (SELECT COUNT(*) FROM leaves WHERE status = 'pending') +
          (SELECT COUNT(*) FROM payslip_requests WHERE status = 'pending') +
          (SELECT COUNT(*) FROM general_requests WHERE status = 'pending')
        ) AS pending_requests
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
    aadhar_proof, address_proof // links from frontend
  } = req.body;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const hashedPassword = await bcrypt.hash(password, 10);
    const userRes = await client.query(
      "INSERT INTO users (username, password, fullname, email, role) VALUES ($1, $2, $3, $4, $5) RETURNING id",
      [username, hashedPassword, fullname, email, role || 'employee']
    );
    await client.query(
      `INSERT INTO employees 
        (user_id, employee_uav_id, fullname, designation, adhar_path, address_path) 
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userRes.rows[0].id, employee_uav_id, fullname, designation, aadhar_proof || null, address_proof || null]
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


// ✅ Fixed: using attendance_date instead of date
router.get("/attendance-today", verifyToken, async (req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0];

    const result = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE a.status = 'Present') AS present_today
      FROM users u
      LEFT JOIN attendance a
        ON a.user_id = u.id AND a.attendance_date = $1
      WHERE u.role IN ('employee', 'intern', 'admin', 'admin_hr', 'super_admin')
    `, [today]);

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
    let query = `
      SELECT
        t.id, t.title, t.target_date, t.start_date,
        t.due_date, t.end_date, t.status, t.days_taken,
        t.link, t.assignment_date, t.parent_id, t.description,
        t.assigned_to,
        assigned_emp.fullname  AS assigned_to_name,
        emp_details.employee_uav_id AS assigned_to_uav_id,
        reviewed_emp.fullname  AS reviewed_by,
        depends_emp.fullname   AS depends_on_name,
        (SELECT COUNT(*) FROM tasks st WHERE st.parent_id = t.id)::int AS subtask_count
      FROM tasks t
      LEFT JOIN users assigned_emp ON t.assigned_to = assigned_emp.id
      LEFT JOIN employees emp_details ON t.assigned_to = emp_details.user_id
      LEFT JOIN users reviewed_emp ON t.reviewed_by = reviewed_emp.id
      LEFT JOIN users depends_emp  ON t.depends_on  = depends_emp.id
    `;
    const params = [];
    const roleMatch = req.user.role?.toLowerCase();

    if (roleMatch === "employee" || roleMatch === "intern") {
      params.push(req.user.id);
      query += ` WHERE t.assigned_to = $${params.length}`;
    } else if (roleMatch !== "super_admin") {
      // scoped admin — fetch their department from users table (consistent with attendanceRoutes)
      const adminRes = await pool.query(
        "SELECT department FROM users WHERE id = $1", [req.user.id]
      );
      const dept = adminRes.rows[0]?.department;
      if (dept) {
        params.push(dept);
        // emp_details is already LEFT JOINed — reuse it, promote to filter
        query += ` WHERE emp_details.department = $${params.length}`;
      }
    }

    query += " ORDER BY t.id ASC";

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error("LIST ERROR:", err.message);
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

// Update basic profile info
router.put("/update-profile", verifyToken, async (req, res) => {
  const { fullname, phone } = req.body;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    
    await client.query(
      "UPDATE users SET fullname = $1, phone = $2 WHERE id = $3",
      [fullname, phone, req.user.id]
    );
    
    await client.query(
      "UPDATE employees SET fullname = $1, phone = $2 WHERE user_id = $3",
      [fullname, phone, req.user.id]
    );

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

// Upload profile picture (SUPER ADMIN ONLY)
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

router.get("/all-assignable", verifyToken, async (req, res) => {
  try {
    let query = `
      SELECT 
        u.id, u.fullname, u.role, u.department, e.designation,
        e.employee_uav_id 
      FROM users u
      LEFT JOIN employees e ON u.id = e.user_id
      WHERE u.role IN ('employee', 'intern', 'admin', 'admin_hr', 'super_admin')
    `;
    const params = [];

    if (req.user.role !== 'super_admin') {
      const creatorRes = await pool.query("SELECT department FROM users WHERE id=$1", [req.user.id]);
      if (creatorRes.rows[0]?.department) {
        query += ` AND (u.department = $1 OR u.role = 'super_admin')`;
        params.push(creatorRes.rows[0].department);
      }
    }

    query += `
      ORDER BY
        CASE u.role
          WHEN 'super_admin' THEN 1
          WHEN 'admin'       THEN 2
          WHEN 'admin_hr'    THEN 3
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

export default router;