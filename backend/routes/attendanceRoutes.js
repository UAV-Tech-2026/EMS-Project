import express from "express";
import pool from "../db.js";
import multer from "multer";
import ExcelJS from "exceljs";
import { verifyToken, isAdminOrSuper } from "../middleware/authMiddleware.js";

const router = express.Router();
const upload = multer({ dest: "uploads/" });

// ─── HELPER: Calculate hours worked ──────────────────────────────────────
function calcHours(checkIn, checkOut) {
  if (!checkIn || !checkOut) return "";
  try {
    const [inH,  inM]  = checkIn.split(":").map(Number);
    const [outH, outM] = checkOut.split(":").map(Number);
    const totalMins = (outH * 60 + outM) - (inH * 60 + inM);
    if (totalMins <= 0) return "";
    return `${Math.floor(totalMins / 60)}h ${totalMins % 60}m`;
  } catch {
    return "";
  }
}

// ─── GET ALL ATTENDANCE (admin + super_admin) ─────────────────────────────
// Both admin and super_admin see ALL attendance records
router.get("/", verifyToken, isAdminOrSuper, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        a.id,
        a.employee_uav_id  AS employee_code,
        u.fullname         AS name,
        a.attendance_date  AS date,
        a.check_in,
        a.check_out,
        a.status,
        a.hours_worked,
        m.fullname         AS marked_by_name
      FROM attendance a
      JOIN users u ON a.user_id = u.id
      LEFT JOIN users m ON a.marked_by = m.id
      ORDER BY a.attendance_date DESC, a.check_in DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("GET ALL ATTENDANCE ERROR:", err);
    res.status(500).json({ msg: "Server error" });
  }
});

// ─── GET EMPLOYEES LIST FOR ATTENDANCE (admin + super_admin) ─────────────
router.get("/employees-list", verifyToken, isAdminOrSuper, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT u.id, u.fullname, e.employee_uav_id
      FROM users u
      JOIN employees e ON u.id = e.user_id
      WHERE u.role IN ('employee', 'intern')
      ORDER BY e.employee_uav_id ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("EMPLOYEES LIST ERROR:", err);
    res.status(500).json({ msg: "Error fetching list" });
  }
});

