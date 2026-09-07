import express from "express";
import pool from "../db.js";
import multer from "multer";
import ExcelJS from "exceljs";
import { verifyToken, isAdminOrSuper, canReadFeature } from "../middleware/authMiddleware.js";
import axios from "axios";
import { parseAttendanceExcel } from "../utils/excelParser.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });


function calcHours(checkIn, checkOut) {
  if (!checkIn || !checkOut) return "";
  try {
    const [inH, inM] = checkIn.split(":").map(Number);
    const [outH, outM] = checkOut.split(":").map(Number);
    const totalMins = (outH * 60 + outM) - (inH * 60 + inM);
    if (totalMins <= 0) return "";
    return `${Math.floor(totalMins / 60)}h ${totalMins % 60}m`;
  } catch {
    return "";
  }
}


function to12h(timeStr) {
  if (!timeStr) return "";
  try {
    const [h, m] = timeStr.split(":").map(Number);
    const ampm = h >= 12 ? "PM" : "AM";
    const hour = h % 12 || 12;
    return `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
  } catch {
    return timeStr;
  }
}


router.get("/", verifyToken, isAdminOrSuper, async (req, res) => {
  try {
    let query = `
      SELECT
        a.id,
        a.employee_uav_id  AS employee_code,
        u.fullname         AS name,
        a.attendance_date  AS date,
        a.check_in, a.check_out, a.status, a.hours_worked,
        m.fullname         AS marked_by_name
      FROM attendance a
      JOIN users u ON a.user_id = u.id
      LEFT JOIN users m ON a.marked_by = m.id
    `;
    const params = [];

    if (req.user.role !== "super_admin") {
      const deptRes = await pool.query("SELECT department FROM users WHERE id=$1", [req.user.id]);
      const dept = deptRes.rows[0]?.department;
      if (dept) {
        const isHR = dept.toLowerCase().includes("hr") || dept.toLowerCase() === "operations";
        if (!isHR) {
          query += ` WHERE u.department = $1`;
          params.push(dept);
        }
      }
    }

    query += ` ORDER BY a.attendance_date DESC, a.check_in DESC`;
    const result = await pool.query(query, params);
    const rows = result.rows.map(r => ({
      ...r, check_in: to12h(r.check_in), check_out: to12h(r.check_out)
    }));
    res.json(rows);
  } catch (err) {
    console.error("GET ALL ATTENDANCE ERROR:", err);
    res.status(500).json({ msg: "Server error" });
  }
});


router.get("/employees-list", verifyToken, isAdminOrSuper, async (req, res) => {
  try {
    let query = `
      SELECT u.id, u.fullname, u.role, u.department, e.employee_uav_id
      FROM users u
      LEFT JOIN employees e ON u.id = e.user_id
      WHERE u.role IN ('employee', 'intern', 'admin', 'super_admin')
    `;
    const params = [];

    if (req.user.role !== "super_admin") {
      const permRes = await pool.query(
        "SELECT can_write FROM user_permissions WHERE user_id=$1 AND feature_name='attendance'",
        [req.user.id]
      );
      const hasAttendanceWrite = permRes.rows[0]?.can_write === true;

      if (!hasAttendanceWrite) {
       
        const deptRes = await pool.query("SELECT department FROM users WHERE id=$1", [req.user.id]);
        const dept = deptRes.rows[0]?.department;
        if (dept) {
          const isHR = dept.toLowerCase().includes("hr") || dept.toLowerCase() === "operations";
          if (!isHR) {
            query += ` AND u.department = $1`;
            params.push(dept);
          }
        }
      }
      
    }

    query += ` ORDER BY CASE u.role
      WHEN 'super_admin' THEN 1 WHEN 'admin' THEN 2
      WHEN 'employee' THEN 4 WHEN 'intern' THEN 5 END, u.fullname ASC`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error("EMPLOYEES LIST ERROR:", err);
    res.status(500).json({ msg: "Error fetching list" });
  }
});


router.get("/today", verifyToken, isAdminOrSuper, async (req, res) => {
  try {
    const { date } = req.query;
    const params = [date];
    let deptJoin = "";
    let deptClause = "";

    if (req.user.role !== "super_admin") {
      
      const permRes = await pool.query(
        "SELECT can_write FROM user_permissions WHERE user_id=$1 AND feature_name='attendance'",
        [req.user.id]
      );
      const hasAttendanceWrite = permRes.rows[0]?.can_write === true;

      if (!hasAttendanceWrite) {
        const deptRes = await pool.query(
          "SELECT department FROM users WHERE id = $1", [req.user.id]
        );
        const dept = deptRes.rows[0]?.department;
        if (dept) {
          const isHR = dept.toLowerCase().includes("hr") || dept.toLowerCase() === "operations";
          if (!isHR) {
            deptJoin = " JOIN users u ON a.user_id = u.id";
            params.push(dept);
            deptClause = ` AND u.department = $${params.length}`;
          }
        }
      }
     
    }

    const result = await pool.query(
      `SELECT a.user_id, a.status, a.check_in, a.check_out, a.hours_worked, a.ot_hours
       FROM attendance a
       ${deptJoin}
       WHERE a.attendance_date = $1${deptClause}`,
      params
    );
    const rows = result.rows.map((r) => ({
      ...r,
      check_in: to12h(r.check_in),
      check_out: to12h(r.check_out),
    }));
    res.json(rows);
  } catch (err) {
    console.error("TODAY ATTENDANCE ERROR:", err);
    res.status(500).json({ msg: "Error fetching records" });
  }
});


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
      `INSERT INTO attendance
         (employee_uav_id, attendance_date, check_in, check_out, status, user_id, marked_by, hours_worked)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (user_id, attendance_date) DO UPDATE SET
         check_in     = EXCLUDED.check_in,
         check_out    = EXCLUDED.check_out,
         status       = EXCLUDED.status,
         marked_by    = EXCLUDED.marked_by,
         hours_worked = EXCLUDED.hours_worked
       RETURNING *`,
      [employee_uav_id, attendance_date,
        check_in || null, check_out || null,
        status || "Present", user_id, req.user.id, hours_worked || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("MANUAL ATTENDANCE ERROR:", err);
    res.status(500).json({ msg: err.message });
  }
});


router.post("/bulk-log", verifyToken, isAdminOrSuper, async (req, res) => {
  const { date, records } = req.body;
  const client = await pool.connect();
  try {
    const today = new Date().toISOString().split("T")[0];
    if (date !== today)
      return res.status(400).json({ msg: "Bulk entry only allowed for the current date." });

    await client.query("BEGIN");

    for (const record of records) {
      const isTimeFrozen = ["CL", "SL", "Absent", "LOP"].includes(record.status);
      const checkIn = isTimeFrozen ? null : record.check_in;
      const checkOut = isTimeFrozen ? null : record.check_out;
      const hoursWorked = isTimeFrozen ? null : calcHours(checkIn, checkOut);

      await client.query(
        `INSERT INTO attendance
           (user_id, employee_uav_id, attendance_date, status, check_in, check_out, marked_by, hours_worked, ot_hours)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (user_id, attendance_date) DO UPDATE SET
           status       = EXCLUDED.status,
           check_in     = EXCLUDED.check_in,
           check_out    = EXCLUDED.check_out,
           marked_by    = EXCLUDED.marked_by,
           hours_worked = EXCLUDED.hours_worked,
           ot_hours     = EXCLUDED.ot_hours`,
        [record.user_id, record.employee_uav_id, date,
        record.status, checkIn, checkOut, req.user.id, hoursWorked, record.ot_hours || 0]
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


router.post("/check-in", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const today = new Date().toISOString().split("T")[0];
    const time = new Date().toLocaleTimeString("en-GB"); // 24h for DB storage

    const empRes = await pool.query(
      "SELECT employee_uav_id FROM employees WHERE user_id=$1", [userId]
    );
    if (empRes.rows.length === 0)
      return res.status(404).json({ msg: "Employee profile not found" });

    const isLate = time > "10:20:00";
    const status = isLate ? "0.5 LOP" : "Present";

    await pool.query(
      `INSERT INTO attendance (user_id, employee_uav_id, attendance_date, check_in, status, hours_worked)
       VALUES ($1,$2,$3,$4,$5,'')
       ON CONFLICT (user_id, attendance_date)
       DO UPDATE SET check_in = COALESCE(attendance.check_in, EXCLUDED.check_in)`,
      [userId, empRes.rows[0].employee_uav_id, today, time, status]
    );
    res.json({ msg: isLate ? "Late check-in recorded (0.5 LOP)" : "Morning check-in saved", time: to12h(time) });
  } catch (err) {
    console.error("CHECK-IN ERROR:", err);
    res.status(500).json({ msg: err.message });
  }
});


router.post("/check-out", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const today = new Date().toISOString().split("T")[0];
    const time = new Date().toLocaleTimeString("en-GB");

    const existing = await pool.query(
      "SELECT check_in FROM attendance WHERE user_id=$1 AND attendance_date=$2",
      [userId, today]
    );
    if (existing.rows.length === 0)
      return res.status(400).json({ msg: "Please check-in first" });

    const hoursWorked = calcHours(existing.rows[0].check_in, time);

    let otHours = 0;
    if (time > "20:00:00") {
      const parts = time.split(":");
      const checkOutHrs = parseFloat(parts[0]) + parseFloat(parts[1]) / 60;
      const baseOutHrs = 18 + 15 / 60; // 18:15
      if (checkOutHrs > baseOutHrs) {
        otHours = parseFloat((checkOutHrs - baseOutHrs).toFixed(2));
      }
    }

    await pool.query(
      `UPDATE attendance SET check_out=$1, hours_worked=$2, ot_hours=$3
       WHERE user_id=$4 AND attendance_date=$5`,
      [time, hoursWorked, otHours, userId, today]
    );
    res.json({ msg: "Evening check-out updated", hours_worked: hoursWorked });
  } catch (err) {
    console.error("CHECK-OUT ERROR:", err);
    res.status(500).json({ msg: err.message });
  }
});


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
    const rows = result.rows.map((r) => ({
      ...r,
      check_in: to12h(r.check_in),
      check_out: to12h(r.check_out),
    }));
    res.json(rows);
  } catch (err) {
    console.error("MY ATTENDANCE ERROR:", err);
    res.status(500).json({ msg: "Server error" });
  }
});


router.get("/directory", verifyToken, canReadFeature("directory"), async (req, res) => {
  try {
    let query = `
      SELECT
        u.id,
        u.fullname,
        u.role,
        u.department,
        COALESCE(e.designation, '')                       AS designation,
        COALESCE(e.employee_uav_id, '')                   AS employee_uav_id,
        INITCAP(COALESCE(e.status, 'active'))              AS status
      FROM users u
      LEFT JOIN employees e ON u.id = e.user_id
      WHERE u.role IN ('employee', 'intern', 'admin')
    `;
    const params = [];

    if (req.user.role !== "super_admin") {
      const deptRes = await pool.query("SELECT department FROM users WHERE id=$1", [req.user.id]);
      const dept = deptRes.rows[0]?.department;
      if (dept) {
        const isHR = dept.toLowerCase().includes("hr") || dept.toLowerCase() === "operations";
        if (!isHR) {
          query += ` AND u.department = $1`;
          params.push(dept);
        }
      }
    }

    query += ` ORDER BY u.role ASC, COALESCE(e.employee_uav_id, u.fullname) ASC`;
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error("DIRECTORY ERROR:", err.message);
    res.status(500).json({ msg: err.message });
  }
});


router.get("/stats/my", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'Present')::int          AS present_count,
        COUNT(*) FILTER (WHERE status = 'Absent')::int           AS absent_count,
        COUNT(*) FILTER (WHERE status IN ('CL','SL','CCL'))::int AS leave_count
      FROM attendance
      WHERE user_id = $1
    `, [userId]);

    res.json({
      presentCount: result.rows[0].present_count,
      absentCount: result.rows[0].absent_count,
      leaveCount: result.rows[0].leave_count,
    });
  } catch (err) {
    console.error("MY STATS ERROR:", err);
    res.status(500).json({ msg: "Server error" });
  }
});


