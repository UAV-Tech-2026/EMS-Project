import express from "express";
import pool from "../db.js";
import verifyToken from "../middleware/verifyToken.js";
import { generateDocumentPdf, getSupportedDocumentTypes } from "../services/document/documentRegistry.js";
import path from "path";
import fs from "fs";

const router = express.Router();

// GET /api/mom/types - Get list of document types
router.get("/types", verifyToken, (req, res) => {
  res.json({ types: getSupportedDocumentTypes() });
});

// GET /api/mom - Get employee MOM list
router.get("/", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;

    let query = `
      SELECT m.*, u.fullname AS creator_name
      FROM moms m
      LEFT JOIN users u ON m.user_id = u.id
    `;
    const params = [];

    // Employees and interns only see their own MOMs
    if (userRole === "employee" || userRole === "intern") {
      params.push(userId);
      query += ` WHERE m.user_id = $1`;
    }

    query += ` ORDER BY m.updated_at DESC, m.id DESC`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error("FETCH MOMS ERROR:", err);
    res.status(500).json({ msg: "Failed to fetch MOM documents", error: err.message });
  }
});

// GET /api/mom/:id - Get single MOM
router.get("/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    const result = await pool.query(`SELECT * FROM moms WHERE id = $1`, [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ msg: "MOM document not found" });
    }

    const mom = result.rows[0];
    if (userRole === "employee" || userRole === "intern") {
      if (mom.user_id !== userId) {
        return res.status(403).json({ msg: "Access denied. You can only access your own MOM documents." });
      }
    }

    res.json(mom);
  } catch (err) {
    console.error("GET MOM ERROR:", err);
    res.status(500).json({ msg: "Failed to fetch MOM document" });
  }
});

// POST /api/mom - Save Draft / Create MOM
router.post("/", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      document_type,
      meeting_title,
      meeting_date,
      meeting_duration,
      organizer,
      attendees,
      agenda,
      summary,
      action_items,
      status
    } = req.body;

    if (!meeting_title) {
      return res.status(400).json({ msg: "Meeting Title is required" });
    }

    // Get employee UAV ID if available
    const empRes = await pool.query(`SELECT employee_uav_id FROM employees WHERE user_id = $1`, [userId]);
    const empUavId = empRes.rows[0]?.employee_uav_id || `EMP-${userId}`;

    const insertResult = await pool.query(`
      INSERT INTO moms (
        user_id, employee_id, document_type, meeting_title, meeting_date,
        meeting_duration, organizer, attendees, agenda, summary, action_items, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `, [
      userId,
      empUavId,
      document_type || "MOM",
      meeting_title,
      meeting_date || new Date(),
      meeting_duration || "1 Hour",
      organizer || req.user.fullname || req.user.username,
      JSON.stringify(attendees || []),
      agenda || "",
      summary || "",
      JSON.stringify(action_items || []),
      status || "Draft"
    ]);

    res.status(201).json(insertResult.rows[0]);
  } catch (err) {
    console.error("CREATE MOM ERROR:", err);
    res.status(500).json({ msg: "Failed to create MOM draft", error: err.message });
  }
});

// PUT /api/mom/:id - Update MOM
router.put("/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    const existingRes = await pool.query(`SELECT * FROM moms WHERE id = $1`, [id]);
    if (existingRes.rows.length === 0) {
      return res.status(404).json({ msg: "MOM document not found" });
    }

    const existing = existingRes.rows[0];
    if (userRole === "employee" || userRole === "intern") {
      if (existing.user_id !== userId) {
        return res.status(403).json({ msg: "Access denied" });
      }
    }

    const {
      meeting_title,
      meeting_date,
      meeting_duration,
      organizer,
      attendees,
      agenda,
      summary,
      action_items,
      status
    } = req.body;

    const updateResult = await pool.query(`
      UPDATE moms
      SET meeting_title = COALESCE($1, meeting_title),
          meeting_date = COALESCE($2, meeting_date),
          meeting_duration = COALESCE($3, meeting_duration),
          organizer = COALESCE($4, organizer),
          attendees = COALESCE($5, attendees),
          agenda = COALESCE($6, agenda),
          summary = COALESCE($7, summary),
          action_items = COALESCE($8, action_items),
          status = COALESCE($9, status),
          updated_at = NOW()
      WHERE id = $10
      RETURNING *
    `, [
      meeting_title,
      meeting_date,
      meeting_duration,
      organizer,
      attendees ? JSON.stringify(attendees) : null,
      agenda,
      summary,
      action_items ? JSON.stringify(action_items) : null,
      status,
      id
    ]);

    res.json(updateResult.rows[0]);
  } catch (err) {
    console.error("UPDATE MOM ERROR:", err);
    res.status(500).json({ msg: "Failed to update MOM document", error: err.message });
  }
});

