import express from "express";
import pool from "../db.js";
import { verifyToken } from "../middleware/authMiddleware.js";

const router = express.Router();


router.get("/my", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await pool.query(
      `SELECT * FROM notifications 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT 50`,
      [userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("FETCH NOTIFICATIONS ERROR:", err);
    res.status(500).json({ msg: "Server error" });
  }
});


router.post("/mark-read", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    await pool.query(
      "UPDATE notifications SET is_read = TRUE WHERE user_id = $1",
      [userId]
    );
    res.json({ msg: "All notifications marked as read" });
  } catch (err) {
    console.error("MARK READ ERROR:", err);
    res.status(500).json({ msg: "Server error" });
  }
});


export const createNotification = async (userId, message, type = "info") => {
  try {
    await pool.query(
      "INSERT INTO notifications (user_id, message, type) VALUES ($1, $2, $3)",
      [userId, message, type]
    );
  } catch (err) {
    console.error("CREATE NOTIFICATION ERROR:", err);
  }
};

export default router;
