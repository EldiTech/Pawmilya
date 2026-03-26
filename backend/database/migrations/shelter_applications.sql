-- Migration: Add user_id to shelter_applications and manager_id to shelters

CREATE TABLE IF NOT EXISTS shelter_applications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    applicant_name VARCHAR(255) NOT NULL,
    applicant_email VARCHAR(255) NOT NULL,
    applicant_phone VARCHAR(50) NOT NULL,
    shelter_name VARCHAR(255) NOT NULL,
    shelter_type VARCHAR(100),
    description TEXT,
    address TEXT NOT NULL,
    city VARCHAR(100),
    state VARCHAR(100),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    contact_person_name VARCHAR(255),
    phone VARCHAR(50),
    email VARCHAR(255),
    animals_accepted TEXT[],
    shelter_capacity INTEGER,
    services_offered TEXT[],
    operating_hours TEXT,
    logo_image TEXT,
    cover_image TEXT,
    business_permit TEXT,
    registration_certificate TEXT,
    government_id TEXT,
    other_documents TEXT[],
    status VARCHAR(50) DEFAULT 'pending',
    admin_feedback TEXT,
    reviewed_by INTEGER REFERENCES users(id),
    reviewed_at TIMESTAMP,
    created_shelter_id INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
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
