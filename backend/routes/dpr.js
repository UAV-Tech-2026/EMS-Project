import express from "express";
import pool from "../db.js";
import ExcelJS from "exceljs";
import { verifyToken, isAdminOrSuper } from "../middleware/authMiddleware.js";

const router = express.Router();

const thin = () => ({
  top: { style: "thin", color: { argb: "FF000000" } },
  bottom: { style: "thin", color: { argb: "FF000000" } },
  left: { style: "thin", color: { argb: "FF000000" } },
  right: { style: "thin", color: { argb: "FF000000" } },
});

const NAVY = "FF1F4E79";
const WHITE = "FFFFFFFF";
const CREAM = "FFFFF9E6";

function getLocalDateString(date) {
  // IST = UTC+5:30
  const offset = 5.5 * 60 * 60 * 1000;
  return new Date(date.getTime() + offset).toISOString().split("T")[0];
}

function isAllowedDate(dprDate) {
  const now = new Date();

  const today = getLocalDateString(now);
  const yesterday = getLocalDateString(new Date(now.getTime() - 86400000));

  return dprDate === today || dprDate === yesterday;
}

function fmtTime(val) {
  if (!val) return "";
  if (val instanceof Date) {
    return val.toTimeString().slice(0, 5); // "HH:MM"
  }
  return String(val).slice(0, 5);
}



router.get("/export", verifyToken, async (req, res) => {
  try {
    const { date } = req.query;
    const result = await pool.query("SELECT * FROM dpr_table WHERE date = $1", [date]);

    if (result.rows.length === 0) {
      return res.status(404).json({ msg: "No data found for this date to export." });
    }

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("DPR");

    ws.columns = [
      { header: "Start", key: "start_time" },
      { header: "End", key: "end_time" },
      { header: "Summary", key: "summary" }
    ];

    ws.addRows(result.rows);

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    await wb.xlsx.write(res);
  } catch (err) {
    res.status(500).send(err.message);
  }
});


router.get("/eod-tasks", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    // BUG FIX: use IST date, not UTC
    const today = getLocalDateString(new Date());

    const result = await pool.query(`
      SELECT
        id,
        title,
        status,
        due_date AS deadline,
        '' AS description
      FROM tasks
      WHERE assigned_to = $1
        AND due_date = $2
      ORDER BY id ASC
    `, [userId, today]);

    res.json(result.rows);
  } catch (err) {
    console.error("EOD TASKS ERROR:", err.message);
    res.status(500).json({ msg: "Failed to fetch EOD tasks" });
  }
});


