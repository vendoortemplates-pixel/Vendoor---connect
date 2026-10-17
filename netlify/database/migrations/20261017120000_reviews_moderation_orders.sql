-- Review moderation, vendor replies, vendor contact details, and orders.
-- Every statement is safe to run on the existing live tables.

-- Reviews now wait for admin approval before appearing publicly.
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS reviewer_email TEXT;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS event_type TEXT;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS ip_hash TEXT;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS vendor_reply TEXT;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS vendor_reply_at TIMESTAMP;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS moderated_at TIMESTAMP;
CREATE INDEX IF NOT EXISTS idx_reviews_status ON reviews (status);

-- Optional ways for clients to reach a vendor directly.
ALTER TABLE listings ADD COLUMN IF NOT EXISTS whatsapp TEXT;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS instagram TEXT;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';

-- One row per successfully verified Paystack payment.
CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    reference TEXT NOT NULL UNIQUE,
    product_slug TEXT NOT NULL,
    template_name TEXT,
    email TEXT,
    amount_kobo INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'NGN',
    paid_at TIMESTAMP,
    download_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders (created_at DESC);
