
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { Pool } = require("pg");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

const JWT_SECRET = process.env.JWT_SECRET || "ems_2026";

// Auth middleware
const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized: Missing Token" });
  }
  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: "Unauthorized: Invalid Token" });
  }
};

// Permission middleware
const checkPermission = (featureName, requiredAccess) => {
  return async (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    
    try {
      // Superadmin bypass
      const userRes = await pool.query("SELECT role FROM users WHERE id = $1", [req.user.id]);
      if (userRes.rows.length > 0 && (userRes.rows[0].role === 'superadmin' || userRes.rows[0].role === 'SUPER_ADMIN')) {
        return next();
      }

      // Check permissions table
      const permRes = await pool.query(
        "SELECT * FROM permissions WHERE user_id = $1 AND feature_name = $2",
        [req.user.id, featureName]
      );
      
      if (permRes.rows.length === 0) {
        return res.status(403).json({ error: "Forbidden: No permissions for this feature" });
      }

      const permission = permRes.rows[0];
      if (requiredAccess === "read" && !permission.can_read) {
        return res.status(403).json({ error: "Forbidden: Missing read access" });
      }
      if (requiredAccess === "write" && !permission.can_write) {
        return res.status(403).json({ error: "Forbidden: Missing write access" });
      }
      
      next();
    } catch (error) {
      console.error("Permission check error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  };
};

// Ensure comment/handoff table exists (tasks/users/notifications are assumed
// to already exist in ems_dbs1 via ensure_schema.js)
const ensureCommentSchema = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS task_comments (
      id SERIAL PRIMARY KEY,
      task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE NOT NULL,
      author_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      comment TEXT NOT NULL,
      tagged_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      handoff_task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
};
ensureCommentSchema().catch(err => console.error("SCHEMA ENSURE ERROR:", err.message));

// Small notification helper (mirrors notificationRoutes.js's createNotification)
const createNotification = async (userId, message, type = "info") => {
  try {
    await pool.query(
      "INSERT INTO notifications (user_id, message, type) VALUES ($1, $2, $3)",
      [userId, message, type]
    );
  } catch (err) {
    console.error("NOTIFICATION CREATE ERROR:", err.message);
  }
};

// Health Check
app.get("/health", (req, res) => {
  res.json({ service: "task-service", status: "UP", port: process.env.PORT });
});

// Feature route: GET /tasks
app.get("/tasks", authMiddleware, async (req, res) => {
  try {
    // Add feature logic here
    res.json({ message: "GET /tasks successful in task-service" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});
// Feature route: POST /tasks
app.post("/tasks", authMiddleware, async (req, res) => {
  try {
    // Add feature logic here
    res.json({ message: "POST /tasks successful in task-service" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});
// Feature route: PUT /tasks/:id
app.put("/tasks/:id", authMiddleware, async (req, res) => {
  try {
    // Add feature logic here
    res.json({ message: "PUT /tasks/:id successful in task-service" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});
// Feature route: DELETE /tasks/:id
app.delete("/tasks/:id", authMiddleware, async (req, res) => {
  try {
    // Add feature logic here
    res.json({ message: "DELETE /tasks/:id successful in task-service" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});
// Feature route: GET /tasks/my
app.get("/tasks/my", authMiddleware, async (req, res) => {
  try {
    // Add feature logic here
    res.json({ message: "GET /tasks/my successful in task-service" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});


// Get comment thread for a task
app.get("/tasks/:id/comments", authMiddleware, async (req, res) => {
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
  } catch (error) {
    console.error("COMMENT FETCH ERROR:", error.message);
    res.status(500).json({ error: "Failed to fetch comments" });
  }
});

// Add a comment; optionally @tag a colleague to hand the task off to them.
// Tagging: closes the task for the author, opens a new task for the tagged user.
app.post("/tasks/:id/comment", authMiddleware, async (req, res) => {
  try {
    const taskId = parseInt(req.params.id);
    const authorId = req.user.id;
    const { comment, tagged_user_id } = req.body;

    if (!comment?.trim()) {
      return res.status(400).json({ error: "Comment cannot be empty" });
    }

    const taskRes = await pool.query("SELECT * FROM tasks WHERE id = $1", [taskId]);
    if (!taskRes.rows.length) return res.status(404).json({ error: "Task not found" });
    const origTask = taskRes.rows[0];

    let handoffTaskId = null;

    if (tagged_user_id && parseInt(tagged_user_id) !== authorId) {
      const tuid = parseInt(tagged_user_id);

      // Create the handoff task for the tagged colleague
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

      // Close the original task for the person tagging
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
  } catch (error) {
    console.error("COMMENT POST ERROR:", error.message);
    res.status(500).json({ error: "Failed to add comment" });
  }
});

const PORT = process.env.PORT || 3004;
app.listen(PORT, () => {
  console.log("task-service is running on port " + PORT);
});





// const express = require("express");
// const cors = require("cors");
// const jwt = require("jsonwebtoken");
// const { Pool } = require("pg");
// require("dotenv").config();

// const app = express();
// app.use(cors());
// app.use(express.json());

// const pool = new Pool({
//   connectionString: process.env.DATABASE_URL
// });

// const JWT_SECRET = process.env.JWT_SECRET || "ems_2026";

// // Auth middleware
// const authMiddleware = (req, res, next) => {
//   const authHeader = req.headers.authorization;
//   if (!authHeader || !authHeader.startsWith("Bearer ")) {
//     return res.status(401).json({ error: "Unauthorized: Missing Token" });
//   }
//   const token = authHeader.split(" ")[1];
//   try {
//     const decoded = jwt.verify(token, JWT_SECRET);
//     req.user = decoded;
//     next();
//   } catch (error) {
//     return res.status(401).json({ error: "Unauthorized: Invalid Token" });
//   }
// };

// // Permission middleware
// const checkPermission = (featureName, requiredAccess) => {
//   return async (req, res, next) => {
//     if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    
//     try {
//       // Superadmin bypass
//       const userRes = await pool.query("SELECT role FROM users WHERE id = $1", [req.user.id]);
//       if (userRes.rows.length > 0 && (userRes.rows[0].role === 'superadmin' || userRes.rows[0].role === 'SUPER_ADMIN')) {
//         return next();
//       }

//       // Check permissions table
//       const permRes = await pool.query(
//         "SELECT * FROM permissions WHERE user_id = $1 AND feature_name = $2",
//         [req.user.id, featureName]
//       );
      
//       if (permRes.rows.length === 0) {
//         return res.status(403).json({ error: "Forbidden: No permissions for this feature" });
//       }

//       const permission = permRes.rows[0];
//       if (requiredAccess === "read" && !permission.can_read) {
//         return res.status(403).json({ error: "Forbidden: Missing read access" });
//       }
//       if (requiredAccess === "write" && !permission.can_write) {
//         return res.status(403).json({ error: "Forbidden: Missing write access" });
//       }
      
//       next();
//     } catch (error) {
//       console.error("Permission check error:", error);
//       res.status(500).json({ error: "Internal server error" });
//     }
//   };
// };

// // Health Check
// app.get("/health", (req, res) => {
//   res.json({ service: "task-service", status: "UP", port: process.env.PORT });
// });

// // Feature route: GET /tasks
// app.get("/tasks", authMiddleware, async (req, res) => {
//   try {
//     // Add feature logic here
//     res.json({ message: "GET /tasks successful in task-service" });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ error: "Internal server error" });
//   }
// });
// // Feature route: POST /tasks
// app.post("/tasks", authMiddleware, async (req, res) => {
//   try {
//     // Add feature logic here
//     res.json({ message: "POST /tasks successful in task-service" });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ error: "Internal server error" });
//   }
// });
// // Feature route: PUT /tasks/:id
// app.put("/tasks/:id", authMiddleware, async (req, res) => {
//   try {
//     // Add feature logic here
//     res.json({ message: "PUT /tasks/:id successful in task-service" });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ error: "Internal server error" });
//   }
// });
// // Feature route: DELETE /tasks/:id
// app.delete("/tasks/:id", authMiddleware, async (req, res) => {
//   try {
//     // Add feature logic here
//     res.json({ message: "DELETE /tasks/:id successful in task-service" });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ error: "Internal server error" });
//   }
// });
// // Feature route: GET /tasks/my
// app.get("/tasks/my", authMiddleware, async (req, res) => {
//   try {
//     // Add feature logic here
//     res.json({ message: "GET /tasks/my successful in task-service" });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ error: "Internal server error" });
//   }
// });


// const PORT = process.env.PORT || 3004;
// app.listen(PORT, () => {
//   console.log("task-service is running on port " + PORT);
// });
