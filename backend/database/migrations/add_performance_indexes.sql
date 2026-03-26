-- Performance indexes for heavy query endpoints
-- Identified via stress testing on 2026-03-10

-- Pets: composite index for the main listing query (status + featured + created_at)
CREATE INDEX IF NOT EXISTS idx_pets_status_featured_created 
  ON pets(status, is_featured DESC, created_at DESC);

-- Pets: index for breed search (ILIKE uses trigram if pg_trgm is enabled, otherwise seq scan)
CREATE INDEX IF NOT EXISTS idx_pets_breed_name ON pets(breed_name);

-- Pets: index for category_id join
CREATE INDEX IF NOT EXISTS idx_pets_category_id ON pets(category_id);

-- Pets: index for shelter_id join
CREATE INDEX IF NOT EXISTS idx_pets_shelter_id ON pets(shelter_id);

-- Pets: index for location filtering
CREATE INDEX IF NOT EXISTS idx_pets_location ON pets(location);

-- Pet images: composite index for the COALESCE subqueries
CREATE INDEX IF NOT EXISTS idx_pet_images_pet_primary 
  ON pet_images(pet_id, is_primary, display_order);

-- Rescue reports: composite index for the main listing query (status + urgency + created_at)
CREATE INDEX IF NOT EXISTS idx_rescue_reports_status_urgency_created 
  ON rescue_reports(status, urgency, created_at DESC);

-- Rescue reports: index for rescuer assignment lookups
CREATE INDEX IF NOT EXISTS idx_rescue_reports_rescuer 
  ON rescue_reports(rescuer_id);

-- Rescue reports: index for created_at ordering
CREATE INDEX IF NOT EXISTS idx_rescue_reports_created 
  ON rescue_reports(created_at DESC);

-- Shelters: index for city filtering
CREATE INDEX IF NOT EXISTS idx_shelters_city ON shelters(city);

-- Shelters: index for nearby queries (lat/long)
CREATE INDEX IF NOT EXISTS idx_shelters_location 
  ON shelters(latitude, longitude);
