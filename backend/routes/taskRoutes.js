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
   
    
   
    const usersRes = await pool.query("SELECT id, fullname, role FROM users");
    const users = usersRes.rows;

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; 

      const title = row.getCell(1).value?.toString();
      const assigneeName = row.getCell(2).value?.toString()?.trim();
      const targetDate = row.getCell(3).value?.toString() || null;
      let dueDate = row.getCell(4).value;

      if (!title) return; 

      let assignedToId = null;
      if (assigneeName) {
        const user = users.find(u => u.fullname && u.fullname.toLowerCase() === assigneeName.toLowerCase());
        assignedToId = user ? user.id : null;
      }

      
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
    const priority     = body.priority     || 'Normal';

    
    const requesterRole = req.user.role?.toLowerCase();
    const isAdminType = requesterRole === "admin" || requesterRole === "super_admin";

    if (!isAdminType) {
      if (!parent_id) {
        return res.status(403).json({ msg: "Only admins can create a new top-level task. You can only split up a task that was assigned to you." });
      }
      const parentRes = await pool.query(
        "SELECT assigned_to, parent_id FROM tasks WHERE id = $1",
        [parent_id]
      );
      if (parentRes.rows.length === 0) {
        return res.status(404).json({ msg: "Parent task not found" });
      }
      const parentTask = parentRes.rows[0];
      const isOwner = parentTask.assigned_to === req.user.id;
      const isRootTask = parentTask.parent_id === null;
      if (!isOwner || !isRootTask) {
        return res.status(403).json({ msg: "You can only delegate a task that was assigned directly to you, and only one level deep." });
      }
    }

   
    try {
      await pool.query("ALTER TABLE tasks ADD COLUMN priority VARCHAR(20) DEFAULT 'Normal'");
    } catch(e) {}

  
    const is_recurring = body.is_recurring === true || body.is_recurring === "true";
    const recurring_frequency = is_recurring ? (body.recurring_frequency || null) : null; // 'Monthly' | 'Quarterly' | 'Yearly'
    const recurring_end_date  = is_recurring ? (body.recurring_end_date  || null) : null;
    const category = is_recurring ? (body.category || null) : null; // e.g. "Website Maintenance"

    const result = await pool.query(
      `INSERT INTO tasks (
        title, assigned_to, assigned_by, reviewed_by,
        target_date, start_date, due_date, end_date,
        status, days_taken, depends_on, link, assignment_date,
        parent_id, description,
        is_recurring, recurring_frequency, recurring_end_date, last_generated_date,
        category, priority
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
      RETURNING *`,
      [
        title, assigned_to, assigned_by, reviewed_by,
        target_date, start_date, due_date, end_date,
        status, days_taken, depends_on, link, assignment_date,
        parent_id, description,
        is_recurring, recurring_frequency, recurring_end_date,
        is_recurring ? due_date : null, // seed last_generated_date so cron knows where to count from
        category, priority
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
    const priority     = body.priority     || 'Normal';

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
           man_hours          = $17,
           priority           = $18
       WHERE id = $19
       RETURNING *`,
      [
        title, assigned_to, reviewed_by, target_date,
        start_date, due_date, end_date, status,
        days_taken, depends_on, link, parent_id, description,
        document_code, output_format_type, costing, man_hours, priority, id
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
        t.document_code, t.output_format_type, t.costing, t.man_hours, t.priority,
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
      query = `
        WITH RECURSIVE task_hierarchy AS (
          SELECT * FROM tasks WHERE assigned_to = $1
          UNION
          SELECT parent.*
          FROM tasks parent
          JOIN task_hierarchy child ON child.parent_id = parent.id
        )
        SELECT
          t.id, t.title, t.target_date, t.start_date,
          t.due_date, t.end_date, t.status, t.days_taken,
          t.link, t.assignment_date, t.parent_id, t.description,
          t.document_code, t.output_format_type, t.costing, t.man_hours, t.priority,
          t.assigned_to,
          assigned_emp.fullname  AS assigned_to_name,
          emp_details.employee_uav_id AS assigned_to_uav_id,
          emp_details.department AS assigned_dept,
          reviewed_emp.fullname  AS reviewed_by,
          depends_emp.fullname   AS depends_on_name,
          (SELECT COUNT(*) FROM tasks st WHERE st.parent_id = t.id)::int AS subtask_count
        FROM task_hierarchy t
        LEFT JOIN users assigned_emp ON t.assigned_to = assigned_emp.id
        LEFT JOIN employees emp_details ON t.assigned_to = emp_details.user_id
        LEFT JOIN users reviewed_emp ON t.reviewed_by = reviewed_emp.id
        LEFT JOIN users depends_emp  ON t.depends_on  = depends_emp.id
        ORDER BY t.id ASC
      `;
    } else if (roleMatch !== "super_admin") {
      
      const adminRes = await pool.query(
        "SELECT department FROM users WHERE id = $1", [req.user.id]
      );
      const dept = adminRes.rows[0]?.department;
      if (dept) {
        params.push(req.user.id, dept);
        query += ` WHERE (t.assigned_to = $${params.length - 1} OR emp_details.department = $${params.length} OR t.assigned_by = $${params.length - 1})`;
      } else {
        
      }
      query += " ORDER BY t.id ASC";
    } else {
      query += " ORDER BY t.id ASC";
    }

    const result = await pool.query(query, params);
    const rows = result.rows;

   
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

    
    sheet.getRow(1).font = { bold: true };

    result.rows.forEach(row => sheet.addRow(row));

    
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "inline; filename=tasks.xlsx");

    await workbook.xlsx.write(res);
    res.end();

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});



router.get("/my-stats", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const roleMatch = req.user.role?.toLowerCase();
    const todayStr = new Date().toISOString().split("T")[0];

    let whereClause = "";
    const params = [todayStr];

    if (roleMatch === "employee" || roleMatch === "intern") {
      whereClause = `AND t.assigned_to = $2`;
      params.push(userId);
    } else if (roleMatch !== "super_admin") {
      const adminRes = await pool.query("SELECT department FROM users WHERE id = $1", [userId]);
      const dept = adminRes.rows[0]?.department;
      if (dept) {
        whereClause = `AND (t.assigned_to = $2 OR emp_details.department = $3 OR t.assigned_by = $2)`;
        params.push(userId, dept);
      }
    }

    const result = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE t.status = 'Pending' AND (t.due_date IS NULL OR t.due_date >= $1))                          AS yet_to_start,
        COUNT(*) FILTER (WHERE t.status NOT IN ('Completed') AND t.due_date IS NOT NULL AND t.due_date < $1)              AS delayed,
        COUNT(*) FILTER (WHERE t.due_date = $1 AND t.status NOT IN ('Completed'))                                          AS due_today,
        COUNT(*) FILTER (WHERE t.status IN ('In Progress', 'Review', 'On Hold'))                                           AS in_progress,
        COUNT(*) FILTER (WHERE t.status = 'Completed')                                                                     AS completed,
        COUNT(*)                                                                                                            AS total
      FROM tasks t
      LEFT JOIN employees emp_details ON t.assigned_to = emp_details.user_id
      WHERE 1=1 ${whereClause}
    `, params);

   
    const creditRes = await pool.query(`
      WITH RECURSIVE task_roots AS (
        SELECT id, id AS root_id FROM tasks WHERE parent_id IS NULL
        UNION ALL
        SELECT t.id, tr.root_id
        FROM tasks t
        JOIN task_roots tr ON t.parent_id = tr.id
      )
      SELECT COUNT(*) AS credited_completed
      FROM task_roots tr
      JOIN tasks leaf ON leaf.id = tr.id
      JOIN tasks root ON root.id = tr.root_id
      WHERE leaf.status = 'Completed' AND root.assigned_by = $1
    `, [userId]);

    res.json({
      ...result.rows[0],
      creditedCompleted: parseInt(creditRes.rows[0].credited_completed) || 0,
    });
  } catch (err) {
    console.error("TASK STATS ERROR:", err.message);
    res.status(500).json({ msg: "Failed to fetch task stats" });
  }
});


