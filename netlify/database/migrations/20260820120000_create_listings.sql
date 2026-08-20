-- Creates the listings table that backs the Vendor Dashboard.
-- Each row is one vendor's listing, tied to their Netlify Identity account
-- (vendor_id = the Identity user's "sub" claim, a stable unique id).

CREATE TABLE listings (
    id SERIAL PRIMARY KEY,
    vendor_id TEXT NOT NULL,
    vendor_email TEXT NOT NULL,
    business_name TEXT NOT NULL,
    category TEXT NOT NULL,
    city TEXT NOT NULL,
    price NUMERIC NOT NULL,
    description TEXT NOT NULL,
    portfolio TEXT NOT NULL,
    photo_data_url TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_listings_vendor_id ON listings (vendor_id);
