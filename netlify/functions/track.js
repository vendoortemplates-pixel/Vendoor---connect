// Public: counts a profile view or a click to a vendor's WhatsApp, Instagram
// or website, per listing per day. Vendors see these totals in their dashboard.
// No personal data is stored: just a daily counter.
const { getDb, json, parseBody, STAT_KINDS } = require('../lib/common');

const BOT_RE = /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp\/|headless|lighthouse/i;

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method Not Allowed' });
  const ua = (event.headers && (event.headers['user-agent'] || event.headers['User-Agent'])) || '';
  if (BOT_RE.test(ua)) return json(200, { ok: true });
  const data = parseBody(event) || {};
  const id = parseInt(data.id, 10);
  const kind = STAT_KINDS.indexOf(data.kind) !== -1 ? data.kind : null;
  if (!id || !kind) return json(400, { error: 'Invalid request.' });
  try {
    const db = getDb();
    await db.sql`
      INSERT INTO listing_stats (listing_id, day, kind, count)
      SELECT ${id}, CURRENT_DATE, ${kind}, 1 WHERE EXISTS (SELECT 1 FROM listings WHERE id = ${id} AND COALESCE(status, 'active') = 'active')
      ON CONFLICT (listing_id, day, kind) DO UPDATE SET count = listing_stats.count + 1
    `;
    return json(200, { ok: true });
  } catch (err) {
    console.error('track error:', err);
    return json(200, { ok: false });
  }
};
