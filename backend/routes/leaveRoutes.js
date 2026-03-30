import express from "express";
import pool from "../db.js";
import { verifyToken, isAdminOrSuper } from "../middleware/authMiddleware.js";

const router = express.Router();

// ─── DIAGNOSTIC: Check DB Health ──────────────────────────────────────────
router.get("/debug-db", async (req, res) => {
  const report = {
    connection: "checking...",
    tables: {},
    columns: {},
    error: null
  };

  try {
    // 1. Check connection
    await pool.query("SELECT 1");
    report.connection = "OK";

    // 2. Check essential tables
    const tableChecks = ["users", "employees", "leaves", "attendance", "tasks"];
    for (const table of tableChecks) {
      const tCheck = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' AND table_name = $1
        )
      `, [table]);
      report.tables[table] = tCheck.rows[0].exists ? "EXISTS" : "MISSING";
    }

    // 3. Check 'leaves' columns specifically
    const leavesCols = ["id", "user_id", "leave_type", "applied_at", "total_days"];
    for (const col of leavesCols) {
      const cCheck = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_schema = 'public' AND table_name = 'leaves' AND column_name = $1
        )
      `, [col]);
      report.columns[col] = cCheck.rows[0].exists ? "EXISTS" : "MISSING";
    }

    res.json(report);
  } catch (err) {
    report.connection = "FAILED";
    report.error = {
      message: err.message,
      detail: err.detail,
      code: err.code
    };
    res.status(500).json(report);
  }
});

// ─── EMPLOYEE: Apply for leave ────────────────────────────────────────────
router.post("/apply", verifyToken, async (req, res) => {
  try {
    const { leave_type, from_date, to_date, reason } = req.body;
    const user_id = req.user.id;

    if (!leave_type || !from_date || !to_date) {
      return res.status(400).json({ msg: "leave_type, from_date, to_date are required" });
    }

    const validTypes = ["CL", "SL", "CCL", "LOP"];
    if (!validTypes.includes(leave_type)) {
      return res.status(400).json({ msg: "Invalid leave type. Use CL, SL, CCL, or LOP" });
    }

    // DEBUG: Log the user details if query fails
    let userRes;
    try {
      userRes = await pool.query(`
        SELECT u.fullname, e.employee_uav_id
        FROM users u
        LEFT JOIN employees e ON u.id = e.user_id
        WHERE u.id = $1
      `, [user_id]);
    } catch (dbErr) {
      console.error("DB QUERY ERROR (User Fetch):", dbErr);
      return res.status(500).json({ msg: "Database error during user fetch", error: dbErr.message });
    }

    if (userRes.rows.length === 0) return res.status(404).json({ msg: "User not found" });
    const { fullname, employee_uav_id } = userRes.rows[0];

    // Calculate total days
    const from = new Date(from_date);
    const to   = new Date(to_date);

    if (isNaN(from.getTime()) || isNaN(to.getTime())) {
      return res.status(400).json({ msg: "Invalid date format. Use YYYY-MM-DD" });
    }

    const total_days = Math.max(1, Math.ceil((to - from) / (1000 * 60 * 60 * 24)) + 1);

    await pool.query(
      `INSERT INTO leaves (user_id, employee_uav_id, name, leave_type, from_date, to_date, total_days, reason)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [user_id, employee_uav_id || "N/A", fullname || "Unknown", leave_type, from_date, to_date, total_days, reason || ""]
    );

    res.status(201).json({ msg: "Leave applied successfully" });
  } catch (err) {
    console.error("❌ LEAVE APPLY ERROR:", {
      message: err.message,
      stack: err.stack,
      body: req.body,
      user: req.user.id
    });
    res.status(500).json({ msg: "Failed to apply leave", error: err.message });
  }
});

// ─── EMPLOYEE: Get my leaves ──────────────────────────────────────────────
router.get("/my", verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM leaves WHERE user_id = $1 ORDER BY applied_at DESC",
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("❌ LEAVE MY ERROR (FETCH):", {
      message: err.message,
      user: req.user.id
    });
    res.status(500).json({ msg: "Failed to fetch your leaves", error: err.message });
  }
});

// ─── ADMIN/SUPERADMIN: Get ALL leaves ────────────────────────────────────
router.get("/all", verifyToken, isAdminOrSuper, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT l.*, u.fullname AS reviewer_name
      FROM leaves l
      LEFT JOIN users u ON l.approved_by = u.id
      ORDER BY l.applied_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("❌ LEAVE GET ALL ERROR:", err.message);
    res.status(500).json({ msg: "Failed to fetch leaves", error: err.message });
  }
});

// ─── ADMIN/SUPERADMIN: Approve or Reject leave ───────────────────────────
router.put("/status/:id", verifyToken, isAdminOrSuper, async (req, res) => {
  try {
    const { status } = req.body;
    const { id } = req.params;

    const validStatuses = ["approved", "rejected", "pending"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ msg: "Invalid status. Use approved, rejected, or pending" });
    }

    await pool.query(
      `UPDATE leaves
       SET status = $1, approved_by = $2, approved_at = NOW()
       WHERE id = $3`,
      [status, req.user.id, id]
    );

    res.json({ msg: `Leave ${status} successfully` });
  } catch (err) {
    console.error("LEAVE STATUS ERROR:", err);
    res.status(500).json({ msg: "Failed to update leave status", error: err.message });
  }
});

export default router;