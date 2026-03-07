-- Migration: Add comprehensive shelter fields
-- Run this migration to add all required shelter information fields

-- Add new columns to shelters table
ALTER TABLE shelters ADD COLUMN IF NOT EXISTS shelter_type VARCHAR(50) DEFAULT 'private';
-- Types: government, private, ngo, rescue_group

ALTER TABLE shelters ADD COLUMN IF NOT EXISTS mission_statement TEXT;

ALTER TABLE shelters ADD COLUMN IF NOT EXISTS province VARCHAR(100);

ALTER TABLE shelters ADD COLUMN IF NOT EXISTS contact_person_name VARCHAR(200);

ALTER TABLE shelters ADD COLUMN IF NOT EXISTS google_maps_url TEXT;

-- Animals & Capacity
ALTER TABLE shelters ADD COLUMN IF NOT EXISTS animals_accepted TEXT[] DEFAULT ARRAY['dogs', 'cats'];
-- Array of: dogs, cats, birds, rabbits, others

ALTER TABLE shelters ADD COLUMN IF NOT EXISTS shelter_capacity INTEGER DEFAULT 0;

-- Services offered (stored as array)
ALTER TABLE shelters ADD COLUMN IF NOT EXISTS services_offered TEXT[] DEFAULT ARRAY[]::TEXT[];
-- Array of: adoption, rescue, foster_care, veterinary_care, spay_neuter, vaccination, rehabilitation

-- Media & Verification
ALTER TABLE shelters ADD COLUMN IF NOT EXISTS photos TEXT[] DEFAULT ARRAY[]::TEXT[];

ALTER TABLE shelters ADD COLUMN IF NOT EXISTS proof_document_url TEXT;
-- URL to business permit or NGO certificate

ALTER TABLE shelters ADD COLUMN IF NOT EXISTS proof_document_type VARCHAR(50);
-- Types: business_permit, ngo_certificate, government_id, other

-- System Fields
ALTER TABLE shelters ADD COLUMN IF NOT EXISTS verification_status VARCHAR(20) DEFAULT 'pending';
-- Status: pending, verified, rejected

ALTER TABLE shelters ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

ALTER TABLE shelters ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP;

ALTER TABLE shelters ADD COLUMN IF NOT EXISTS verified_by INTEGER;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_shelters_verification_status ON shelters(verification_status);
CREATE INDEX IF NOT EXISTS idx_shelters_shelter_type ON shelters(shelter_type);
CREATE INDEX IF NOT EXISTS idx_shelters_city ON shelters(city);

-- Update existing shelters to have proper verification_status based on is_verified
UPDATE shelters SET verification_status = 'verified' WHERE is_verified = TRUE AND verification_status = 'pending';
