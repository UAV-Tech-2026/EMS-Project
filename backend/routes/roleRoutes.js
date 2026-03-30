import express from "express";
import pool from "../db.js";

const router = express.Router();


router.get("/", async (req, res) => {
  try {
    res.json([{ name: "super_admin" }]);
  } catch (err) {
    res.status(500).json({ msg: "Failed to fetch roles" });
  }
});


router.post("/", async (req, res) => {
  return res.status(403).json({
    msg: "Role creation is disabled. Only super_admin is allowed.",
  });
});

export default router;
