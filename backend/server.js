import dotenv from "dotenv";
import express from "express";
import 'dotenv/config';
import cors from "cors";
import authRoutes from "./routes/authRoutes.js";
import employeesRoutes from "./routes/employeesRoutes.js";
import attendanceRoutes from "./routes/attendanceRoutes.js";
import taskRoutes from "./routes/taskRoutes.js"
import pool from "./db.js";
import dpr from "./routes/dpr.js";
import leaveRoutes from "./routes/leaveRoutes.js";
import payslipRoutes from "./routes/payslipRoutes.js";
import payslipRequests from "./routes/payslipRequests.js";
import { run as seedSuperAdmin } from "./seed_user.js";


const app = express();
const PORT = process.env.PORT || 5000;

import { ensureSchema } from "./utils/ensure_schema.js";

pool.query("SELECT 1", async (err, res) => {
  if (err) {
    console.error("❌ Database connection failed:", err.message);
    console.error("Please ensure PostgreSQL is running and credentials in .env are correct.");
    process.exit(1);
  } else {
    console.log("✓ Database connected successfully");
    // Ensure database schema is healthy on start
    await ensureSchema();
    await seedSuperAdmin(); 
  }
});



app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true,
}));

app.use(express.json());   

app.use((req, res, next) => {
  console.log(`Incoming Request: ${req.method} ${req.url}`);
  next();
});

app.use("/api/auth", authRoutes);
app.use("/api/employees", employeesRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/dpr",dpr);
app.use("/api/leave", leaveRoutes);
app.use("/api/payslip", payslipRoutes);
app.use("/api/payslip-requests", payslipRequests);

app.use((err, req, res, next) => {
  console.error("Server Error:", err);
  res.status(err.status || 500).json({
    msg: err.message || "Internal server error",
  });
});


app.listen(PORT,"0.0.0.0",() => {
  console.log(`✓ Server running on port ${PORT}`);
//   console.log(`✓ API available at http://localhost:${PORT}/api/login`);
 });


process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully");
  pool.end(() => process.exit(0));
});

process.on("SIGINT", () => {
  console.log("SIGINT received, shutting down gracefully");
  pool.end(() => process.exit(0));
});
