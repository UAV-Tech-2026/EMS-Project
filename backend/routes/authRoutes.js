import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import speakeasy from "speakeasy";
import qrcode from "qrcode";
import pool from "../db.js";
import { verifyToken, isAdminOrSuper } from "../middleware/authMiddleware.js";
import { rateLimiter } from "../middleware/securityMiddleware.js";

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret_key_change_this";


const loginLimiter = rateLimiter(10, 10 * 60 * 1000);
const otpLimiter = rateLimiter(10, 10 * 60 * 1000);


function generateTotpSecret(label) {
  return speakeasy.generateSecret({ name: label, issuer: "UAVTech", length: 20 });
}



export async function generateUavId(role) {
  const r = (role || "").toLowerCase();
  const prefix =
    r === "super_admin" ? "UTPLS" :
      r === "admin" ? "UTPLA" :
        r === "intern" ? "UTPLI" :
          "UTPLE";

  const res = await pool.query(
    `SELECT employee_uav_id FROM employees WHERE employee_uav_id LIKE $1`,
    [`${prefix}%`]
  );


  const usedNums = new Set();
  for (const row of res.rows) {
    const numStr = row.employee_uav_id.slice(prefix.length);
    const n = parseInt(numStr, 10);
    if (!isNaN(n)) usedNums.add(n);
  }


  let next = 1;
  while (usedNums.has(next)) next++;

  return `${prefix}${String(next).padStart(3, "0")}`;
}





router.post("/login", loginLimiter, async (req, res) => {
  const { username, password } = req.body;
  const identifier = (username || "").trim().toUpperCase();

  try {
    const result = await pool.query(
      `SELECT u.* FROM users u 
       JOIN employees e ON u.id = e.user_id 
       WHERE e.employee_uav_id = $1`,
      [identifier]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ msg: "Invalid credentials" });
    }

    const user = result.rows[0];


    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ msg: "Invalid credentials" });
    }


    const tempToken = jwt.sign(
      { id: user.id, stage: "pre-otp" },
      JWT_SECRET,
      { expiresIn: "10m" }
    );


    let setupRequired = false;
    let qrCode = null;

    if (!user.totp_secret) {
      setupRequired = true;
      const identifier = (user.username || user.email || "").trim();

      let secretBase32 = user.totp_secret_temp;
      if (!secretBase32) {
        const secret = generateTotpSecret(`UAVTech EMS (${identifier})`);
        secretBase32 = secret.base32;
        await pool.query(
          "UPDATE users SET totp_secret_temp = $1 WHERE id = $2",
          [secretBase32, user.id]
        );
        qrCode = await qrcode.toDataURL(secret.otpauth_url);
      } else {
        const otpauth_url = speakeasy.otpauthURL({
          secret: secretBase32,
          label: `UAVTech EMS (${identifier})`,
          issuer: "UAVTech",
          encoding: "base32",
        });
        qrCode = await qrcode.toDataURL(otpauth_url);
      }
    }

    return res.json({
      requires2FA: true,
      setupRequired,
      tempToken,
      ...(qrCode && { qrCode }),
    });

  } catch (err) {
    console.error("LOGIN ERROR:", err);
    res.status(500).json({ msg: "Server error" });
  }
});


router.post("/reset-2fa", verifyToken, isAdminOrSuper, async (req, res) => {
  const { userId } = req.body;
  try {

    const userRes = await pool.query("SELECT * FROM users WHERE id = $1", [userId]);
    if (userRes.rows.length === 0)
      return res.status(404).json({ msg: "User not found" });

    const user = userRes.rows[0];
    const identifier = user.username || user.email;
    const secret = generateTotpSecret(`UAVTech EMS (${identifier})`);


    await pool.query(
      "UPDATE users SET totp_secret = NULL, totp_secret_temp = $1 WHERE id = $2",
      [secret.base32, userId]
    );

    const qrCode = await qrcode.toDataURL(secret.otpauth_url);

    return res.json({
      msg: "2FA reset successfully. Show this QR to the user.",
      qrCode,
      manualKey: secret.base32
    });
  } catch (err) {
    console.error("RESET 2FA ERROR:", err);
    return res.status(500).json({ msg: "Server error" });
  }
});

