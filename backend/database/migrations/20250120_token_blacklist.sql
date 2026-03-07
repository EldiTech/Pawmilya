-- Migration: token_blacklist
-- Created: 2025-01-20

-- UP
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

-- DOWN
DROP INDEX IF EXISTS idx_token_blacklist_expires;
DROP INDEX IF EXISTS idx_token_blacklist_hash;
DROP TABLE IF EXISTS token_blacklist;
