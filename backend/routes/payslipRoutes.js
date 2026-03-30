import express from "express";
import pool from "../db.js";
import { verifyToken, isAdminOrSuper } from "../middleware/authMiddleware.js";

const router = express.Router();

const superAdminOnly = (req, res, next) => {
  if (req.user.role?.toLowerCase() !== "super_admin")
    return res.status(403).json({ msg: "Only Super Admin allowed" });
  next();
};

// ─── GET EMPLOYEES LIST (admin + super_admin for payslip request dropdown) ─
router.get("/employees", verifyToken, isAdminOrSuper, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        u.id,
        u.fullname,
        e.employee_uav_id,
        e.designation,
        COALESCE(e.basic_salary, 0) AS basic_salary,
        COALESCE(e.hra,          0) AS hra,
        COALESCE(e.epf_amount,   0) AS epf_amount,
        COALESCE(e.pt_amount,    0) AS pt_amount
      FROM users u
      JOIN employees e ON u.id = e.user_id
      WHERE u.role = 'employee'
      ORDER BY e.employee_uav_id ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Error fetching employees" });
  }
});

// ─── UPDATE SALARY (super_admin only) ────────────────────────────────────
router.put("/salary/:userId", verifyToken, superAdminOnly, async (req, res) => {
  try {
    const { basic_salary, hra, epf_amount, pt_amount } = req.body;
    const { userId } = req.params;

    await pool.query(`
      UPDATE employees
      SET basic_salary = $1, hra = $2, epf_amount = $3, pt_amount = $4
      WHERE user_id = $5
    `, [
      Number(basic_salary)  || 0,
      Number(hra)           || 0,
      Number(epf_amount)    || 0,
      Number(pt_amount)     || 0,
      userId
    ]);

    res.json({ msg: "Salary updated successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Error updating salary" });
  }
});

