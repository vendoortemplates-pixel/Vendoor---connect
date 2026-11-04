-- Self-serve vendor packages (pay once, runs for a set time, reminders
-- before it ends) and multi-template cart orders.
ALTER TABLE listings ADD COLUMN IF NOT EXISTS featured_package TEXT;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS featured_reminded TEXT;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS membership_reminded TEXT;
CREATE TABLE IF NOT EXISTS package_orders (
  id SERIAL PRIMARY KEY,
  reference TEXT NOT NULL UNIQUE,
  listing_id INTEGER,
  package TEXT NOT NULL,
  email TEXT,
  amount_kobo INTEGER NOT NULL,
  paid_at TIMESTAMP,
  active_until TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_package_orders_created_at ON package_orders (created_at DESC);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS items TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS resent_at TIMESTAMP;