router.post("/verify-phone", async (req, res) => {
  const { tempToken, phone } = req.body;
  try {
    const decoded = jwt.verify(tempToken, JWT_SECRET);
    if (decoded.stage !== "pre-phone")
      return res.status(401).json({ msg: "Invalid token stage" });

    const userRes = await pool.query("SELECT * FROM users WHERE id = $1", [decoded.id]);
    if (userRes.rows.length === 0)
      return res.status(401).json({ msg: "User not found" });

    const user = userRes.rows[0];

    if (!user.phone || user.phone.trim() !== (phone || "").trim()) {
      return res.status(401).json({ msg: "Phone number does not match our records" });
    }

    let secretBase32 = user.totp_secret_temp;
    let qrCode = "";
    const identifier = (user.username || user.email || "").trim();

    if (!secretBase32) {
      const secret = generateTotpSecret(`UAVTech EMS (${identifier})`);
      secretBase32 = secret.base32;
      await pool.query(
        "UPDATE users SET totp_secret_temp = $1 WHERE id = $2",
        [secretBase32, user.id]
      );
      qrCode = await qrcode.toDataURL(secret.otpauth_url);
    } else {
      const otpauth_url = speakeasy.otpauthURL({
        secret: secretBase32,
        label: `UAVTech EMS (${identifier})`,
        issuer: "UAVTech",
        encoding: "base32"
      });
      qrCode = await qrcode.toDataURL(otpauth_url);
    }

    const nextToken = jwt.sign(
      { id: user.id, stage: "pre-otp" },
      JWT_SECRET,
      { expiresIn: "10m" }
    );
    return res.json({ requires2FA: true, setupRequired: true, tempToken: nextToken, qrCode });
  } catch (err) {
    console.error("VERIFY PHONE ERROR:", err);
    return res.status(401).json({ msg: "Phone verification failed" });
  }
});



router.post("/verify-otp", otpLimiter, async (req, res) => {
  const { tempToken, otp, isSetup } = req.body;
  try {
    const decoded = jwt.verify(tempToken, JWT_SECRET);
    if (decoded.stage !== "pre-otp")
      return res.status(401).json({ msg: "Invalid token stage" });

    const userRes = await pool.query("SELECT * FROM users WHERE id = $1", [decoded.id]);
    if (userRes.rows.length === 0)
      return res.status(401).json({ msg: "User not found" });

    const user = userRes.rows[0];
    const secret = isSetup ? user.totp_secret_temp : user.totp_secret;
    if (!secret) return res.status(400).json({ msg: "No TOTP secret found" });

    const valid = speakeasy.totp.verify({
      secret,
      encoding: "base32",
      token: otp,
      window: 1,
    });

    if (!valid) return res.status(401).json({ msg: "Invalid OTP code" });

    if (isSetup) {
      await pool.query(
        "UPDATE users SET totp_secret = $1, totp_secret_temp = NULL WHERE id = $2",
        [secret, user.id]
      );
    }

    const empRes = await pool.query("SELECT employee_uav_id FROM employees WHERE user_id = $1", [user.id]);
    const employee_uav_id = empRes.rows[0]?.employee_uav_id || null;

    const token = jwt.sign(
      {
        id: user.id,
        role: user.role,
        username: user.username,
        department: user.department,
        fullname: user.fullname,
        employee_uav_id
      },
      JWT_SECRET,
      { expiresIn: "8h" }
    );

    return res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        fullname: user.fullname,
        role: user.role,
        email: user.email,
        department: user.department,
        profile_pic: user.profile_pic,
      },
    });
  } catch (err) {
    console.error("VERIFY OTP ERROR:", err);
    return res.status(401).json({ msg: "OTP verification failed" });
  }
});


