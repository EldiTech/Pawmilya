-- Migration: Add delivery status tracking to adoption_applications
-- Run this migration to add delivery status tracking

-- Add delivery status column
ALTER TABLE adoption_applications
ADD COLUMN IF NOT EXISTS delivery_status VARCHAR(50) DEFAULT 'pending';

-- Add delivery tracking fields
ALTER TABLE adoption_applications
ADD COLUMN IF NOT EXISTS delivery_scheduled_date DATE,
ADD COLUMN IF NOT EXISTS delivery_actual_date TIMESTAMP,
ADD COLUMN IF NOT EXISTS delivery_tracking_notes TEXT,
ADD COLUMN IF NOT EXISTS delivery_updated_at TIMESTAMP;

-- Create index for faster queries on delivery status
CREATE INDEX IF NOT EXISTS idx_adoption_delivery_status ON adoption_applications(delivery_status);

-- Add constraint for valid delivery statuses
-- Valid statuses: pending, processing, preparing, out_for_delivery, delivered, cancelled
