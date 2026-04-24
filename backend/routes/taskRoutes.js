import express from "express";
import pool from "../db.js";
import { verifyToken } from "../middleware/authMiddleware.js";
import multer from "multer";
import ExcelJS from "exceljs";
import { createNotification } from "./notificationRoutes.js";

const router = express.Router();
const upload = multer({ dest: "uploads/" });

router.post("/upload", verifyToken, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ msg: "No file uploaded" });

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(req.file.path);
    const worksheet = workbook.worksheets[0];

    const tasksToInsert = [];
    // Assuming Row 1 is headers: Title, Assignee (UAV ID or Exact Name), Target Date, Due Date
    
    // Fetch all employees to find IDs by name
    const usersRes = await pool.query("SELECT id, fullname, role FROM users");
    const users = usersRes.rows;

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // Skip headers

      const title = row.getCell(1).value?.toString();
      const assigneeName = row.getCell(2).value?.toString()?.trim();
      const targetDate = row.getCell(3).value?.toString() || null;
      let dueDate = row.getCell(4).value;

      if (!title) return; // Title is required

      let assignedToId = null;
      if (assigneeName) {
        const user = users.find(u => u.fullname && u.fullname.toLowerCase() === assigneeName.toLowerCase());
        assignedToId = user ? user.id : null;
      }

      // Handle Excel Date objects
      if (dueDate && typeof dueDate === "object") {
         dueDate = dueDate.toISOString().split("T")[0];
      } else if (dueDate) {
         dueDate = new Date(dueDate).toISOString().split("T")[0];
      } else {
         dueDate = null;
      }

      tasksToInsert.push({ title, assignedToId, targetDate, dueDate });
    });

    for (const t of tasksToInsert) {
      await pool.query(
        `INSERT INTO tasks (title, assigned_to, assigned_by, target_date, due_date, status, assignment_date)
         VALUES ($1, $2, $3, $4, $5, 'Pending', NOW())`,
        [t.title, t.assignedToId, req.user.id, t.targetDate, t.dueDate]
      );
      if (t.assignedToId) {
        await createNotification(t.assignedToId, `New task assigned: ${t.title}`, "info");
      }
    }

    res.json({ msg: `Successfully uploaded ${tasksToInsert.length} tasks!` });
  } catch (err) {
    console.error("EXCEL UPLOAD ERROR:", err);
    res.status(500).json({ msg: "Failed to parse Excel file" });
  }
});


