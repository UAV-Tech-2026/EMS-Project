import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: process.env.SMTP_SECURE === "true", // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
  },
});

export const sendOtpEmail = async (toEmail, otp) => {
  const fromEmail = process.env.EMAIL_FROM || `"WorkStockPro" <${process.env.SMTP_USER || "noreply@workstockpro.com"}>`;
  
  // If SMTP is not fully configured, log warning and skip throw if desired
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn(`[MAILER WARNING] SMTP_USER or SMTP_PASS not set in environment. OTP for ${toEmail} is ${otp}`);
    return false;
  }

  const mailOptions = {
    from: fromEmail,
    to: toEmail,
    subject: "WorkStockPro - Password Reset OTP Code",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff;">
        <h2 style="color: #1e3a8a; text-align: center;">WorkStockPro Password Reset</h2>
        <p style="color: #334155; font-size: 16px;">Hello,</p>
        <p style="color: #334155; font-size: 16px;">You requested a password reset for your account. Please use the verification code below to reset your password:</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #2563eb; background-color: #eff6ff; padding: 12px 24px; border-radius: 6px; border: 1px dashed #bfdbfe;">
            ${otp}
          </span>
        </div>
        
        <p style="color: #64748b; font-size: 14px;">This code is valid for <strong>10 minutes</strong>. If you did not request a password reset, please ignore this email.</p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
        <p style="color: #94a3b8; font-size: 12px; text-align: center;">&copy; ${new Date().getFullYear()} WorkStockPro. All rights reserved.</p>
      </div>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`[MAILER] OTP email successfully sent to ${toEmail}. MessageId: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error(`[MAILER ERROR] Failed to send email to ${toEmail}:`, error);
    throw error;
  }
};
