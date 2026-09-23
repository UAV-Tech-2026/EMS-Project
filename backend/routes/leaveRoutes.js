import express from "express";
import pool from "../db.js";
import { verifyToken, isAdminOrSuper, canReadFeature } from "../middleware/authMiddleware.js";
import { createNotification } from "./notificationRoutes.js";

const router = express.Router();


const countWorkingDays = (startStr, endStr) => {
  if (!startStr || !endStr) return 0;
  let current = new Date(startStr + "T00:00:00Z");
  const end = new Date(endStr + "T00:00:00Z");
  let count = 0;
  while (current <= end) {
    if (current.getUTCDay() !== 0) count++; // Skip Sunday
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return count;
};


const getUTCMonthRange = (dateObj) => {
  const year = dateObj.getUTCFullYear();
  const month = dateObj.getUTCMonth();
  
  const start = new Date(Date.UTC(year, month, 1)).toISOString().split("T")[0];
  const end = new Date(Date.UTC(year, month + 1, 0)).toISOString().split("T")[0];
  return { start, end };
};


router.get("/debug-db", async (req, res) => {
  const report = { connection: "checking...", tables: {}, columns: {}, error: null };
  try {
    await pool.query("SELECT 1");
    report.connection = "OK";
    
    const tablesToCheck = ["users", "employees", "leaves", "attendance", "tasks"];
    for (const table of tablesToCheck) {
      const r = await pool.query(
        `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema='public' AND table_name=$1)`,
        [table]
      );
      report.tables[table] = r.rows[0].exists ? "EXISTS" : "MISSING";
    }
    
    const columnsToCheck = ["id", "user_id", "leave_type", "applied_at", "total_days", "approved_by_name", "approved_by_role", "target_approver_role"];
    for (const col of columnsToCheck) {
      const r = await pool.query(
        `SELECT EXISTS (SELECT FROM information_schema.columns WHERE table_schema='public' AND table_name='leaves' AND column_name=$1)`,
        [col]
      );
      report.columns[col] = r.rows[0].exists ? "EXISTS" : "MISSING";
    }
    const roles = await pool.query("SELECT id, fullname, role, department FROM users");
    report.users = roles.rows;
    res.json(report);
  } catch (err) {
    report.connection = "FAILED";
    report.error = { message: err.message, detail: err.detail, code: err.code };
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

    const userRes = await pool.query(`
      SELECT u.fullname, u.role, u.department, e.employee_uav_id
      FROM users u
      LEFT JOIN employees e ON u.id = e.user_id
      WHERE u.id = $1
    `, [user_id]);

    if (userRes.rows.length === 0) return res.status(404).json({ msg: "User not found" });
    const { fullname, role, department, employee_uav_id } = userRes.rows[0];

    const from = new Date(from_date + "T00:00:00Z");
    const to = new Date(to_date + "T00:00:00Z");
    if (isNaN(from.getTime()) || isNaN(to.getTime())) {
      return res.status(400).json({ msg: "Invalid date format. Use YYYY-MM-DD" });
    }

    const total_days = countWorkingDays(from_date, to_date);
    if (total_days === 0) {
      return res.status(400).json({ msg: "Selected date range only contains Sundays." });
    }

    const { start: monthStart, end: monthEnd } = getUTCMonthRange(from);

    
    if (leave_type === "CL") {
      const clRes = await pool.query(`
        SELECT COALESCE(SUM(total_days), 0) as used_cl FROM leaves
        WHERE user_id=$1 AND leave_type='CL' AND status != 'rejected'
          AND from_date >= $2 AND from_date <= $3
      `, [user_id, monthStart, monthEnd]);
      
      const usedCl = Number(clRes.rows[0].used_cl);
      if (usedCl + total_days > 2) {
        return res.status(400).json({ msg: `CL limit reached (Max 2/month). Used: ${usedCl}` });
      }
    }

    if (leave_type === "ML") {
      const mlRes = await pool.query(`
        SELECT COALESCE(SUM(total_days), 0) as used_ml FROM leaves
        WHERE user_id=$1 AND leave_type='ML' AND status != 'rejected'
          AND from_date >= $2 AND from_date <= $3
      `, [user_id, monthStart, monthEnd]);
      
      const usedMl = Number(mlRes.rows[0].used_ml);
      if (usedMl + total_days > 12) {
        return res.status(400).json({ msg: `ML limit reached (Max 12/month). Used: ${usedMl}` });
      }
      if (total_days > 2 && !certificate_path) {
        return res.status(400).json({ msg: "Medical certificate required for ML > 2 days." });
      }
    }

    // Employees → routed to dept admin; Admins → routed to super admin
    const target_approver_role = (role?.toLowerCase() === "admin" || (role && role.toLowerCase().replace(/[^a-z]/g, '') === "superadmin")) ? "super_admin" : "dept_admin";

    await pool.query(`
      INSERT INTO leaves
        (user_id, employee_uav_id, name, leave_type, from_date, to_date,
         total_days, reason, certificate_path, target_approver_role)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `, [
      user_id, employee_uav_id || "N/A", fullname || "Unknown",
      leave_type, from_date, to_date, total_days,
      reason || "", certificate_path || null, target_approver_role
    ]);

    // ── Notify all relevant approvers ──────────────────────────────────────
    // 1. Super Admins  — always notified
    // 2. HR Admins     — admins whose department is 'HR'
    // 3. Dept Admins   — admins in the same department as the applicant
    try {
      const approversRes = await pool.query(`
        SELECT DISTINCT id FROM users
        WHERE
          LOWER(role) IN ('super_admin', 'superadmin')
          OR (LOWER(role) = 'admin' AND LOWER(department) = 'hr')
          OR (LOWER(role) = 'admin' AND department = $1)
      `, [department]);

      const notifMessage = `📋 New ${leave_type} leave request from ${fullname}${department ? ` (${department})` : ""} — ${total_days} day(s) [${from_date} to ${to_date}]. Pending your approval.`;

      await Promise.all(
        approversRes.rows.map(({ id }) => createNotification(id, notifMessage, "info"))
      );
    } catch (notifErr) {
      // Non-fatal — leave was saved, just log the notification error
      console.error("⚠️ Failed to notify approvers:", notifErr.message);
    }
    // ───────────────────────────────────────────────────────────────────────

    res.status(201).json({
      msg: "Leave applied successfully",
      routed_to: target_approver_role === "super_admin"
        ? "Super Admin"
        : "HR Admin, Department Admin & Super Admin"
    });
  } catch (err) {
    console.error("❌ LEAVE APPLY ERROR:", err.message);
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
    console.error("❌ LEAVE MY ERROR:", err.message);
    res.status(500).json({ msg: "Failed to fetch your leaves", error: err.message });
  }
});


router.get("/all", verifyToken, canReadFeature("leaves"), async (req, res) => {
  try {
    const callerRole = req.user.role?.toLowerCase();
    const callerId = req.user.id;

    
    if (callerRole && callerRole.replace(/[^a-z]/g, '') === "superadmin") {
      const result = await pool.query(`
        SELECT l.*,
               approver.fullname    AS approved_by_name,
               approver.role        AS approved_by_role,
               applicant.role       AS applicant_role,
               applicant.department AS applicant_department
        FROM leaves l
        LEFT JOIN users approver  ON l.approved_by = approver.id
        LEFT JOIN users applicant ON l.user_id     = applicant.id
        ORDER BY l.applied_at DESC
      `);
      return res.json(result.rows);
    }

    
    const adminRes = await pool.query("SELECT department FROM users WHERE id = $1", [callerId]);
    const dept = adminRes.rows[0]?.department;

   
    if (!dept) {
      console.warn(`⚠️ Dept admin ${callerId} has no department set in DB`);
      return res.status(400).json({
        msg: "Your account has no department assigned. Please contact Super Admin to set your department."
      });
    }

    
    const result = await pool.query(`
      SELECT l.*,
             approver.fullname    AS approved_by_name,
             approver.role        AS approved_by_role,
             applicant.role       AS applicant_role,
             applicant.department AS applicant_department
      FROM leaves l
      JOIN      users applicant ON l.user_id    = applicant.id
      LEFT JOIN users approver  ON l.approved_by = approver.id
      WHERE applicant.department = $1
        AND LOWER(applicant.role) NOT IN ('admin', 'superadmin', 'super_admin')
      ORDER BY l.applied_at DESC
    `, [dept]);

    return res.json(result.rows);
  } catch (err) {
    console.error("❌ LEAVE GET ALL ERROR:", err.message);
    res.status(500).json({ msg: "Failed to fetch leaves", error: err.message });
  }
});


router.put("/status/:id", verifyToken, isAdminOrSuper, async (req, res) => {
  try {
    const { status } = req.body;
    const { id } = req.params;
    const approverRole = req.user.role?.toLowerCase();
    const approverId = req.user.id;

    const validStatuses = ["approved", "rejected", "pending"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ msg: "Invalid status. Use approved, rejected, or pending" });
    }

    
    const leaveRes = await pool.query(`
      SELECT l.user_id, l.leave_type, l.target_approver_role,
             u.fullname AS applicant_name, u.role AS applicant_role, u.department AS applicant_dept
      FROM leaves l
      JOIN users u ON l.user_id = u.id
      WHERE l.id = $1
    `, [id]);

    if (leaveRes.rows.length === 0) {
      return res.status(404).json({ msg: "Leave record not found" });
    }

    const { user_id, leave_type, target_approver_role, applicant_dept } = leaveRes.rows[0];

 

    if (approverRole && approverRole.toLowerCase().replace(/[^a-z]/g, '') !== "superadmin") {
      let adminDept = null;
      if (approverRole === "admin") {
        const adminRes = await pool.query("SELECT department FROM users WHERE id=$1", [approverId]);
        adminDept = adminRes.rows[0]?.department;
      }
      
      if (approverRole === "admin" && adminDept !== applicant_dept) {
        return res.status(403).json({
          msg: "You can only approve leaves from your own department. Super Admin has full control over all leaves."
        });
      }
    }

 
    const approverRes = await pool.query("SELECT fullname, role FROM users WHERE id = $1", [approverId]);
    const approverName = approverRes.rows[0]?.fullname || "Unknown";
    const approverRoleName = approverRes.rows[0]?.role || approverRole;

    await pool.query(`
      UPDATE leaves
      SET status           = $1,
          approved_by      = $2,
          approved_by_name = $3,
          approved_by_role = $4,
          approved_at      = NOW()
      WHERE id = $5
    `, [status, approverId, approverName, approverRoleName, id]);

    await createNotification(
      user_id,
      `Your ${leave_type} leave request has been ${status} by ${approverName} (${approverRoleName}).`,
      status === "approved" ? "success" : "warning"
    );

    res.json({
      msg: `Leave ${status} successfully`,
      actioned_by: { id: approverId, name: approverName, role: approverRoleName }
    });
  } catch (err) {
    console.error("❌ LEAVE STATUS ERROR:", err);
    res.status(500).json({ msg: "Failed to update leave status", error: err.message });
  }
});

export default router;