router.get("/:id/chain", verifyToken, async (req, res) => {
  try {
    const taskId = parseInt(req.params.id);
    if (isNaN(taskId)) return res.status(400).json({ msg: "Invalid task id" });

    const result = await pool.query(`
      WITH RECURSIVE chain AS (
        SELECT id, parent_id, assigned_by, assigned_to, 0 AS level
        FROM tasks WHERE id = $1
        UNION ALL
        SELECT t.id, t.parent_id, t.assigned_by, t.assigned_to, c.level + 1
        FROM tasks t
        JOIN chain c ON t.id = c.parent_id
      )
      SELECT
        c.id, c.level,
        ub.fullname AS assigned_by_name,
        ut.fullname AS assigned_to_name
      FROM chain c
      LEFT JOIN users ub ON ub.id = c.assigned_by
      LEFT JOIN users ut ON ut.id = c.assigned_to
      ORDER BY c.level DESC
    `, [taskId]);

    res.json(result.rows);
  } catch (err) {
    console.error("TASK CHAIN ERROR:", err.message);
    res.status(500).json({ msg: "Failed to fetch task chain" });
  }
});




router.get("/employees", verifyToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        u.id,
        u.fullname,
        u.role,
        e.department,
        e.designation
      FROM users u
      LEFT JOIN employees e ON e.user_id = u.id
      WHERE u.role = 'admin'
      ORDER BY u.fullname ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("EMPLOYEES FETCH ERROR:", err.message);
    res.status(500).json({ msg: "Failed to fetch employees" });
  }
});



