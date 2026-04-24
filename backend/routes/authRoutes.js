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


const ADMIN_ROLES = ["super_admin", "admin", "admin_hr", "hr_admin", "production_admin"];



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

    console.log("Entered:", password);
    console.log("DB Hash:", user.password);
    console.log("Match:", isMatch);

    if (!isMatch) {
      return res.status(400).json({ msg: "Invalid credentials" });
    }

    const tempToken = jwt.sign(
      { id: user.id, role: user.role },
      JWT_SECRET,
      { expiresIn: "10m" }
    );

    if (user.totp_secret) {
      return res.json({
        requires2FA: true,
        setupRequired: false,
        tempToken,
        msg: "Enter code from Google Authenticator app",
      });
    }

    const secret = speakeasy.generateSecret({
      name: `UAVTech EMS (${user.emp_phone || user.username})`,
      issuer: "UAVTech",
    });

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
});



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

    const secret = isSetup ? user.totp_secret_temp : user.totp_secret;

    if (!secret) {
      return res.status(400).json({ msg: "No authenticator set up. Please login again." });
    }

    const verified = speakeasy.totp.verify({
      secret,
      encoding: "base32",
      token: otp,
      window: 6,
    });

    if (!verified) {
      console.error("OTP Verification Failed for user ID:", user.id);
      console.error("Provided OTP:", otp, "isSetup mode:", isSetup);
      return res.status(400).json({ msg: "Invalid code. Check Google Authenticator and try again." });
    }

    if (isSetup) {
      console.log("Setup confirmed, migrating temp secret to permanent for user:", user.id);
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

    let permissionsResult = { rows: [] };
    try {
      permissionsResult = await pool.query(
        "SELECT feature_name, can_read, can_write FROM user_permissions WHERE user_id=$1",
        [user.id]
      );
    } catch (permErr) {
      console.warn("WARN: Could not fetch user_permissions, defaulting to empty. Error:", permErr.message);
    }

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        fullname: user.fullname,
        email: user.email,
        role: user.role,
        designation: user.designation,
        permissions: permissionsResult.rows,
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



router.post("/resend-otp", async (req, res) => {
  res.json({ msg: "Open Google Authenticator app. Code refreshes every 30 seconds." });
});



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



router.get("/users", verifyToken, async (req, res) => {
  try {
    if (!ADMIN_ROLES.includes(req.user.role)) {
      return res.status(403).json({ success: false, msg: "Access denied" });
    }


    let query = `
      SELECT id, username, fullname, email, role, created_at
      FROM users
    `;
    const params = [];

    if (req.user.role === "super_admin") {
      query += " WHERE role != 'super_admin'";
    } else {

      query += " WHERE role NOT IN ('super_admin', 'admin')";
    }

    query += " ORDER BY created_at DESC";

    const result = await pool.query(query, params);
    res.json({ success: true, total: result.rows.length, users: result.rows });
  } catch (error) {
    console.error("GET USERS ERROR:", error.message);
    res.status(500).json({ success: false, msg: "Server error" });
  }
});



router.post(
  "/create-user",
  verifyToken,
  async (req, res) => {
    console.log("Create User Payload:", req.body);
    const client = await pool.connect();
    try {
      const {
        email, password, fullname, designation, phone, role, department,
        basic_salary, hra, epf_amount, pt_amount,
        adhar, addressProof, // links from frontend
        account_number, pan_number
      } = req.body;

      if (!ADMIN_ROLES.includes(req.user.role)) {
        return res.status(403).json({ msg: "Permission denied" });
      }
      if (req.user.role === "admin" &&
        (role === "admin" || role === "super_admin")) {
        return res.status(403).json({ msg: "Admins/HR can only create employees or interns" });
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
      
      let finalDepartment = department;
      if (req.user.role !== "super_admin") {
         const creatorRes = await pool.query("SELECT department FROM users WHERE id=$1", [req.user.id]);
         if (creatorRes.rows[0]?.department) {
            finalDepartment = creatorRes.rows[0].department;
         }
      }

      await client.query("BEGIN");
      await client.query("LOCK TABLE employees IN EXCLUSIVE MODE");

      const hashedPassword = await bcrypt.hash(password, 10);

      const userResult = await client.query(
        `INSERT INTO users (username, fullname, name, email, phone, password, role, department)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
        [email, fullname, fullname, email, phone, hashedPassword, role || "employee", finalDepartment || null]
      );

      const userId = userResult.rows[0].id;

      // UAV ID format:
      //   Employee  → UAVE0001
      //   Admin/HR  → UAVTA0001
      //   Intern    → UAVI0001
      //   Super Admin → UAVS0001
      let prefix;
      if (role === "super_admin") {
        prefix = "UAVS";
      } else if (role === "admin" || role === "admin_hr" || role === "hr_admin" || role === "production_admin") {
        prefix = "UAVTA";
      } else if (role === "intern") {
        prefix = "UAVI";
      } else {
        prefix = "UAVE"; // default: employee
      }

      const pLen = prefix.length + 1; // substring start (1-indexed)
      const seqResult = await client.query(`
        SELECT COALESCE(MAX(CAST(NULLIF(regexp_replace(SUBSTRING(employee_uav_id FROM ${pLen}), '[^0-9]', '', 'g'), '') AS INTEGER)), 0) + 1 AS next_id
        FROM employees
        WHERE employee_uav_id LIKE $1
      `, [prefix + '%']);

      const employeeUavId = `${prefix}${String(seqResult.rows[0].next_id).padStart(4, "0")}`;

      await client.query(
        `INSERT INTO employees
          (employee_uav_id, user_id, fullname, designation, department, phone,
           adhar_path, address_path, account_number, pan_number,
           basic_salary, hra, epf_amount, pt_amount)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
        [
          employeeUavId, userId, fullname, designation || null, finalDepartment || null, phone,
          adhar || null,
          addressProof || null,
          account_number || null,
          pan_number ? pan_number.toUpperCase() : null,
          Number(basic_salary) || 0, Number(hra) || 0,
          Number(epf_amount) || 0, Number(pt_amount) || 0,
        ]
      );

      const secret = speakeasy.generateSecret({
        name: `UAVTech EMS (${phone})`,
        issuer: "UAVTech",
      });

      // Save secret to database as active directly
      await client.query("UPDATE users SET totp_secret=$1 WHERE id=$2", [secret.base32, userId]);

      const qrDataUrl = await qrcode.toDataURL(secret.otpauth_url);

      await client.query("COMMIT");

      res.status(201).json({
        msg: "User created successfully",
        employee_uav_id: employeeUavId,
        role: role || "employee",
        qrCode: qrDataUrl
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




router.put("/users/update-profile", verifyToken, async (req, res) => {
  const { name, email, phone, password } = req.body;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    let query = "UPDATE users SET fullname=$1, name=$1, email=$2, phone=$3";
    let params = [name, email, phone, req.user.id];

    if (password && password.trim() !== "") {
      const hashedPassword = await bcrypt.hash(password, 10);
      query += ", password=$5";
      params.push(hashedPassword);
    }

    query += " WHERE id=$4 RETURNING id, username, fullname, name, email, phone, role";

    const result = await client.query(query, params);

    if (result.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ msg: "User not found" });
    }

    await client.query(
      "UPDATE employees SET fullname=$1, phone=$2 WHERE user_id=$3",
      [name, phone, req.user.id]
    );

    await client.query("COMMIT");
    res.json(result.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Profile Update Error:", err);
    res.status(500).json({ msg: "Internal error updating profile" });
  } finally {
    client.release();
  }
});



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