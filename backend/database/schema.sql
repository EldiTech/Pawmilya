-- =====================================================
-- PAWMILYA DATABASE SCHEMA
-- Pet Adoption & Rescue Management System
-- Simplified - Only Active Tables
-- =====================================================

-- =====================================================
-- USER SCHEMA - User Management
-- =====================================================

-- Users Table - Regular app users
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    avatar_url TEXT,
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    date_of_birth DATE,
    status VARCHAR(20) DEFAULT 'active', -- 'active', 'suspended'
    role VARCHAR(50) DEFAULT 'user', -- 'user', 'rescuer'
    bio TEXT,
    suspended_at TIMESTAMP,
    suspended_by INTEGER,
    suspension_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- SHELTER SCHEMA - Shelter Management
-- =====================================================

-- Shelters Table
CREATE TABLE shelters (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    address TEXT NOT NULL,
    city VARCHAR(100),
    state VARCHAR(100),
    phone VARCHAR(20),
    email VARCHAR(255),
    logo_url TEXT,
    cover_image_url TEXT,
    operating_hours TEXT,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    is_active BOOLEAN DEFAULT TRUE,
    is_verified BOOLEAN DEFAULT FALSE,
    current_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- PET SCHEMA - Pet Management
-- =====================================================

-- Pet Categories Table
CREATE TABLE pet_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    icon VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Breeds Table
CREATE TABLE breeds (
    id SERIAL PRIMARY KEY,
    category_id INTEGER REFERENCES pet_categories(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Pets Table - Main pet listings
CREATE TABLE pets (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    category_id INTEGER REFERENCES pet_categories(id),
    breed_id INTEGER REFERENCES breeds(id),
    breed_name VARCHAR(100),
    age_years INTEGER DEFAULT 0,
    age_months INTEGER DEFAULT 0,
    gender VARCHAR(10), -- 'Male', 'Female', 'Unknown'
    size VARCHAR(20), -- 'small', 'medium', 'large', 'extra-large'
    weight_kg DECIMAL(5, 2),
    color VARCHAR(100),
    description TEXT,
    medical_history TEXT,
    vaccination_status VARCHAR(50), -- 'fully_vaccinated', 'partially_vaccinated', 'not_vaccinated'
    is_neutered BOOLEAN DEFAULT FALSE,
    is_house_trained BOOLEAN DEFAULT FALSE,
    is_good_with_kids BOOLEAN DEFAULT FALSE,
    is_good_with_other_pets BOOLEAN DEFAULT FALSE,
    temperament TEXT[], -- ['friendly', 'playful', 'calm', 'energetic']
    special_needs TEXT,
    status VARCHAR(30) DEFAULT 'available', -- 'available', 'pending', 'adopted'
    is_featured BOOLEAN DEFAULT FALSE,
    shelter_id INTEGER REFERENCES shelters(id),
    location VARCHAR(255),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    images TEXT[], -- Array of image URLs
    adoption_fee DECIMAL(10, 2) DEFAULT 0,
    created_by INTEGER,
    updated_by INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Pet Images Table - For storing multiple images per pet
CREATE TABLE pet_images (
    id SERIAL PRIMARY KEY,
    pet_id INTEGER REFERENCES pets(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    is_primary BOOLEAN DEFAULT FALSE,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User Saved Pets Table - For favorites/saved pets
CREATE TABLE user_saved_pets (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    pet_id INTEGER REFERENCES pets(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, pet_id)
);

-- =====================================================
-- ADOPTION SCHEMA - Adoption Applications
-- =====================================================

-- Adoption Applications Table
CREATE TABLE adoption_applications (
    id SERIAL PRIMARY KEY,
    pet_id INTEGER REFERENCES pets(id) ON DELETE SET NULL,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    status VARCHAR(30) DEFAULT 'pending', -- 'pending', 'reviewing', 'approved', 'rejected', 'cancelled'
    
    -- Application Details
    living_situation VARCHAR(100),
    has_yard BOOLEAN DEFAULT FALSE,
    yard_fenced BOOLEAN DEFAULT FALSE,
    rental_allows_pets BOOLEAN,
    household_members INTEGER,
    has_children BOOLEAN DEFAULT FALSE,
    children_ages TEXT,
    has_other_pets BOOLEAN DEFAULT FALSE,
    other_pets_details TEXT,
    previous_pet_experience TEXT,
    reason_for_adoption TEXT,
    work_schedule TEXT,
    emergency_contact_name VARCHAR(100),
    emergency_contact_phone VARCHAR(20),
    veterinarian_name VARCHAR(100),
    veterinarian_phone VARCHAR(20),
    additional_notes TEXT,
    
    -- Processing
    review_notes TEXT,
    rejection_reason TEXT,
    reviewed_at TIMESTAMP,
    
    -- Timeline
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    approved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- RESCUE SCHEMA - Rescue Reports
-- =====================================================

-- Rescue Reports Table
CREATE TABLE rescue_reports (
    id SERIAL PRIMARY KEY,
    reporter_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    reporter_name VARCHAR(100),
    reporter_phone VARCHAR(20),
    reporter_email VARCHAR(255),
    
    -- Report Details
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    animal_type VARCHAR(50),
    estimated_count INTEGER DEFAULT 1,
    condition VARCHAR(50), -- 'injured', 'sick', 'healthy', 'unknown'
    urgency VARCHAR(20) DEFAULT 'normal', -- 'critical', 'high', 'normal', 'low'
    
    -- Location
    location_description TEXT NOT NULL,
    address TEXT,
    city VARCHAR(100),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    
    -- Status Tracking
    status VARCHAR(30) DEFAULT 'new', -- 'new', 'in_progress', 'on_the_way', 'arrived', 'rescued', 'pending_verification', 'verified', 'closed', 'false_report'
    
    -- Rescuer Assignment
    rescuer_id INTEGER REFERENCES users(id),
    responded_at TIMESTAMP,
    arrived_at TIMESTAMP,
    
    -- Images
    images TEXT[], -- Array of image URLs
    completion_photo TEXT,
    
    -- Verification workflow
    submitted_for_verification_at TIMESTAMP,
    verified_at TIMESTAMP,
    verified_by INTEGER,
    verification_notes TEXT,
    
    -- Processing
    acknowledged_at TIMESTAMP,
    rescued_at TIMESTAMP,
    resolved_at TIMESTAMP,
    closed_at TIMESTAMP,
    resolution_notes TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Rescuer Applications Table (for verified rescuers)
CREATE TABLE rescuer_applications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    full_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(255),
    address TEXT NOT NULL,
    city VARCHAR(100),
    experience TEXT,
    reason TEXT,
    availability TEXT,
    transportation_type VARCHAR(50),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    status VARCHAR(30) DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'revoked'
    rejection_reason TEXT,
    reviewed_by INTEGER,
    reviewed_at TIMESTAMP,
    revoked_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id)
);

-- =====================================================
-- NOTIFICATION SCHEMA
-- =====================================================

-- Notifications Table
CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- 'adoption_update', 'rescue_update', 'rescuer_status', 'system'
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    data JSONB, -- Additional data for navigation
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- ADMIN SCHEMA - Admin Activity Tracking
-- =====================================================

-- Admins Table - Admin users for the system
CREATE TABLE admins (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    role VARCHAR(50) DEFAULT 'admin', -- 'admin', 'super_admin'
    is_active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Admin Activity Logs Table
CREATE TABLE admin_activity_logs (
    id SERIAL PRIMARY KEY,
    admin_id INTEGER NOT NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id INTEGER,
    details JSONB,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- RESCUE HISTORY - Mission Logs Tracking
-- =====================================================

-- Rescue History Table - Tracks all status changes and events
CREATE TABLE rescue_history (
    id SERIAL PRIMARY KEY,
    rescue_id INTEGER REFERENCES rescue_reports(id) ON DELETE CASCADE,
    action VARCHAR(100) NOT NULL, -- 'created', 'status_changed', 'rescuer_assigned', 'rescuer_cancelled', 'photo_uploaded', 'verified', 'admin_edit', etc.
    previous_status VARCHAR(30),
    new_status VARCHAR(30),
    performed_by_type VARCHAR(20), -- 'system', 'user', 'rescuer', 'admin'
    performed_by_id INTEGER, -- user_id or admin_id
    performed_by_name VARCHAR(100),
    details JSONB, -- Additional details like notes, changes made, etc.
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_rescue_history_rescue ON rescue_history(rescue_id);
CREATE INDEX idx_rescue_history_created ON rescue_history(created_at);

-- =====================================================
-- INDEXES - For better query performance
-- =====================================================

CREATE INDEX idx_pets_status ON pets(status);
CREATE INDEX idx_pets_featured ON pets(is_featured);

CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_email ON users(email);

CREATE INDEX idx_adoption_applications_status ON adoption_applications(status);
CREATE INDEX idx_adoption_applications_user ON adoption_applications(user_id);
CREATE INDEX idx_adoption_applications_pet ON adoption_applications(pet_id);

CREATE INDEX idx_rescue_reports_status ON rescue_reports(status);
CREATE INDEX idx_rescue_reports_urgency ON rescue_reports(urgency);
CREATE INDEX idx_rescue_reports_location ON rescue_reports(latitude, longitude);

CREATE INDEX idx_rescuer_applications_user ON rescuer_applications(user_id);
CREATE INDEX idx_rescuer_applications_status ON rescuer_applications(status);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(is_read);

CREATE INDEX idx_pet_images_pet ON pet_images(pet_id);
CREATE INDEX idx_pet_images_primary ON pet_images(is_primary);

CREATE INDEX idx_user_saved_pets_user ON user_saved_pets(user_id);
CREATE INDEX idx_user_saved_pets_pet ON user_saved_pets(pet_id);

CREATE INDEX idx_admin_activity_logs_admin ON admin_activity_logs(admin_id);
CREATE INDEX idx_admin_activity_logs_action ON admin_activity_logs(action);
CREATE INDEX idx_admin_activity_logs_created ON admin_activity_logs(created_at);
