-- Migration: Add payment and delivery fields to adoption_applications
-- Run this migration to add payment and delivery tracking

-- Add payment fields
ALTER TABLE adoption_applications
ADD COLUMN IF NOT EXISTS payment_completed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS payment_amount DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS payment_date TIMESTAMP;

-- Add delivery fields
ALTER TABLE adoption_applications
ADD COLUMN IF NOT EXISTS delivery_full_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS delivery_phone VARCHAR(50),
ADD COLUMN IF NOT EXISTS delivery_address TEXT,
ADD COLUMN IF NOT EXISTS delivery_city VARCHAR(100),
ADD COLUMN IF NOT EXISTS delivery_postal_code VARCHAR(20),
ADD COLUMN IF NOT EXISTS delivery_notes TEXT;

-- Add adoption_fee to pets table if not exists
ALTER TABLE pets
ADD COLUMN IF NOT EXISTS adoption_fee DECIMAL(10, 2) DEFAULT 500.00;

-- Create index for faster queries on payment status
CREATE INDEX IF NOT EXISTS idx_adoption_payment_status ON adoption_applications(payment_completed);