const NAVY = "1a3a6b";
const GREEN = "C6EFCE";
const RED = "FFC7CE";
const YELLOW = "FFEB9C";
const BLUE = "BDD7EE";
const GRAY = "F2F2F2";

function thinBorder() {
  const s = { style: "thin", color: { argb: "FFAAAAAA" } };
  return { top: s, left: s, bottom: s, right: s };
}

function applyHeaderRow(ws, headers, widths, rowNum) {
  const row = ws.getRow(rowNum);
  headers.forEach((h, i) => {
    const cell = row.getCell(i + 1);
    cell.value = h;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, name: "Arial", size: 10 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + NAVY } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = thinBorder();
    if (widths[i]) ws.getColumn(i + 1).width = widths[i];
  });
  row.height = 36;
}

router.get("/export-excel", verifyToken, isAdminOrSuper, async (req, res) => {
  try {
    const { from: fromDate, to: toDate } = req.query;
    if (!fromDate || !toDate)
      return res.status(400).json({ msg: "from and to dates are required" });

    const rangeLabel = `${fromDate} TO ${toDate}`;
    const params = [fromDate, toDate];

    const summaryRes = await pool.query(`
      SELECT
        u.fullname                                                              AS emp_name,
        e.employee_uav_id                                                      AS emp_id,
        ($2::date - $1::date + 1)::int                                         AS total_days,
        COUNT(*) FILTER (WHERE a.status = 'Present')::int                     AS present_days,
        COUNT(*) FILTER (WHERE a.status = '0.5')::int                         AS half_days,
        COUNT(*) FILTER (WHERE a.status = 'Field Work')::int                  AS field_work,
        COUNT(*) FILTER (WHERE a.status = 'CL')::int                          AS cl_used,
        COUNT(*) FILTER (WHERE a.status = 'SL')::int                          AS sl_used,
        COUNT(*) FILTER (WHERE a.status = 'CCL')::int                         AS ccl_used,
        COUNT(*) FILTER (WHERE a.status = 'Absent')::int                      AS absent_days,
        COUNT(*) FILTER (WHERE a.status = 'LOP')::int                         AS lop_days,
        e.total_cl                                                              AS cl_allotted,
        e.total_ml                                                              AS sl_allotted,
        GREATEST(e.total_cl - COUNT(*) FILTER (WHERE a.status = 'CL'), 0)::int AS cl_balance,
        GREATEST(e.total_ml - COUNT(*) FILTER (WHERE a.status = 'SL'), 0)::int AS sl_balance
      FROM employees e
      JOIN users u ON e.user_id = u.id
      LEFT JOIN attendance a
        ON e.user_id = a.user_id
        AND a.attendance_date BETWEEN $1::date AND $2::date
      GROUP BY u.fullname, e.employee_uav_id, e.total_cl, e.total_ml
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

    const wb = new ExcelJS.Workbook();
    const ws1 = wb.addWorksheet("Monthly Summary");

    ws1.mergeCells("A1:O1");
    const t1 = ws1.getCell("A1");
    t1.value = `MONTHLY ATTENDANCE SUMMARY — ${rangeLabel}`;
    t1.font = { bold: true, color: { argb: "FFFFFFFF" }, name: "Arial", size: 13 };
    t1.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + NAVY } };
    t1.alignment = { horizontal: "center", vertical: "middle" };
    ws1.getRow(1).height = 28;

    applyHeaderRow(ws1, [
      "Employee Name", "Emp ID", "Total Days", "Present Days", "Half Days", "Field Work",
      "CL Used", "SL Used", "CCL Used", "Absent Days", "LOP Days",
      "CL Allotted", "SL Allotted", "CL Balance", "SL Balance",
    ], [22, 13, 10, 9, 8, 8, 7, 7, 7, 9, 7, 10, 10, 10, 10], 2);

    ws1.views = [{ state: "frozen", ySplit: 2 }];

    summaryRes.rows.forEach((r, ri) => {
      const values = [
        r.emp_name, r.emp_id, r.total_days,
        r.present_days, r.half_days, r.field_work,
        r.cl_used, r.sl_used, r.ccl_used,
        r.absent_days, r.lop_days,
        r.cl_allotted, r.sl_allotted, r.cl_balance, r.sl_balance,
      ];
      const exRow = ws1.getRow(ri + 3);
      values.forEach((val, ci0) => {
        const cell = exRow.getCell(ci0 + 1);
        cell.value = val;
        cell.border = thinBorder();
        cell.font = { name: "Arial", size: 10 };
        cell.alignment = { horizontal: ci0 === 0 ? "left" : "center", vertical: "middle" };
        cell.fill = {
          type: "pattern", pattern: "solid",
          fgColor: { argb: "FF" + (ri % 2 === 0 ? GRAY : "FFFFFF") },
        };
      });
      exRow.height = 18;
    });

   
    const ws2 = wb.addWorksheet("Daily Logs");
    ws2.mergeCells("A1:G1");
    const t2 = ws2.getCell("A1");
    t2.value = `DAILY ATTENDANCE LOGS — ${rangeLabel}`;
    t2.font = { bold: true, color: { argb: "FFFFFFFF" }, name: "Arial", size: 13 };
    t2.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + NAVY } };
    t2.alignment = { horizontal: "center", vertical: "middle" };
    ws2.getRow(1).height = 28;

    applyHeaderRow(ws2,
      ["Employee Name", "Employee ID", "Date", "Check In", "Check Out", "Hours Worked", "Status"],
      [22, 13, 13, 13, 13, 14, 12], 2
    );
    ws2.views = [{ state: "frozen", ySplit: 2 }];

    const logStatusFill = {
      "Present": GREEN, "0.5": GREEN, "Field Work": BLUE,
      "CCL": BLUE, "CL": YELLOW, "SL": YELLOW, "Absent": RED, "LOP": RED,
    };

    logRes.rows.forEach((r, ri) => {
      const fill = logStatusFill[r.status] || "FFFFFF";
      const exRow = ws2.getRow(ri + 3);
     
      [r.emp_name, r.emp_id, r.att_date, to12h(r.check_in), to12h(r.check_out), r.hours_worked, r.status]
        .forEach((val, ci0) => {
          const cell = exRow.getCell(ci0 + 1);
          cell.value = val;
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + fill } };
          cell.border = thinBorder();
          cell.font = { bold: ci0 === 6, name: "Arial", size: 10 };
          cell.alignment = { horizontal: ci0 === 0 ? "left" : "center", vertical: "middle" };
        });
      exRow.height = 18;
    });

   
    const filename = `Attendance_${rangeLabel.replace(/ /g, "_")}.xlsx`;
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Access-Control-Expose-Headers", "Content-Disposition");

    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("EXPORT ERROR:", err);
    res.status(500).json({ msg: "Export failed", error: err.message });
  }
});


router.post("/upload-excel", verifyToken, isAdminOrSuper, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ msg: "No file uploaded" });

    const usersRes = await pool.query(
      "SELECT u.id, u.fullname, e.employee_uav_id FROM users u JOIN employees e ON u.id = e.user_id"
    );
    const users = usersRes.rows;

    const records = await parseAttendanceExcel(req.file.buffer, users);

    if (!records.length) {
      return res.status(400).json({ msg: "No matching employee records found in Excel sheet." });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      for (const rec of records) {
        const hoursWorked = rec.hoursWorked || calcHours(rec.checkIn, rec.checkOut);
        await client.query(
          `INSERT INTO attendance
             (user_id, employee_uav_id, attendance_date, status, check_in, check_out, marked_by, hours_worked)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
           ON CONFLICT (user_id, attendance_date) DO UPDATE SET
             status       = EXCLUDED.status,
             check_in     = EXCLUDED.check_in,
             check_out    = EXCLUDED.check_out,
             marked_by    = EXCLUDED.marked_by,
             hours_worked = EXCLUDED.hours_worked`,
          [rec.userId, rec.empId, rec.date, rec.status,
          rec.checkIn, rec.checkOut, req.user.id, hoursWorked || null]
        );
      }
      await client.query("COMMIT");
      res.json({ msg: `Successfully uploaded & synced ${records.length} attendance records!` });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("EXCEL UPLOAD ERROR:", err.message);
    res.status(500).json({ msg: err.message });
  }
});


router.post("/upload-from-drive", verifyToken, isAdminOrSuper, async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ msg: "No URL provided" });

    let fileId = null;
    const match1 = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    const match2 = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (match1) fileId = match1[1];
    else if (match2) fileId = match2[1];
    else return res.status(400).json({ msg: "Could not extract file ID from URL." });

    const downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
    const response = await axios.get(downloadUrl, { responseType: "arraybuffer", timeout: 15000 });
    const buffer = Buffer.from(response.data);

    const usersRes = await pool.query(
      "SELECT u.id, u.fullname, e.employee_uav_id FROM users u JOIN employees e ON u.id = e.user_id"
    );
    const users = usersRes.rows;

    const records = await parseAttendanceExcel(buffer, users);

    if (!records.length) {
      return res.status(400).json({ msg: "No matching employee records found in Excel sheet." });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      for (const rec of records) {
        const hoursWorked = rec.hoursWorked || calcHours(rec.checkIn, rec.checkOut);
        await client.query(
          `INSERT INTO attendance
             (user_id, employee_uav_id, attendance_date, status, check_in, check_out, marked_by, hours_worked)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
           ON CONFLICT (user_id, attendance_date) DO UPDATE SET
             status       = EXCLUDED.status,
             check_in     = EXCLUDED.check_in,
             check_out    = EXCLUDED.check_out,
             marked_by    = EXCLUDED.marked_by,
             hours_worked = EXCLUDED.hours_worked`,
          [rec.userId, rec.empId, rec.date, rec.status,
          rec.checkIn, rec.checkOut, req.user.id, hoursWorked || null]
        );
      }
      await client.query("COMMIT");
      res.json({ msg: `Successfully imported & synced ${records.length} records from Google Drive!` });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("DRIVE IMPORT ERROR:", err.message);
    res.status(500).json({
      msg: err.response?.status === 403
        ? "Access denied. Make sure the file is shared as 'Anyone with the link'."
        : err.message,
    });
  }
});

export default router;
