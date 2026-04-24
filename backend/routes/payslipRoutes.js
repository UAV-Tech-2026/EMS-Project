import express from "express";
import pool from "../db.js";
import { verifyToken, isAdminOrSuper } from "../middleware/authMiddleware.js";

const router = express.Router();

const superAdminOnly = (req, res, next) => {
  if (req.user.role?.toLowerCase() !== "super_admin")
    return res.status(403).json({ msg: "Only Super Admin allowed" });
  next();
};

// ─── GET EMPLOYEES LIST ──────────────────────────────────────────────────
router.get("/employees", verifyToken, isAdminOrSuper, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        u.id, u.fullname, e.employee_uav_id, e.designation,
        COALESCE(e.basic_salary, 0) AS basic_salary,
        COALESCE(e.hra, 0) AS hra,
        COALESCE(e.epf_amount, 0) AS epf_amount,
        COALESCE(e.pt_amount, 0) AS pt_amount
      FROM users u
      LEFT JOIN employees e ON u.id = e.user_id
      WHERE u.role IN ('employee', 'intern')
      ORDER BY e.employee_uav_id ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("GET EMPLOYEES ERROR:", err);
    res.status(500).json({ msg: "Error fetching employees" });
  }
});

// ─── GENERATE PAYSLIP ────────────────────────────────────────────────────
router.get("/generate", verifyToken, isAdminOrSuper, async (req, res) => {
  try {
    const { userId, from, to } = req.query;
    if (!userId || !from || !to) return res.status(400).json({ msg: "Missing params" });

    // 1. Fetch Salary Structure
    const empRes = await pool.query(`
      SELECT u.id, u.fullname, e.employee_uav_id, e.designation,
        COALESCE(e.basic_salary, 0) AS basic, COALESCE(e.hra, 0) AS hra,
        COALESCE(e.epf_amount, 0) AS epf, COALESCE(e.pt_amount, 0) AS pt
      FROM users u JOIN employees e ON u.id = e.user_id WHERE u.id = $1
    `, [userId]);
    if (empRes.rows.length === 0) return res.status(404).json({ msg: "Employee not found" });
    const emp = empRes.rows[0];

    // 2. Fetch Attendance Summary
    const attRes = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'Present')::int              AS present_days,
        COUNT(*) FILTER (WHERE status IN ('0.5', '0.5 LOP'))::int    AS half_days,
        COUNT(*) FILTER (WHERE status IN ('CL','ML','SL','CCL'))::int AS paid_leaves,
        COUNT(*) FILTER (WHERE status IN ('Absent', 'LOP'))::int     AS unpaid_days,
        COALESCE(SUM(ot_hours), 0)                                   AS ot_hours,
        ($2::date - $1::date + 1)::int                               AS total_calendar_days
      FROM attendance
      WHERE user_id = $3 AND attendance_date BETWEEN $1::date AND $2::date
    `, [from, to, userId]);
    const att = attRes.rows[0];

    // 3. Calculations
    const grossFixed      = Number(emp.basic) + Number(emp.hra);
    const dailyRate       = att.total_calendar_days > 0 ? grossFixed / att.total_calendar_days : 0;
    const lopDays         = Number(att.unpaid_days) + (Number(att.half_days) * 0.5);
    const lopDeduction    = Math.round(dailyRate * lopDays);
    const otPay           = Math.round((grossFixed / 30 / 8) * Number(att.ot_hours));
    const totalDeductions = Number(emp.epf) + Number(emp.pt) + lopDeduction;
    const netSalary       = Math.max((grossFixed + otPay) - totalDeductions, 0);

    // 4. YTD Cumulative
    const year = from.substring(0, 4);
    const ytdRes = await pool.query(`
      SELECT
        COALESCE(SUM(gross), 0)          AS ytd_gross,
        COALESCE(SUM(epf + pt + lop), 0) AS ytd_deductions,
        COALESCE(SUM(net_salary), 0)     AS ytd_net
      FROM payroll_history
      WHERE user_id = $1 AND month LIKE $2
    `, [userId, `${year}-%`]);
    const ytd = ytdRes.rows[0];

    // 5. Check Approval Status
    const month = from.substring(0, 7);
    const checkApproved = await pool.query(
      "SELECT id FROM payroll_history WHERE user_id = $1 AND month = $2",
      [userId, month]
    );

    res.json({
      employee: emp,
      period: { from, to, month },
      salary: {
        basic:            Number(emp.basic),
        hra:              Number(emp.hra),
        gross_salary:     grossFixed,
        epf_deduction:    Number(emp.epf),
        pt_deduction:     Number(emp.pt),
        lop_deduction:    lopDeduction,
        ot_pay:           otPay,
        total_deductions: totalDeductions,
        net_salary:       netSalary
      },
      attendance: {
        working_days: att.total_calendar_days,
        present_days: att.present_days,
        half_days:    att.half_days,
        lop_days:     lopDays,
        ot_hours:     att.ot_hours
      },
      cumulative: {
        ytd_gross:      Number(ytd.ytd_gross),
        ytd_deductions: Number(ytd.ytd_deductions),
        ytd_net:        Number(ytd.ytd_net)
      },
      is_approved: checkApproved.rows.length > 0
    });
  } catch (err) {
    console.error("GENERATE PAYSLIP ERROR:", err);
    res.status(500).json({ msg: err.message });
  }
});

// ─── APPROVE & LOCK PAYROLL ──────────────────────────────────────────────
router.post("/approve", verifyToken, superAdminOnly, async (req, res) => {
  try {
    const { userId, month, from, to, salary, attendance } = req.body;

    const check = await pool.query(
      "SELECT id FROM payroll_history WHERE user_id = $1 AND month = $2",
      [userId, month]
    );
    if (check.rows.length > 0) return res.status(400).json({ msg: "Already locked" });

    await pool.query(`
      INSERT INTO payroll_history (
        user_id, month, from_date, to_date,
        basic, hra, gross, epf, pt, lop, ot_pay, net_salary,
        present_days, lop_days, approved_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
    `, [
      userId, month, from, to,
      salary.basic, salary.hra, salary.gross_salary,
      salary.epf_deduction, salary.pt_deduction, salary.lop_deduction,
      salary.ot_pay, salary.net_salary,
      attendance.present_days, attendance.lop_days, req.user.id
    ]);

    res.json({ msg: "Payroll approved and locked" });
  } catch (err) {
    console.error("APPROVE PAYROLL ERROR:", err);
    res.status(500).json({ msg: "Approval failed" });
  }
});

// ─── GET PAYROLL HISTORY ─────────────────────────────────────────────────
router.get("/history", verifyToken, isAdminOrSuper, async (req, res) => {
  try {
    const { userId, year } = req.query;

    let query = `
      SELECT
        ph.*,
        u.fullname,
        COALESCE(e.employee_uav_id, 'N/A') AS employee_uav_id
      FROM payroll_history ph
      JOIN users u ON ph.user_id = u.id
      LEFT JOIN employees e ON u.id = e.user_id
    `;

    const params = [];

    if (userId) {
      query += ` WHERE ph.user_id = $${params.length + 1}`;
      params.push(userId);
    }
    if (year) {
      query += (params.length > 0 ? " AND " : " WHERE ") + `ph.month LIKE $${params.length + 1}`;
      params.push(`${year}-%`);
    }

    query += " ORDER BY ph.month DESC";

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error("GET PAYROLL HISTORY ERROR:", err);
    res.status(500).json({ msg: "Error fetching payroll history" });
  }
});

// ─── UPDATE SALARY ───────────────────────────────────────────────────────
router.put("/salary/:id", verifyToken, superAdminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const { basic_salary, hra, epf_amount, pt_amount } = req.body;

    await pool.query(`
      UPDATE employees
      SET basic_salary = $1, hra = $2, epf_amount = $3, pt_amount = $4
      WHERE user_id = $5
    `, [basic_salary, hra, epf_amount, pt_amount, id]);

    res.json({ msg: "Salary updated successfully" });
  } catch (err) {
    console.error("UPDATE SALARY ERROR:", err);
    res.status(500).json({ msg: "Failed to update salary" });
  }
});

export default router;