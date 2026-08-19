const express = require("express");
const cors = require("cors");
const { createProxyMiddleware } = require("http-proxy-middleware");
require("dotenv").config();

const app = express();
app.use(cors());

const HOST = process.env.MICROSERVICE_HOST || "localhost";

// ─── Service Route Map ───────────────────────────────────────────────
// Maps URL prefixes to the correct microservice port
const routes = [
  { prefix: "/api/auth",         port: 3010 },
  { prefix: "/api/permissions",  port: 3010 },
  { prefix: "/api/admins",       port: 3010 },
  { prefix: "/api/attendance",   port: 3014 },
  { prefix: "/api/leave",        port: 3002 },
  { prefix: "/api/payroll",      port: 3003 },
  { prefix: "/api/dpr",          port: 3003 },
  { prefix: "/api/payslips",     port: 3003 },
  { prefix: "/api/tasks",        port: 3004 },
  { prefix: "/api/users",        port: 3005 },
  { prefix: "/api/employees",    port: 3005 },
  { prefix: "/api/departments",  port: 3005 },
  { prefix: "/api/bulletins",    port: 3006 },
  { prefix: "/api/meetings",     port: 3007 },
  { prefix: "/api/requests",     port: 3008 },
  { prefix: "/api/products",     port: 3009 },
  { prefix: "/api/stock-in",     port: 3009 },
  { prefix: "/api/stock-out",    port: 3013 },
  { prefix: "/api/return",       port: 3013 },
  { prefix: "/api/withdrawals",  port: 3011 },
  { prefix: "/api/maintenance",  port: 3012 },
];

// ─── Register Proxy Routes ───────────────────────────────────────────
routes.forEach(({ prefix, port }) => {
  app.use(
    prefix,
    createProxyMiddleware({
      target: `http://${HOST}:${port}`,
      changeOrigin: true,
      // Strip /api prefix before forwarding to the microservice
      pathRewrite: { [`^${prefix}`]: prefix.replace("/api", "") },
      on: {
        error: (err, req, res) => {
          console.error(`[Gateway] Error routing ${req.path} to port ${port}:`, err.message);
          res.status(502).json({ error: `Service unavailable (port ${port})` });
        },
      },
    })
  );
});

// ─── Health Check ────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({ service: "api-gateway", status: "UP", port: process.env.PORT || 5000 });
});


app.use((_req, res) => {
  res.status(404).json({ error: "Route not found in gateway" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ API Gateway running on port ${PORT}`);
  console.log(`   Routing ${routes.length} service groups to host: ${HOST}`);
});