router.get("/:id/comments", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      SELECT
        tc.id, tc.task_id, tc.comment, tc.created_at,
        author.fullname AS author_name,
        tagged.fullname AS tagged_name,
        tc.tagged_user_id, tc.handoff_task_id
      FROM task_comments tc
      LEFT JOIN users author ON tc.author_id = author.id
      LEFT JOIN users tagged ON tc.tagged_user_id = tagged.id
      WHERE tc.task_id = $1
      ORDER BY tc.created_at ASC
    `, [id]);
    res.json(result.rows);
  } catch (err) {
    console.error("COMMENT FETCH ERROR:", err.message);
    res.status(500).json({ msg: "Failed to fetch comments" });
  }
});



router.post("/:id/comment", verifyToken, async (req, res) => {
  try {
    const taskId = parseInt(req.params.id);
    const authorId = req.user.id;
    const { comment, tagged_user_id } = req.body;

    if (!comment?.trim()) {
      return res.status(400).json({ msg: "Comment cannot be empty" });
    }

    
    const taskRes = await pool.query("SELECT * FROM tasks WHERE id = $1", [taskId]);
    if (!taskRes.rows.length) return res.status(404).json({ msg: "Task not found" });
    const origTask = taskRes.rows[0];

    let handoffTaskId = null;

    
    if (tagged_user_id && parseInt(tagged_user_id) !== authorId) {
      const tuid = parseInt(tagged_user_id);

     
      const newTaskRes = await pool.query(`
        INSERT INTO tasks (title, assigned_to, assigned_by, parent_id, status, due_date, target_date, description, assignment_date)
        VALUES ($1, $2, $3, $4, 'Pending', $5, $6, $7, CURRENT_DATE)
        RETURNING id
      `, [
        origTask.title,
        tuid,
        authorId,
        origTask.parent_id || null,
        origTask.due_date || null,
        origTask.target_date || null,
        `[Handed off from task #${taskId}] ${origTask.description || ""}`.trim()
      ]);
      handoffTaskId = newTaskRes.rows[0].id;

     
      await pool.query("UPDATE tasks SET status = 'Completed', end_date = CURRENT_DATE WHERE id = $1", [taskId]);

      
      await createNotification(tuid, `Task handed off to you: "${origTask.title}" — see task #${handoffTaskId}`, "info");
    }

    
    const commentRes = await pool.query(`
      INSERT INTO task_comments (task_id, author_id, comment, tagged_user_id, handoff_task_id)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, created_at
    `, [taskId, authorId, comment.trim(), tagged_user_id || null, handoffTaskId]);

    res.status(201).json({
      comment_id: commentRes.rows[0].id,
      handoff_task_id: handoffTaskId,
      msg: handoffTaskId
        ? `Task handed off to colleague. New task #${handoffTaskId} created.`
        : "Comment added successfully."
    });
  } catch (err) {
    console.error("COMMENT POST ERROR:", err.message);
    res.status(500).json({ msg: "Failed to add comment", error: err.message });
  }
});


