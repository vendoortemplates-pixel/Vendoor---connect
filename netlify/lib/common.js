// Shared helpers for every Netlify Function on the site.
// Keeping these in one place means a fix here fixes every endpoint.
const { getDatabase } = require('@netlify/database');
const crypto = require('crypto');

// Email address(es) allowed into admin.html (review approval, orders).
// Lower-case only. Can also be set in Netlify as an ADMIN_EMAILS env var
// (comma-separated) without touching code.
const DEFAULT_ADMIN_EMAILS = ['vendoor.templates@gmail.com'];

let cachedDb = null;
let schemaReady = null;

// Safety net: makes sure the October 2026 columns/tables exist even if the
// deploy-time migration hasn't run. Every statement is idempotent and runs
// at most once per function instance.
async function ensureSchema(base) {
  const steps = [
    () => base.sql`ALTER TABLE reviews ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending'`,
    () => base.sql`ALTER TABLE reviews ADD COLUMN IF NOT EXISTS reviewer_email TEXT`,
    () => base.sql`ALTER TABLE reviews ADD COLUMN IF NOT EXISTS event_type TEXT`,
    () => base.sql`ALTER TABLE reviews ADD COLUMN IF NOT EXISTS ip_hash TEXT`,
    () => base.sql`ALTER TABLE reviews ADD COLUMN IF NOT EXISTS vendor_reply TEXT`,
    () => base.sql`ALTER TABLE reviews ADD COLUMN IF NOT EXISTS vendor_reply_at TIMESTAMP`,
    () => base.sql`ALTER TABLE reviews ADD COLUMN IF NOT EXISTS moderated_at TIMESTAMP`,
    () => base.sql`ALTER TABLE listings ADD COLUMN IF NOT EXISTS whatsapp TEXT`,
    () => base.sql`ALTER TABLE listings ADD COLUMN IF NOT EXISTS instagram TEXT`,
    () => base.sql`ALTER TABLE listings ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'`,
    () => base.sql`CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY, reference TEXT NOT NULL UNIQUE, product_slug TEXT NOT NULL, template_name TEXT,
        email TEXT, amount_kobo INTEGER NOT NULL, currency TEXT NOT NULL DEFAULT 'NGN', paid_at TIMESTAMP,
        download_count INTEGER NOT NULL DEFAULT 0, created_at TIMESTAMP NOT NULL DEFAULT NOW())`,
    () => base.sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMP`,
    () => base.sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS email_had_file BOOLEAN`,
    () => base.sql`ALTER TABLE reviews ADD COLUMN IF NOT EXISTS review_type TEXT NOT NULL DEFAULT 'vendor'`,
    () => base.sql`ALTER TABLE listings ADD COLUMN IF NOT EXISTS membership TEXT`,
    () => base.sql`ALTER TABLE listings ADD COLUMN IF NOT EXISTS membership_until TIMESTAMP`,
    () => base.sql`ALTER TABLE listings ADD COLUMN IF NOT EXISTS featured_until TIMESTAMP`,
    () => base.sql`ALTER TABLE reviews ADD COLUMN IF NOT EXISTS dispute_reason TEXT`,
    () => base.sql`ALTER TABLE reviews ADD COLUMN IF NOT EXISTS disputed_at TIMESTAMP`,
    () => base.sql`ALTER TABLE reviews ADD COLUMN IF NOT EXISTS dispute_resolved_at TIMESTAMP`,
    () => base.sql`CREATE TABLE IF NOT EXISTS listing_stats (
        listing_id INTEGER NOT NULL, day DATE NOT NULL DEFAULT CURRENT_DATE, kind TEXT NOT NULL,
        count INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (listing_id, day, kind))`,
    () => base.sql`CREATE TABLE IF NOT EXISTS membership_inquiries (
        id SERIAL PRIMARY KEY, business_name TEXT NOT NULL, contact_name TEXT, email TEXT NOT NULL, phone TEXT,
        interest TEXT NOT NULL, listing_id INTEGER, message TEXT, status TEXT NOT NULL DEFAULT 'new', ip_hash TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW())`
  ];
  const probe = await base.sql`
    SELECT
      (SELECT COUNT(*)::int FROM information_schema.columns WHERE table_name = 'reviews' AND column_name IN ('status','reviewer_email','event_type','ip_hash','vendor_reply','vendor_reply_at','moderated_at')) AS r,
      (SELECT COUNT(*)::int FROM information_schema.columns WHERE table_name = 'listings' AND column_name IN ('whatsapp','instagram','status')) AS l,
      (SELECT COUNT(*)::int FROM information_schema.tables WHERE table_name = 'orders') AS o,
      (SELECT COUNT(*)::int FROM information_schema.columns WHERE table_name = 'orders' AND column_name IN ('email_sent_at','email_had_file')) AS e,
      (SELECT COUNT(*)::int FROM information_schema.columns WHERE table_name = 'reviews' AND column_name = 'review_type') AS t,
      (SELECT COUNT(*)::int FROM information_schema.columns WHERE table_name = 'listings' AND column_name IN ('membership','membership_until','featured_until')) AS m,
      (SELECT COUNT(*)::int FROM information_schema.columns WHERE table_name = 'reviews' AND column_name IN ('dispute_reason','disputed_at','dispute_resolved_at')) AS d,
      (SELECT COUNT(*)::int FROM information_schema.tables WHERE table_name IN ('listing_stats','membership_inquiries')) AS s
  `;
  const p = rowsOf(probe)[0] || {};
  if (Number(p.r) === 7 && Number(p.l) === 3 && Number(p.o) === 1 && Number(p.e) === 2 && Number(p.t) === 1
      && Number(p.m) === 3 && Number(p.d) === 3 && Number(p.s) === 2) return;
  for (const step of steps) {
    try { await step(); } catch (e) { console.error('ensureSchema step failed:', e && e.message); }
  }
}

