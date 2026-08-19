/**
 * regen_2fa.js
 * Regenerates the Super Admin's 2FA QR code WITHOUT touching any other data.
 * Run: node regen_2fa.js
 * Then open superadmin_qr.html in a browser, scan with Google Authenticator, and DELETE the file.
 */
import 'dotenv/config';
import speakeasy from 'speakeasy';
import qrcode from 'qrcode';
import { writeFileSync } from 'fs';
import pkg from 'pg';

const { Pool } = pkg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function regenSuperAdmin2FA() {
  const client = await pool.connect();
  try {
    // Find super admin
    const res = await client.query(
      "SELECT id, username, email FROM users WHERE role = 'super_admin' LIMIT 1"
    );

    if (res.rows.length === 0) {
      console.error('❌ No super_admin found in DB.');
      return;
    }

    const user = res.rows[0];
    const identifier = user.username || user.email || 'superadmin';
    console.log(`✅ Found Super Admin: ${identifier} (id=${user.id})`);

    // Generate a fresh TOTP secret
    const secret = speakeasy.generateSecret({
      name: `UAVTech EMS (${identifier})`,
      issuer: 'UAVTech',
      length: 20,
    });

    // Save as totp_secret_temp so next login scan+verify promotes it to totp_secret
    await client.query(
      'UPDATE users SET totp_secret = NULL, totp_secret_temp = $1 WHERE id = $2',
      [secret.base32, user.id]
    );

    // Generate QR HTML
    const qrDataUrl = await qrcode.toDataURL(secret.otpauth_url);
    const html = `<!DOCTYPE html>
<html>
<head><title>Super Admin 2FA QR</title></head>
<body style="display:flex;flex-direction:column;align-items:center;justify-content:center;
             height:100vh;font-family:sans-serif;background:#f0f4f8">
  <h2>Super Admin — Google Authenticator Setup</h2>
  <p>Scan this QR code with your Google Authenticator app, then log in.</p>
  <img src="${qrDataUrl}" style="width:260px;height:260px;border:1px solid #ccc;
       padding:12px;border-radius:8px" />
  <p style="color:#555;font-size:13px;margin-top:16px">
    Manual key: <strong>${secret.base32}</strong>
  </p>
  <p style="color:red;font-weight:bold;margin-top:12px">
    ⚠️ Delete this file immediately after scanning!
  </p>
</body>
</html>`;

    writeFileSync('superadmin_qr.html', html);

    console.log('\n✅ Done! 2FA regenerated successfully.');
    console.log('   ➜  Open superadmin_qr.html in a browser and scan with Google Authenticator.');
    console.log('   ➜  Then log in — the first successful OTP will lock in the new secret.');
    console.log('   ➜  DELETE superadmin_qr.html after scanning!\n');
    console.log('   Manual key (if QR fails):', secret.base32);

  } catch (err) {
    console.error('❌ Failed:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

regenSuperAdmin2FA();
