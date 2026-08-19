import pool from "./db.js";
import bcrypt from "bcryptjs";
import speakeasy from "speakeasy";
import qrcode from "qrcode";
import { writeFileSync } from "fs";

async function resetDatabase() {
  const client = await pool.connect();
  try {
    console.log("Starting Database Reset...");
    await client.query("BEGIN");

    console.log("Clearing all tables...");
    await client.query(`
      TRUNCATE TABLE 
        bulletins, 
        user_permissions, 
        payslip_requests, 
        dpr_tasks, 
        dpr_entries, 
        tasks, 
        attendance, 
        leaves, 
        employees, 
        shared_documents,
        general_requests,
        notifications,
        payroll_history,
        meetings,
        users 
      RESTART IDENTITY CASCADE
    `);

    const superHash = await bcrypt.hash("good123", 10);

    console.log("Creating Super Admin...");


    const superSecret = speakeasy.generateSecret({
      name: "UAVTech EMS (superadmin)",
      issuer: "UAVTech",
    });

    const superRes = await client.query(`
      INSERT INTO users (username, password, fullname, name, email, role, phone, totp_secret, qr_delivered)
      VALUES ('superadmin', $1, 'Super Administrator', 'Super Administrator', 'superadmin@uavtech.ai', 'super_admin', '6281915237', $2, false)
      RETURNING id
    `, [superHash, superSecret.base32]);
    const superId = superRes.rows[0].id;

    await client.query(`
      INSERT INTO employees (user_id, employee_uav_id, fullname, designation, department, phone)
      VALUES ($1, 'UTPLS001', 'Super Administrator', 'Director', 'Management', '6281915237')
    `, [superId]);

    await client.query("COMMIT");


    const qrDataUrl = await qrcode.toDataURL(superSecret.otpauth_url);

    const html = `<!DOCTYPE html>
<html>
<head><title>Super Admin QR</title></head>
<body style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;background:#f0f4f8">
  <h2>Super Admin - Google Authenticator Setup</h2>
  <p>Scan this QR code with your Google Authenticator app</p>
  <img src="${qrDataUrl}" style="width:250px;height:250px;border:1px solid #ccc;padding:10px;border-radius:8px" />
  <p style="color:#666;font-size:12px;margin-top:16px">Manual key: ${superSecret.base32}</p>
  <p style="color:red;font-weight:bold">Delete this file after scanning!</p>
</body>
</html>`;

    writeFileSync("superadmin_qr.html", html);

    console.log("\n Database Reset and Initial Setup Complete!");
    console.log("\n SUPER ADMIN GOOGLE AUTHENTICATOR SETUP:");
    console.log("   OTP URL:", superSecret.otpauth_url);
    console.log("   Manual key (if QR fails):", superSecret.base32);
    console.log("\n QR saved to: superadmin_qr.html — open in browser, scan, then DELETE the file!");

  } catch (err) {
    if (client) await client.query("ROLLBACK");
    console.error("❌ Reset Failed:", err.message);
  } finally {
    client.release();
    process.exit(0);
  }
}

resetDatabase();