-- 'vendor' = review of a vendor; 'platform' = review of Vendoor Connect itself.
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS review_type TEXT NOT NULL DEFAULT 'vendor';
