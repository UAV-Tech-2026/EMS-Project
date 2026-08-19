import express from "express";
import pool from "../db.js";
import { verifyToken, isAdminOrSuper } from "../middleware/authMiddleware.js";
import multer from "multer";
import { createNotification } from "./notificationRoutes.js";

const router = express.Router();

const storage = multer.diskStorage({
  destination: "uploads/reimbursements/",
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});
const upload = multer({ storage });


router.post("/submit", verifyToken, upload.single("receipt"), async (req, res) => {
  const { expense_date, expense_type, amount, description } = req.body;
  const user_id = req.user.id;
  const receipt_path = req.file ? `/uploads/reimbursements/${req.file.filename}` : null;

  try {
    const result = await pool.query(
      `INSERT INTO reimbursements (user_id, expense_date, expense_type, amount, description, receipt_path)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [user_id, expense_date, expense_type, amount, description, receipt_path]
    );

   
    const adminsRes = await pool.query("SELECT id FROM users WHERE role IN ('super_admin', 'admin_hr', 'hr_admin')");
    const employeeName = req.user.fullname || "An employee";
    for (const admin of adminsRes.rows) {
      await createNotification(admin.id, `${employeeName} submitted a reimbursement request for ₹${amount}`, "info");
    }

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("REIMBURSEMENT SUBMIT ERROR:", err);
    res.status(500).json({ msg: "Server error" });
  }
});


router.get("/my", verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM reimbursements WHERE user_id = $1 ORDER BY created_at DESC",
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ msg: "Server error" });
  }
});


router.get("/all", verifyToken, isAdminOrSuper, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT r.*, u.fullname AS employee_name, e.employee_uav_id
      FROM reimbursements r
      JOIN users u ON r.user_id = u.id
      LEFT JOIN employees e ON u.id = e.user_id
      ORDER BY r.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("GET /all REIMBURSEMENT ERROR:", err);
    res.status(500).json({ msg: "Server error" });
  }
});


router.patch("/status/:id", verifyToken, isAdminOrSuper, async (req, res) => {
  const { status } = req.body;
  const { id } = req.params;

  if (!["approved", "rejected", "pending"].includes(status)) {
    return res.status(400).json({ msg: "Invalid status" });
  }

  try {
    const result = await pool.query(
      "UPDATE reimbursements SET status = $1, approved_by = $2, approved_at = NOW() WHERE id = $3 RETURNING *",
      [status, req.user.id, id]
    );

    if (result.rows.length === 0) return res.status(404).json({ msg: "Request not found" });

    // Notify user
    const request = result.rows[0];
    await createNotification(request.user_id, `Your reimbursement request for ₹${request.amount} has been ${status}`, status === "approved" ? "success" : "warning");

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ msg: "Server error" });
  }
});

export default router;