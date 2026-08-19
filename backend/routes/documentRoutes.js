import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import pool from "../db.js";
import { verifyToken } from "../middleware/authMiddleware.js";

const router = express.Router();


const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = "uploads/documents";
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, 
});

router.get("/my", verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM documents WHERE user_id = $1 ORDER BY uploaded_at DESC",
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("FETCH DOCUMENTS ERROR:", err.message);
    res.status(500).json({ msg: "Server error while fetching documents" });
  }
});


router.post("/upload", verifyToken, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ msg: "No file uploaded" });
    }

    const { document_name } = req.body;
    const { filename, path: filePath, size, mimetype } = req.file;

    const result = await pool.query(
      `INSERT INTO documents (user_id, document_name, file_name, file_path, file_size, file_type)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [req.user.id, document_name || filename, filename, filePath, size, mimetype]
    );

    res.status(201).json({
      msg: "Document uploaded successfully",
      document: result.rows[0],
    });
  } catch (err) {
    console.error("UPLOAD DOCUMENT ERROR:", err.message);
    res.status(500).json({ msg: "Server error during upload" });
  }
});


router.post("/save-link", verifyToken, async (req, res) => {
  try {
    const { document_name, drive_link } = req.body;

    if (!drive_link) {
      return res.status(400).json({ msg: "Drive link is required" });
    }

    const result = await pool.query(
      `INSERT INTO documents (user_id, document_name, file_name, file_path, file_size, file_type)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [req.user.id, document_name || "Drive Link", "Drive Link", drive_link, 0, "link"]
    );

    res.status(201).json({
      msg: "Link saved successfully",
      document: result.rows[0],
    });
  } catch (err) {
    console.error("SAVE LINK ERROR:", err.message);
    res.status(500).json({ msg: "Server error while saving link" });
  }
});


router.get("/download/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      "SELECT * FROM documents WHERE id = $1",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ msg: "Document not found" });
    }

    const doc = result.rows[0];

   
    if (req.user.role !== "super_admin" && req.user.role !== "admin" && doc.user_id !== req.user.id) {
      return res.status(403).json({ msg: "Permission denied" });
    }

    const absolutePath = path.resolve(doc.file_path);
    if (!fs.existsSync(absolutePath)) {
      return res.status(404).json({ msg: "File not found on server" });
    }

    res.download(absolutePath, doc.document_name || doc.file_name);
  } catch (err) {
    console.error("DOWNLOAD ERROR:", err.message);
    res.status(500).json({ msg: "Server error during download" });
  }
});


router.delete("/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const checkResult = await pool.query(
      "SELECT * FROM documents WHERE id = $1",
      [id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ msg: "Document not found" });
    }

    const doc = checkResult.rows[0];

    
    if (req.user.role !== "super_admin" && req.user.role !== "admin" && doc.user_id !== req.user.id) {
      return res.status(403).json({ msg: "Permission denied" });
    }

    
    await pool.query("DELETE FROM documents WHERE id = $1", [id]);

   
    const absolutePath = path.resolve(doc.file_path);
    if (fs.existsSync(absolutePath)) {
      fs.unlinkSync(absolutePath);
    }

    res.json({ msg: "Document deleted successfully" });
  } catch (err) {
    console.error("DELETE DOCUMENT ERROR:", err.message);
    res.status(500).json({ msg: "Server error during deletion" });
  }
});

export default router;