// ─── GET TODAY'S ATTENDANCE (admin + super_admin) ─────────────────────────
router.get("/today", verifyToken, isAdminOrSuper, async (req, res) => {
  try {
    const { date } = req.query;
    const result = await pool.query(
      `SELECT user_id, status, check_in, check_out, hours_worked
       FROM attendance WHERE attendance_date = $1`,
      [date]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("TODAY ATTENDANCE ERROR:", err);
    res.status(500).json({ msg: "Error fetching records" });
  }
});

// ─── MANUAL ATTENDANCE ENTRY (admin + super_admin) ───────────────────────
router.post("/manual", verifyToken, isAdminOrSuper, async (req, res) => {
  try {
    const { user_id, status, check_in, check_out } = req.body;
    const attendance_date = new Date().toISOString().split("T")[0];

    const userRes = await pool.query(
      "SELECT employee_uav_id FROM employees WHERE user_id = $1", [user_id]
    );
    if (userRes.rows.length === 0)
      return res.status(404).json({ msg: "Employee profile not found" });

    const employee_uav_id = userRes.rows[0].employee_uav_id;
    const hours_worked = calcHours(check_in, check_out);

    const result = await pool.query(
      `INSERT INTO attendance (employee_uav_id, attendance_date, check_in, check_out, status, user_id, marked_by, hours_worked)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (user_id, attendance_date) DO UPDATE SET
         check_in     = EXCLUDED.check_in,
         check_out    = EXCLUDED.check_out,
         status       = EXCLUDED.status,
         marked_by    = EXCLUDED.marked_by,
         hours_worked = EXCLUDED.hours_worked
       RETURNING *`,
      [employee_uav_id, attendance_date, check_in || null, check_out || null,
       status || "Present", user_id, req.user.id, hours_worked || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("MANUAL ATTENDANCE ERROR:", err);
    res.status(500).json({ msg: err.message });
  }
});

// ─── BULK ATTENDANCE (admin + super_admin) ────────────────────────────────
router.post("/bulk-log", verifyToken, isAdminOrSuper, async (req, res) => {
  const { date, records } = req.body;
  const client = await pool.connect();
  try {
    const today = new Date().toISOString().split("T")[0];
    if (date !== today)
      return res.status(400).json({ msg: "Bulk entry only allowed for the current date." });

    await client.query("BEGIN");

    for (let record of records) {
      const isTimeFrozen = ["CL", "SL", "Absent", "LOP"].includes(record.status);
      const checkIn      = isTimeFrozen ? null : record.check_in;
      const checkOut     = isTimeFrozen ? null : record.check_out;
      const hoursWorked  = isTimeFrozen ? null : calcHours(checkIn, checkOut);

      await client.query(
        `INSERT INTO attendance (user_id, employee_uav_id, attendance_date, status, check_in, check_out, marked_by, hours_worked)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (user_id, attendance_date) DO UPDATE SET
           status       = EXCLUDED.status,
           check_in     = EXCLUDED.check_in,
           check_out    = EXCLUDED.check_out,
           marked_by    = EXCLUDED.marked_by,
           hours_worked = EXCLUDED.hours_worked`,
        [record.user_id, record.employee_uav_id, date,
         record.status, checkIn, checkOut, req.user.id, hoursWorked]
      );
    }

    await client.query("COMMIT");
    res.json({ msg: "Attendance saved successfully" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("BULK LOG ERROR:", err);
    res.status(500).json({ msg: err.message });
  } finally {
    client.release();
  }
});

// ─── EMPLOYEE: Self Check-In ──────────────────────────────────────────────
router.post("/check-in", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const today  = new Date().toISOString().split("T")[0];
    const time   = new Date().toLocaleTimeString("en-GB");

    const empRes = await pool.query(
      "SELECT employee_uav_id FROM employees WHERE user_id=$1", [userId]
    );
    if (empRes.rows.length === 0)
      return res.status(404).json({ msg: "Employee profile not found" });

    await pool.query(
      `INSERT INTO attendance (user_id, employee_uav_id, attendance_date, check_in, status, hours_worked)
       VALUES ($1,$2,$3,$4,'Present','')
       ON CONFLICT (user_id, attendance_date)
       DO UPDATE SET check_in = COALESCE(attendance.check_in, EXCLUDED.check_in)`,
      [userId, empRes.rows[0].employee_uav_id, today, time]
    );
    res.json({ msg: "Morning check-in saved", time });
  } catch (err) {
    console.error("CHECK-IN ERROR:", err);
    res.status(500).json({ msg: err.message });
  }
});

// ─── EMPLOYEE: Self Check-Out ─────────────────────────────────────────────
router.post("/check-out", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const today  = new Date().toISOString().split("T")[0];
    const time   = new Date().toLocaleTimeString("en-GB");

    const existing = await pool.query(
      "SELECT check_in FROM attendance WHERE user_id=$1 AND attendance_date=$2",
      [userId, today]
    );
    if (existing.rows.length === 0)
      return res.status(400).json({ msg: "Please check-in first" });

    const hoursWorked = calcHours(existing.rows[0].check_in, time);

    await pool.query(
      `UPDATE attendance SET check_out=$1, hours_worked=$2
       WHERE user_id=$3 AND attendance_date=$4`,
      [time, hoursWorked, userId, today]
    );
    res.json({ msg: "Evening check-out updated", hours_worked: hoursWorked });
  } catch (err) {
    console.error("CHECK-OUT ERROR:", err);
    res.status(500).json({ msg: err.message });
  }
});

// ─── EMPLOYEE: View own attendance ────────────────────────────────────────
router.get("/my", verifyToken, async (req, res) => {
  try {
    const { from, to } = req.query;
    const userId = req.user.id;

    let query = `
      SELECT attendance_date AS date, check_in, check_out, status, hours_worked
      FROM attendance WHERE user_id = $1
    `;
    const params = [userId];

    if (from && to) {
      query += " AND attendance_date BETWEEN $2 AND $3";
      params.push(from, to);
    }
    query += " ORDER BY attendance_date DESC";

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error("MY ATTENDANCE ERROR:", err);
    res.status(500).json({ msg: "Server error" });
  }
});

// ─── EMPLOYEE: Get own attendance statistics ─────────────────────────────
router.get("/stats/my", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'Present')::int AS present_count,
        COUNT(*) FILTER (WHERE status = 'Absent')::int  AS absent_count,
        COUNT(*) FILTER (WHERE status IN ('CL','SL','CCL'))::int AS leave_count
      FROM attendance
      WHERE user_id = $1
    `, [userId]);

    res.json({
      presentCount: result.rows[0].present_count,
      absentCount:  result.rows[0].absent_count,
      leaveCount:   result.rows[0].leave_count
    });
  } catch (err) {
    console.error("MY STATS ERROR:", err);
    res.status(500).json({ msg: "Server error" });
  }
});

// ─── EXPORT EXCEL (admin + super_admin) ──────────────────────────────────
const NAVY  = "1a3a6b";
const GREEN = "C6EFCE";
const RED   = "FFC7CE";
const YELLOW= "FFEB9C";
const BLUE  = "BDD7EE";
const GRAY  = "F2F2F2";

function thinBorder() {
  const s = { style: "thin", color: { argb: "FFAAAAAA" } };
  return { top: s, left: s, bottom: s, right: s };
}

function applyHeaderRow(ws, headers, widths, rowNum) {
  const row = ws.getRow(rowNum);
  headers.forEach((h, i) => {
    const cell     = row.getCell(i + 1);
    cell.value     = h;
    cell.font      = { bold: true, color: { argb: "FFFFFFFF" }, name: "Arial", size: 10 };
    cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + NAVY } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border    = thinBorder();
    if (widths[i]) ws.getColumn(i + 1).width = widths[i];
  });
  row.height = 36;
}

function applyGrandTotal(ws, rowNum, values, colCount) {
  const row = ws.getRow(rowNum);
  values.forEach((val, i) => {
    const cell     = row.getCell(i + 1);
    cell.value     = val;
    cell.font      = { bold: true, name: "Arial", size: 10, color: { argb: "FFFFFFFF" } };
    cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + NAVY } };
    cell.alignment = { horizontal: i === 0 ? "left" : "center", vertical: "middle" };
    cell.border    = thinBorder();
  });
  row.height = 20;
}

router.get("/export-excel", verifyToken, isAdminOrSuper, async (req, res) => {
  try {
    const { from: fromDate, to: toDate } = req.query;
    if (!fromDate || !toDate)
      return res.status(400).json({ msg: "from and to dates are required" });

    const rangeLabel = `${fromDate} TO ${toDate}`;
    const params     = [fromDate, toDate];

    const summaryRes = await pool.query(`
      SELECT
        u.fullname                                                             AS emp_name,
        e.employee_uav_id                                                     AS emp_id,
        ($2::date - $1::date + 1)::int                                        AS total_days,
        COUNT(*) FILTER (WHERE a.status = 'Present')::int                    AS present_days,
        COUNT(*) FILTER (WHERE a.status = '0.5')::int                        AS half_days,
        COUNT(*) FILTER (WHERE a.status = 'Field Work')::int                 AS field_work,
        COUNT(*) FILTER (WHERE a.status = 'CL')::int                         AS cl_used,
        COUNT(*) FILTER (WHERE a.status = 'SL')::int                         AS sl_used,
        COUNT(*) FILTER (WHERE a.status = 'CCL')::int                        AS ccl_used,
        COUNT(*) FILTER (WHERE a.status = 'Absent')::int                     AS absent_days,
        COUNT(*) FILTER (WHERE a.status = 'LOP')::int                        AS lop_days,
        e.total_cl                                                             AS cl_allotted,
        e.total_sl                                                             AS sl_allotted,
        GREATEST(e.total_cl - COUNT(*) FILTER (WHERE a.status = 'CL'), 0)::int   AS cl_balance,
        GREATEST(e.total_sl - COUNT(*) FILTER (WHERE a.status = 'SL'), 0)::int   AS sl_balance
      FROM employees e
      JOIN users u ON e.user_id = u.id
      LEFT JOIN attendance a
        ON e.user_id = a.user_id
        AND a.attendance_date BETWEEN $1::date AND $2::date
      GROUP BY u.fullname, e.employee_uav_id, e.total_cl, e.total_sl
      ORDER BY e.employee_uav_id ASC
    `, params);

    const logRes = await pool.query(`
      SELECT
        u.fullname                               AS emp_name,
        a.employee_uav_id                        AS emp_id,
        TO_CHAR(a.attendance_date, 'YYYY-MM-DD') AS att_date,
        COALESCE(a.check_in::text,  '')          AS check_in,
        COALESCE(a.check_out::text, '')          AS check_out,
        COALESCE(a.hours_worked,    '')          AS hours_worked,
        a.status
      FROM attendance a
      JOIN users u ON a.user_id = u.id
      WHERE a.attendance_date BETWEEN $1::date AND $2::date
      ORDER BY a.attendance_date ASC, a.employee_uav_id ASC
    `, params);

    const wb  = new ExcelJS.Workbook();
    const ws1 = wb.addWorksheet("Monthly Summary");

    ws1.mergeCells("A1:P1");
    const t1     = ws1.getCell("A1");
    t1.value     = `MONTHLY ATTENDANCE SUMMARY — ${rangeLabel}`;
    t1.font      = { bold: true, color: { argb: "FFFFFFFF" }, name: "Arial", size: 13 };
    t1.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + NAVY } };
    t1.alignment = { horizontal: "center", vertical: "middle" };
    ws1.getRow(1).height = 28;

    applyHeaderRow(ws1, [
      "Employee Name","Emp ID","Total Days","Present Days","Half Days","Field Work",
      "CL Used","SL Used","CCL Used","Absent Days","LOP Days",
      "CL Allotted","SL Allotted","CL Balance","SL Balance"
    ], [22,13,10,9,8,8,7,7,7,9,7,10,10,10,10], 2);

    ws1.views = [{ state: "frozen", ySplit: 2 }];

    summaryRes.rows.forEach((r, ri) => {
      const values = [
        r.emp_name, r.emp_id, r.total_days,
        r.present_days, r.half_days, r.field_work,
        r.cl_used, r.sl_used, r.ccl_used,
        r.absent_days, r.lop_days,
        r.cl_allotted, r.sl_allotted,
        r.cl_balance, r.sl_balance
      ];
      const exRow = ws1.getRow(ri + 3);
      values.forEach((val, ci0) => {
        const cell     = exRow.getCell(ci0 + 1);
        cell.value     = val;
        cell.border    = thinBorder();
        cell.font      = { name: "Arial", size: 10 };
        cell.alignment = { horizontal: ci0 === 0 ? "left" : "center", vertical: "middle" };
        cell.fill      = { type: "pattern", pattern: "solid",
          fgColor: { argb: "FF" + (ri % 2 === 0 ? GRAY : "FFFFFF") } };
      });
      exRow.height = 18;
    });

    const ws2 = wb.addWorksheet("Daily Logs");
    ws2.mergeCells("A1:G1");
    const t2     = ws2.getCell("A1");
    t2.value     = `DAILY ATTENDANCE LOGS — ${rangeLabel}`;
    t2.font      = { bold: true, color: { argb: "FFFFFFFF" }, name: "Arial", size: 13 };
    t2.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + NAVY } };
    t2.alignment = { horizontal: "center", vertical: "middle" };
    ws2.getRow(1).height = 28;

    applyHeaderRow(ws2,
      ["Employee Name","Employee ID","Date","Check In","Check Out","Hours Worked","Status"],
      [22, 13, 13, 13, 13, 14, 12], 2
    );
    ws2.views = [{ state: "frozen", ySplit: 2 }];

    const logStatusFill = {
      "Present": GREEN, "0.5": GREEN, "Field Work": BLUE,
      "CCL": BLUE, "CL": YELLOW, "SL": YELLOW, "Absent": RED, "LOP": RED,
    };

    logRes.rows.forEach((r, ri) => {
      const fill  = logStatusFill[r.status] || "FFFFFF";
      const exRow = ws2.getRow(ri + 3);
      [r.emp_name, r.emp_id, r.att_date, r.check_in, r.check_out, r.hours_worked, r.status]
        .forEach((val, ci0) => {
          const cell     = exRow.getCell(ci0 + 1);
          cell.value     = val;
          cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + fill } };
          cell.border    = thinBorder();
          cell.font      = { bold: ci0 === 6, name: "Arial", size: 10 };
          cell.alignment = { horizontal: ci0 === 0 ? "left" : "center", vertical: "middle" };
        });
      exRow.height = 18;
    });

    const filename = `Attendance_${rangeLabel.replace(/ /g, "_")}.xlsx`;
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("EXPORT ERROR:", err);
    res.status(500).json({ msg: "Export failed", error: err.message });
  }
});

export default router;