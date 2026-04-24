import express from "express";
import pool from "../db.js";
import { verifyToken } from "../middleware/authMiddleware.js";

const router = express.Router();

// ✅ Public (token only) — any logged-in user fetches their own permissions
router.get("/my", verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT feature_name, can_read, can_write 
       FROM user_permissions 
       WHERE user_id = $1`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ msg: "Server error" });
  }
});

// ✅ Get list of all administrators (Super Admin, Admin, HR Admin) for request forms
router.get("/admins", verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, fullname, username, role 
       FROM users 
       WHERE role IN ('super_admin', 'admin', 'admin_hr')
       ORDER BY fullname ASC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }
});

// ✅ Middleware: all routes below require a valid token + administrative role
const adminOnly = (req, res, next) => {
  const role = (req.user?.role || "").toLowerCase();
  if (role !== "super_admin" && role !== "admin" && role !== "admin_hr") {
    return res.status(403).json({ msg: "Forbidden: Administrative access required" });
  }
  next();
};

router.use(verifyToken);
router.use(adminOnly);

// GET /api/permissions/list
// Lists only users with role = 'admin' (ControlPanel manages feature permissions for Admins only)
router.get("/list", async (req, res) => {
  try {
    const query = `
      SELECT u.id, u.username, u.fullname, u.role,
             COALESCE(json_agg(json_build_object(
               'feature_name', p.feature_name,
               'can_read',     p.can_read,
               'can_write',    p.can_write
             )) FILTER (WHERE p.feature_name IS NOT NULL), '[]') AS permissions
      FROM users u
      LEFT JOIN user_permissions p ON u.id = p.user_id
      GROUP BY u.id
      ORDER BY u.fullname
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }
});

// GET /api/permissions/list-employees — list employees & interns
router.get("/list-employees", async (req, res) => {
  try {
    const query = `
      SELECT u.id, u.username, u.fullname, u.role, e.employee_uav_id,
             COALESCE(json_agg(json_build_object(
               'feature_name', p.feature_name,
               'can_read',     p.can_read,
               'can_write',    p.can_write
             )) FILTER (WHERE p.feature_name IS NOT NULL), '[]') AS permissions
      FROM users u
      LEFT JOIN employees e ON u.id = e.user_id
      LEFT JOIN user_permissions p ON u.id = p.user_id
      WHERE u.role IN ('employee', 'intern')
      GROUP BY u.id, e.employee_uav_id
      ORDER BY u.fullname
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }
});

// POST /api/permissions/update — update permissions for any non-super_admin user
router.post("/update", async (req, res) => {
  const { user_id, permissions } = req.body;

  if (!user_id || !Array.isArray(permissions)) {
    return res.status(400).json({ msg: "Invalid payload" });
  }

  const targetUser = await pool.query(
    "SELECT role FROM users WHERE id = $1",
    [user_id]
  );

  if (!targetUser.rows.length) {
    return res.status(404).json({ msg: "User not found" });
  }

  if (targetUser.rows[0].role === "super_admin") {
    return res.status(403).json({ msg: "Cannot modify Super Admin permissions" });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    for (const p of permissions) {
      if (!p.feature_name) continue;

      // If write is granted, read must also be true
      const safeRead = p.can_read || p.can_write;

      await client.query(`
        INSERT INTO user_permissions (user_id, feature_name, can_read, can_write)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (user_id, feature_name)
        DO UPDATE SET can_read = EXCLUDED.can_read, can_write = EXCLUDED.can_write
      `, [user_id, p.feature_name, safeRead, p.can_write]);
    }

    await client.query("COMMIT");
    res.json({ msg: "Permissions updated successfully" });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ msg: "Server error" });
  } finally {
    client.release();
  }
});

export default router;