function getDb() {
  if (cachedDb) return cachedDb;
  let base = global.__VENDOOR_TEST_DB__; // local tests only
  if (!base) {
    const url = process.env.NETLIFY_DB_URL
      || process.env.NETLIFY_DATABASE_URL
      || process.env.DATABASE_URL
      || process.env.NEON_DATABASE_URL
      || process.env.POSTGRES_URL;
    base = url ? getDatabase({ connectionString: url }) : getDatabase();
  }
  cachedDb = {
    sql: async function () {
      if (!schemaReady) schemaReady = ensureSchema(base).catch(function (e) { console.error('ensureSchema failed:', e && e.message); });
      await schemaReady;
      return base.sql.apply(base, arguments);
    }
  };
  return cachedDb;
}

// @netlify/database resolves to a plain array of rows; other drivers use { rows }.
function rowsOf(result) {
  if (Array.isArray(result)) return result;
  if (result && Array.isArray(result.rows)) return result.rows;
  return [];
}

function json(statusCode, body, extraHeaders) {
  return {
    statusCode,
    headers: Object.assign({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, extraHeaders || {}),
    body: JSON.stringify(body)
  };
}

function parseBody(event) {
  try { return JSON.parse(event.body || '{}'); } catch (e) { return null; }
}

function currentUser(context) {
  return (context && context.clientContext && context.clientContext.user) || null;
}

function adminEmails() {
  const fromEnv = (process.env.ADMIN_EMAILS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  return fromEnv.length ? fromEnv : DEFAULT_ADMIN_EMAILS;
}

function isAdmin(user) {
  return !!(user && user.email && adminEmails().indexOf(String(user.email).toLowerCase()) !== -1);
}

function clean(value, maxLen) {
  if (value === undefined || value === null) return '';
  return String(value).replace(/\u0000/g, '').trim().slice(0, maxLen || 2000);
}

// Only allow http(s) links (blocks javascript: and other unsafe URLs).
function safeUrl(value) {
  let v = clean(value, 500);
  if (!v) return '';
  if (!/^https?:\/\//i.test(v)) v = 'https://' + v.replace(/^\/+/, '');
  try {
    const u = new URL(v);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return '';
    return u.toString();
  } catch (e) { return ''; }
}

// Digits only, for wa.me links. Nigerian numbers like 0803... become 234803...
function normalizePhone(value) {
  let d = clean(value, 40).replace(/[^\d]/g, '');
  if (!d) return '';
  if (d.length === 11 && d[0] === '0') d = '234' + d.slice(1);
  return d.length >= 8 && d.length <= 15 ? d : '';
}

function ipHash(event) {
  const h = event.headers || {};
  const ip = h['x-nf-client-connection-ip'] || h['client-ip'] || (h['x-forwarded-for'] || '').split(',')[0] || 'unknown';
  return crypto.createHash('sha256').update('vendoor:' + ip.trim()).digest('hex').slice(0, 32);
}

const CATEGORIES = ['photography', 'catering', 'decor', 'mc', 'makeup', 'venue', 'fashion', 'cakes', 'planning', 'other'];

// Max size of a stored vendor photo (client resizes to ~480px JPEG, ~40-80KB).
const MAX_PHOTO_CHARS = 400000;

function validPhoto(dataUrl) {
  if (!dataUrl) return null;
  const s = String(dataUrl);
  if (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(s)) return undefined;
  if (s.length > MAX_PHOTO_CHARS) return undefined;
  return s;
}

// Founding Vendor Membership: 12 months, capped at the first 50 businesses.
const FOUNDING_LIMIT = 50;
const STAT_KINDS = ['view', 'whatsapp', 'instagram', 'website'];

module.exports = { FOUNDING_LIMIT, STAT_KINDS, getDb, rowsOf, json, parseBody, currentUser, isAdmin, clean, safeUrl, normalizePhone, ipHash, CATEGORIES, validPhoto };
