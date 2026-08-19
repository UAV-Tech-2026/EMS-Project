import express from "express";
import pool from "../db.js";
import ExcelJS from "exceljs";
import { verifyToken, isAdminOrSuper, canReadFeature } from "../middleware/authMiddleware.js";

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

    
    const result = await pool.query(`
      SELECT
        id,
        title,
        status,
        due_date AS deadline,
        description
      FROM tasks
      WHERE assigned_to = $1
        AND status NOT IN ('Completed')
      ORDER BY due_date ASC NULLS LAST, id ASC
    `, [userId]);

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

    
    const empRes = await pool.query(`
      SELECT u.fullname, e.designation, e.employee_uav_id
      FROM users u
      JOIN employees e ON u.id = e.user_id
      WHERE u.id = $1
    `, [userId]);

    if (!empRes.rows.length)
      return res.status(404).json({ msg: "Employee not found" });

    const emp = empRes.rows[0];

  
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

  
    [18, 10, 14, 6, 42, 4, 22, 4, 22].forEach((w, i) => (ws.getColumn(i + 1).width = w));

   
    for (let r = 1; r <= 29; r++) ws.getRow(r).height = 16;
    ws.getRow(1).height = 10;
    ws.getRow(6).height = 10;
    ws.getRow(10).height = 10;
    ws.getRow(11).height = 22;

   
    ws.mergeCells("A2:C5");
    Object.assign(ws.getCell("A2"), {
      value: "UAV Tech",
      font: { bold: true, size: 18, color: { argb: NAVY }, name: "Arial" },
      alignment: { horizontal: "center", vertical: "middle" },
    });


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

    
    lbl("A7", "Name");
    ws.mergeCells("B7:E7"); val("B7", emp.fullname);
    lbl("F7", "Date"); val("G7", dateFmt);
    lbl("H7", "Location"); val("I7", entry.location || "Office");

   
    lbl("A8", "Designation");
    ws.mergeCells("B8:E8"); val("B8", emp.designation || "");
    lbl("F8", "Day"); val("G8", dayName);
    lbl("H8", "Clock-in Time");
    
    val("I8", entry.clock_in ? fmtTime(entry.clock_in) : fmtTime(att.check_in));

   
    lbl("A9", "Project");
    ws.mergeCells("B9:E9"); val("B9", entry.project || "");
    lbl("F9", "Project Code"); val("G9", entry.project_code || emp.employee_uav_id || "");
    lbl("H9", "Clock-Out Time");
    val("I9", entry.clock_out ? fmtTime(entry.clock_out) : fmtTime(att.check_out));

    
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

      setCellStyle(1, fmtTime(task.start_time)); 
      setCellStyle(2, fmtTime(task.end_time));      
      setCellStyle(3, task.task_code || "");      
      setCellStyle(5, task.summary || "");      
      setCellStyle(7, task.equipment || "");     
      setCellStyle(8, task.personnel || "");     
    }

   
    ws.getRow(25).height = 20;
    ws.mergeCells("A25:B25"); lbl("A25", "Requirement (If any)");
    ws.mergeCells("C25:I25");
    Object.assign(ws.getCell("C25"), {
      value: entry.requirement || "N/A",
      font: { size: 10, name: "Arial" },
      border: thin(),
      alignment: { vertical: "middle" },
    });

   
    ws.getRow(27).height = 20;
    ws.mergeCells("A27:B27"); lbl("A27", "Remarks / Issues");
    ws.mergeCells("C27:I27");
    Object.assign(ws.getCell("C27"), {
      value: entry.remarks || "N/A",
      font: { size: 10, name: "Arial" },
      border: thin(),
      alignment: { vertical: "middle" },
    });


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


    await wb.xlsx.write(res);

  } catch (err) {
    console.error("DPR ERROR:", err.message);
    res.status(500).json({ msg: "Failed to generate DPR", error: err.message });
  }
});


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

router.get("/my-history", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await pool.query(
      "SELECT dpr_date, project, clock_in, clock_out, remarks FROM dpr_entries WHERE user_id = $1 ORDER BY dpr_date DESC",
      [userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("MY DPR HISTORY ERROR:", err.message);
    res.status(500).json({ msg: "Server error" });
  }
});