router.get("/recurring-instances", verifyToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        t.id, t.title, t.category, t.recurring_frequency AS frequency,
        t.due_date, t.status, t.end_date, t.link,
        t.reviewed_by AS reviewer_id,
        reviewer.fullname AS reviewer_name,
        reviewer.role AS reviewer_role
      FROM tasks t
      LEFT JOIN users reviewer ON reviewer.id = t.reviewed_by
      WHERE t.recurring_template_id IS NOT NULL
      ORDER BY t.due_date ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("RECURRING INSTANCES FETCH ERROR:", err.message);
    res.status(500).json({ msg: "Failed to fetch recurring task instances" });
  }
});


router.post("/recurring-manual", verifyToken, async (req, res) => {
  try {
    const { title, category, recurring_frequency, due_date, reviewer_id } = req.body;
    const assigned_by = req.user.id;
    
   
    const tplRes = await pool.query(
      `INSERT INTO tasks (title, is_recurring, recurring_frequency, category, assigned_by, reviewed_by, status, due_date, last_generated_date)
       VALUES ($1, true, $2, $3, $4, $5, 'Pending', $6, $6) RETURNING id`,
       [title, recurring_frequency, category, assigned_by, reviewer_id, due_date]
    );
    const templateId = tplRes.rows[0].id;
    
    
    const instRes = await pool.query(
      `INSERT INTO tasks (title, category, recurring_frequency, due_date, status, recurring_template_id, assigned_by, reviewed_by, assignment_date)
       VALUES ($1, $2, $3, $4, 'Pending', $5, $6, $7, CURRENT_DATE) RETURNING *`,
       [title, category, recurring_frequency, due_date, templateId, assigned_by, reviewer_id]
    );
    
    res.status(201).json(instRes.rows[0]);
  } catch (err) {
    console.error("RECURRING MANUAL ADD ERROR:", err.message);
    res.status(500).json({ msg: "Failed to manually add recurring task" });
  }
});


router.patch("/:id/verify", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { verified } = req.body;

    if (typeof verified !== "boolean") {
      return res.status(400).json({ msg: "`verified` must be a boolean" });
    }

    const result = await pool.query(
      `UPDATE tasks
       SET status   = $1,
           end_date = $2
       WHERE id = $3 AND recurring_template_id IS NOT NULL
       RETURNING id, status, end_date`,
      [verified ? "Completed" : "Pending", verified ? new Date().toISOString().split("T")[0] : null, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ msg: "Recurring task instance not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("RECURRING VERIFY ERROR:", err.message);
    res.status(500).json({ msg: "Failed to update verification status" });
  }
});


router.patch("/:id/reviewer", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const reviewer_id = parseInt(req.body.reviewer_id);

    if (!reviewer_id || isNaN(reviewer_id)) {
      return res.status(400).json({ msg: "reviewer_id is required" });
    }

    const result = await pool.query(
      `UPDATE tasks
       SET reviewed_by = $1
       WHERE id = $2 AND recurring_template_id IS NOT NULL
       RETURNING id, reviewed_by`,
      [reviewer_id, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ msg: "Recurring task instance not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("RECURRING REVIEWER ERROR:", err.message);
    res.status(500).json({ msg: "Failed to update reviewer" });
  }
});

export default router;