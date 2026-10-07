import express from "express";
import pool from "../db.js";
import { verifyToken, isAdminOrSuper } from "../middleware/authMiddleware.js";

const router = express.Router();


const getUserId = (req) => req.user.id || req.user.employee_id;

const superAdminOnly = (req, res, next) => {
  if (req.user.role?.toLowerCase() !== "super_admin")
    return res.status(403).json({ msg: "Only Super Admin allowed" });
  next();
};

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
        AND u.status ILIKE 'active'
        AND e.status ILIKE 'active'
      ORDER BY e.employee_uav_id ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("GET EMPLOYEES ERROR:", err);
    res.status(500).json({ msg: "Error fetching employees" });
  }
});

router.get("/generate", verifyToken, isAdminOrSuper, async (req, res) => {
  try {
    const { userId, from, to } = req.query;
    if (!userId || !from || !to) return res.status(400).json({ msg: "Missing params" });

    const uid = parseInt(userId, 10);
    if (isNaN(uid)) return res.status(400).json({ msg: "Invalid user ID" });

    const empRes = await pool.query(`
      SELECT u.id, u.fullname, e.employee_uav_id, e.designation,
        COALESCE(e.basic_salary, 0) AS basic, COALESCE(e.hra, 0) AS hra,
        COALESCE(e.epf_amount, 0) AS epf, COALESCE(e.pt_amount, 0) AS pt
      FROM users u JOIN employees e ON u.id = e.user_id WHERE u.id = $1
    `, [uid]);
    if (empRes.rows.length === 0) return res.status(404).json({ msg: "Employee not found" });
    const emp = empRes.rows[0];

    const d1 = new Date(from);
    const d2 = new Date(to);
    const monthDiff = (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth()) + 1;
    const numMonths = Math.max(1, monthDiff);

    const startMonth = from.substring(0, 7);
    const endMonth = to.substring(0, 7);

    const approvedRes = await pool.query(`
      SELECT * FROM payroll_history 
      WHERE user_id = $1 AND month BETWEEN $2 AND $3
      ORDER BY month ASC
    `, [uid, startMonth, endMonth]);

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
    `, [from, to, uid]);
    const att = attRes.rows[0] || {};

    let basic = Number(emp.basic) * numMonths;
    let hra = Number(emp.hra) * numMonths;
    let epf = Number(emp.epf) * numMonths;
    let pt = Number(emp.pt) * numMonths;
    let grossFixed = basic + hra;

    const totalCalDays = Number(att.total_calendar_days) || (30 * numMonths);
    const dailyRate = totalCalDays > 0 ? grossFixed / totalCalDays : 0;
    const lopDays = Number(att.unpaid_days || 0) + (Number(att.half_days || 0) * 0.5);
    const lopDeduction = Math.round(dailyRate * lopDays);
    let otPay = Math.round(((grossFixed / numMonths) / 30 / 8) * Number(att.ot_hours || 0));

    if (approvedRes.rows.length > 0 && approvedRes.rows.length === numMonths) {
      basic = approvedRes.rows.reduce((sum, r) => sum + Number(r.basic), 0);
      hra = approvedRes.rows.reduce((sum, r) => sum + Number(r.hra), 0);
      grossFixed = approvedRes.rows.reduce((sum, r) => sum + Number(r.gross), 0);
      epf = approvedRes.rows.reduce((sum, r) => sum + Number(r.epf), 0);
      pt = approvedRes.rows.reduce((sum, r) => sum + Number(r.pt), 0);
      otPay = approvedRes.rows.reduce((sum, r) => sum + Number(r.ot_pay || 0), 0);
    }

    const totalDeductions = epf + pt + lopDeduction;
    const netSalary = Math.max((grossFixed + otPay) - totalDeductions, 0);

    const year = from.substring(0, 4);
    const ytdRes = await pool.query(`
      SELECT
        COALESCE(SUM(gross), 0)          AS ytd_gross,
        COALESCE(SUM(epf + pt + lop), 0) AS ytd_deductions,
        COALESCE(SUM(net_salary), 0)     AS ytd_net
      FROM payroll_history
      WHERE user_id = $1 AND month LIKE $2
    `, [uid, `${year}-%`]);
    const ytd = ytdRes.rows[0] || { ytd_gross: 0, ytd_deductions: 0, ytd_net: 0 };

    const monthStr = numMonths > 1 ? `${startMonth} to ${endMonth}` : startMonth;
    const checkApproved = approvedRes.rows.length > 0 && approvedRes.rows.length === numMonths;

    res.json({
      employee: emp,
      period: { from, to, month: monthStr, numMonths, startMonth, endMonth },
      salary: {
        basic: basic,
        hra: hra,
        gross_salary: grossFixed,
        epf_deduction: epf,
        pt_deduction: pt,
        lop_deduction: lopDeduction,
        ot_pay: otPay,
        total_deductions: totalDeductions,
        net_salary: netSalary
      },
      attendance: {
        working_days: totalCalDays,
        present_days: Number(att.present_days || 0),
        half_days: Number(att.half_days || 0),
        lop_days: lopDays,
        ot_hours: Number(att.ot_hours || 0)
      },
      cumulative: {
        ytd_gross: Number(ytd.ytd_gross),
        ytd_deductions: Number(ytd.ytd_deductions),
        ytd_net: Number(ytd.ytd_net)
      },
      is_approved: checkApproved
    });
  } catch (err) {
    console.error("GENERATE PAYSLIP ERROR:", err);
    res.status(500).json({ msg: err.message });
  }
});

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
      attendance.present_days, attendance.lop_days, getUserId(req)
    ]);

    res.json({ msg: "Payroll approved and locked" });
  } catch (err) {
    console.error("APPROVE PAYROLL ERROR:", err);
    res.status(500).json({ msg: "Approval failed" });
  }
});

router.delete("/unlock", verifyToken, superAdminOnly, async (req, res) => {
  try {
    const { userId, month } = req.query;
    if (!userId || !month) return res.status(400).json({ msg: "Missing userId or month" });

    const result = await pool.query(
      "DELETE FROM payroll_history WHERE user_id = $1 AND month = $2 RETURNING id",
      [parseInt(userId, 10), month]
    );

    if (result.rowCount === 0)
      return res.status(404).json({ msg: "No approved record found for this month" });

    res.json({ msg: `Payroll for ${month} unlocked. You can now re-edit attendance and re-approve.` });
  } catch (err) {
    console.error("UNLOCK PAYROLL ERROR:", err);
    res.status(500).json({ msg: "Failed to unlock payroll" });
  }
});

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


router.get("/my", verifyToken, async (req, res) => {
  try {
    const userId = getUserId(req);
    const { from, to } = req.query;

    let query = `
      SELECT
        ph.*,
        u.fullname,
        COALESCE(e.employee_uav_id, 'N/A') AS employee_uav_id
      FROM payroll_history ph
      JOIN users u ON ph.user_id = u.id
      LEFT JOIN employees e ON u.id = e.user_id
      WHERE ph.user_id = $1
    `;
    const params = [userId];

    if (from && to) {
      const startMonth = from.substring(0, 7);
      const endMonth = to.substring(0, 7);
      query += ` AND ph.month BETWEEN $2 AND $3`;
      params.push(startMonth, endMonth);
    }

    query += " ORDER BY ph.month DESC";

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error("GET MY PAYROLL HISTORY ERROR:", err);
    res.status(500).json({ msg: "Error fetching my payroll history" });
  }
});

router.put("/salary/:id", verifyToken, superAdminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const { basic_salary, hra, epf_amount, pt_amount } = req.body;

    const uid = parseInt(id, 10);
    const b = Number(basic_salary || 0);
    const h = Number(hra || 0);
    const ep = Number(epf_amount || 0);
    const p = Number(pt_amount || 0);
    const g = b + h;

    await pool.query(`
      UPDATE employees
      SET basic_salary = $1, hra = $2, epf_amount = $3, pt_amount = $4
      WHERE user_id = $5
    `, [b, h, ep, p, uid]);

    await pool.query(`
      UPDATE payroll_history
      SET basic = $1, hra = $2, gross = $3, epf = $4, pt = $5,
          net_salary = GREATEST(($3 + ot_pay) - ($4 + $5 + lop), 0)
      WHERE user_id = $6
    `, [b, h, g, ep, p, uid]);

    res.json({ msg: "Salary updated successfully" });
  } catch (err) {
    console.error("UPDATE SALARY ERROR:", err);
    res.status(500).json({ msg: "Failed to update salary" });
  }
});

export default router;