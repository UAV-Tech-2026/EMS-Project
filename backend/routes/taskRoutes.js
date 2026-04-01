import express from "express";
import pool from "../db.js";
import { verifyToken } from "../middleware/authMiddleware.js";
import multer from "multer";
import ExcelJS from "exceljs";

const router = express.Router();
const upload = multer({ dest: "uploads/" });

router.post("/upload", verifyToken, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ msg: "No file uploaded" });

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(req.file.path);
    const worksheet = workbook.worksheets[0];

    const tasksToInsert = [];
    // Assuming Row 1 is headers: Title, Assignee (UAV ID or Exact Name), Man Hours, Due Date
    
    // Fetch all employees to find IDs by name
    const usersRes = await pool.query("SELECT id, fullname, role FROM users");
    const users = usersRes.rows;

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // Skip headers

      const title = row.getCell(1).value?.toString();
      const assigneeName = row.getCell(2).value?.toString()?.trim();
      const manHours = row.getCell(3).value?.toString() || null;
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

      tasksToInsert.push({ title, assignedToId, manHours, dueDate });
    });

    for (const t of tasksToInsert) {
      await pool.query(
        `INSERT INTO tasks (title, assigned_to, assigned_by, man_hours, due_date, status, assignment_date)
         VALUES ($1, $2, $3, $4, $5, 'Pending', NOW())`,
        [t.title, t.assignedToId, req.user.id, t.manHours, t.dueDate]
      );
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
    const {
      title, assigned_to, reviewed_by, man_hours,
      start_date, due_date, end_date, status,
      days_taken, depends_on, link, assignment_date,
    } = req.body;

    const assigned_by = req.user.id;

    const result = await pool.query(
      `INSERT INTO tasks (
        title, assigned_to, assigned_by, reviewed_by,
        man_hours, start_date, due_date, end_date,
        status, days_taken, depends_on, link, assignment_date
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      RETURNING *`,
      [
        title, assigned_to, assigned_by,
        reviewed_by  || null, man_hours   || null,
        start_date   || null, due_date    || null,
        end_date     || null, status      || "Pending",
        days_taken   || null, depends_on  || null,
        link         || null,
        assignment_date || new Date().toISOString().split("T")[0],
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("TASK ERROR:", err.message);
    res.status(500).json({ msg: err.message });
  }
});


router.put("/edit/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title, assigned_to, reviewed_by, man_hours,
      start_date, due_date, end_date, status,
      days_taken, depends_on, link
    } = req.body;

    const result = await pool.query(
      `UPDATE tasks
       SET title = COALESCE($1, title),
           assigned_to = COALESCE($2, assigned_to),
           reviewed_by = COALESCE($3, reviewed_by),
           man_hours = COALESCE($4, man_hours),
           start_date = COALESCE($5, start_date),
           due_date = COALESCE($6, due_date),
           end_date = COALESCE($7, end_date),
           status = COALESCE($8, status),
           days_taken = COALESCE($9, days_taken),
           depends_on = COALESCE($10, depends_on),
           link = COALESCE($11, link)
       WHERE id = $12
       RETURNING *`,
      [
        title || null, assigned_to || null, reviewed_by || null, 
        man_hours || null, start_date || null, due_date || null, 
        end_date || null, status || null, days_taken || null, 
        depends_on || null, link || null, id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ msg: "Task not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error("TASK EDIT ERROR:", err.message);
    res.status(500).json({ msg: "Failed to update task" });
  }
});


router.get("/list", verifyToken, async (req, res) => {
  try {
    let query = `
      SELECT
        t.id, t.title, t.man_hours, t.start_date,
        t.due_date, t.end_date, t.status, t.days_taken,
        t.link, t.assignment_date,
        assigned_emp.fullname  AS assigned_to_name,
        reviewed_emp.fullname  AS reviewed_by,
        depends_emp.fullname   AS depends_on_name
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

    query += " ORDER BY t.id DESC";

    const result = await pool.query(query, params);
    res.json(result.rows);
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
      query += " WHERE t.assigned_to = $1";
      params.push(req.user.id);
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
        t.man_hours, t.start_date, t.due_date, t.end_date,
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

    query += " ORDER BY t.id DESC";

    const result = await pool.query(query, params);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Tasks");

    // Headers
    sheet.columns = [
      { header: "Task",        key: "title",       width: 30 },
      { header: "Assigned To", key: "assigned_to", width: 20 },
      { header: "Reviewed By", key: "reviewed_by", width: 20 },
      { header: "Man Hours",   key: "man_hours",   width: 12 },
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