router.get("/stats", verifyToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        COUNT(*)                                          AS total_tasks,
        COUNT(*) FILTER (WHERE assigned_to IS NOT NULL)  AS assigned_tasks,
        COUNT(*) FILTER (WHERE depends_on  IS NOT NULL)  AS dependent_tasks
      FROM tasks
    `);
    res.json({
      total_tasks:     parseInt(result.rows[0].total_tasks),
      assigned_tasks:  parseInt(result.rows[0].assigned_tasks),
      dependent_tasks: parseInt(result.rows[0].dependent_tasks),
    });
  } catch (err) {
    console.error("STATS ERROR:", err.message);
    res.status(500).json({ msg: err.message });
  }
});


router.post("/assign", verifyToken, async (req, res) => {
  try {
    const body = req.body;
    const assigned_by = req.user.id;

    // ── Sanitize Inputs (Match /edit logic) ──
    const title        = body.title       || "Untitled Task";
    const assigned_to  = (body.assigned_to && !isNaN(parseInt(body.assigned_to))) ? parseInt(body.assigned_to) : null;
    const reviewed_by  = (body.reviewed_by && !isNaN(parseInt(body.reviewed_by))) ? parseInt(body.reviewed_by) : null;
    const depends_on   = (body.depends_on  && !isNaN(parseInt(body.depends_on)))  ? parseInt(body.depends_on)  : null;
    const target_date    = body.target_date ? body.target_date.toString() : null; // VARCHAR(50)
    const days_taken   = (body.days_taken  && !isNaN(parseFloat(body.days_taken))) ? Math.round(parseFloat(body.days_taken)) : null;

    const status       = body.status      || "Pending";
    const start_date   = body.start_date  || null;
    const due_date     = body.due_date    || null;
    const end_date     = body.end_date    || null;
    const link         = body.link        || null;
    const assignment_date = body.assignment_date || new Date().toISOString().split("T")[0];
    const parent_id    = (body.parent_id && !isNaN(parseInt(body.parent_id))) ? parseInt(body.parent_id) : null;
    const description  = body.description  || null;

    const result = await pool.query(
      `INSERT INTO tasks (
        title, assigned_to, assigned_by, reviewed_by,
        target_date, start_date, due_date, end_date,
        status, days_taken, depends_on, link, assignment_date,
        parent_id, description
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
      RETURNING *`,
      [
        title, assigned_to, assigned_by, reviewed_by,
        target_date, start_date, due_date, end_date,
        status, days_taken, depends_on, link, assignment_date,
        parent_id, description
      ]
    );

    if (assigned_to) {
      await createNotification(assigned_to, `New task assigned: ${title}`, "info");
    }

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("TASK ASSIGN ERROR:", err.message);
    res.status(500).json({ msg: "Failed to assign task", error: err.message });
  }
});


router.put("/edit/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body;

    // ── Sanitize Inputs ──
    const title        = body.title       || null;
    const assigned_to  = (body.assigned_to && !isNaN(parseInt(body.assigned_to))) ? parseInt(body.assigned_to) : null;
    const reviewed_by  = (body.reviewed_by && !isNaN(parseInt(body.reviewed_by))) ? parseInt(body.reviewed_by) : null;
    const depends_on   = (body.depends_on  && !isNaN(parseInt(body.depends_on)))  ? parseInt(body.depends_on)  : null;
    const target_date    = body.target_date ? body.target_date.toString() : null;
    const days_taken   = (body.days_taken  && !isNaN(parseFloat(body.days_taken))) ? Math.round(parseFloat(body.days_taken)) : null;

    const status       = body.status      || null;
    const start_date   = body.start_date  || null;
    const due_date     = body.due_date    || null;
    const end_date     = body.end_date    || null;
    const link         = body.link        || null;
    const parent_id    = (body.parent_id && !isNaN(parseInt(body.parent_id))) ? parseInt(body.parent_id) : null;
    const description  = body.description  || null;

    const document_code       = body.document_code       || null;
    const output_format_type  = body.output_format_type  || null;
    const costing             = (body.costing  !== undefined && !isNaN(parseFloat(body.costing)))  ? parseFloat(body.costing)  : null;
    const man_hours           = (body.man_hours !== undefined && !isNaN(parseFloat(body.man_hours))) ? parseFloat(body.man_hours) : null;

    const result = await pool.query(
      `UPDATE tasks
       SET title              = $1,
           assigned_to        = $2,
           reviewed_by        = $3,
           target_date        = $4,
           start_date         = $5,
           due_date           = $6,
           end_date           = $7,
           status             = $8,
           days_taken         = $9,
           depends_on         = $10,
           link               = $11,
           parent_id          = $12,
           description        = $13,
           document_code      = $14,
           output_format_type = $15,
           costing            = $16,
           man_hours          = $17
       WHERE id = $18
       RETURNING *`,
      [
        title, assigned_to, reviewed_by, target_date,
        start_date, due_date, end_date, status,
        days_taken, depends_on, link, parent_id, description,
        document_code, output_format_type, costing, man_hours, id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ msg: "Task not found" });
    }
    res.json(result.rows[0]);

  } catch (err) {
    console.error(`TASK EDIT ERROR [ID=${req.params.id}]:`, err.stack);
    res.status(500).json({ msg: "Failed to update task", error: err.message });
  }
});


router.get("/list", verifyToken, async (req, res) => {
  try {
    let query = `
      SELECT
        t.id, t.title, t.target_date, t.start_date,
        t.due_date, t.end_date, t.status, t.days_taken,
        t.link, t.assignment_date, t.parent_id, t.description,
        t.document_code, t.output_format_type, t.costing, t.man_hours,
        t.assigned_to,
        assigned_emp.fullname  AS assigned_to_name,
        emp_details.employee_uav_id AS assigned_to_uav_id,
        emp_details.department AS assigned_dept,
        reviewed_emp.fullname  AS reviewed_by,
        depends_emp.fullname   AS depends_on_name,
        (SELECT COUNT(*) FROM tasks st WHERE st.parent_id = t.id)::int AS subtask_count
      FROM tasks t
      LEFT JOIN users assigned_emp ON t.assigned_to = assigned_emp.id
      LEFT JOIN employees emp_details ON t.assigned_to = emp_details.user_id
      LEFT JOIN users reviewed_emp ON t.reviewed_by = reviewed_emp.id
      LEFT JOIN users depends_emp  ON t.depends_on  = depends_emp.id
    `;
    const params = [];
    const roleMatch = req.user.role?.toLowerCase();

    if (roleMatch === "employee" || roleMatch === "intern") {
      params.push(req.user.id);
      query += ` WHERE t.assigned_to = $${params.length}`;
    } else if (roleMatch !== "super_admin") {
      const adminRes = await pool.query(
        "SELECT department FROM users WHERE id = $1", [req.user.id]
      );
      const dept = adminRes.rows[0]?.department;
      if (dept) {
        params.push(dept);
        query += ` WHERE emp_details.department = $${params.length}`;
      }
    }

    query += " ORDER BY t.id ASC";

    const result = await pool.query(query, params);
    const rows = result.rows;

    // ── Compute task_code per level ──
    // Level 0 = no parent_id → MTA####
    // Level 1 = has parent_id but parent has no parent_id → STA####
    // Level 2 = parent's parent also exists → TAA####
    const idSet = new Set(rows.map(r => r.id));
    const parentOf = {};
    rows.forEach(r => { parentOf[r.id] = r.parent_id; });

    const getLevel = (id, visited = new Set()) => {
      if (visited.has(id)) return 0;
      visited.add(id);
      const pid = parentOf[id];
      if (!pid) return 0;
      return 1 + getLevel(pid, visited);
    };

    const counters = { 0: 0, 1: 0, 2: 0 };
    const codeMap = {};
    rows.forEach(r => {
      const lvl = getLevel(r.id);
      counters[lvl] = (counters[lvl] || 0) + 1;
      const seq = String(counters[lvl]).padStart(4, '0');
      const prefix = lvl === 0 ? 'MTA' : lvl === 1 ? 'STA' : 'TAA';
      codeMap[r.id] = `${prefix}${seq}`;
    });

    const withCodes = rows.map(r => ({ ...r, task_code: codeMap[r.id] }));
    res.json(withCodes);
  } catch (err) {
    console.error("LIST ERROR:", err.message);
    res.status(500).json({ error: "Fetch failed" });
  }
});

router.get("/all", verifyToken, async (req, res) => {
  try {
    let query = `
      SELECT t.*, u.fullname AS employee_name
      FROM tasks t
      JOIN users u ON t.assigned_to = u.id
    `;
    const params = [];
    const roleMatch = req.user.role?.toLowerCase();

    if (roleMatch === "employee" || roleMatch === "intern") {
      params.push(req.user.id);
      query += ` WHERE t.assigned_to = $${params.length}`;
    } else if (roleMatch !== "super_admin") {
      const adminRes = await pool.query(
        "SELECT department FROM users WHERE id = $1", [req.user.id]
      );
      const dept = adminRes.rows[0]?.department;
      if (dept) {
        params.push(dept);
        query += ` WHERE u.department = $${params.length}`;
      }
    }

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Fetch failed" });
  }
});

router.get("/calendar-events", verifyToken, async (req, res) => {
  try {
    let query = `
      SELECT t.id, t.title, t.due_date AS start, t.status, u.fullname
      FROM tasks t
      LEFT JOIN users u ON t.assigned_to = u.id
    `;
    const params = [];
    const roleMatch = req.user.role?.toLowerCase();

    if (roleMatch === "employee" || roleMatch === "intern") {
      query += " WHERE t.assigned_to = $1";
      params.push(req.user.id);
    }

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ msg: "Error fetching calendar events" });
  }
});
 


router.get("/download-excel", verifyToken, async (req, res) => {
  try {
    const token = req.query.token;
    if (!token) return res.status(401).json({ msg: "No token provided" });

    let query = `
      SELECT
        t.title,
        assigned_emp.fullname  AS assigned_to,
        reviewed_emp.fullname  AS reviewed_by,
        t.target_date, t.start_date, t.due_date, t.end_date,
        t.status, t.days_taken,
        depends_emp.fullname   AS depends_on,
        t.link
      FROM tasks t
      LEFT JOIN users assigned_emp ON t.assigned_to = assigned_emp.id
      LEFT JOIN users reviewed_emp ON t.reviewed_by = reviewed_emp.id
      LEFT JOIN users depends_emp  ON t.depends_on  = depends_emp.id
    `;
    const params = [];
    const roleMatch = req.user.role?.toLowerCase();

    if (roleMatch === "employee" || roleMatch === "intern") {
      query += " WHERE t.assigned_to = $1";
      params.push(req.user.id);
    }

    query += " ORDER BY t.id ASC";

    const result = await pool.query(query, params);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Tasks");

    // Headers
    sheet.columns = [
      { header: "Task",        key: "title",       width: 30 },
      { header: "Assigned To", key: "assigned_to", width: 20 },
      { header: "Reviewed By", key: "reviewed_by", width: 20 },
      { header: "Target Date",   key: "target_date",   width: 12 },
      { header: "Start Date",  key: "start_date",  width: 14 },
      { header: "Due Date",    key: "due_date",     width: 14 },
      { header: "End Date",    key: "end_date",     width: 14 },
      { header: "Status",      key: "status",       width: 14 },
      { header: "Days Taken",  key: "days_taken",   width: 12 },
      { header: "Depends On",  key: "depends_on",   width: 20 },
      { header: "Link",        key: "link",         width: 30 },
    ];

    // Bold header row
    sheet.getRow(1).font = { bold: true };

    result.rows.forEach(row => sheet.addRow(row));

    // ✅ inline so Google can fetch it — not attachment
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "inline; filename=tasks.xlsx");

    await workbook.xlsx.write(res);
    res.end();

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

export default router;