router.post("/create-user", verifyToken, isAdminOrSuper, async (req, res) => {
  const callerRole = req.user.role?.toLowerCase();
  const client = await pool.connect();

  try {
    const {
      title, fullname, phone, email, altEmail, designation, password,
      experiences, custom_fields, basic_salary, hra, epf_amount, pt_amount,
      adhar, addressProof, account_number, ifsc_code, bank_name, branch_name, pan_number,
      police_certificate, medical_certificate, offer_letter_path, nda_path, hr_docs_path,
      employee_uav_id: manualUavId,
      assigned_admin,
    } = req.body;

    let { role, department } = req.body;

    if (!email || !email.trim()) {
      return res.status(400).json({ msg: "Email is required to create a user" });
    }

    if (callerRole !== "super_admin") {
      const allowedRoles = ["employee", "intern"];
      if (!allowedRoles.includes((role || "").toLowerCase())) {
        return res.status(403).json({
          msg: "Dept admin can only create Employee or Intern accounts",
        });
      }
      role = role.toLowerCase();
    } else {
      role = (role || "employee").toLowerCase();
    }

    if (!fullname || !password) {
      return res.status(400).json({ msg: "fullname and password are required" });
    }

    await client.query("BEGIN");

    try {
      await client.query("ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key");
      await client.query("ALTER TABLE users DROP CONSTRAINT IF EXISTS users_username_key");
    } catch (e) { }

    let employee_uav_id;
    if (manualUavId && manualUavId.trim()) {
      employee_uav_id = manualUavId.trim().toUpperCase();
      const idCheck = await client.query(
        "SELECT id FROM employees WHERE employee_uav_id = $1",
        [employee_uav_id]
      );
      if (idCheck.rows.length > 0) {
        await client.query("ROLLBACK");
        return res.status(409).json({
          msg: `Employee ID "${employee_uav_id}" is already taken. Please choose a different one.`,
        });
      }
    } else {
      employee_uav_id = await generateUavId(role);
    }

    const username = `${email.trim().toLowerCase()}_${employee_uav_id.toLowerCase()}`;
    const hashedPassword = await bcrypt.hash(password, 10);

    const userRes = await client.query(
      `INSERT INTO users
         (username, password, fullname, email, role, phone, department, totp_secret, totp_secret_temp, qr_delivered, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,NULL,NULL,false,'Active')
       RETURNING id`,
      [username, hashedPassword, fullname, email.trim(), role,
        phone || null, department || null]
    );
    const userId = userRes.rows[0].id;

    let parsedExperiences = [];
    if (typeof experiences === "string") {
      try { parsedExperiences = JSON.parse(experiences); } catch (e) { parsedExperiences = []; }
    } else if (Array.isArray(experiences)) {
      parsedExperiences = experiences;
    }

    let parsedCustomFields = {};
    if (typeof custom_fields === "string") {
      try { parsedCustomFields = JSON.parse(custom_fields); } catch (e) { parsedCustomFields = {}; }
    } else if (custom_fields && typeof custom_fields === "object") {
      parsedCustomFields = custom_fields;
    }

    await client.query(
      `INSERT INTO employees
         (user_id, employee_uav_id, title, fullname, designation, department, phone,
          adhar_path, address_path, account_number, ifsc_code, bank_name, branch_name, pan_number,
          basic_salary, hra, epf_amount, pt_amount, police_certificate, medical_certificate,
          offer_letter_path, nda_path, hr_docs_path, status, assigned_admin_id, experiences, custom_fields)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,'active',$24,$25,$26)`,
      [
        userId, employee_uav_id, title || 'Mr.', fullname, designation || null, department || null,
        phone || null, adhar || null, addressProof || null,
        account_number || null, ifsc_code || null, bank_name || null, branch_name || null, pan_number || null,
        parseFloat(basic_salary) || 0, parseFloat(hra) || 0,
        parseFloat(epf_amount) || 0, parseFloat(pt_amount) || 0,
        police_certificate || null, medical_certificate || null,
        offer_letter_path || null, nda_path || null, hr_docs_path || null,
        assigned_admin ? parseInt(assigned_admin, 10) : null,
        JSON.stringify(parsedExperiences),
        JSON.stringify(parsedCustomFields)
      ]
    );

    await client.query("COMMIT");


    const identifier = username;
    const secret = generateTotpSecret(`UAVTech EMS (${identifier})`);

    await pool.query(
      "UPDATE users SET totp_secret_temp = $1 WHERE id = $2",
      [secret.base32, userId]
    );

    const qrCode = await qrcode.toDataURL(secret.otpauth_url);

    return res.status(201).json({
      msg: "User created successfully",
      userId,
      username,
      employee_uav_id,
      department,
      qrCode,
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("CREATE USER ERROR:", err);

    if (err.code === "23505") {
      return res.status(409).json({ msg: "Email already exists" });
    }
    return res.status(500).json({ msg: err.message });
  } finally {
    client.release();
  }
});



router.get("/me", verifyToken, async (req, res) => {
  try {
    console.log(`[AuthRoutes] GET /me - User ID: ${req.user.id}`);
    const result = await pool.query(
      "SELECT id, username, fullname, email, role, phone, department, profile_pic FROM users WHERE id = $1",
      [req.user.id]
    );
    if (result.rows.length === 0) {
      console.warn(`[AuthRoutes] GET /me - User not found in DB for ID: ${req.user.id}`);
      return res.status(404).json({ msg: "User not found" });
    }
    console.log(`[AuthRoutes] GET /me - Found user: ${result.rows[0].username} (Role: ${result.rows[0].role})`);
    res.json(result.rows[0]);
  } catch (err) {
    console.error("[AuthRoutes] GET /me - Server error:", err);
    res.status(500).json({ msg: "Server error" });
  }
});



router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;
  try {
    const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    if (result.rows.length === 0)
      return res.status(404).json({ msg: "No account found with that email" });

    const user = result.rows[0];
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const resetToken = jwt.sign({ id: user.id, otp }, JWT_SECRET, { expiresIn: "10m" });

    console.log(`[AUTH] Password reset OTP for ${email}: ${otp}`);

    return res.json({ msg: "OTP sent", resetToken });
  } catch (err) {
    console.error("FORGOT PASSWORD ERROR:", err);
    res.status(500).json({ msg: "Server error" });
  }
});



