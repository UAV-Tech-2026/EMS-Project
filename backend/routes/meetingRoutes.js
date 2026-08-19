import express from "express";
import pool from "../db.js";
import { verifyToken, isAdminOrSuper } from "../middleware/authMiddleware.js";
import { createNotification } from "./notificationRoutes.js";

const router = express.Router();


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


router.post("/", verifyToken, async (req, res) => {
  const { title, description, meeting_date, start_time, end_time, meeting_link, assigned_creator, target_users } = req.body;

  try {
 
    const canAssign = req.user.role === "super_admin" || (req.user.role === "admin" && req.user.department === "HR");
    const creatorId = (canAssign && assigned_creator)
      ? assigned_creator
      : req.user.id;

    const tUsersJson = target_users ? JSON.stringify(target_users) : '[]';

    const result = await pool.query(`
      INSERT INTO meetings (title, description, meeting_date, start_time, end_time, meeting_link, created_by, target_users)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *
    `, [title, description, meeting_date, start_time, end_time, meeting_link, creatorId, tUsersJson]);

    const meeting = result.rows[0];

    // Notify targeted users about the new meeting!
    if (target_users && Array.isArray(target_users) && target_users.length > 0) {
      const execName = req.user.fullname || "Someone";
      for (const tUserId of target_users) {
        await createNotification(
          tUserId,
          `${execName} invited you to a new meeting: "${meeting.title}" on ${meeting_date}`,
          "meeting"
        );
      }
    }

    res.status(201).json(meeting);
  } catch (err) {
    console.error("CREATE MEETING ERROR:", err);
    res.status(500).json({ msg: "Server error" });
  }
});




router.patch("/:id/start", verifyToken, async (req, res) => {
  const { id } = req.params;
  try {
    
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
      "SELECT id FROM users WHERE role = 'super_admin' OR (role = 'admin' AND department = 'HR')"
    );

   
    for (const admin of adminsRes.rows) {
      await createNotification(
        admin.id,
        `${employeeName} has started the meeting: "${meeting.title}"`,
        "meeting"
      );
    }
    
    
    let tUsers = [];
    if (typeof meeting.target_users === "string") {
      try { tUsers = JSON.parse(meeting.target_users); } catch (e) {}
    } else if (Array.isArray(meeting.target_users)) {
      tUsers = meeting.target_users;
    }
    for (const tUserId of tUsers) {
      
      if (!adminsRes.rows.some(a => a.id === Number(tUserId))) {
        await createNotification(
          tUserId,
          `The meeting "${meeting.title}" has just started! You can join now.`,
          "meeting"
        );
      }
    }

    res.json({ msg: "Meeting started and participants notified", meeting });
  } catch (err) {
    console.error("START MEETING ERROR:", err);
    res.status(500).json({ msg: "Server error" });
  }
});


router.patch("/:id/mom", verifyToken, async (req, res) => {
  const { id } = req.params;
  const { minutes_of_meeting } = req.body;
  
  const notifyUsers = async (meeting) => {
    let tUsers = [];
    if (typeof meeting.target_users === "string") {
      try { tUsers = JSON.parse(meeting.target_users); } catch (e) {}
    } else if (Array.isArray(meeting.target_users)) {
      tUsers = meeting.target_users;
    }
    for (const tUserId of tUsers) {
      await createNotification(
        tUserId,
        `'Minutes Of Meeting' for meeting created in the calendar`,
        "meeting"
      );
    }
  };

  try {
    const result = await pool.query(`
      UPDATE meetings
      SET minutes_of_meeting = $1
      WHERE id = $2
      RETURNING *
    `, [minutes_of_meeting, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ msg: "Meeting not found" });
    }

    const meeting = result.rows[0];
    await notifyUsers(meeting);

    res.json({ msg: "Minutes of Meeting updated", meeting: result.rows[0] });
  } catch (err) {
    
    if (err.code === '42703') { 
       try {
         await pool.query('ALTER TABLE meetings ADD COLUMN minutes_of_meeting TEXT');
         const retryResult = await pool.query(`
            UPDATE meetings SET minutes_of_meeting = $1 WHERE id = $2 RETURNING *
         `, [minutes_of_meeting, id]);
         
         const meeting = retryResult.rows[0];
         await notifyUsers(meeting);
         
         return res.json({ msg: "Minutes of Meeting updated", meeting: retryResult.rows[0] });
       } catch (retryErr) {
         return res.status(500).json({ msg: "Server error adding MOM column" });
       }
    }
    console.error("UPDATE MOM ERROR:", err);
    res.status(500).json({ msg: "Server error" });
  }
});

export default router;