router.get("/download", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const dprDate = req.query.date || getLocalDateString(new Date());

    if (!isAllowedDate(dprDate)) {
      return res.status(403).json({
        msg: "DPR can only be downloaded for today or tomorrow.",
      });
    }

    // Fetch employee info
    const empRes = await pool.query(`
      SELECT u.fullname, e.designation, e.employee_uav_id
      FROM users u
      JOIN employees e ON u.id = e.user_id
      WHERE u.id = $1
    `, [userId]);

    if (!empRes.rows.length)
      return res.status(404).json({ msg: "Employee not found" });

    const emp = empRes.rows[0];

    // Fetch attendance
    const attRes = await pool.query(
      "SELECT check_in, check_out FROM attendance WHERE user_id=$1 AND attendance_date=$2",
      [userId, dprDate]
    );
    const att = attRes.rows[0] || {};

    // BUG FIX: Also fetch saved DPR entry + tasks so Excel is populated
    const entryRes = await pool.query(
      "SELECT * FROM dpr_entries WHERE user_id=$1 AND dpr_date=$2",
      [userId, dprDate]
    );
    const entry = entryRes.rows[0] || {};

    const tasksRes = await pool.query(
      "SELECT * FROM dpr_tasks WHERE user_id=$1 AND dpr_date=$2 ORDER BY id ASC",
      [userId, dprDate]
    );
    const savedTasks = tasksRes.rows || [];

    const dateObj = new Date(dprDate + "T00:00:00");
    const dayName = dateObj.toLocaleDateString("en-GB", { weekday: "long" });
    const dateFmt = dateObj.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("DPR");

    // Column widths
    [18, 10, 14, 6, 42, 4, 22, 4, 22].forEach((w, i) => (ws.getColumn(i + 1).width = w));

    // Row heights
    for (let r = 1; r <= 29; r++) ws.getRow(r).height = 16;
    ws.getRow(1).height = 10;
    ws.getRow(6).height = 10;
    ws.getRow(10).height = 10;
    ws.getRow(11).height = 22;

    // Logo
    ws.mergeCells("A2:C5");
    Object.assign(ws.getCell("A2"), {
      value: "UAV Tech",
      font: { bold: true, size: 18, color: { argb: NAVY }, name: "Arial" },
      alignment: { horizontal: "center", vertical: "middle" },
    });

    // Title
    ws.mergeCells("D2:I5");
    Object.assign(ws.getCell("D2"), {
      value: "DAILY PROGRESS REPORT",
      font: { bold: true, size: 16, color: { argb: NAVY }, name: "Arial" },
      alignment: { horizontal: "center", vertical: "middle" },
    });

    const lbl = (ref, text) =>
      Object.assign(ws.getCell(ref), {
        value: text,
        font: { bold: true, size: 10, name: "Arial" },
        alignment: { vertical: "middle" },
        border: thin(),
      });

    const val = (ref, text = "") =>
      Object.assign(ws.getCell(ref), {
        value: text,
        font: { size: 10, name: "Arial" },
        alignment: { vertical: "middle" },
        border: thin(),
        fill: { type: "pattern", pattern: "solid", fgColor: { argb: CREAM } },
      });

    // Row 7
    lbl("A7", "Name");
    ws.mergeCells("B7:E7"); val("B7", emp.fullname);
    lbl("F7", "Date"); val("G7", dateFmt);
    lbl("H7", "Location"); val("I7", entry.location || "Office");

    // Row 8
    lbl("A8", "Designation");
    ws.mergeCells("B8:E8"); val("B8", emp.designation || "");
    lbl("F8", "Day"); val("G8", dayName);
    lbl("H8", "Clock-in Time");
    // BUG FIX: fmtTime() handles both Date objects and strings from DB
    val("I8", entry.clock_in ? fmtTime(entry.clock_in) : fmtTime(att.check_in));

    // Row 9
    lbl("A9", "Project");
    ws.mergeCells("B9:E9"); val("B9", entry.project || "");
    lbl("F9", "Project Code"); val("G9", entry.project_code || emp.employee_uav_id || "");
    lbl("H9", "Clock-Out Time");
    val("I9", entry.clock_out ? fmtTime(entry.clock_out) : fmtTime(att.check_out));

    // Task header row 11
    const hdr = (ref, text) =>
      Object.assign(ws.getCell(ref), {
        value: text,
        font: { bold: true, size: 10, color: { argb: WHITE }, name: "Arial" },
        fill: { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } },
        alignment: { horizontal: "center", vertical: "middle", wrapText: true },
        border: thin(),
      });

    ws.mergeCells("C11:D11");
    ws.mergeCells("E11:F11");
    ws.mergeCells("H11:I11");
    hdr("A11", "Start");
    hdr("B11", "End");
    hdr("C11", "Task Code");
    hdr("E11", "Summary of Work Done");
    hdr("G11", "Equipments / Software Used");
    hdr("H11", "Personnel Involved");

    // BUG FIX: Fill task rows 12–24 from saved dpr_tasks data
    for (let i = 0; i < 13; i++) {
      const row = 12 + i;
      const task = savedTasks[i] || {};

      ws.getRow(row).height = 18;
      ws.mergeCells(`C${row}:D${row}`);
      ws.mergeCells(`E${row}:F${row}`);
      ws.mergeCells(`H${row}:I${row}`);

      const setCellStyle = (col, value = "") => {
        const c = ws.getCell(row, col);
        c.value = value;
        c.border = thin();
        c.font = { size: 10, name: "Arial" };
        c.alignment = { vertical: "middle", wrapText: true };
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } };
      };

      setCellStyle(1, fmtTime(task.start_time));   // Start
      setCellStyle(2, fmtTime(task.end_time));      // End
      setCellStyle(3, task.task_code || "");      // Task Code (merged C:D)
      setCellStyle(5, task.summary || "");      // Summary (merged E:F)
      setCellStyle(7, task.equipment || "");      // Equipment
      setCellStyle(8, task.personnel || "");      // Personnel (merged H:I)
    }

    // Requirement row 25 — use saved value
    ws.getRow(25).height = 20;
    ws.mergeCells("A25:B25"); lbl("A25", "Requirement (If any)");
    ws.mergeCells("C25:I25");
    Object.assign(ws.getCell("C25"), {
      value: entry.requirement || "N/A",
      font: { size: 10, name: "Arial" },
      border: thin(),
      alignment: { vertical: "middle" },
    });

    // Remarks row 27 — use saved value
    ws.getRow(27).height = 20;
    ws.mergeCells("A27:B27"); lbl("A27", "Remarks / Issues");
    ws.mergeCells("C27:I27");
    Object.assign(ws.getCell("C27"), {
      value: entry.remarks || "N/A",
      font: { size: 10, name: "Arial" },
      border: thin(),
      alignment: { vertical: "middle" },
    });

    // Date lock notice row 29
    ws.mergeCells("A29:I29");
    Object.assign(ws.getCell("A29"), {
      value: `⚠ This DPR is valid for ${dateFmt}. Editing allowed for today & tomorrow only. Past dates are locked.`,
      font: { italic: true, size: 9, color: { argb: "FFCC0000" }, name: "Arial" },
      alignment: { horizontal: "center", vertical: "middle" },
    });

    ws.pageSetup.orientation = "landscape";
    ws.pageSetup.fitToPage = true;
    ws.pageSetup.fitToWidth = 1;
    ws.printArea = "A1:I29";

    const filename = `DPR_${emp.fullname.replace(/ /g, "_")}_${dprDate}.xlsx`;
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

    // BUG FIX: removed res.end() after wb.xlsx.write(res) — calling res.end()
    // after write() causes "write after end" crash because write() already ends the stream.
    await wb.xlsx.write(res);

  } catch (err) {
    console.error("DPR ERROR:", err.message);
    res.status(500).json({ msg: "Failed to generate DPR", error: err.message });
  }
});

