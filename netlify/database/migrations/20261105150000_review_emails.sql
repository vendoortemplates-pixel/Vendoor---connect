-- Review notifications: when the reviewer was told it went live, and any
-- request from the owner for more details before publishing.
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS published_email_at TIMESTAMP;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS info_requested_at TIMESTAMP;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS info_note TEXT;
