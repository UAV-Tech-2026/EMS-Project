import express from "express";
import pool from "../db.js";
import { verifyToken } from "../middleware/authMiddleware.js";

const router = express.Router();

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
    console.error("Error in /permissions/my:", err);
    res.status(500).json({ msg: "Server error" });
  }
});

router.get("/admins", verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, fullname, username, role 
       FROM users 
       WHERE role IN ('super_admin', 'superadmin', 'admin')
       ORDER BY fullname ASC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Error in /permissions/admins:", err);
    res.status(500).json({ msg: "Server error" });
  }
});

const adminOnly = (req, res, next) => {
  const role = (req.user?.role || "").toLowerCase().replace(/[^a-z]/g, "");
  const ALLOWED_ADMINS = ["superadmin", "admin"];
  if (!ALLOWED_ADMINS.includes(role)) {
    return res.status(403).json({ msg: "Forbidden: Administrative access required" });
  }
  next();
};

router.use(verifyToken);
router.use(adminOnly);

router.get("/list", async (req, res) => {
  try {
    const query = `
      SELECT 
        u.id, 
        u.username, 
        u.fullname, 
        u.role, 
        COALESCE(u.department, e.department, '') AS department, 
        e.employee_uav_id,
        COALESCE((
          SELECT json_agg(json_build_object(
            'feature_name', p.feature_name,
            'can_read',     p.can_read,
            'can_write',    p.can_write
          ))
          FROM user_permissions p
          WHERE p.user_id = u.id
        ), '[]'::json) AS permissions
      FROM users u
      LEFT JOIN employees e ON u.id = e.user_id
      ORDER BY
        CASE 
          WHEN u.role IN ('super_admin', 'superadmin') THEN 1
          WHEN u.role = 'admin' THEN 2
          ELSE 3
        END,
        CASE 
          WHEN regexp_replace(COALESCE(e.employee_uav_id, ''), '[^0-9]', '', 'g') ~ '^[0-9]+$' 
          THEN regexp_replace(COALESCE(e.employee_uav_id, ''), '[^0-9]', '', 'g')::bigint 
          ELSE 99999999 
        END ASC,
        e.employee_uav_id ASC NULLS LAST,
        LOWER(COALESCE(u.fullname, '')) ASC
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error("Error in /permissions/list:", err);
    res.status(500).json({ msg: "Server error", detail: err.message });
  }
});

router.get("/list-employees", async (req, res) => {
  try {
    const query = `
      SELECT 
        u.id, 
        u.username, 
        u.fullname, 
        u.role, 
        COALESCE(u.department, e.department, '') AS department,
        e.employee_uav_id,
        COALESCE((
          SELECT json_agg(json_build_object(
            'feature_name', p.feature_name,
            'can_read',     p.can_read,
            'can_write',    p.can_write
          ))
          FROM user_permissions p
          WHERE p.user_id = u.id
        ), '[]'::json) AS permissions
      FROM users u
      LEFT JOIN employees e ON u.id = e.user_id
      WHERE u.role IN ('employee', 'intern')
      ORDER BY
        CASE 
          WHEN regexp_replace(COALESCE(e.employee_uav_id, ''), '[^0-9]', '', 'g') ~ '^[0-9]+$' 
          THEN regexp_replace(COALESCE(e.employee_uav_id, ''), '[^0-9]', '', 'g')::bigint 
          ELSE 99999999 
        END ASC,
        e.employee_uav_id ASC NULLS LAST,
        LOWER(COALESCE(u.fullname, '')) ASC
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error("Error in /permissions/list-employees:", err);
    res.status(500).json({ msg: "Server error", detail: err.message });
  }
});

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

  const targetRole = (targetUser.rows[0].role || "").toLowerCase().replace(/[^a-z]/g, "");
  if (targetRole === "superadmin") {
    return res.status(403).json({ msg: "Cannot modify Super Admin permissions" });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    for (const p of permissions) {
      if (!p.feature_name) continue;

      // Trust the frontend's explicit values. Write without Read is invalid but
      // the UI already enforces Read=true when Write is ON.
      const canRead  = Boolean(p.can_read);
      const canWrite = Boolean(p.can_write);

      await client.query(`
        INSERT INTO user_permissions (user_id, feature_name, can_read, can_write)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (user_id, feature_name)
        DO UPDATE SET can_read = EXCLUDED.can_read, can_write = EXCLUDED.can_write
      `, [user_id, p.feature_name, canRead, canWrite]);
    }

    await client.query("COMMIT");
    res.json({ msg: "Permissions updated successfully" });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error updating permissions:", err);
    res.status(500).json({ msg: "Server error", detail: err.message });
  } finally {
    client.release();
  }
});

export default router;