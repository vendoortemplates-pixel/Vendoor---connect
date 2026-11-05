-- Simple, cookieless visitor stats for the admin Visitors tab.
CREATE TABLE IF NOT EXISTS site_views (
  day DATE NOT NULL DEFAULT CURRENT_DATE,
  path TEXT NOT NULL,
  source TEXT NOT NULL,
  country TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, path, source, country)
);
CREATE TABLE IF NOT EXISTS site_visitors (
  day DATE NOT NULL DEFAULT CURRENT_DATE,
  vhash TEXT NOT NULL,
  PRIMARY KEY (day, vhash)
);