// ─── EMPLOYEE: Get existing DPR for a date ───────────────────────────────────
router.get("/my-dpr", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { date } = req.query;
    if (!date) return res.status(400).json({ msg: "Date is required" });

    const entryRes = await pool.query(
      "SELECT * FROM dpr_entries WHERE user_id = $1 AND dpr_date = $2",
      [userId, date]
    );
    const tasksRes = await pool.query(
      "SELECT * FROM dpr_tasks WHERE user_id = $1 AND dpr_date = $2 ORDER BY id ASC",
      [userId, date]
    );

    res.json({
      entry: entryRes.rows[0] || null,
      tasks: tasksRes.rows || [],
    });
  } catch (err) {
    console.error("MY DPR FETCH ERROR:", err.message);
    res.status(500).json({ msg: "Server error" });
  }
});

// ─── SAVE DPR (today or tomorrow only) ───────────────────────────────────────
router.post("/save", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      dpr_date, tasks, requirement, remarks,
      clock_in, clock_out, project, project_code, location,
    } = req.body;

    if (!isAllowedDate(dpr_date)) {
      return res.status(403).json({
        msg: "DPR can only be saved for today or tomorrow. Past dates are locked.",
      });
    }

    await pool.query(`
      INSERT INTO dpr_entries
        (user_id, dpr_date, project, project_code, location, clock_in, clock_out, requirement, remarks)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      ON CONFLICT (user_id, dpr_date) DO UPDATE SET
        project=$3, project_code=$4, location=$5,
        clock_in=$6, clock_out=$7, requirement=$8,
        remarks=$9, updated_at=NOW()
    `, [
      userId, dpr_date,
      project || "",
      project_code || "",
      location || "Office",
      clock_in || null,
      clock_out || null,
      requirement || "N/A",
      remarks || "N/A",
    ]);

    await pool.query(
      "DELETE FROM dpr_tasks WHERE user_id=$1 AND dpr_date=$2",
      [userId, dpr_date]
    );

    for (const task of tasks || []) {
      if (!task.summary) continue;
      await pool.query(`
        INSERT INTO dpr_tasks
          (user_id, dpr_date, start_time, end_time, task_code, summary, equipment, personnel)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      `, [
        userId, dpr_date,
        task.start || null,
        task.end || null,
        task.task_code || "",
        task.summary,
        task.equipment || "",
        task.personnel || "",
      ]);
    }

    res.json({ msg: "DPR saved successfully" });
  } catch (err) {
    console.error("DPR SAVE ERROR:", err.message);
    res.status(500).json({ msg: err.message });
  }
});

