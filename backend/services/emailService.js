const nodemailer = require("nodemailer");

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
    throw new Error("Email service is not configured");
  }
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: process.env.SMTP_SECURE === "true",
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  return transporter;
}

async function sendPasswordResetEmail(to, token, resetUrl) {
  const from = process.env.EMAIL_FROM || process.env.SMTP_USER;
  await getTransporter().sendMail({
    from,
    to,
    subject: "Reset your password",
    text: `We received a request to reset your password.\n\nEnter this code in the app: ${token}\n\nOr open this link on this device: ${resetUrl}\n\nThis code expires in 15 minutes. If you didn't request this, you can ignore this email.`,
    html: `<p>We received a request to reset your password.</p><p>Enter this code in the app:</p><p style="font-size:20px;font-weight:700;letter-spacing:2px;">${token}</p><p>Or open this link on this device: <a href="${resetUrl}">${resetUrl}</a></p><p>This code expires in 15 minutes. If you didn't request this, you can ignore this email.</p>`,
  });
}

module.exports = { sendPasswordResetEmail };
