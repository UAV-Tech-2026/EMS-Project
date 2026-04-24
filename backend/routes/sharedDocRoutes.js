import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import pool from "../db.js";
import { verifyToken } from "../middleware/authMiddleware.js";

const router = express.Router();

// ─── MULTER SETUP ────────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = "uploads/shared";
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

// ─── ALLOWED FILE TYPES ──────────────────────────────────────────────────
const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
  "application/vnd.ms-excel",                                           // .xls
  "text/plain",                                                          // .txt
  "application/msword",                                                  // .doc
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
];

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type "${file.mimetype}" is not allowed. Accepted: images, PDF, Excel, Word, text files.`));
    }
  },
});

// ─── SHARE DOCUMENT (file upload) ────────────────────────────────────────
router.post("/upload", verifyToken, (req, res, next) => {
  upload.single("file")(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      // Multer-specific errors (file size, etc.)
      return res.status(400).json({ msg: `Upload error: ${err.message}` });
    } else if (err) {
      // fileFilter rejection or other errors
      return res.status(400).json({ msg: err.message });
    }
    next();
  });
}, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ msg: "No file uploaded" });
    }

    const { document_name, target_role, target_user_id, message } = req.body;
    const { filename, path: filePath, size, mimetype } = req.file;

    const result = await pool.query(
      `INSERT INTO shared_documents (shared_by, document_name, file_name, file_path, file_size, file_type, target_role, target_user_id, message)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [req.user.id, document_name || filename, filename, filePath, size, mimetype, target_role || "admin", target_user_id || null, message || ""]
    );

    res.status(201).json({
      msg: "Document shared successfully",
      document: result.rows[0],
    });
  } catch (err) {
    console.error("SHARE DOCUMENT ERROR:", err.message);
    res.status(500).json({ msg: err.message });
  }
});

// ─── SHARE DRIVE LINK ────────────────────────────────────────────────────
router.post("/share-link", verifyToken, async (req, res) => {
  try {
    const { document_name, drive_link, target_role, target_user_id, message } = req.body;

    if (!drive_link) {
      return res.status(400).json({ msg: "Drive link is required" });
    }

    const result = await pool.query(
      `INSERT INTO shared_documents (shared_by, document_name, file_name, file_path, file_size, file_type, target_role, target_user_id, message)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [req.user.id, document_name || "Drive Link", "Drive Link", drive_link, 0, "link", target_role || "admin", target_user_id || null, message || ""]
    );

    res.status(201).json({
      msg: "Link shared successfully",
      document: result.rows[0],
    });
  } catch (err) {
    console.error("SHARE LINK ERROR:", err.message);
    res.status(500).json({ msg: "Server error while sharing link" });
  }
});

// ─── GET DOCUMENTS SHARED WITH ME (by role) ──────────────────────────────
router.get("/inbox", verifyToken, async (req, res) => {
  try {
    const userRole = req.user.role;

    let result;
    if (userRole === "super_admin") {
      result = await pool.query(
        `SELECT sd.*, u.fullname as shared_by_name
         FROM shared_documents sd
         JOIN users u ON sd.shared_by = u.id
         ORDER BY sd.shared_at DESC`
      );
    } else {
      result = await pool.query(
        `SELECT sd.*, u.fullname as shared_by_name
         FROM shared_documents sd
         JOIN users u ON sd.shared_by = u.id
         WHERE sd.target_role = $1 
            OR (sd.target_role = 'admins' AND ($1 = 'admin' OR $1 = 'admin_hr' OR $1 = 'hr_admin' OR $1 = 'production_admin'))
            OR sd.target_role = 'all' 
            OR sd.target_user_id = $2
         ORDER BY sd.shared_at DESC`,
        [userRole, req.user.id]
      );
    }
    res.json(result.rows);
  } catch (err) {
    console.error("FETCH SHARED DOCS ERROR:", err.message);
    res.status(500).json({ msg: "Server error while fetching shared documents" });
  }
});

// ─── GET DOCUMENTS I HAVE SHARED ─────────────────────────────────────────
router.get("/sent", verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM shared_documents WHERE shared_by = $1 ORDER BY shared_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("FETCH SENT DOCS ERROR:", err.message);
    res.status(500).json({ msg: "Server error while fetching sent documents" });
  }
});

// ─── DOWNLOAD SHARED DOCUMENT ────────────────────────────────────────────
router.get("/download/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      "SELECT * FROM shared_documents WHERE id = $1",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ msg: "Document not found" });
    }

    const doc = result.rows[0];
    const absolutePath = path.resolve(doc.file_path);
    if (!fs.existsSync(absolutePath)) {
      return res.status(404).json({ msg: "File not found on server" });
    }

    res.download(absolutePath, doc.document_name || doc.file_name);
  } catch (err) {
    console.error("DOWNLOAD SHARED DOC ERROR:", err.message);
    res.status(500).json({ msg: "Server error during download" });
  }
});

// ─── GET RECENT SHARED DOCUMENTS COUNT (for dashboard badge) ─────────────
router.get("/count", verifyToken, async (req, res) => {
  try {
    const userRole = req.user.role;
    let result;
    if (userRole === "super_admin") {
      result = await pool.query("SELECT COUNT(*) FROM shared_documents");
    } else {
      result = await pool.query(
        "SELECT COUNT(*) FROM shared_documents WHERE target_role = $1 OR target_role = 'all'",
        [userRole]
      );
    }
    res.json({ count: parseInt(result.rows[0].count) });
  } catch (err) {
    console.error("COUNT SHARED DOCS ERROR:", err.message);
    res.status(500).json({ msg: "Server error" });
  }
});

export default router;