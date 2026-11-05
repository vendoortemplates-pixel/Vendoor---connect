// Public: counts one page view for the admin Visitors tab.
// No cookies and nothing personal is stored: a daily counter per page, source
// and country, plus a one-way daily fingerprint (changes every day, can't be
// reversed) used only to count unique visitors. Old fingerprints are deleted.
const crypto = require('crypto');
const { getDb, json, parseBody, clean } = require('../lib/common');

const BOT_RE = /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp\/|headless|lighthouse|pingdom|monitor|curl|wget|python|axios/i;
const PAGES = /^\/(?:[a-z0-9-]+\.html)?$/;

function sourceOf(ref, utm, host) {
  const u = (utm || '').toLowerCase();
  if (u) {
    if (/insta|^ig$/.test(u)) return 'Instagram';
    if (/whats|^wa$/.test(u)) return 'WhatsApp';
    if (/face|^fb$/.test(u)) return 'Facebook';
    if (/tiktok/.test(u)) return 'TikTok';
    if (/twitter|^x$/.test(u)) return 'X (Twitter)';
    if (/mail|newsletter/.test(u)) return 'Email';
    return u.slice(0, 30);
  }
  let h = '';
  try { h = new URL(ref).hostname.replace(/^www\./, '').toLowerCase(); } catch (e) { return 'Direct or WhatsApp'; }
  if (!h || h === host) return 'Direct or WhatsApp';
  if (/instagram\.com$|^l\.instagram/.test(h)) return 'Instagram';
  if (/whatsapp|wa\.me$/.test(h)) return 'WhatsApp';
  if (/facebook\.com$|fb\.com$|^l\.facebook|^lm\.facebook/.test(h)) return 'Facebook';
  if (/tiktok\.com$/.test(h)) return 'TikTok';
  if (/^t\.co$|twitter\.com$|x\.com$/.test(h)) return 'X (Twitter)';
  if (/google\./.test(h)) return 'Google';
  if (/bing\.com$|yahoo\.|duckduckgo/.test(h)) return 'Other search';
  if (/linkedin/.test(h)) return 'LinkedIn';
  if (/mail\.|outlook|gmail/.test(h)) return 'Email';
  return h.slice(0, 40);
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method Not Allowed' });
  const h = event.headers || {};
  const ua = h['user-agent'] || h['User-Agent'] || '';
  if (!ua || BOT_RE.test(ua)) return json(200, { ok: true });
  const data = parseBody(event) || {};
  let path = clean(data.path, 80).toLowerCase().split('?')[0].split('#')[0];
  if (path === '/index.html') path = '/';
  if (!PAGES.test(path) || path === '/admin.html') return json(200, { ok: true });
  const host = String(h.host || 'vendoorconnect.com').replace(/^www\./, '').toLowerCase();
  const source = sourceOf(clean(data.ref, 300), clean(data.utm, 40), host);
  const country = clean(h['x-country'] || h['x-nf-country'] || '', 2).toUpperCase() || '??';
  const ip = h['x-nf-client-connection-ip'] || h['client-ip'] || (h['x-forwarded-for'] || '').split(',')[0] || '';
  const day = new Date().toISOString().slice(0, 10);
  const vhash = crypto.createHash('sha256').update(day + '|' + (process.env.PAYSTACK_SECRET_KEY || 'vc') + '|' + ip + '|' + ua).digest('hex').slice(0, 20);
  try {
    const db = getDb();
    await db.sql`
      INSERT INTO site_views (day, path, source, country, count) VALUES (CURRENT_DATE, ${path}, ${source}, ${country}, 1)
      ON CONFLICT (day, path, source, country) DO UPDATE SET count = site_views.count + 1
    `;
    await db.sql`INSERT INTO site_visitors (day, vhash) VALUES (CURRENT_DATE, ${vhash}) ON CONFLICT DO NOTHING`;
    if (Math.random() < 0.02) await db.sql`DELETE FROM site_visitors WHERE day < CURRENT_DATE - 100`;
    return json(200, { ok: true });
  } catch (err) {
    console.error('hit error:', err);
    return json(200, { ok: false });
  }
};
