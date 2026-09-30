import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: false, // true for 465, false for 587
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/**
 * Send a password reset OTP email.
 * @param {string} toEmail  - Recipient email address
 * @param {string} otp      - 6-digit OTP code
 * @param {string} name     - Recipient's full name
 */
export async function sendPasswordResetOtp(toEmail, otp, name = "User") {
  const mailOptions = {
    from: process.env.EMAIL_FROM || `"WorkStockPro" <${process.env.SMTP_USER}>`,
    to: toEmail,
    subject: "Password Reset OTP — UAV-Tech EMS",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; background: #f8fafc; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0;">
        <div style="background: linear-gradient(135deg, #1e3a5f 0%, #2d6a9f 100%); padding: 28px 32px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 22px; letter-spacing: -0.5px;">UAV-Tech EMS</h1>
          <p style="color: #cbd5e1; margin: 6px 0 0; font-size: 13px;">Employee Management System</p>
        </div>
        <div style="padding: 32px;">
          <p style="color: #334155; font-size: 15px; margin: 0 0 8px;">Hi <strong>${name}</strong>,</p>
          <p style="color: #64748b; font-size: 14px; margin: 0 0 24px;">
            We received a request to reset your password. Use the OTP below. It is valid for <strong>10 minutes</strong>.
          </p>
          <div style="background: #f1f5f9; border: 2px dashed #94a3b8; border-radius: 10px; padding: 20px; text-align: center; margin-bottom: 24px;">
            <p style="margin: 0 0 6px; font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 1px;">Your OTP Code</p>
            <p style="margin: 0; font-size: 38px; font-weight: 800; color: #1e3a5f; letter-spacing: 8px;">${otp}</p>
          </div>
          <p style="color: #94a3b8; font-size: 12px; margin: 0;">
            If you did not request a password reset, please ignore this email. Your account is safe.
          </p>
        </div>
        <div style="background: #f1f5f9; padding: 16px 32px; text-align: center; border-top: 1px solid #e2e8f0;">
          <p style="color: #94a3b8; font-size: 11px; margin: 0;">© 2026 UAV-Tech. All rights reserved.</p>
        </div>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
}
