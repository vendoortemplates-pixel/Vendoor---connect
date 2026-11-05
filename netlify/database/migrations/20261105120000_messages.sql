-- Messages from the contact, custom planner and "find me a vendor" forms.
CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  kind TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  subject TEXT,
  details TEXT,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  ip_hash TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
