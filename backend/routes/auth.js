const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../config/database');
const { logger } = require('../config/logger');
const { validate, schemas } = require('../middleware/validation');
const tokenBlacklist = require('../config/tokenBlacklist');
const { sendOtpEmail } = require('../config/email');

const router = express.Router();

// ===========================================
// REFRESH TOKEN STORAGE (In production, use Redis)
// ===========================================
const refreshTokens = new Map();

// ===========================================
// 2FA OTP STORAGE (Database-backed)
// ===========================================
const OTP_TTL_MS = 5 * 60 * 1000;

const initOtpTable = async () => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS otp_codes (
        id SERIAL PRIMARY KEY,
        temp_token VARCHAR(128) NOT NULL UNIQUE,
        user_id INTEGER NOT NULL,
        email VARCHAR(255) NOT NULL,
        user_type VARCHAR(20) NOT NULL DEFAULT 'user',
        otp VARCHAR(10) NOT NULL,
        user_data JSONB,
        attempts INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_otp_codes_token ON otp_codes(temp_token);
      CREATE INDEX IF NOT EXISTS idx_otp_codes_expiry ON otp_codes(expires_at);
    `);
  } catch (error) {
    logger.error('Failed to initialize otp_codes table:', error.message);
  }
};

initOtpTable();

const generateOTP = () => {
  return crypto.randomInt(100000, 999999).toString();
};

const maskEmail = (email) => {
  const [local, domain] = email.split('@');
  const maskedLocal = local.length <= 2
    ? local[0] + '*'.repeat(local.length - 1)
    : local[0] + '*'.repeat(local.length - 2) + local[local.length - 1];
  return `${maskedLocal}@${domain}`;
};

const createOTPSession = async (userId, email, userType, userData) => {
  const otp = generateOTP();
  const tempToken = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  await db.query(
    `INSERT INTO otp_codes (temp_token, user_id, email, user_type, otp, user_data, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (temp_token) DO UPDATE
     SET user_id = EXCLUDED.user_id,
         email = EXCLUDED.email,
         user_type = EXCLUDED.user_type,
         otp = EXCLUDED.otp,
         user_data = EXCLUDED.user_data,
         attempts = 0,
         created_at = CURRENT_TIMESTAMP,
         expires_at = EXCLUDED.expires_at`,
    [tempToken, userId, email, userType, otp, JSON.stringify(userData || {}), expiresAt]
  );

  // Best-effort cleanup of expired rows.
  await db.query('DELETE FROM otp_codes WHERE expires_at < NOW()');

  return { otp, tempToken };
};

const getOTPSession = async (tempToken) => {
  const result = await db.query(
    `SELECT temp_token, user_id, email, user_type, otp, user_data, attempts, created_at, expires_at
     FROM otp_codes
     WHERE temp_token = $1`,
    [tempToken]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    tempToken: row.temp_token,
    userId: row.user_id,
    email: row.email,
    userType: row.user_type,
    otp: row.otp,
    userData: row.user_data || {},
    attempts: row.attempts,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  };
};

const incrementOtpAttempts = async (tempToken) => {
  const result = await db.query(
    `UPDATE otp_codes
     SET attempts = attempts + 1
     WHERE temp_token = $1
     RETURNING attempts`,
    [tempToken]
  );
  return result.rows[0]?.attempts ?? 0;
};

const updateOtpCode = async (tempToken, otp) => {
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);
  await db.query(
    `UPDATE otp_codes
     SET otp = $1,
         attempts = 0,
         expires_at = $2,
         created_at = CURRENT_TIMESTAMP
     WHERE temp_token = $3`,
    [otp, expiresAt, tempToken]
  );
};

const deleteOTPSession = async (tempToken) => {
  await db.query('DELETE FROM otp_codes WHERE temp_token = $1', [tempToken]);
};

// Generate refresh token
const generateRefreshToken = () => {
  return crypto.randomBytes(64).toString('hex');
};

// ===========================================
// REGISTER NEW USER
// ===========================================
router.post('/register', validate(schemas.register), async (req, res) => {
  try {
    const { email, password, full_name, phone } = req.body;

    // Check if user already exists
    const existingUser = await db.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existingUser.rows.length > 0) {
      logger.logAuth('register', email, false, { reason: 'email_exists' });
      return res.status(409).json({ error: 'Email already registered' });
    }

    // Check if phone number already exists
    if (phone) {
      const existingPhone = await db.query('SELECT id FROM users WHERE phone = $1', [phone]);
      if (existingPhone.rows.length > 0) {
        logger.logAuth('register', email, false, { reason: 'phone_exists' });
        return res.status(409).json({ error: 'Phone number already registered' });
      }
    }

    // Hash password with higher cost factor for security
    const password_hash = await bcrypt.hash(password, 12);

    // Insert user with explicit role='user'
    const result = await db.query(
      `INSERT INTO users (email, password_hash, full_name, phone, role) 
       VALUES ($1, $2, $3, $4, 'user') 
       RETURNING id, email, full_name, phone, status, role, created_at`,
      [email.toLowerCase(), password_hash, full_name, phone]
    );

    const user = result.rows[0];

    // 2FA: Generate OTP instead of returning tokens directly
    const { otp, tempToken } = await createOTPSession(user.id, user.email, 'user', { user });

    logger.logAuth('register', user.id, true, { email: user.email, requires2FA: true });

    // Send OTP via email
    await sendOtpEmail(user.email, otp, 'register');

    const response = {
      message: 'Verification code sent to your email',
      requires2FA: true,
      tempToken,
      maskedEmail: maskEmail(user.email),
    };

    if (process.env.NODE_ENV !== 'production') {
      response.otp = otp; // Only for development/testing
    }

    res.status(201).json(response);
  } catch (error) {
    logger.logError(error, req);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// ===========================================
// USER LOGIN
// ===========================================
router.post('/login', validate(schemas.login), async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check for user
    const result = await db.query(
      'SELECT id, email, password_hash, full_name, phone, status, role, avatar_url, two_factor_enabled FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      logger.logAuth('login', email, false, { reason: 'user_not_found' });
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = result.rows[0];

    // Verify password first
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      logger.logAuth('login', user.id, false, { reason: 'invalid_password' });
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Check if user is suspended
    if (user.status === 'suspended') {
      logger.logAuth('login', user.id, false, { reason: 'account_suspended' });
      return res.status(403).json({ error: 'Account suspended. Contact support.' });
    }

    // Remove password hash before storing in session
    delete user.password_hash;

    // Skip 2FA if user has it disabled
    if (user.two_factor_enabled === false) {
      const accessToken = jwt.sign(
        { id: user.id, email: user.email, type: 'user' },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '4h' }
      );

      const refreshToken = generateRefreshToken();
      refreshTokens.set(refreshToken, {
        userId: user.id,
        type: 'user',
        createdAt: Date.now(),
        expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
      });

      delete user.two_factor_enabled;
      logger.logAuth('login', user.id, true, { email: user.email, requires2FA: false });

      return res.json({
        message: 'Login successful',
        requires2FA: false,
        success: true,
        user,
        token: accessToken,
        refreshToken,
      });
    }

    delete user.two_factor_enabled;

    // 2FA: Generate OTP instead of returning tokens directly
    const { otp, tempToken } = await createOTPSession(user.id, user.email, 'user', { user });

    logger.logAuth('login', user.id, true, { email: user.email, requires2FA: true });

    // Send OTP via email
    await sendOtpEmail(user.email, otp, 'login');

    const response = {
      message: 'Verification code sent to your email',
      requires2FA: true,
      tempToken,
      maskedEmail: maskEmail(user.email),
    };

    if (process.env.NODE_ENV !== 'production') {
      response.otp = otp; // Only for development/testing
    }

    res.json(response);
  } catch (error) {
    logger.logError(error, req);
    res.status(500).json({ error: 'Login failed' });
  }
});

// ===========================================
// VERIFY OTP (2FA)
// ===========================================
router.post('/verify-otp', async (req, res) => {
  try {
    const { tempToken, otp } = req.body;

    if (!tempToken || !otp) {
      return res.status(400).json({ error: 'Verification code and session token are required' });
    }

    const session = await getOTPSession(tempToken);

    if (!session) {
      return res.status(400).json({ error: 'Session expired. Please login again.' });
    }

    // Check expiry
    if (Date.now() > new Date(session.expiresAt).getTime()) {
      await deleteOTPSession(tempToken);
      return res.status(400).json({ error: 'Verification code has expired. Please login again.' });
    }

    // Check attempts (max 5)
    if (session.attempts >= 5) {
      await deleteOTPSession(tempToken);
      return res.status(400).json({ error: 'Too many failed attempts. Please login again.' });
    }

    // Verify OTP
    if (session.otp !== otp.toString()) {
      const attempts = await incrementOtpAttempts(tempToken);
      return res.status(400).json({
        error: 'Invalid verification code',
        attemptsRemaining: Math.max(0, 5 - attempts),
      });
    }

    // OTP verified — generate actual auth tokens
    const accessToken = jwt.sign(
      { id: session.userId, email: session.email, type: session.userType },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '4h' }
    );

    const refreshToken = generateRefreshToken();
    refreshTokens.set(refreshToken, {
      userId: session.userId,
      type: session.userType,
      createdAt: Date.now(),
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
    });

    // Clean up OTP session
    await deleteOTPSession(tempToken);

    logger.logAuth('2fa_verify', session.userId, true, { email: session.email });

    res.json({
      message: 'Verification successful',
      success: true,
      user: session.userData.user,
      token: accessToken,
      refreshToken,
    });
  } catch (error) {
    logger.logError(error, req);
    res.status(500).json({ error: 'Verification failed' });
  }
});

// ===========================================
// RESEND OTP (2FA)
// ===========================================
router.post('/resend-otp', async (req, res) => {
  try {
    const { tempToken } = req.body;

    if (!tempToken) {
      return res.status(400).json({ error: 'Session token is required' });
    }

    const session = await getOTPSession(tempToken);

    if (!session) {
      return res.status(400).json({ error: 'Session expired. Please login again.' });
    }

    if (Date.now() > new Date(session.expiresAt).getTime()) {
      await deleteOTPSession(tempToken);
      return res.status(400).json({ error: 'Session expired. Please login again.' });
    }

    // Generate new OTP
    const newOtp = generateOTP();
    await updateOtpCode(tempToken, newOtp);

    // Send new OTP via email
    await sendOtpEmail(session.email, newOtp, 'login');

    const response = {
      message: 'A new verification code has been sent',
      success: true,
      maskedEmail: maskEmail(session.email),
    };

    if (process.env.NODE_ENV !== 'production') {
      response.otp = newOtp; // Only for development/testing
    }

    logger.logAuth('2fa_resend', session.userId, true, { email: session.email });

    res.json(response);
  } catch (error) {
    logger.logError(error, req);
    res.status(500).json({ error: 'Failed to resend verification code' });
  }
});

// ===========================================
// REFRESH TOKEN ENDPOINT
// ===========================================
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token is required' });
    }

    if (await tokenBlacklist.isBlacklisted(refreshToken)) {
      return res.status(401).json({ error: 'Refresh token has been revoked' });
    }

    const tokenData = refreshTokens.get(refreshToken);

    if (!tokenData) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    if (Date.now() > tokenData.expiresAt) {
      refreshTokens.delete(refreshToken);
      return res.status(401).json({ error: 'Refresh token expired' });
    }

    // Get user data
    let result;
    if (tokenData.type === 'admin') {
      result = await db.query('SELECT id, email FROM admins WHERE id = $1', [tokenData.userId]);
    } else {
      result = await db.query('SELECT id, email FROM users WHERE id = $1', [tokenData.userId]);
    }

    if (result.rows.length === 0) {
      refreshTokens.delete(refreshToken);
      return res.status(401).json({ error: 'User not found' });
    }

    const user = result.rows[0];

    // Generate new access token
    const accessToken = jwt.sign(
      { id: user.id, email: user.email, type: tokenData.type },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '4h' }
    );

    // Optionally rotate refresh token
    const newRefreshToken = generateRefreshToken();
    refreshTokens.delete(refreshToken);
    refreshTokens.set(newRefreshToken, {
      ...tokenData,
      createdAt: Date.now(),
    });

    logger.logAuth('token_refresh', user.id, true, { type: tokenData.type });

    res.json({
      token: accessToken,
      refreshToken: newRefreshToken,
    });
  } catch (error) {
    logger.logError(error, req);
    res.status(500).json({ error: 'Token refresh failed' });
  }
});

// ===========================================
// ADMIN LOGIN
// ===========================================
router.post('/admin/login', validate(schemas.login), async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check for admin
    const result = await db.query(
      'SELECT id, email, password_hash, full_name, role, is_active FROM admins WHERE email = $1',
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      logger.logAuth('admin_login', email, false, { reason: 'admin_not_found' });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const admin = result.rows[0];

    // Verify password first
    const validPassword = await bcrypt.compare(password, admin.password_hash);
    if (!validPassword) {
      logger.logAuth('admin_login', admin.id, false, { reason: 'invalid_password' });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!admin.is_active) {
      logger.logAuth('admin_login', admin.id, false, { reason: 'account_disabled' });
      return res.status(403).json({ error: 'Admin account is disabled' });
    }

    // Update last login
    await db.query('UPDATE admins SET last_login = NOW() WHERE id = $1', [admin.id]);

    // Generate access token
    const accessToken = jwt.sign(
      { id: admin.id, email: admin.email, role: admin.role, type: 'admin' },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '4h' }
    );

    // Generate refresh token
    const refreshToken = generateRefreshToken();
    refreshTokens.set(refreshToken, {
      userId: admin.id,
      type: 'admin',
      createdAt: Date.now(),
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    delete admin.password_hash;

    logger.logAuth('admin_login', admin.id, true, { email: admin.email, role: admin.role });

    res.json({
      message: 'Admin login successful',
      admin,
      token: accessToken,
      refreshToken,
    });
  } catch (error) {
    logger.logError(error, req);
    res.status(500).json({ error: 'Login failed' });
  }
});

// ===========================================
// LOGOUT (Invalidate tokens)
// ===========================================
router.post('/logout', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    const authHeader = req.headers['authorization'];
    const accessToken = authHeader && authHeader.split(' ')[1];

    let userId = null;
    let userType = 'user';

    // Blacklist the access token
    if (accessToken) {
      try {
        const decoded = jwt.verify(accessToken, process.env.JWT_SECRET, { ignoreExpiration: true });
        userId = decoded.id;
        userType = decoded.type || 'user';
        
        // Calculate token expiry for blacklist
        const expiresAt = new Date(decoded.exp * 1000);
        await tokenBlacklist.add(accessToken, userId, userType, 'logout', expiresAt);
      } catch (e) {
        // Token might be invalid, but we still proceed with logout
      }
    }

    // Revoke refresh token and remove it from storage
    if (refreshToken) {
      const tokenData = refreshTokens.get(refreshToken);

      if (tokenData) {
        userId = tokenData.userId;
        userType = tokenData.type;
      }

      await tokenBlacklist.add(
        refreshToken,
        tokenData?.userId || userId,
        tokenData?.type || userType,
        'logout_refresh',
        tokenData?.expiresAt ? new Date(tokenData.expiresAt) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      );

      if (tokenData) {
        refreshTokens.delete(refreshToken);
      }
    }

    if (userId) {
      logger.logAuth('logout', userId, true, { type: userType });
    }

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

// ===========================================
// LOGOUT ALL SESSIONS (Security feature)
// ===========================================
router.post('/logout-all', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const accessToken = authHeader && authHeader.split(' ')[1];

    if (!accessToken) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const decoded = jwt.verify(accessToken, process.env.JWT_SECRET);
    const userId = decoded.id;
    const userType = decoded.type || 'user';

    // Blacklist all tokens for this user
    await tokenBlacklist.blacklistAllForUser(userId, userType, 'logout_all');

    // Remove all refresh tokens for this user
    for (const [token, data] of refreshTokens.entries()) {
      if (data.userId === userId && data.type === userType) {
        refreshTokens.delete(token);
      }
    }

    logger.logAuth('logout_all', userId, true, { type: userType });

    res.json({ message: 'All sessions logged out successfully' });
  } catch (error) {
    logger.error('Logout all error:', { error: error.message });
    res.status(500).json({ error: 'Logout failed' });
  }
});

// ===========================================
// PASSWORD RESET TOKEN STORAGE
// ===========================================
const passwordResetTokens = new Map();

// ===========================================
// FORGOT PASSWORD - Request reset token
// ===========================================
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Check if user exists
    const result = await db.query(
      'SELECT id, email, full_name FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    // Always return success to prevent email enumeration
    if (result.rows.length === 0) {
      logger.logAuth('forgot_password', email, false, { reason: 'user_not_found' });
      return res.json({ 
        message: 'If your email is registered, you will receive a password reset link shortly.' 
      });
    }

    const user = result.rows[0];

    // Generate reset token (6-digit code for mobile apps)
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    const resetToken = crypto.randomBytes(32).toString('hex');
    
    // Store token with 15-minute expiry
    passwordResetTokens.set(resetToken, {
      userId: user.id,
      email: user.email,
      code: resetCode,
      expiresAt: Date.now() + 15 * 60 * 1000, // 15 minutes
      attempts: 0,
    });

    // Also store by code for code-based verification
    passwordResetTokens.set(`code_${user.id}`, {
      token: resetToken,
      code: resetCode,
      expiresAt: Date.now() + 15 * 60 * 1000,
      attempts: 0,
    });

    logger.logAuth('forgot_password', user.id, true, { email: user.email });

    // In production, you would send an email here
    // For now, return the code in development mode only
    if (process.env.NODE_ENV === 'development') {
      return res.json({ 
        message: 'Password reset code generated.',
        resetToken, // Only in development
        resetCode,  // Only in development
        expiresIn: '15 minutes',
      });
    }

    res.json({ 
      message: 'If your email is registered, you will receive a password reset link shortly.' 
    });
  } catch (error) {
    logger.error('Forgot password error:', { error: error.message });
    res.status(500).json({ error: 'Failed to process password reset request' });
  }
});

// ===========================================
// VERIFY RESET CODE
// ===========================================
router.post('/verify-reset-code', async (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({ error: 'Email and code are required' });
    }

    // Find user
    const userResult = await db.query(
      'SELECT id FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (userResult.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired reset code' });
    }

    const userId = userResult.rows[0].id;
    const codeData = passwordResetTokens.get(`code_${userId}`);

    if (!codeData) {
      return res.status(400).json({ error: 'Invalid or expired reset code' });
    }

    // Check expiry
    if (Date.now() > codeData.expiresAt) {
      passwordResetTokens.delete(`code_${userId}`);
      passwordResetTokens.delete(codeData.token);
      return res.status(400).json({ error: 'Reset code has expired' });
    }

    // Check attempts (max 5)
    if (codeData.attempts >= 5) {
      passwordResetTokens.delete(`code_${userId}`);
      passwordResetTokens.delete(codeData.token);
      return res.status(400).json({ error: 'Too many failed attempts. Request a new code.' });
    }

    // Verify code
    if (codeData.code !== code) {
      codeData.attempts++;
      return res.status(400).json({ 
        error: 'Invalid reset code',
        attemptsRemaining: 5 - codeData.attempts,
      });
    }

    // Code is valid - return the token for password reset
    res.json({ 
      success: true,
      resetToken: codeData.token,
      message: 'Code verified successfully',
    });
  } catch (error) {
    logger.error('Verify reset code error:', { error: error.message });
    res.status(500).json({ error: 'Failed to verify reset code' });
  }
});

// ===========================================
// RESET PASSWORD
// ===========================================
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token and new password are required' });
    }

    // Validate password strength
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]+$/;
    if (!passwordRegex.test(newPassword)) {
      return res.status(400).json({ 
        error: 'Password must contain uppercase, lowercase, number, and special character' 
      });
    }

    // Verify token
    const tokenData = passwordResetTokens.get(token);

    if (!tokenData) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    if (Date.now() > tokenData.expiresAt) {
      passwordResetTokens.delete(token);
      passwordResetTokens.delete(`code_${tokenData.userId}`);
      return res.status(400).json({ error: 'Reset token has expired' });
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 12);

    // Update password in database
    await db.query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [passwordHash, tokenData.userId]
    );

    // Invalidate all existing tokens for this user
    await tokenBlacklist.blacklistAllForUser(tokenData.userId, 'user', 'password_reset');

    // Clean up reset tokens
    passwordResetTokens.delete(token);
    passwordResetTokens.delete(`code_${tokenData.userId}`);

    // Remove all refresh tokens for this user
    for (const [refreshToken, data] of refreshTokens.entries()) {
      if (data.userId === tokenData.userId && data.type === 'user') {
        refreshTokens.delete(refreshToken);
      }
    }

    logger.logAuth('password_reset', tokenData.userId, true, { email: tokenData.email });

    res.json({ message: 'Password reset successfully. Please login with your new password.' });
  } catch (error) {
    logger.error('Reset password error:', { error: error.message });
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

module.exports = router;
