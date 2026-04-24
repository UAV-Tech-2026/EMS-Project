import express from "express";
import pool from "../db.js";
import { verifyToken, isAdminOrSuper } from "../middleware/authMiddleware.js";
import { createNotification } from "./notificationRoutes.js";

const router = express.Router();

// GET all meetings (visible to everyone)
router.get("/", verifyToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT m.*, u.fullname AS creator_name
      FROM meetings m
      LEFT JOIN users u ON m.created_by = u.id
      ORDER BY m.meeting_date ASC, m.start_time ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("FETCH MEETINGS ERROR:", err);
    res.status(500).json({ msg: "Server error" });
  }
});


// POST create a meeting
router.post("/", verifyToken, isAdminOrSuper, async (req, res) => {
  const { title, description, meeting_date, start_time, end_time, meeting_link, assigned_creator } = req.body;

  try {
    // Allow super_admin AND admin_hr to assign a creator
    const canAssign = req.user.role === "super_admin" || req.user.role === "admin_hr";
    const creatorId = (canAssign && assigned_creator)
      ? assigned_creator
      : req.user.id;

    const result = await pool.query(`
      INSERT INTO meetings (title, description, meeting_date, start_time, end_time, meeting_link, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *
    `, [title, description, meeting_date, start_time, end_time, meeting_link, creatorId]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("CREATE MEETING ERROR:", err);
    res.status(500).json({ msg: "Server error" });
  }
});



// PATCH start a meeting
router.patch("/:id/start", verifyToken, async (req, res) => {
  const { id } = req.params;
  try {
    // ✅ Fixed: use started_at only if column exists (added via ensure_schema patch)
    const result = await pool.query(`
      UPDATE meetings
      SET status = 'In Progress', started_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ msg: "Meeting not found" });
    }

    const meeting = result.rows[0];
    const employeeName = req.user.fullname || "An employee";

    const adminsRes = await pool.query(
      "SELECT id FROM users WHERE role IN ('super_admin', 'admin_hr')"
    );

    for (const admin of adminsRes.rows) {
      await createNotification(
        admin.id,
        `${employeeName} has started the meeting: "${meeting.title}"`,
        "meeting"
      );
    }

    res.json({ msg: "Meeting started and admins notified", meeting });
  } catch (err) {
    console.error("START MEETING ERROR:", err);
    res.status(500).json({ msg: "Server error" });
  }
});

export default router;