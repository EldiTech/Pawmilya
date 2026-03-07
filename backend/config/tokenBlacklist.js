const db = require('./database');

// ===========================================
// TOKEN BLACKLIST SERVICE
// ===========================================
// Stores invalidated tokens to prevent reuse after logout
// In production, consider using Redis for better performance

class TokenBlacklist {
  constructor() {
    // In-memory cache for quick lookups
    this.cache = new Map();
    
    // Cleanup interval (every hour)
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60 * 60 * 1000);

    // Initialize database table
    this.initTable();
  }

  // Create blacklist table if it doesn't exist
  async initTable() {
    try {
      await db.query(`
        CREATE TABLE IF NOT EXISTS token_blacklist (
          id SERIAL PRIMARY KEY,
          token_hash VARCHAR(64) NOT NULL UNIQUE,
          user_id INTEGER,
          user_type VARCHAR(20),
          reason VARCHAR(100),
          expires_at TIMESTAMP NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE INDEX IF NOT EXISTS idx_token_blacklist_hash ON token_blacklist(token_hash);
        CREATE INDEX IF NOT EXISTS idx_token_blacklist_expires ON token_blacklist(expires_at);
      `);
    } catch (error) {
      console.error('Failed to initialize token blacklist table:', error.message);
    }
  }

  // Hash a token for storage (we don't store raw tokens)
  hashToken(token) {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  // Add a token to the blacklist
  async add(token, userId = null, userType = 'user', reason = 'logout', expiresAt = null) {
    try {
      const tokenHash = this.hashToken(token);
      
      // Default expiry: 24 hours (or use token's actual expiry)
      const expiry = expiresAt || new Date(Date.now() + 24 * 60 * 60 * 1000);

      // Add to in-memory cache
      this.cache.set(tokenHash, {
        userId,
        userType,
        reason,
        expiresAt: expiry,
      });

      // Persist to database
      await db.query(
        `INSERT INTO token_blacklist (token_hash, user_id, user_type, reason, expires_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (token_hash) DO NOTHING`,
        [tokenHash, userId, userType, reason, expiry]
      );

      return true;
    } catch (error) {
      console.error('Failed to blacklist token:', error.message);
      return false;
    }
  }

  // Check if a token is blacklisted
  async isBlacklisted(token) {
    try {
      const tokenHash = this.hashToken(token);

      // Check in-memory cache first
      if (this.cache.has(tokenHash)) {
        const entry = this.cache.get(tokenHash);
        if (new Date() < new Date(entry.expiresAt)) {
          return true;
        }
        // Expired, remove from cache
        this.cache.delete(tokenHash);
      }

      // Check database
      const result = await db.query(
        `SELECT id FROM token_blacklist 
         WHERE token_hash = $1 AND expires_at > NOW()`,
        [tokenHash]
      );

      if (result.rows.length > 0) {
        // Add to cache for faster future lookups
        this.cache.set(tokenHash, { expiresAt: new Date(Date.now() + 60 * 60 * 1000) });
        return true;
      }

      return false;
    } catch (error) {
      console.error('Failed to check token blacklist:', error.message);
      // Fail open (allow) if we can't check - consider failing closed in high-security scenarios
      return false;
    }
  }

  // Blacklist all tokens for a user (e.g., when password changed or account suspended)
  async blacklistAllForUser(userId, userType = 'user', reason = 'security') {
    try {
      // We can't actually blacklist all tokens without knowing them
      // Instead, we can store a "blacklist all before" timestamp
      await db.query(
        `INSERT INTO token_blacklist (token_hash, user_id, user_type, reason, expires_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (token_hash) DO UPDATE SET expires_at = EXCLUDED.expires_at`,
        [
          `user_all_${userType}_${userId}`,
          userId,
          userType,
          reason,
          new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        ]
      );

      return true;
    } catch (error) {
      console.error('Failed to blacklist all user tokens:', error.message);
      return false;
    }
  }

  // Check if all tokens for a user are blacklisted
  async isUserBlacklisted(userId, userType = 'user', tokenIssuedAt = null) {
    try {
      const result = await db.query(
        `SELECT created_at FROM token_blacklist 
         WHERE token_hash = $1 AND expires_at > NOW()`,
        [`user_all_${userType}_${userId}`]
      );

      if (result.rows.length > 0 && tokenIssuedAt) {
        // Check if token was issued before the blacklist entry
        return new Date(tokenIssuedAt) < new Date(result.rows[0].created_at);
      }

      return result.rows.length > 0;
    } catch (error) {
      console.error('Failed to check user blacklist:', error.message);
      return false;
    }
  }

  // Cleanup expired entries
  async cleanup() {
    try {
      // Clean in-memory cache
      const now = new Date();
      for (const [hash, entry] of this.cache.entries()) {
        if (new Date(entry.expiresAt) < now) {
          this.cache.delete(hash);
        }
      }

      // Clean database
      const result = await db.query(
        'DELETE FROM token_blacklist WHERE expires_at < NOW()'
      );

      if (result.rowCount > 0) {
        console.log(`🧹 Cleaned up ${result.rowCount} expired blacklist entries`);
      }
    } catch (error) {
      console.error('Failed to cleanup token blacklist:', error.message);
    }
  }

  // Get blacklist statistics
  async getStats() {
    try {
      const result = await db.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE reason = 'logout') as logouts,
          COUNT(*) FILTER (WHERE reason = 'security') as security,
          COUNT(*) FILTER (WHERE expires_at < NOW()) as expired
        FROM token_blacklist
      `);

      return {
        ...result.rows[0],
        cacheSize: this.cache.size,
      };
    } catch (error) {
      console.error('Failed to get blacklist stats:', error.message);
      return null;
    }
  }

  // Shutdown cleanup
  destroy() {
    clearInterval(this.cleanupInterval);
  }
}

// Singleton instance
const tokenBlacklist = new TokenBlacklist();

module.exports = tokenBlacklist;
