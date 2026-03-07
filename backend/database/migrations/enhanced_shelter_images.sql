-- =====================================================
-- ENHANCED SHELTER IMAGES MIGRATION
-- Proper image storage for shelter management
-- =====================================================

-- Add new columns to shelters table if they don't exist
DO $$ 
BEGIN
    -- Add logo_image column for storing base64 logo
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shelters' AND column_name = 'logo_image') THEN
        ALTER TABLE shelters ADD COLUMN logo_image TEXT;
    END IF;

    -- Add cover_image column for storing base64 cover photo
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shelters' AND column_name = 'cover_image') THEN
        ALTER TABLE shelters ADD COLUMN cover_image TEXT;
    END IF;

    -- Add proof_document_image column for storing verification documents
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shelters' AND column_name = 'proof_document_image') THEN
        ALTER TABLE shelters ADD COLUMN proof_document_image TEXT;
    END IF;

    -- Add shelter_type column if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shelters' AND column_name = 'shelter_type') THEN
        ALTER TABLE shelters ADD COLUMN shelter_type VARCHAR(50) DEFAULT 'private';
    END IF;

    -- Add mission_statement column if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shelters' AND column_name = 'mission_statement') THEN
        ALTER TABLE shelters ADD COLUMN mission_statement TEXT;
    END IF;

    -- Add province column if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shelters' AND column_name = 'province') THEN
        ALTER TABLE shelters ADD COLUMN province VARCHAR(100);
    END IF;

    -- Add contact_person_name column if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shelters' AND column_name = 'contact_person_name') THEN
        ALTER TABLE shelters ADD COLUMN contact_person_name VARCHAR(100);
    END IF;

    -- Add google_maps_url column if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shelters' AND column_name = 'google_maps_url') THEN
        ALTER TABLE shelters ADD COLUMN google_maps_url TEXT;
    END IF;

    -- Add animals_accepted column if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shelters' AND column_name = 'animals_accepted') THEN
        ALTER TABLE shelters ADD COLUMN animals_accepted TEXT[] DEFAULT ARRAY['dogs', 'cats'];
    END IF;

    -- Add shelter_capacity column if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shelters' AND column_name = 'shelter_capacity') THEN
        ALTER TABLE shelters ADD COLUMN shelter_capacity INTEGER DEFAULT 0;
    END IF;

    -- Add services_offered column if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shelters' AND column_name = 'services_offered') THEN
        ALTER TABLE shelters ADD COLUMN services_offered TEXT[] DEFAULT ARRAY['adoption'];
    END IF;

    -- Add proof_document_url column if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shelters' AND column_name = 'proof_document_url') THEN
        ALTER TABLE shelters ADD COLUMN proof_document_url TEXT;
    END IF;

    -- Add proof_document_type column if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shelters' AND column_name = 'proof_document_type') THEN
        ALTER TABLE shelters ADD COLUMN proof_document_type VARCHAR(50);
    END IF;

    -- Add verification_status column if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shelters' AND column_name = 'verification_status') THEN
        ALTER TABLE shelters ADD COLUMN verification_status VARCHAR(30) DEFAULT 'pending';
    END IF;

    -- Add rejection_reason column if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shelters' AND column_name = 'rejection_reason') THEN
        ALTER TABLE shelters ADD COLUMN rejection_reason TEXT;
    END IF;

    -- Add verified_at column if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shelters' AND column_name = 'verified_at') THEN
        ALTER TABLE shelters ADD COLUMN verified_at TIMESTAMP;
    END IF;

    -- Add verified_by column if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shelters' AND column_name = 'verified_by') THEN
        ALTER TABLE shelters ADD COLUMN verified_by INTEGER;
    END IF;

    -- Add photos column for gallery images if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shelters' AND column_name = 'photos') THEN
        ALTER TABLE shelters ADD COLUMN photos TEXT[];
    END IF;
END $$;

-- Create shelter_images table for storing multiple images per shelter
CREATE TABLE IF NOT EXISTS shelter_images (
    id SERIAL PRIMARY KEY,
    shelter_id INTEGER REFERENCES shelters(id) ON DELETE CASCADE,
    image_data TEXT NOT NULL, -- Base64 encoded image data
    image_type VARCHAR(20) DEFAULT 'gallery', -- 'logo', 'cover', 'gallery', 'proof'
    display_order INTEGER DEFAULT 0,
    caption TEXT,
    is_primary BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_shelter_images_shelter ON shelter_images(shelter_id);
CREATE INDEX IF NOT EXISTS idx_shelter_images_type ON shelter_images(image_type);
CREATE INDEX IF NOT EXISTS idx_shelter_images_primary ON shelter_images(is_primary);

-- Create index on shelters for faster lookups
CREATE INDEX IF NOT EXISTS idx_shelters_verification_status ON shelters(verification_status);
CREATE INDEX IF NOT EXISTS idx_shelters_is_active ON shelters(is_active);
CREATE INDEX IF NOT EXISTS idx_shelters_shelter_type ON shelters(shelter_type);

-- Comment on table structure
COMMENT ON TABLE shelter_images IS 'Stores multiple images per shelter with base64 encoding';
COMMENT ON COLUMN shelter_images.image_data IS 'Base64 encoded image including data URI prefix (data:image/...;base64,...)';
COMMENT ON COLUMN shelter_images.image_type IS 'Type of image: logo, cover, gallery, or proof document';