// ─── GENERATE PAYSLIP (super_admin only) ─────────────────────────────────
router.get("/generate", verifyToken, superAdminOnly, async (req, res) => {
  try {
    const { userId, from, to } = req.query;

    if (!userId || !from || !to)
      return res.status(400).json({ msg: "userId, from, to are required" });

    const empRes = await pool.query(`
      SELECT
        u.id, u.fullname,
        e.employee_uav_id, e.designation,
        COALESCE(e.basic_salary, 0) AS basic_salary,
        COALESCE(e.hra,          0) AS hra,
        COALESCE(e.epf_amount,   0) AS epf_amount,
        COALESCE(e.pt_amount,    0) AS pt_amount
      FROM users u
      JOIN employees e ON u.id = e.user_id
      WHERE u.id = $1
    `, [userId]);

    if (empRes.rows.length === 0)
      return res.status(404).json({ msg: "Employee not found" });

    const emp = empRes.rows[0];

    const attRes = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'Present')::int              AS present_days,
        COUNT(*) FILTER (WHERE status = '0.5')::int                  AS half_days,
        COUNT(*) FILTER (WHERE status IN ('CL','SL','CCL'))::int     AS leave_days,
        COUNT(*) FILTER (WHERE status = 'Absent')::int               AS absent_days,
        COUNT(*) FILTER (WHERE status = 'LOP')::int                  AS lop_days,
        ($2::date - $1::date + 1)::int                               AS range_days
      FROM attendance
      WHERE user_id = $3
        AND attendance_date BETWEEN $1::date AND $2::date
    `, [from, to, userId]);

    const att = attRes.rows[0];

    const basic       = Number(emp.basic_salary);
    const hra         = Number(emp.hra);
    const grossSalary = basic + hra;

    const workingDays  = att.range_days;
    const lopDays      = Number(att.lop_days) + Number(att.absent_days);

    const lopDeduction = workingDays > 0
      ? Math.round((grossSalary / workingDays) * lopDays)
      : 0;

    const epfDeduction    = Number(emp.epf_amount);
    const ptDeduction     = Number(emp.pt_amount);
    const totalDeductions = epfDeduction + ptDeduction + lopDeduction;
    const netSalary       = Math.max(grossSalary - totalDeductions, 0);

    res.json({
      employee: {
        id:              emp.id,
        fullname:        emp.fullname,
        employee_uav_id: emp.employee_uav_id,
        designation:     emp.designation || "Employee",
      },
      period: { from, to },
      salary: {
        basic,
        hra,
        gross_salary:     grossSalary,
        epf_deduction:    epfDeduction,
        pt_deduction:     ptDeduction,
        lop_deduction:    lopDeduction,
        total_deductions: totalDeductions,
        net_salary:       netSalary,
      },
      attendance: {
        working_days: workingDays,
        present_days: att.present_days,
        half_days:    att.half_days,
        leave_days:   att.leave_days,
        absent_days:  att.absent_days,
        lop_days:     lopDays,
      }
    });
  } catch (err) {
    console.error("PAYSLIP GENERATE ERROR:", err);
    res.status(500).json({ msg: err.message });
  }
});

// ─── EMPLOYEE: View own payslip ───────────────────────────────────────────
router.get("/my", verifyToken, async (req, res) => {
  try {
    const { from, to } = req.query;
    const userId = req.user.id;

    if (!from || !to)
      return res.status(400).json({ msg: "from and to dates are required" });

    const empRes = await pool.query(`
      SELECT u.id, u.fullname, e.employee_uav_id, e.designation,
        COALESCE(e.basic_salary, 0) AS basic_salary,
        COALESCE(e.hra, 0) AS hra,
        COALESCE(e.epf_amount, 0) AS epf_amount,
        COALESCE(e.pt_amount, 0) AS pt_amount
      FROM users u JOIN employees e ON u.id = e.user_id
      WHERE u.id = $1
    `, [userId]);

    if (empRes.rows.length === 0)
      return res.status(404).json({ msg: "Employee profile not found" });

    const emp = empRes.rows[0];

    const attRes = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'Present')::int          AS present_days,
        COUNT(*) FILTER (WHERE status = '0.5')::int              AS half_days,
        COUNT(*) FILTER (WHERE status IN ('CL','SL','CCL'))::int AS leave_days,
        COUNT(*) FILTER (WHERE status = 'Absent')::int           AS absent_days,
        COUNT(*) FILTER (WHERE status = 'LOP')::int              AS lop_days,
        ($2::date - $1::date + 1)::int                           AS range_days
      FROM attendance
      WHERE user_id = $3 AND attendance_date BETWEEN $1::date AND $2::date
    `, [from, to, userId]);

    const att = attRes.rows[0];
    const basic = Number(emp.basic_salary);
    const hra   = Number(emp.hra);
    const gross = basic + hra;
    const lop   = Number(att.lop_days) + Number(att.absent_days);
    const lopDed = att.range_days > 0 ? Math.round((gross / att.range_days) * lop) : 0;
    const totalDed = Number(emp.epf_amount) + Number(emp.pt_amount) + lopDed;

    res.json({
      employee: { fullname: emp.fullname, employee_uav_id: emp.employee_uav_id, designation: emp.designation },
      period: { from, to },
      salary: {
        basic, hra, gross_salary: gross,
        epf_deduction: Number(emp.epf_amount),
        pt_deduction: Number(emp.pt_amount),
        lop_deduction: lopDed,
        total_deductions: totalDed,
        net_salary: Math.max(gross - totalDed, 0),
      },
      attendance: {
        working_days: att.range_days,
        present_days: att.present_days,
        half_days: att.half_days,
        leave_days: att.leave_days,
        absent_days: att.absent_days,
        lop_days: lop,
      }
    });
  } catch (err) {
    console.error("MY PAYSLIP ERROR:", err);
    res.status(500).json({ msg: err.message });
  }
});

export default router;