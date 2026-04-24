import dotenv from "dotenv";
import 'dotenv/config';
import express from "express";
import cors from "cors";
import pool from "./db.js";
import { ensureSchema } from "./utils/ensure_schema.js";

import authRoutes from "./routes/authRoutes.js";
import employeesRoutes from "./routes/employeesRoutes.js";
import attendanceRoutes from "./routes/attendanceRoutes.js";
import taskRoutes from "./routes/taskRoutes.js";
import dpr from "./routes/dpr.js";
import leaveRoutes from "./routes/leaveRoutes.js";
import payslipRoutes from "./routes/payslipRoutes.js";
import payslipRequests from "./routes/payslipRequests.js";
import requestRoutes from "./routes/requestRoutes.js";
import documentRoutes from "./routes/documentRoutes.js";
import permissionRoutes from "./routes/permissionRoutes.js";
import bulletinRoutes from "./routes/bulletinRoutes.js";
import sharedDocRoutes from "./routes/sharedDocRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import meetingRoutes from "./routes/meetingRoutes.js";

const app = express();
const PORT = process.env.PORT || 5000;


app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
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
app.use("/api/dpr", dpr);
app.use("/api/leave", leaveRoutes);
app.use("/api/payslip", payslipRoutes);
app.use("/api/payslip-requests", payslipRequests);
app.use("/api/general-requests", requestRoutes);
app.use("/api/requests", requestRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/permissions", permissionRoutes);
app.use("/api/bulletins", bulletinRoutes);
app.use("/api/shared-docs", sharedDocRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/meetings", meetingRoutes);
app.use("/uploads", express.static("uploads"));


app.use((err, req, res, next) => {
  console.error("Server Error:", err);
  res.status(err.status || 500).json({
    msg: err.message || "Internal server error",
  });
});


async function startServer() {
  try {
    await pool.query("SELECT 1");
    console.log("✓ Database connected successfully");

    await ensureSchema();
    console.log("✓ Schema verified");

    // ✅ ONE app.listen() only
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`✓ Server running on port ${PORT}`);
    });

  } catch (err) {
    console.error("❌ Startup failed:", err.message);
    process.exit(1);
  }
}

startServer();


process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully");
  pool.end(() => process.exit(0));
});

process.on("SIGINT", () => {
  console.log("SIGINT received, shutting down gracefully");
  pool.end(() => process.exit(0));
});