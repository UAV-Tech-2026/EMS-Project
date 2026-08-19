import dotenv from "dotenv";
import 'dotenv/config';
import express from "express";
import cors from "cors";
import pool from "./db.js";
import ensureSchemaModule from "./utils/ensure_schema.js";


import { runRecurringTaskGenerator } from "./routes/recurringTaskGenerator.js";

const ensureSchema = typeof ensureSchemaModule === "function" 
  ? ensureSchemaModule 
  : (ensureSchemaModule.ensureSchema || ensureSchemaModule.default || ensureSchemaModule);

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
import metaRoutes from "./routes/metaRoutes.js";
import departmentRoutes from "./routes/departmentRoutes.js";

import reimbursementRoutes from "./routes/reimbursementRoutes.js";

const app = express();
const PORT = process.env.PORT || 5000;

const corsOptions = {
  origin: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

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
app.use("/api/reimbursements", reimbursementRoutes);
app.use("/api/permissions", permissionRoutes);
app.use("/api/bulletins", bulletinRoutes);
app.use("/api/shared-docs", sharedDocRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/meetings", meetingRoutes);
app.use("/api/meta", metaRoutes);
app.use("/api/departments", departmentRoutes);
app.use("/uploads", express.static("uploads"));



app.get("/health", (req, res) => res.status(200).json({ status: "ok" }));

app.use((err, req, res, next) => {
  console.error("Server Error:", err);
  res.status(err.status || 500).json({
    msg: err.message || "Internal server error",
  });
});


let server;

async function startServer() {
  try {
    await pool.query("SELECT 1");
    console.log("✓ Database connected successfully");

    await ensureSchema();
    console.log("✓ Schema verified");

   
    await runRecurringTaskGenerator();
    console.log("✓ Recurring task generator ran");

    server = app.listen(PORT, "0.0.0.0", () => {
      console.log(`✓ Server running on port ${PORT}`);
    });

  } catch (err) {
    console.error("❌ Startup failed:", err.message);
    process.exit(1);
  }
}

startServer();

function gracefulShutdown(signal) {
  console.log(`${signal} received, shutting down gracefully`);
 
  const timeout = setTimeout(() => {
    console.log("Shutdown timeout reached, forcing exit");
    pool.end(() => process.exit(1));
  }, 10000);

  if (server) {
    server.close(() => {
      clearTimeout(timeout);
      pool.end(() => {
        console.log("Server closed cleanly");
        process.exit(0);
      });
    });
  } else {
    clearTimeout(timeout);
    pool.end(() => process.exit(0));
  }
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT",  () => gracefulShutdown("SIGINT"));

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);

});

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Promise Rejection:", reason);
  
});