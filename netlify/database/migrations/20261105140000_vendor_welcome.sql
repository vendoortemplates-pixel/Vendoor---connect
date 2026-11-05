-- Vendors who have already received the branded welcome email (sent once).
CREATE TABLE IF NOT EXISTS vendor_welcomes (
  email TEXT PRIMARY KEY,
  sent_at TIMESTAMP NOT NULL DEFAULT NOW()
);
