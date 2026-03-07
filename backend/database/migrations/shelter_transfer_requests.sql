-- =====================================================
-- SHELTER TRANSFER REQUESTS TABLE
-- For managing rescued animal shelter admission requests
-- =====================================================

-- Shelter Transfer Requests Table
CREATE TABLE IF NOT EXISTS shelter_transfer_requests (
    id SERIAL PRIMARY KEY,
    
    -- References
    rescue_report_id INTEGER REFERENCES rescue_reports(id) ON DELETE SET NULL,
    shelter_id INTEGER REFERENCES shelters(id) ON DELETE SET NULL,
    requester_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    
    -- Animal Info (from rescue report)
    animal_type VARCHAR(50),
    animal_description TEXT,
    animal_condition VARCHAR(50), -- 'injured', 'sick', 'healthy', 'unknown'
    images TEXT[], -- Array of image URLs
    
    -- Request Details
    notes TEXT, -- Additional notes from rescuer
    urgency VARCHAR(20) DEFAULT 'normal', -- 'critical', 'high', 'normal', 'low'
    
    -- Status Tracking
    status VARCHAR(30) DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'completed', 'cancelled'
    
    -- Admin/Shelter Response
    reviewed_by INTEGER, -- admin_id who reviewed
    reviewed_at TIMESTAMP,
    review_notes TEXT,
    rejection_reason TEXT,
    
    -- Completion
    completed_at TIMESTAMP,
    completion_notes TEXT,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for better query performance
CREATE INDEX idx_shelter_transfer_rescue ON shelter_transfer_requests(rescue_report_id);
CREATE INDEX idx_shelter_transfer_shelter ON shelter_transfer_requests(shelter_id);
CREATE INDEX idx_shelter_transfer_requester ON shelter_transfer_requests(requester_id);
CREATE INDEX idx_shelter_transfer_status ON shelter_transfer_requests(status);
CREATE INDEX idx_shelter_transfer_created ON shelter_transfer_requests(created_at);
