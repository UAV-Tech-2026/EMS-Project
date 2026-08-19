const fs = require("fs");
const path = require("path");

const services = [
  { name: "auth-service", port: 3010, routes: ["POST /auth/login", "GET /auth/me", "GET /permissions/my", "PUT /permissions/:userId", "GET /admins"] },
  { name: "attendance-service", port: 3001, routes: ["GET /attendance/today", "POST /attendance/bulk", "POST /attendance/upload", "GET /attendance/records", "GET /attendance/reports"] },
  { name: "leave-service", port: 3002, routes: ["GET /leaves", "POST /leaves/apply", "PUT /leaves/:id/approve", "PUT /leaves/:id/reject", "GET /leaves/my"] },
  { name: "payroll-service", port: 3003, routes: ["GET /payslips", "POST /payslips/generate", "GET /payslips/:userId", "GET /dpr", "POST /dpr"] },
  { name: "task-service", port: 3004, routes: ["GET /tasks", "POST /tasks", "PUT /tasks/:id", "DELETE /tasks/:id", "GET /tasks/my"] },
  { name: "employee-service", port: 3005, routes: ["GET /users", "POST /users/enroll", "PUT /users/:id", "GET /users/:id", "GET /departments", "POST /departments"] },
  { name: "bulletin-service", port: 3006, routes: ["GET /bulletins", "POST /bulletins", "DELETE /bulletins/:id"] },
  { name: "meeting-service", port: 3007, routes: ["GET /meetings", "POST /meetings", "PUT /meetings/:id", "DELETE /meetings/:id"] },
  { name: "request-service", port: 3008, routes: ["GET /requests", "POST /requests", "PUT /requests/:id/status"] },
  { name: "inventory-service", port: 3009, routes: ["GET /products", "POST /products", "GET /products/:id", "POST /products/:id/add-quantity", "POST /stock-in"] },
  { name: "transaction-service", port: 3013, routes: ["POST /stock-out", "POST /return", "GET /reports/transactions/:productId"] },
  { name: "withdrawal-service", port: 3011, routes: ["GET /my-withdrawals", "GET /all-withdrawals", "GET /reports/withdrawal-summary/:productId"] },
  { name: "maintenance-service", port: 3012, routes: ["POST /maintenance", "GET /maintenance/:productId"] }
];

const dockercomposeTemplate = (name, port) => `version: "3.9"
services:
  ${name}:
    build: .
    container_name: ${name}
    restart: always
    ports:
      - "${port}:${port}"
    environment:
      - PORT=${port}
      - DB_USER=ems_db
      - DB_PASSWORD=123
      - DB_NAME=ems_dbs1
      - DATABASE_URL=postgres://ems_db:123@172.31.14.42:5432/ems_dbs1
      - JWT_SECRET=ems_2026
    networks:
      - ems-network

networks:
  ems-network:
    external: true
`;

const dockerfileTemplate = () => `FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE \${PORT:-3000}
CMD ["node", "index.js"]
`;

const packageJsonTemplate = (name) => `{
  "name": "${name}",
  "version": "1.0.0",
  "main": "index.js",
  "scripts": {
    "start": "node index.js"
  },
  "dependencies": {
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "express": "^4.18.2",
    "jsonwebtoken": "^9.0.2",
    "pg": "^8.11.3"
  }
}
`;

const indexJsTemplate = (name, port, routes) => {
  const methodHandlers = routes.map(route => {
    let [method, path] = route.split(" ");
    let expressPath = path.replace(/:[a-zA-Z]+/g, match => match);
    return `// Feature route: ${method} ${path}
app.${method.toLowerCase()}("${expressPath}", authMiddleware, async (req, res) => {
  try {
    // Add feature logic here
    res.json({ message: "${method} ${path} successful in ${name}" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});`;
  }).join("\n\n");

  return `const express = require("express");
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
  res.json({ service: "${name}", status: "UP", port: process.env.PORT });
});

${methodHandlers}

const PORT = process.env.PORT || ${port};
app.listen(PORT, () => {
  console.log("${name} is running on port " + PORT);
});
`;
};

const MAIN_DIR = path.join(__dirname);

services.forEach(service => {
  const serviceDir = path.join(MAIN_DIR, service.name);
  if (!fs.existsSync(serviceDir)) {
    fs.mkdirSync(serviceDir, { recursive: true });
  }

  // Write docker-compose.yml
  fs.writeFileSync(path.join(serviceDir, "docker-compose.yml"), dockercomposeTemplate(service.name, service.port));
  
  // Write Dockerfile
  fs.writeFileSync(path.join(serviceDir, "Dockerfile"), dockerfileTemplate());
  
  // Write package.json
  fs.writeFileSync(path.join(serviceDir, "package.json"), packageJsonTemplate(service.name));
  
  // Write index.js
  fs.writeFileSync(path.join(serviceDir, "index.js"), indexJsTemplate(service.name, service.port, service.routes));

  console.log(`Generated ${service.name} successfully in ${serviceDir}`);
});
