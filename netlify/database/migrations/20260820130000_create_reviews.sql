-- Creates the reviews table. A review is always tied to a vendor by name
-- (as typed by the reviewer), and ALSO linked to a real listing via
-- vendor_id when the name matches one in the listings table. When there's
-- no match, vendor_id stays NULL and the review shows as a "Community
-- Mention" instead of linking to a vendor profile.

CREATE TABLE reviews (
    id SERIAL PRIMARY KEY,
    vendor_name TEXT NOT NULL,
    vendor_category TEXT,
    vendor_id INTEGER REFERENCES listings(id) ON DELETE SET NULL,
    reviewer_name TEXT NOT NULL,
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    review_text TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_reviews_vendor_id ON reviews (vendor_id);
CREATE INDEX idx_reviews_created_at ON reviews (created_at DESC);
