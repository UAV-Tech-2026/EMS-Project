import express from "express";
import multer from "multer";
import pool from "../db.js";
import bcrypt from "bcryptjs";
import { verifyToken,isAdminOrSuper } from "../middleware/authMiddleware.js";

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
    if (req.user.role !== "super_admin") {
      return res.status(403).json({ msg: "Access denied" });
    }

    const statsRes = await pool.query(`
      SELECT 
        COUNT(*)                                              AS total_users,
        COUNT(*) FILTER (WHERE role = 'employee')            AS total_employees,
        COUNT(*) FILTER (WHERE role = 'super_admin')         AS total_admins,
        COUNT(*) FILTER (WHERE role = 'employee'
          AND status = 'active')                             AS active_employees
      FROM users
    `);

    res.json({
      totalUsers:      parseInt(statsRes.rows[0].total_users),
      totalEmployees:  parseInt(statsRes.rows[0].total_employees),
      totalAdmins:     parseInt(statsRes.rows[0].total_admins),
      activeEmployees: parseInt(statsRes.rows[0].active_employees),
    });

  } catch (err) {
    console.error("Stats Error:", err);
    res.status(500).json({ msg: "Server error" });
  }
});

router.post("/enroll", verifyToken, isAdminOrSuper, async (req, res) => {
  const { username, password, fullname, email, role, employee_uav_id, designation } = req.body;
  const client = await pool.connect();
  
  try {
    await client.query("BEGIN");

    // 1. Create Login Credentials
    const hashedPassword = await bcrypt.hash(password, 10);
    const userRes = await client.query(
      "INSERT INTO users (username, password, fullname, email, role) VALUES ($1, $2, $3, $4, $5) RETURNING id",
      [username, hashedPassword, fullname, email, role || 'employee']
    );

    // 2. Create Employee Profile linked to that User ID
    await client.query(
      "INSERT INTO employees (user_id, employee_uav_id, fullname, designation) VALUES ($1, $2, $3, $4)",
      [userRes.rows[0].id, employee_uav_id, fullname, designation]
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

    const result = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE a.status = 'Present') AS present_today
      FROM users u
      LEFT JOIN attendance a
        ON a.user_id = u.id AND a.attendance_date = $1
      WHERE u.role = 'employee'
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
    const result = await pool.query(
      `SELECT u.id, u.fullname, u.role
       FROM users u 
       WHERE u.role='employee' `
    );
    res.json(result.rows);
  } catch (err) {
    console.error("EMPLOYEES LIST ERROR:", err.message);
    res.status(500).json({ msg: "Server error" });
  }
});



// Get specific profile for the logged-in employee
router.get("/my-profile", verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM employees WHERE user_id = $1",
      [req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ msg: "Profile not found" });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ msg: "Server error" });
  }
});

// Get recent activity logs for this employee
router.get("/my-activity", verifyToken, async (req, res) => {
  try {
    // Assuming you have an activity_logs table
    const result = await pool.query(
      "SELECT action, created_at FROM activity_logs WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10",
      [req.user.id]
    );
    res.json(result.rows.map(row => `${row.action} on ${new Date(row.created_at).toLocaleDateString()}`));
  } catch (err) {
    res.status(500).json({ msg: "Server error" });
  }
});

export default router;