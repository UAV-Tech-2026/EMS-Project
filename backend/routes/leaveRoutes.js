import express from "express";
import pool from "../db.js";
import { verifyToken, isAdminOrSuper } from "../middleware/authMiddleware.js";
import { createNotification } from "./notificationRoutes.js";

const router = express.Router();

const countWorkingDays = (startStr, endStr) => {
  if (!startStr || !endStr) return 0;
  let start = new Date(startStr);
  let end = new Date(endStr);
  let count = 0;
  let current = new Date(start);
  while (current <= end) {
    if (current.getUTCDay() !== 0) { // Skip Sunday
      count++;
    }
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return count;
};


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


router.post("/apply", verifyToken, async (req, res) => {
  try {
    const { leave_type, from_date, to_date, reason, certificate_path } = req.body;
    const user_id = req.user.id;

    if (!leave_type || !from_date || !to_date) {
      return res.status(400).json({ msg: "leave_type, from_date, to_date are required" });
    }

    const validTypes = ["CL", "ML", "CCL", "LOP"];
    if (!validTypes.includes(leave_type)) {
      return res.status(400).json({ msg: "Invalid leave type. Use CL, ML, CCL, or LOP" });
    }

   
    if (leave_type === "ML") {
      
    }

   
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

    const total_days = countWorkingDays(from_date, to_date);

    if (total_days === 0) {
      return res.status(400).json({ msg: "Selected date range only contains Sundays (non-working days)." });
    }

    
    if (leave_type === "CL") {
      const monthStart = new Date(from.getFullYear(), from.getMonth(), 1).toISOString().split('T')[0];
      const monthEnd = new Date(from.getFullYear(), from.getMonth() + 1, 0).toISOString().split('T')[0];

      const clCountRes = await pool.query(`
        SELECT SUM(total_days) as used_cl
        FROM leaves
        WHERE user_id = $1 AND leave_type = 'CL' AND status != 'rejected'
        AND from_date >= $2 AND from_date <= $3
      `, [user_id, monthStart, monthEnd]);

      const usedCl = Number(clCountRes.rows[0].used_cl || 0);
      if (usedCl + total_days > 2) {
        return res.status(400).json({ msg: `Casual Leave limit reached (Max 2 per month). You have already used ${usedCl} CL.` });
      }
    }

  
    if (leave_type === "ML") {
      const monthStart = new Date(from.getFullYear(), from.getMonth(), 1).toISOString().split('T')[0];
      const monthEnd = new Date(from.getFullYear(), from.getMonth() + 1, 0).toISOString().split('T')[0];

      const mlCountRes = await pool.query(`
        SELECT SUM(total_days) as used_ml
        FROM leaves
        WHERE user_id = $1 AND leave_type = 'ML' AND status != 'rejected'
        AND from_date >= $2 AND from_date <= $3
      `, [user_id, monthStart, monthEnd]);

      const usedMl = Number(mlCountRes.rows[0].used_ml || 0);
      if (usedMl + total_days > 12) {
        return res.status(400).json({ msg: `Medical Leave limit reached (Max 12 per month). You have already used ${usedMl} ML.` });
      }

      // Check for certificate requirement: only if > 2 days
      if (total_days > 2 && !certificate_path) {
        return res.status(400).json({ msg: "Medical certificate is required for ML requests longer than 2 days." });
      }
    }

    await pool.query(
      `INSERT INTO leaves (user_id, employee_uav_id, name, leave_type, from_date, to_date, total_days, reason, certificate_path)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [user_id, employee_uav_id || "N/A", fullname || "Unknown", leave_type, from_date, to_date, total_days, reason || "", certificate_path || null]
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


router.get("/all", verifyToken, isAdminOrSuper, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT l.*, u.fullname AS approved_by_name, u.role AS approved_by_role
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


router.put("/status/:id", verifyToken, isAdminOrSuper, async (req, res) => {
  try {
    const { status } = req.body;
    const { id } = req.params;

    const validStatuses = ["approved", "rejected", "pending"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ msg: "Invalid status. Use approved, rejected, or pending" });
    }

    
    const leaveRes = await pool.query("SELECT user_id, leave_type FROM leaves WHERE id = $1", [id]);
    if (leaveRes.rows.length === 0) {
      return res.status(404).json({ msg: "Leave record not found" });
    }
    const { user_id, leave_type } = leaveRes.rows[0];

    await pool.query(
      `UPDATE leaves
       SET status = $1, approved_by = $2, approved_at = NOW()
       WHERE id = $3`,
      [status, req.user.id, id]
    );

    // Trigger notification
    await createNotification(
      user_id,
      `Your ${leave_type} leave request has been ${status}.`,
      status === "approved" ? "success" : "warning"
    );

    res.json({ msg: `Leave ${status} successfully` });
  } catch (err) {
    console.error("LEAVE STATUS ERROR:", err);
    res.status(500).json({ msg: "Failed to update leave status", error: err.message });
  }
});

export default router;