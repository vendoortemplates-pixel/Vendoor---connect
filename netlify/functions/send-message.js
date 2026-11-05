// Public: the Contact form, the Custom Planner request form and the
// "Tell us who you're looking for" form on Find Vendors.
// Saved for admin.html (Messages tab) and emailed to the owner straight away,
// with Reply going to the person who wrote in.
//   POST { kind: 'contact'|'custom'|'vendor-request', name, email, phone?, subject?, message?, ...details, website(honeypot) }
const { getDb, rowsOf, json, parseBody, clean, ipHash } = require('../lib/common');
const { notifyOwner } = require('../lib/email');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const KINDS = {
  contact: { label: 'Contact form', fields: [] },
  custom: { label: 'Custom planner request', fields: [['eventType', 'Celebration'], ['eventDate', 'Event date'], ['budget', 'Budget'], ['culture', 'Culture or tradition']] },
  'vendor-request': { label: 'Vendor request', fields: [['category', 'Looking for'], ['city', 'City'], ['eventDate', 'Event date'], ['budget', 'Budget']] }
};

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method Not Allowed' });
  const data = parseBody(event);
  if (!data) return json(400, { error: 'Invalid request.' });
  if (data.website) return json(200, { ok: true });
  const kind = KINDS[data.kind] ? data.kind : 'contact';
  const name = clean(data.name, 100);
  const email = clean(data.email, 160).toLowerCase();
  const phone = clean(data.phone, 40);
  const subject = clean(data.subject, 160);
  const message = clean(data.message, 3000);
  if (!name || !EMAIL_RE.test(email)) return json(400, { error: 'Please add your name and a valid email address.' });
  if (kind === 'contact' && message.length < 5) return json(400, { error: 'Please write your message.' });
  const details = KINDS[kind].fields
    .map(([key, label]) => [label, clean(data[key], 120)])
    .filter(([, v]) => v);

  try {
    const db = getDb();
    const ip = ipHash(event);
    const recent = rowsOf(await db.sql`
      SELECT COUNT(*)::int AS n FROM messages WHERE ip_hash = ${ip} AND created_at > NOW() - INTERVAL '1 day'
    `)[0];
    if (recent && Number(recent.n) >= 8) return json(429, { error: 'We already have your messages and will reply soon.' });

    const detailText = details.map(([l, v]) => l + ': ' + v).join('\n');
    await db.sql`
      INSERT INTO messages (kind, name, email, phone, subject, details, message, ip_hash)
      VALUES (${kind}, ${name}, ${email}, ${phone || null}, ${subject || null}, ${detailText || null}, ${message || null}, ${ip})
    `;
    await notifyOwner(KINDS[kind].label + ': ' + (subject || name), [
      'From: ' + name + ' (' + email + ')' + (phone ? ', ' + phone : ''),
      ...details.map(([l, v]) => l + ': ' + v),
      message ? 'Message: ' + message : '',
      'Reply to this email to answer ' + name.split(' ')[0] + ' directly.'
    ].filter(Boolean), email).catch(() => {});
    return json(200, { ok: true });
  } catch (err) {
    console.error('send-message error:', err);
    return json(500, { error: 'Your message could not be sent. Please email vendoor.templates@gmail.com or message us on WhatsApp.' });
  }
};
