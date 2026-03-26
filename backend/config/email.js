const nodemailer = require('nodemailer');
const { logger } = require('./logger');

// Create reusable transporter
const createTransporter = () => {
  const config = {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  };

  return nodemailer.createTransport(config);
};

let transporter = null;

const getTransporter = () => {
  if (!transporter) {
    transporter = createTransporter();
  }
  return transporter;
};

// Send OTP verification email
const sendOtpEmail = async (to, otp, purpose = 'login') => {
  const purposeText = purpose === 'register'
    ? 'complete your registration'
    : 'log in to your account';

  const mailOptions = {
    from: `"Pawmilya" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
    to,
    subject: `${otp} is your Pawmilya verification code`,
    html: `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 480px; margin: 0 auto; background: #FFF8F3; border-radius: 16px; overflow: hidden;">
        <div style="background: #FF8C42; padding: 32px 24px; text-align: center;">
          <h1 style="color: #fff; margin: 0; font-size: 28px;">🐾 Pawmilya</h1>
          <p style="color: #FFE0C2; margin: 8px 0 0; font-size: 14px;">Every paw deserves a home</p>
        </div>
        <div style="padding: 32px 24px;">
          <p style="color: #333; font-size: 16px; margin: 0 0 8px;">Hi there!</p>
          <p style="color: #555; font-size: 14px; line-height: 1.6; margin: 0 0 24px;">
            Use the code below to ${purposeText}. This code expires in <strong>5 minutes</strong>.
          </p>
          <div style="background: #fff; border: 2px dashed #FF8C42; border-radius: 12px; padding: 20px; text-align: center; margin: 0 0 24px;">
            <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #FF8C42;">${otp}</span>
          </div>
          <p style="color: #999; font-size: 12px; line-height: 1.5; margin: 0;">
            If you didn't request this code, you can safely ignore this email. Someone may have entered your email address by mistake.
          </p>
        </div>
        <div style="background: #F5E6D8; padding: 16px 24px; text-align: center;">
          <p style="color: #999; font-size: 11px; margin: 0;">© ${new Date().getFullYear()} Pawmilya. All rights reserved.</p>
        </div>
      </div>
    `,
    text: `Your Pawmilya verification code is: ${otp}\n\nThis code expires in 5 minutes.\n\nIf you didn't request this code, please ignore this email.`,
  };

  try {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      logger.warn('[Email] SMTP not configured — skipping email send. OTP must be retrieved from logs.');
      return { sent: false, reason: 'smtp_not_configured' };
    }

    const info = await getTransporter().sendMail(mailOptions);
    logger.info(`[Email] OTP email sent to ${to}: ${info.messageId}`);
    return { sent: true, messageId: info.messageId };
  } catch (error) {
    logger.error(`[Email] Failed to send OTP to ${to}: ${error.message}`);
    return { sent: false, reason: error.message };
  }
};

module.exports = { sendOtpEmail, getTransporter };
