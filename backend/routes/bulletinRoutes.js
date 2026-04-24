import express from "express";
import pool from "../db.js";
import { verifyToken, isAdminOrSuper } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", verifyToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT b.id, b.title, b.content, b.created_at, u.fullname as author_name 
      FROM bulletins b 
      JOIN users u ON b.author_id = u.id 
      ORDER BY b.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("GET BULLETINS ERROR:", err);
    res.status(500).json({ msg: "Server error" });
  }
});

router.post("/", verifyToken, isAdminOrSuper, async (req, res) => {
  try {
    const { title, content } = req.body;
    if (!content) {
      return res.status(400).json({ msg: "Content is required" });
    }
    
    const result = await pool.query(
      `INSERT INTO bulletins (title, content, author_id)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [title || "Bulletin", content, req.user.id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("POST BULLETIN ERROR:", err);
    res.status(500).json({ msg: "Server error" });
  }
});

export default router;