router.post("/save", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      dpr_date, tasks, requirement, remarks,
      clock_in, clock_out, project, project_code, location,
      assigned_admin_id,
    } = req.body;

    if (!isAllowedDate(dpr_date)) {
      return res.status(403).json({
        msg: "DPR can only be saved for today or tomorrow. Past dates are locked.",
      });
    }

    
    const MIN_SUMMARY_LENGTH = 20;
    const isDegenerate = (text) => {
      const trimmed = text.trim();
      if (trimmed.length < MIN_SUMMARY_LENGTH) return true;
      const noSpaces = trimmed.replace(/\s/g, "");
      if (/^(.)\1*$/.test(noSpaces)) return true;
      const words = trimmed.split(/\s+/).filter(Boolean);
      if (words.length < 3) return true; 
      return false;
    };
    const badRows = (tasks || [])
      .map((t, i) => ({ i, summary: (t.summary || "").trim() }))
      .filter(t => t.summary && isDegenerate(t.summary));
    if (badRows.length > 0) {
      return res.status(400).json({
        msg: `Row ${badRows.map(r => r.i + 1).join(", ")}: summary is too short or looks like placeholder text. Please describe the work done (min ${MIN_SUMMARY_LENGTH} characters).`,
      });
    }

    
    try {
      await pool.query(`
        ALTER TABLE dpr_entries
          ADD COLUMN IF NOT EXISTS flagged BOOLEAN DEFAULT false,
          ADD COLUMN IF NOT EXISTS flag_reason TEXT,
          ADD COLUMN IF NOT EXISTS flagged_by INTEGER REFERENCES users(id),
          ADD COLUMN IF NOT EXISTS flagged_at TIMESTAMPTZ
      `);
    } catch (e) {}

    await pool.query(`
      INSERT INTO dpr_entries
        (user_id, dpr_date, project, project_code, location, clock_in, clock_out, requirement, remarks, assigned_admin_id)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      ON CONFLICT (user_id, dpr_date) DO UPDATE SET
        project=$3, project_code=$4, location=$5,
        clock_in=$6, clock_out=$7, requirement=$8,
        remarks=$9, assigned_admin_id=$10, updated_at=NOW(),
        flagged=false, flag_reason=NULL, flagged_by=NULL, flagged_at=NULL
    `, [
      userId, dpr_date,
      project || "",
      project_code || "",
      location || "Office",
      clock_in || null,
      clock_out || null,
      requirement || "N/A",
      remarks || "N/A",
      assigned_admin_id || null,
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



router.patch("/comment/:dprId", verifyToken, isAdminOrSuper, async (req, res) => {
  try {
    const { dprId } = req.params;
    const { admin_comment } = req.body;
    if (typeof admin_comment !== "string") {
      return res.status(400).json({ msg: "admin_comment is required" });
    }
    await pool.query(
      "UPDATE dpr_entries SET admin_comment = $1 WHERE id = $2",
      [admin_comment, dprId]
    );
    res.json({ msg: "Comment saved" });
  } catch (err) {
    console.error("DPR COMMENT ERROR:", err.message);
    res.status(500).json({ msg: err.message });
  }
});


router.put("/:dprId/flag", verifyToken, isAdminOrSuper, async (req, res) => {
  try {
    const { dprId } = req.params;
    const reason = (req.body?.reason || "").trim();
    if (!reason) return res.status(400).json({ msg: "A reason is required to flag an entry." });

    try {
      await pool.query(`
        ALTER TABLE dpr_entries
          ADD COLUMN IF NOT EXISTS flagged BOOLEAN DEFAULT false,
          ADD COLUMN IF NOT EXISTS flag_reason TEXT,
          ADD COLUMN IF NOT EXISTS flagged_by INTEGER REFERENCES users(id),
          ADD COLUMN IF NOT EXISTS flagged_at TIMESTAMPTZ
      `);
    } catch (e) {}

    const result = await pool.query(
      `UPDATE dpr_entries
       SET flagged = true, flag_reason = $1, flagged_by = $2, flagged_at = NOW()
       WHERE id = $3
       RETURNING user_id, dpr_date`,
      [reason, req.user.id, dprId]
    );
    if (result.rows.length === 0) return res.status(404).json({ msg: "DPR entry not found" });

    res.json({ msg: "Entry flagged", ...result.rows[0] });
  } catch (err) {
    console.error("DPR FLAG ERROR:", err.message);
    res.status(500).json({ msg: err.message });
  }
});


router.get("/flags/:userId", verifyToken, isAdminOrSuper, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, dpr_date, flag_reason, flagged_at,
              (SELECT fullname FROM users WHERE id = flagged_by) AS flagged_by_name
       FROM dpr_entries
       WHERE user_id = $1 AND flagged = true
       ORDER BY flagged_at DESC`,
      [req.params.userId]
    );
    res.json({ flaggedCount: result.rows.length, entries: result.rows });
  } catch (err) {
    console.error("DPR FLAGS FETCH ERROR:", err.message);
    res.status(500).json({ msg: err.message });
  }
});

router.get("/admins", verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.fullname, u.role, e.designation, e.department
       FROM users u
       LEFT JOIN employees e ON u.id = e.user_id
       WHERE u.role IN ('admin', 'super_admin')
       ORDER BY u.role DESC, u.fullname ASC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error("DPR ADMINS ERROR:", err.message);
    res.status(500).json({ msg: err.message });
  }
});


router.get("/task-codes", verifyToken, async (req, res) => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS dpr_task_codes (
        code VARCHAR(40) PRIMARY KEY,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    const result = await pool.query(`
      SELECT DISTINCT code FROM (
        SELECT task_code AS code FROM dpr_tasks WHERE task_code IS NOT NULL AND TRIM(task_code) != ''
        UNION
        SELECT code FROM dpr_task_codes
      ) t
      ORDER BY code ASC
    `);
    res.json(result.rows.map(r => r.code));
  } catch (err) {
    console.error("DPR TASK CODES ERROR:", err.message);
    res.status(500).json({ msg: err.message });
  }
});


router.post("/task-codes/register", verifyToken, async (req, res) => {
  try {
    const code = (req.body?.code || "").trim();
    if (!code) return res.status(400).json({ msg: "Code is required" });
    await pool.query(`
      CREATE TABLE IF NOT EXISTS dpr_task_codes (
        code VARCHAR(40) PRIMARY KEY,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await pool.query(
      "INSERT INTO dpr_task_codes (code) VALUES ($1) ON CONFLICT (code) DO NOTHING",
      [code]
    );
    res.json({ msg: "Code registered" });
  } catch (err) {
    console.error("DPR TASK CODE REGISTER ERROR:", err.message);
    res.status(500).json({ msg: err.message });
  }
});


router.delete("/task-codes/:code", verifyToken, async (req, res) => {
  try {
    const code = (req.params.code || "").trim();
    if (!code) return res.status(400).json({ msg: "Code is required" });

    await pool.query("DELETE FROM dpr_task_codes WHERE code = $1", [code]);

    const stillUsed = await pool.query(
      "SELECT 1 FROM dpr_tasks WHERE task_code = $1 LIMIT 1",
      [code]
    );

    res.json({
      msg: "Code removed",
      stillInHistory: stillUsed.rows.length > 0,
    });
  } catch (err) {
    console.error("DPR TASK CODE DELETE ERROR:", err.message);
    res.status(500).json({ msg: err.message });
  }
});

router.get("/all", verifyToken, canReadFeature("dpr"), async (req, res) => {
  try {
    const { date, startDate, endDate } = req.query;
    const role = req.user.role?.toLowerCase();

    try {
      await pool.query(`
        ALTER TABLE dpr_entries
          ADD COLUMN IF NOT EXISTS flagged BOOLEAN DEFAULT false,
          ADD COLUMN IF NOT EXISTS flag_reason TEXT,
          ADD COLUMN IF NOT EXISTS flagged_by INTEGER REFERENCES users(id),
          ADD COLUMN IF NOT EXISTS flagged_at TIMESTAMPTZ
      `);
    } catch (e) {}

  
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
       d.admin_comment, d.assigned_admin_id,
       d.flagged, d.flag_reason, d.flagged_at,
       u.fullname, e.designation, e.employee_uav_id,
       au.fullname AS assigned_admin_name
      FROM dpr_entries d
      JOIN users u ON d.user_id = u.id
      JOIN employees e ON u.id = e.user_id
      LEFT JOIN users au ON d.assigned_admin_id = au.id
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