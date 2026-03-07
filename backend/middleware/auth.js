const jwt = require('jsonwebtoken');
const db = require('../config/database');
const tokenBlacklist = require('../config/tokenBlacklist');

// Authenticate regular user
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    // Check if token is blacklisted
    if (await tokenBlacklist.isBlacklisted(token)) {
      return res.status(401).json({ error: 'Token has been revoked' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.type !== 'user') {
      return res.status(403).json({ error: 'Invalid token type' });
    }

    // Check if all user tokens are blacklisted (password change, security event)
    if (await tokenBlacklist.isUserBlacklisted(decoded.id, 'user', decoded.iat * 1000)) {
      return res.status(401).json({ error: 'Session invalidated. Please login again.' });
    }

    // Verify user still exists and is active
    const result = await db.query(
      'SELECT id, email, status FROM users WHERE id = $1',
      [decoded.id]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }

    if (result.rows[0].status === 'suspended') {
      return res.status(403).json({ error: 'Account suspended' });
    }

    req.user = result.rows[0];
    req.token = token; // Store token for potential logout
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(403).json({ error: 'Invalid token' });
  }
};

// Authenticate token but allow suspended users (for checking suspension status)
const authenticateTokenAllowSuspended = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    // Check if token is blacklisted
    if (await tokenBlacklist.isBlacklisted(token)) {
      return res.status(401).json({ error: 'Token has been revoked' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.type !== 'user') {
      return res.status(403).json({ error: 'Invalid token type' });
    }

    // Check if all user tokens are blacklisted
    if (await tokenBlacklist.isUserBlacklisted(decoded.id, 'user', decoded.iat * 1000)) {
      return res.status(401).json({ error: 'Session invalidated. Please login again.' });
    }

    // Verify user still exists (but don't block suspended users)
    const result = await db.query(
      'SELECT id, email, status, suspension_reason, suspended_at FROM users WHERE id = $1',
      [decoded.id]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }

    req.user = result.rows[0];
    req.token = token;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(403).json({ error: 'Invalid token' });
  }
};

// Optional authentication (for routes that work with or without auth)
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      console.log('🔐 Optional auth - Token decoded:', {
        userId: decoded.id,
        type: decoded.type,
        isUser: decoded.type === 'user'
      });
      
      if (decoded.type === 'user') {
        const result = await db.query('SELECT id, email FROM users WHERE id = $1', [decoded.id]);
        if (result.rows.length > 0) {
          req.user = result.rows[0];
          console.log('✅ User authenticated:', req.user.id);
        } else {
          console.log('❌ User not found in database');
        }
      } else {
        console.log('❌ Token type is not "user":', decoded.type);
      }
    } else {
      console.log('⚠️ No auth token provided');
    }
    next();
  } catch (error) {
    // Continue without authentication
    console.log('❌ Optional auth error:', error.message);
    next();
  }
};

// Authenticate admin
const authenticateAdmin = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Admin access token required' });
    }

    // Check if token is blacklisted
    if (await tokenBlacklist.isBlacklisted(token)) {
      return res.status(401).json({ error: 'Token has been revoked' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.type !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Check if all admin tokens are blacklisted
    if (await tokenBlacklist.isUserBlacklisted(decoded.id, 'admin', decoded.iat * 1000)) {
      return res.status(401).json({ error: 'Session invalidated. Please login again.' });
    }

    // Verify admin still exists and is active
    const result = await db.query(
      'SELECT id, email, role, is_active FROM admins WHERE id = $1',
      [decoded.id]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Admin not found' });
    }

    if (!result.rows[0].is_active) {
      return res.status(403).json({ error: 'Admin account disabled' });
    }

    req.admin = result.rows[0];
    req.token = token;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(403).json({ error: 'Invalid admin token' });
  }
};

module.exports = {
  authenticateToken,
  authenticateTokenAllowSuspended,
  optionalAuth,
  authenticateAdmin,
};