router.put("/change-password", verifyToken, async (req, res) => {
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password) {
    return res.status(400).json({ msg: "Both current and new password are required." });
  }
  if (new_password.length < 6) {
    return res.status(400).json({ msg: "New password must be at least 6 characters." });
  }
  try {
    const userRes = await pool.query("SELECT * FROM users WHERE id = $1", [req.user.id]);
    if (userRes.rows.length === 0)
      return res.status(404).json({ msg: "User not found." });

    const user = userRes.rows[0];
    const isMatch = await bcrypt.compare(current_password, user.password);
    if (!isMatch)
      return res.status(401).json({ msg: "Current password is incorrect." });

    const hashed = await bcrypt.hash(new_password, 10);


    await pool.query(
      "UPDATE users SET password = $1, totp_secret = NULL, totp_secret_temp = NULL WHERE id = $2",
      [hashed, user.id]
    );

    return res.json({ msg: "Password changed successfully. Please log in again to set up your new 2FA." });
  } catch (err) {
    console.error("CHANGE PASSWORD ERROR:", err);
    return res.status(500).json({ msg: "Server error" });
  }
});


router.post("/reset-password", async (req, res) => {
  const { resetToken, otp, newPassword } = req.body;
  try {
    const decoded = jwt.verify(resetToken, JWT_SECRET);
    if (decoded.otp !== otp)
      return res.status(401).json({ msg: "Invalid OTP" });

    const hashed = await bcrypt.hash(newPassword, 10);
    await pool.query("UPDATE users SET password = $1 WHERE id = $2", [hashed, decoded.id]);

    return res.json({ msg: "Password reset successfully" });
  } catch (err) {
    console.error("RESET PASSWORD ERROR:", err);
    return res.status(401).json({ msg: "Invalid or expired reset token" });
  }

});

export default router;