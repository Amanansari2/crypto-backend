const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 465),
    secure: process.env.SMTP_SECURE === "true",
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
});

async function verifyEmailConnection() {
    await transporter.verify();
    console.log("SMTP connection verified successfully");
}

async function sendEmail({ to, subject, html, text }) {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        throw new Error("SMTP credentials are not configured");
    }
    if (!to || !subject || (!html && !text)) {
        throw new Error("Email recipient, subject, and body are required");
    }
    const result = await transporter.sendMail({
        from: { name: process.env.SMTP_FROM_NAME || "Terminal1", address: process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER },
        to, subject, html, text
    });
    if (result.rejected && result.rejected.length && (!result.accepted || !result.accepted.length)) {
        throw new Error("SMTP rejected the email recipient");
    }
    return { messageId: result.messageId, accepted: result.accepted, rejected: result.rejected };
}

module.exports = { transporter, verifyEmailConnection, sendEmail };
