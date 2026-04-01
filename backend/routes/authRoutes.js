import express from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import speakeasy from "speakeasy";
import qrcode from "qrcode";
import pool from "../db.js";
import multer from "multer";
import { verifyToken } from "../middleware/authMiddleware.js";

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret_key_change_this";


// ─── REGISTER ─────────────────────────────────────────────────────────────
router.post("/register", async (req, res) => {
  try {
    const { username, password, fullname, email, role: requestedRole } = req.body;

    if (!username || !password) {
      return res.status(400).json({ msg: "Username and password required" });
    }

    const userCheck = await pool.query(
      "SELECT * FROM users WHERE username=$1", [username]
    );
    if (userCheck.rows.length > 0) {
      return res.status(400).json({ msg: "Username already exists" });
    }

    const userCount = await pool.query("SELECT COUNT(*) FROM users");
    let role = requestedRole || "employee";
    if (parseInt(userCount.rows[0].count) === 0) role = "super_admin";

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO users (username, password, fullname, name, email, role)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, username, fullname, email, role`,
      [username, hashedPassword, fullname, fullname, email || null, role]
    );

    res.status(201).json({ msg: "User registered successfully", user: result.rows[0] });
  } catch (err) {
    console.error("REGISTER ERROR:", err.message);
    res.status(500).json({ msg: "Server error" });
  }
});



router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    const result = await pool.query(
      `SELECT u.*, e.designation, e.phone AS emp_phone
       FROM users u
       LEFT JOIN employees e ON u.id = e.user_id
       WHERE u.username=$1`,
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ msg: "User not found" });
    }

    const user = result.rows[0];

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ msg: "Invalid credentials" });
    }

    const tempToken = jwt.sign(
      { id: user.id, role: user.role },
      JWT_SECRET,
      { expiresIn: "10m" }
    );

    // Already set up Google Authenticator → just ask for code
    if (user.totp_secret) {
      return res.json({
        requires2FA: true,
        setupRequired: false,
        tempToken,
        msg: "Enter code from Google Authenticator app",
      });
    }

    // First time → generate QR code for employee to scan
    const secret = speakeasy.generateSecret({
      name: `UAVTech EMS (${user.username})`,
      issuer: "UAVTech",
    });

    // Save temp secret until employee confirms it works
    await pool.query(
      "UPDATE users SET totp_secret_temp=$1 WHERE id=$2",
      [secret.base32, user.id]
    );
    
    const qrDataUrl = await qrcode.toDataURL(secret.otpauth_url);

    return res.json({
      requires2FA: true,
      setupRequired: true,
      tempToken,
      qrCode: qrDataUrl,
      msg: "Scan QR with Google Authenticator app",
    });

  } catch (error) {
    console.error("LOGIN ERROR:", error.message);
    res.status(500).json({ msg: "Server error" });
  }
  console.log("Entered:", password);
console.log("DB Hash:", user.password);
console.log("Match:", isMatch);
});


// ─── VERIFY OTP ───────────────────────────────────────────────────────────
router.post("/verify-otp", async (req, res) => {
  try {
    const { tempToken, otp, isSetup } = req.body;

    if (!tempToken || !otp) {
      return res.status(400).json({ msg: "Token and OTP required" });
    }

    const decoded = jwt.verify(tempToken, JWT_SECRET);

    const result = await pool.query(
      `SELECT u.*, e.designation
       FROM users u
       LEFT JOIN employees e ON u.id = e.user_id
       WHERE u.id=$1`,
      [decoded.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ msg: "User not found" });
    }

    const user = result.rows[0];

    // isSetup=true: employee just scanned QR and is confirming it works
    const secret = isSetup ? user.totp_secret_temp : user.totp_secret;

    if (!secret) {
      return res.status(400).json({ msg: "No authenticator set up. Please login again." });
    }

    const verified = speakeasy.totp.verify({
      secret,
      encoding: "base32",
      token: otp,
      window: 1,  // allows ±30 seconds clock drift
    });

    if (!verified) {
      return res.status(400).json({ msg: "Invalid code. Check Google Authenticator and try again." });
    }

    // Confirm setup → move temp secret to permanent
    if (isSetup) {
      await pool.query(
        "UPDATE users SET totp_secret=$1, totp_secret_temp=NULL WHERE id=$2",
        [secret, user.id]
      );
    }

    const token = jwt.sign(
      { id: user.id, role: user.role },
      JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        designation: user.designation,
      },
      msg: "Login successful",
    });

  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(400).json({ msg: "Session expired. Please login again." });
    }
    console.error("VERIFY OTP ERROR:", err.message);
    return res.status(400).json({ msg: "Invalid or expired session" });
  }
});


// ─── RESEND OTP — not applicable for Google Authenticator ─────────────────
router.post("/resend-otp", async (req, res) => {
  res.json({ msg: "Open Google Authenticator app. Code refreshes every 30 seconds." });
});


// ─── ME ───────────────────────────────────────────────────────────────────
router.get("/me", verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, username, fullname, email, role FROM users WHERE id=$1",
      [req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ msg: "User not found" });
    res.json(result.rows[0]);
  } catch (err) {
    console.error("GET ME ERROR:", err.message);
    res.status(500).json({ msg: "Server error" });
  }
});


// ─── GET ALL USERS ────────────────────────────────────────────────────────
router.get("/users", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "super_admin") {
      return res.status(403).json({ success: false, msg: "Access denied" });
    }
    const result = await pool.query(
      `SELECT id, username, fullname, email, role, created_at
       FROM users WHERE role != 'super_admin' ORDER BY created_at DESC`
    );
    res.json({ success: true, total: result.rows.length, users: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, msg: "Server error" });
  }
});


// ─── CREATE USER ──────────────────────────────────────────────────────────
const upload = multer({ dest: "uploads/" });



router.post(
  "/create-user",
  verifyToken,
  upload.fields([
    { name: "adhar", maxCount: 1 },
    { name: "addressProof", maxCount: 1 },
  ]),
  async (req, res) => {
    const client = await pool.connect();
    try {
      const {
        email, password, fullname, designation, phone, role,
        basic_salary, hra, epf_amount, pt_amount,
      } = req.body;

      if (req.user.role !== "super_admin" && req.user.role !== "admin") {
        return res.status(403).json({ msg: "Permission denied" });
      }
      if (req.user.role === "admin" && (role === "admin" || role === "super_admin")) {
        return res.status(403).json({ msg: "Admins can only create employees or interns" });
      }
      if (!email || !password || !fullname) {
        return res.status(400).json({ msg: "email, password and fullname are required" });
      }
      if (!phone) {
        return res.status(400).json({ msg: "Phone number is required" });
      }

      const dupCheck = await pool.query("SELECT id FROM users WHERE email=$1", [email]);
      if (dupCheck.rows.length > 0) {
        return res.status(400).json({ msg: "A user with this email already exists" });
      }

      await client.query("BEGIN");

      const hashedPassword = await bcrypt.hash(password, 10);

      const userResult = await client.query(
        `INSERT INTO users (username, fullname, name, email, phone, password, role)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
        [email, fullname, fullname, email, phone, hashedPassword, role || "employee"]
      );

      const userId = userResult.rows[0].id;

      const seqResult = await client.query(`
        SELECT COALESCE(MAX(CAST(SUBSTRING(employee_uav_id FROM 8) AS INTEGER)), 0) + 1 AS next_id
        FROM employees
      `);
      const employeeUavId = `UAVTech${String(seqResult.rows[0].next_id).padStart(3, "0")}`;

      await client.query(
        `INSERT INTO employees
          (employee_uav_id, user_id, fullname, designation, phone,
           adhar_path, address_path, basic_salary, hra, epf_amount, pt_amount)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [
          employeeUavId, userId, fullname, designation || null, phone,
          req.files?.adhar?.[0]?.path || null,
          req.files?.addressProof?.[0]?.path || null,
          Number(basic_salary) || 0, Number(hra) || 0,
          Number(epf_amount) || 0, Number(pt_amount) || 0,
        ]
      );

      await client.query("COMMIT");

      res.status(201).json({
        msg: "User created successfully",
        employee_uav_id: employeeUavId,
        role: role || "employee",
      });

    } catch (err) {
      await client.query("ROLLBACK");
      console.error("CREATE USER ERROR:", err.message);
      res.status(500).json({ msg: err.message });
    } finally {
      client.release();
    }
  }
);


// ─── UPDATE PROFILE ───────────────────────────────────────────────────────
router.put("/users/update-profile", verifyToken, async (req, res) => {
  const { name, email, phone } = req.body;
  const result = await pool.query(
    "UPDATE users SET name=$1, email=$2, phone=$3 WHERE id=$4 RETURNING *",
    [name, email, phone, req.user.id]
  );
  res.json(result.rows[0]);
});


// ─── FORGOT PASSWORD ──────────────────────────────────────────────────────
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    const result = await pool.query("SELECT * FROM users WHERE email=$1", [email]);
    if (result.rows.length === 0) return res.status(400).json({ msg: "User not found" });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    console.log("RESET OTP:", otp);

    const resetToken = jwt.sign({ id: result.rows[0].id, otp }, JWT_SECRET, { expiresIn: "5m" });
    res.json({ msg: "OTP sent", resetToken });
  } catch (err) {
    res.status(500).json({ msg: "Server error" });
  }
});


// ─── RESET PASSWORD ───────────────────────────────────────────────────────
router.post("/reset-password", async (req, res) => {
  try {
    const { resetToken, otp, newPassword } = req.body;
    const decoded = jwt.verify(resetToken, JWT_SECRET);
    if (decoded.otp !== otp) return res.status(400).json({ msg: "Invalid OTP" });

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await pool.query("UPDATE users SET password=$1 WHERE id=$2", [hashedPassword, decoded.id]);
    res.json({ msg: "Password reset successful" });
  } catch (err) {
    res.status(400).json({ msg: "Invalid or expired token" });
  }
});


export default router;