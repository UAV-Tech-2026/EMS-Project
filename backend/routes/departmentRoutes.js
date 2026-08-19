import express from "express";
import pool from "../db.js";
import { verifyToken, isAdminOrSuper } from "../middleware/authMiddleware.js";

const router = express.Router();


router.get("/", verifyToken, async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM departments ORDER BY name ASC");
    res.json(result.rows);
  } catch (err) {
    console.error("GET DEPARTMENTS ERROR:", err);
    res.status(500).json({ msg: "Server Error", error: err.message });
  }
});


router.post("/", verifyToken, isAdminOrSuper, async (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ msg: "Department name is required" });
  
  try {
    const result = await pool.query(
      "INSERT INTO departments (name, description, created_by) VALUES ($1, $2, $3) RETURNING *",
      [name, description, req.user.id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("POST DEPARTMENT ERROR:", err);
    if (err.code === "23505") return res.status(409).json({ msg: "Department already exists" });
    res.status(500).json({ msg: "Server Error", error: err.message });
  }
});


router.put("/:id", verifyToken, isAdminOrSuper, async (req, res) => {
  const { id } = req.params;
  const { name, description } = req.body;
  try {
    const result = await pool.query(
      "UPDATE departments SET name = $1, description = $2 WHERE id = $3 RETURNING *",
      [name, description, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ msg: "Department not found" });
    res.json(result.rows[0]);
  } catch (err) {
    console.error("PUT DEPARTMENT ERROR:", err);
    res.status(500).json({ msg: "Server Error", error: err.message });
  }
});


router.delete("/:id", verifyToken, isAdminOrSuper, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query("DELETE FROM departments WHERE id = $1 RETURNING *", [id]);
    if (result.rows.length === 0) return res.status(404).json({ msg: "Department not found" });
    res.json({ msg: "Department deleted successfully" });
  } catch (err) {
    console.error("DELETE DEPARTMENT ERROR:", err);
    res.status(500).json({ msg: "Server Error", error: err.message });
  }
});

export default router;