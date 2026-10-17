-- Tracks the automatic order confirmation email.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMP;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS email_had_file BOOLEAN;