router.get("/all", verifyToken, isAdminOrSuper, async (req, res) => {
  try {
    const { date, startDate, endDate } = req.query;
    const role = req.user.role?.toLowerCase();

    // For scoped admins, fetch their department first
    let departmentFilter = null;
    if (role !== "super_admin") {
      const adminRes = await pool.query(
        "SELECT department FROM employees WHERE user_id = $1",
        [req.user.id]
      );
      departmentFilter = adminRes.rows[0]?.department || null;
    }

    let query = `
      SELECT d.id, d.user_id, d.dpr_date, d.project, d.project_code, d.location,
       d.clock_in, d.clock_out, d.requirement, d.remarks,
       u.fullname, e.designation, e.employee_uav_id
      FROM dpr_entries d
      JOIN users u ON d.user_id = u.id
      JOIN employees e ON u.id = e.user_id
      WHERE 1=1
    `;
    const params = [];

    // Department scope (non-super admins)
    if (departmentFilter) {
      params.push(departmentFilter);
      query += ` AND e.department = $${params.length}`;
    }

    if (date) {
      params.push(date);
      query += ` AND d.dpr_date = $${params.length}`;
    } else if (startDate && endDate) {
      params.push(startDate, endDate);
      query += ` AND d.dpr_date >= $${params.length - 1} AND d.dpr_date <= $${params.length}`;
    }

    query += " ORDER BY d.dpr_date DESC, u.fullname ASC";

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
}); 


router.get("/download-all", verifyToken, isAdminOrSuper, async (req, res) => {
  try {
    const { date, start_date, end_date } = req.query;
    const role = req.user.role?.toLowerCase();

    let departmentFilter = null;
    if (role !== "super_admin") {
      const adminRes = await pool.query(
        "SELECT department FROM employees WHERE user_id = $1",
        [req.user.id]
      );
      departmentFilter = adminRes.rows[0]?.department || null;
    }

    let query = `
      SELECT d.dpr_date, d.project, d.project_code, d.location,
             d.clock_in, d.clock_out, d.requirement, d.remarks,
             u.fullname, e.designation, e.employee_uav_id,
             t.start_time, t.end_time, t.task_code, t.summary, t.equipment, t.personnel
      FROM dpr_entries d
      JOIN users u ON d.user_id = u.id
      JOIN employees e ON u.id = e.user_id
      LEFT JOIN dpr_tasks t ON d.user_id = t.user_id AND d.dpr_date = t.dpr_date
      WHERE 1=1
    `;
    const params = [];

    if (departmentFilter) {
      params.push(departmentFilter);
      query += ` AND e.department = $${params.length}`;
    }

    if (date) {
      params.push(date);
      query += ` AND d.dpr_date = $${params.length}`;
    } else if (start_date && end_date) {
      params.push(start_date, end_date);
      query += ` AND d.dpr_date >= $${params.length - 1} AND d.dpr_date <= $${params.length}`;
    }

    query += " ORDER BY d.dpr_date DESC, u.fullname ASC";

    const result = await pool.query(query, params);

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Whole Project DPR");
    ws.columns = [
      { header: "Date", key: "dpr_date", width: 12 },
      { header: "Employee", key: "fullname", width: 20 },
      { header: "Designation", key: "designation", width: 15 },
      { header: "UAV ID", key: "employee_uav_id", width: 12 },
      { header: "Project", key: "project", width: 15 },
      { header: "Proj Code", key: "project_code", width: 12 },
      { header: "Location", key: "location", width: 12 },
      { header: "Clock In", key: "clock_in", width: 10 },
      { header: "Clock Out", key: "clock_out", width: 10 },
      { header: "Requirement", key: "requirement", width: 25 },
      { header: "Remarks", key: "remarks", width: 25 },
      { header: "Task Start", key: "start_time", width: 10 },
      { header: "Task End", key: "end_time", width: 10 },
      { header: "Task Code", key: "task_code", width: 12 },
      { header: "Task Summary", key: "summary", width: 35 },
      { header: "Equipment", key: "equipment", width: 20 },
      { header: "Personnel", key: "personnel", width: 20 },
    ];
    ws.getRow(1).font = { bold: true };
    ws.addRows(result.rows);

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="Whole_Project_DPR_${start_date || date || "All"}.xlsx"`
    );
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    // BUG FIX: removed res.end() — write() already ends the stream
    await wb.xlsx.write(res);
  } catch (err) {
    console.error("DPR EXPORT ERROR:", err.message);
    res.status(500).json({ msg: err.message });
  }
});


router.get("/tasks/:userId", verifyToken, isAdminOrSuper, async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ msg: "Date is required" });

    const result = await pool.query(
      "SELECT * FROM dpr_tasks WHERE user_id=$1 AND dpr_date=$2 ORDER BY id ASC",
      [req.params.userId, date]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

export default router;