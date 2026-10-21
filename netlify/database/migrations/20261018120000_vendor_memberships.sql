-- Founding Vendor Membership, sponsored (featured) placements, vendor stats,
-- membership enquiries and review disputes.
ALTER TABLE listings ADD COLUMN IF NOT EXISTS membership TEXT;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS membership_until TIMESTAMP;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS featured_until TIMESTAMP;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS dispute_reason TEXT;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS disputed_at TIMESTAMP;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS dispute_resolved_at TIMESTAMP;
CREATE TABLE IF NOT EXISTS listing_stats (
  listing_id INTEGER NOT NULL,
  day DATE NOT NULL DEFAULT CURRENT_DATE,
  kind TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (listing_id, day, kind)
);
CREATE TABLE IF NOT EXISTS membership_inquiries (
  id SERIAL PRIMARY KEY,
  business_name TEXT NOT NULL,
  contact_name TEXT,
  email TEXT NOT NULL,
  phone TEXT,
  interest TEXT NOT NULL,
  listing_id INTEGER,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  ip_hash TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
