-- Event Liaison consultation requests from event-liaison.html.
CREATE TABLE IF NOT EXISTS liaison_requests (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  service TEXT NOT NULL,
  event_type TEXT,
  event_date TEXT,
  location TEXT,
  guests TEXT,
  based TEXT,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  ip_hash TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
