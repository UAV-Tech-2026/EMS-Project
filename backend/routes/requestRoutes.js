import express from "express";
import pool from "../db.js";
import { verifyToken } from "../middleware/authMiddleware.js";

const router = express.Router();


router.post("/", verifyToken, async (req, res) => {
  const {
    request_type,         
    target_role,
    target_user_id,

   
    role, jd, experience, skills, deadline,


    product_name, cost, vendor, procurement_deadline,
    from_department, to_department, qty,

    certificate_name, description, format,

   
    name,
  } = req.body;

  const user_id = req.user.id;

  if (!request_type) {
    return res.status(400).json({ msg: "request_type is required." });
  }

 
  let finalName, finalDescription, finalFormat;

  if (request_type === "manpower") {
    if (!role || !deadline) return res.status(400).json({ msg: "Role and deadline are required for Man Power Request." });
    finalName = `Manpower: ${role}`.slice(0, 100);
    finalDescription = JSON.stringify({ role, jd, experience, skills, deadline });
    finalFormat = "manpower";

  } else if (request_type === "procurement") {
    if (!product_name || !qty) return res.status(400).json({ msg: "Product name and qty are required for Procurement Request." });
    finalName = `Procurement: ${product_name}`.slice(0, 100);
    finalDescription = JSON.stringify({ product_name, cost, vendor, deadline: procurement_deadline, from_department, to_department, qty });
    finalFormat = "procurement";

  } else if (request_type === "other") {
    if (!certificate_name) return res.status(400).json({ msg: "Certificate name is required for Other Request." });
    finalName = `Other: ${certificate_name}`.slice(0, 100);
    finalDescription = JSON.stringify({ certificate_name, description });
    finalFormat = format || "pdf";

  } else {
    return res.status(400).json({ msg: "Invalid request_type." });
  }

  if (!target_role && !target_user_id) {
    return res.status(400).json({ msg: "target_role or target_user_id is required." });
  }

  try {
    const result = await pool.query(
      `INSERT INTO general_requests
         (user_id, name, description, target_role, target_user_id, format, request_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        user_id, finalName, finalDescription,
        target_role || null,
        target_user_id || null,
        finalFormat,
        request_type,
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("REQUEST POST ERROR:", err.message);
    res.status(500).json({ msg: "Server Error" });
  }
});


router.get("/my", verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM general_requests WHERE user_id = $1 ORDER BY created_at DESC",
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: "Server Error" });
  }
});


router.get("/admin", verifyToken, async (req, res) => {
  if (!["super_admin", "admin", "hr_admin"].includes(req.user.role)) {
    return res.status(403).json({ msg: "Access denied." });
  }

  try {
    let result;

    if (req.user.role === "super_admin") {
    
      result = await pool.query(
        `SELECT r.*, u.fullname AS employee_name, e.employee_uav_id
         FROM general_requests r
         JOIN users u ON r.user_id = u.id
         LEFT JOIN employees e ON u.id = e.user_id
         ORDER BY r.created_at DESC`
      );

    } else if (req.user.role === "hr_admin") {
      
      result = await pool.query(
        `SELECT r.*, u.fullname AS employee_name, e.employee_uav_id
         FROM general_requests r
         JOIN users u ON r.user_id = u.id
         LEFT JOIN employees e ON u.id = e.user_id
         WHERE r.target_role = 'hr_admin'
            OR r.target_user_id = $1
         ORDER BY r.created_at DESC`,
        [req.user.id]
      );

    } else {
      
      result = await pool.query(
        `SELECT r.*, u.fullname AS employee_name, e.employee_uav_id
         FROM general_requests r
         JOIN users u ON r.user_id = u.id
         LEFT JOIN employees e ON u.id = e.user_id
         WHERE r.target_user_id = $1
            OR r.target_role = 'admin'
            OR (r.target_role = 'hr_admin' AND $2 = 'HR')
         ORDER BY r.created_at DESC`,
        [req.user.id, req.user.department || ""]
      );
    }

    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: "Server Error" });
  }
});


router.put("/status/:id", verifyToken, async (req, res) => {
  if (!["super_admin", "admin", "hr_admin"].includes(req.user.role)) {
    return res.status(403).json({ msg: "Access denied." });
  }

  const { status } = req.body;
  const { id } = req.params;

  if (!["approved", "rejected", "pending"].includes(status)) {
    return res.status(400).json({ msg: "Invalid status." });
  }

  try {
    const result = await pool.query(
      "UPDATE general_requests SET status = $1 WHERE id = $2 RETURNING *",
      [status, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ msg: "Request not found." });
    res.json({ msg: `Request ${status} successfully`, request: result.rows[0] });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: "Server Error" });
  }
});

export default router;