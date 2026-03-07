-- Migration: Add user_id to shelter_applications and manager_id to shelters
-- shelter_applications table already exists with columns:
--   id, applicant_name, applicant_email, applicant_phone, shelter_name, shelter_type,
--   description, address, city, state, latitude, longitude, contact_person_name,
--   phone, email, animals_accepted, shelter_capacity, services_offered, operating_hours,
--   logo_image, cover_image, business_permit, registration_certificate, government_id,
--   other_documents, status, admin_feedback, reviewed_by, reviewed_at, created_shelter_id,
--   created_at, updated_at

-- Add user_id so we can link applications to authenticated users
ALTER TABLE shelter_applications ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;

-- Add manager_id to shelters table to track who owns/manages a shelter
ALTER TABLE shelters ADD COLUMN IF NOT EXISTS manager_id INTEGER REFERENCES users(id);

-- Add managed_shelter_id to users table so shelterManager routes can look up by user
ALTER TABLE users ADD COLUMN IF NOT EXISTS managed_shelter_id INTEGER REFERENCES shelters(id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_shelter_applications_user_id ON shelter_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_shelter_applications_status ON shelter_applications(status);
CREATE INDEX IF NOT EXISTS idx_shelters_manager_id ON shelters(manager_id);
CREATE INDEX IF NOT EXISTS idx_users_managed_shelter_id ON users(managed_shelter_id);
