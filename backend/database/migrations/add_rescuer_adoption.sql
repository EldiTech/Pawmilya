-- Migration: Add rescuer adoption fields to rescue_reports
-- This allows rescuers to adopt animals they have rescued

-- Add rescuer adoption fields
ALTER TABLE rescue_reports
ADD COLUMN IF NOT EXISTS rescuer_adoption_status VARCHAR(30) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS rescuer_adopted_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS rescuer_adoption_notes TEXT;

-- Index for querying adopted rescues
CREATE INDEX IF NOT EXISTS idx_rescue_reports_adoption_status ON rescue_reports(rescuer_adoption_status);

-- Comment: rescuer_adoption_status values:
-- NULL: No adoption request
-- 'requested': Rescuer requested to adopt
-- 'approved': Admin approved the adoption
-- 'rejected': Admin rejected the adoption