// POST /api/mom/:id/generate-pdf - Generate PDF for MOM
router.post("/:id/generate-pdf", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    const momRes = await pool.query(`SELECT * FROM moms WHERE id = $1`, [id]);
    if (momRes.rows.length === 0) {
      return res.status(404).json({ msg: "MOM document not found" });
    }

    const mom = momRes.rows[0];
    if (userRole === "employee" || userRole === "intern") {
      if (mom.user_id !== userId) {
        return res.status(403).json({ msg: "Access denied" });
      }
    }

    // Call document generator service
    const pdfInfo = await generateDocumentPdf(mom.document_type || "MOM", mom);

    // Update MOM status to Generated and store pdf_path
    const updatedRes = await pool.query(`
      UPDATE moms
      SET status = 'Generated',
          pdf_path = $1,
          updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `, [pdfInfo.relativeUrl, id]);

    res.json({
      msg: "MOM PDF generated successfully!",
      mom: updatedRes.rows[0],
      pdfUrl: `/api/mom/${id}/pdf`
    });

  } catch (err) {
    console.error("GENERATE MOM PDF ERROR:", err);
    res.status(500).json({ msg: "Failed to generate MOM PDF", error: err.message });
  }
});

// GET /api/mom/:id/pdf - Stream/Download PDF
router.get("/:id/pdf", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    const momRes = await pool.query(`SELECT * FROM moms WHERE id = $1`, [id]);
    if (momRes.rows.length === 0) {
      return res.status(404).json({ msg: "MOM document not found" });
    }

    const mom = momRes.rows[0];
    if (userRole === "employee" || userRole === "intern") {
      if (mom.user_id !== userId) {
        return res.status(403).json({ msg: "Access denied" });
      }
    }

    if (!mom.pdf_path) {
      return res.status(404).json({ msg: "PDF not generated yet. Please click 'Generate PDF' first." });
    }

    const fullPdfPath = path.join(process.cwd(), mom.pdf_path);
    if (!fs.existsSync(fullPdfPath)) {
      return res.status(404).json({ msg: "PDF file missing on server." });
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="MOM_${mom.meeting_title.replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf"`);
    fs.createReadStream(fullPdfPath).pipe(res);

  } catch (err) {
    console.error("STREAM MOM PDF ERROR:", err);
    res.status(500).json({ msg: "Failed to retrieve PDF" });
  }
});

// DELETE /api/mom/:id - Delete MOM
router.delete("/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    const momRes = await pool.query(`SELECT * FROM moms WHERE id = $1`, [id]);
    if (momRes.rows.length === 0) {
      return res.status(404).json({ msg: "MOM document not found" });
    }

    const mom = momRes.rows[0];
    if (userRole === "employee" || userRole === "intern") {
      if (mom.user_id !== userId) {
        return res.status(403).json({ msg: "Access denied" });
      }
    }

    await pool.query(`DELETE FROM moms WHERE id = $1`, [id]);
    res.json({ msg: "MOM document deleted successfully" });
  } catch (err) {
    console.error("DELETE MOM ERROR:", err);
    res.status(500).json({ msg: "Failed to delete MOM document" });
  }
});

export default router;
