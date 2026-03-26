-- Add PayMongo payment fields to adoption_applications
-- Run: psql -U postgres -d Pawmilya -f database/migrations/add_paymongo_fields.sql

ALTER TABLE adoption_applications
ADD COLUMN IF NOT EXISTS paymongo_checkout_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50) DEFAULT 'cod';

-- Index for quick lookups by checkout session
CREATE INDEX IF NOT EXISTS idx_adoption_paymongo_checkout 
ON adoption_applications(paymongo_checkout_id) 
WHERE paymongo_checkout_id IS NOT NULL;
