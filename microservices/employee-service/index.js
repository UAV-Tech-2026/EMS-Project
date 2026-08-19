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

// Health Check
app.get("/health", (req, res) => {
  res.json({ service: "employee-service", status: "UP", port: process.env.PORT });
});

// Feature route: GET /users
app.get("/users", authMiddleware, async (req, res) => {
  try {
    // Add feature logic here
    res.json({ message: "GET /users successful in employee-service" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});
// Feature route: POST /users/enroll
app.post("/users/enroll", authMiddleware, async (req, res) => {
  try {
    // Add feature logic here
    res.json({ message: "POST /users/enroll successful in employee-service" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});
// Feature route: PUT /users/:id
app.put("/users/:id", authMiddleware, async (req, res) => {
  try {
    // Add feature logic here
    res.json({ message: "PUT /users/:id successful in employee-service" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});
// Feature route: GET /users/:id
app.get("/users/:id", authMiddleware, async (req, res) => {
  try {
    // Add feature logic here
    res.json({ message: "GET /users/:id successful in employee-service" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});
// Feature route: GET /departments
app.get("/departments", authMiddleware, async (req, res) => {
  try {
    // Add feature logic here
    res.json({ message: "GET /departments successful in employee-service" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});
// Feature route: POST /departments
app.post("/departments", authMiddleware, async (req, res) => {
  try {
    // Add feature logic here
    res.json({ message: "POST /departments successful in employee-service" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});


const PORT = process.env.PORT || 3005;
app.listen(PORT, () => {
  console.log("employee-service is running on port " + PORT);
});
