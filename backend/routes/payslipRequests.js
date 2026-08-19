import express from "express";
import pool from "../db.js";
import { verifyToken, isAdminOrSuper } from "../middleware/authMiddleware.js";
import { createNotification } from "./notificationRoutes.js";

const router = express.Router();

const superAdminOnly = (req, res, next) => {
  if (req.user.role?.toLowerCase() !== "super_admin")
    return res.status(403).json({ msg: "Only Super Admin allowed" });
  next();
};

router.post("/", verifyToken, async (req, res) => {
  try {
    const role = req.user.role?.toLowerCase();
    const { employee_id, month } = req.body;

    if (!["admin", "super_admin", "employee"].includes(role)) {
      return res.status(403).json({ msg: "Access denied" });
    }

    
    if (role === "employee" && parseInt(employee_id) !== req.user.id) {
      return res.status(403).json({ msg: "You can only request your own payslip" });
    }
    if (!employee_id || !month) {
      return res.status(400).json({ msg: "employee_id and month are required" });
    }

    
    const empCheck = await pool.query("SELECT id FROM users WHERE id = $1", [employee_id]);
    if (empCheck.rows.length === 0) {
      return res.status(404).json({ msg: "Employee not found" });
    }

    
    const dupCheck = await pool.query(
      "SELECT id FROM payslip_requests WHERE requested_by = $1 AND employee_id = $2 AND month = $3 AND status = 'pending'",
      [req.user.id, employee_id, month]
    );
    if (dupCheck.rows.length > 0) {
      return res.status(400).json({ msg: "A pending request for this employee and month already exists" });
    }

    await pool.query(
      `INSERT INTO payslip_requests (requested_by, employee_id, month)
       VALUES ($1, $2, $3)`,
      [req.user.id, employee_id, month]
    );

    res.status(201).json({ msg: "Payslip request submitted to Super Admin" });
  } catch (err) {
    console.error("PAYSLIP REQUEST ERROR:", err);
    res.status(500).json({ msg: "Failed to submit request" });
  }
});


router.get("/my", verifyToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        pr.id, pr.month, pr.status, pr.payslip_url,
        pr.rejection_reason, pr.created_at,
        emp.fullname AS employee_name,
        req.fullname AS admin_name
      FROM payslip_requests pr
      JOIN users emp ON pr.employee_id  = emp.id
      JOIN users req ON pr.requested_by = req.id
      WHERE pr.requested_by = $1
      ORDER BY pr.created_at DESC
    `, [req.user.id]);

    res.json(result.rows);
  } catch (err) {
    console.error("PAYSLIP MY REQUESTS ERROR:", err);
    res.status(500).json({ msg: "Failed to fetch requests" });
  }
});


router.get("/all", verifyToken, isAdminOrSuper, async (req, res) => {
  try {
    const { status } = req.query;

    let query = `
      SELECT
        pr.id, pr.month, pr.status, pr.payslip_url,
        pr.rejection_reason, pr.created_at,
        emp.fullname AS employee_name,
        req.fullname AS admin_name
      FROM payslip_requests pr
      JOIN users emp ON pr.employee_id  = emp.id
      JOIN users req ON pr.requested_by = req.id
    `;
    const params = [];
    if (status) {
      query += " WHERE pr.status = $1";
      params.push(status);
    }
    query += " ORDER BY pr.created_at DESC";

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error("PAYSLIP ALL REQUESTS ERROR:", err);
    res.status(500).json({ msg: "Failed to fetch requests" });
  }
});


router.patch("/:id", verifyToken, isAdminOrSuper, async (req, res) => {
  try {
    const { status, rejection_reason, payslip_url } = req.body;
    const { id } = req.params;

    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({ msg: "status must be approved or rejected" });
    }
    if (status === "rejected" && !rejection_reason?.trim()) {
      return res.status(400).json({ msg: "rejection_reason is required when rejecting" });
    }

    
    const reqRes = await pool.query("SELECT requested_by, month FROM payslip_requests WHERE id = $1", [id]);
    if (reqRes.rows.length === 0) {
      return res.status(404).json({ msg: "Payslip request not found" });
    }
    const { requested_by, month } = reqRes.rows[0];

    await pool.query(
      `UPDATE payslip_requests
       SET status = $1, rejection_reason = $2, payslip_url = $3, reviewed_at = NOW(), reviewed_by = $4
       WHERE id = $5`,
      [status, rejection_reason || null, payslip_url || null, req.user.id, id]
    );

    
    await createNotification(
      requested_by,
      `Your payslip request for ${month} has been ${status}.`,
      status === "approved" ? "success" : "warning"
    );

    res.json({ msg: `Request ${status} successfully` });
  } catch (err) {
    console.error("PAYSLIP APPROVE ERROR:", err);
    res.status(500).json({ msg: "Failed to update request" });
  }
});

export default router;