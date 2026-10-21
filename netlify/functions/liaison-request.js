// Public: Event Liaison consultation requests (event-liaison.html).
// Stored for admin.html and emailed to the owner. Pricing is by consultation.
const { getDb, rowsOf, json, parseBody, clean, ipHash } = require('../lib/common');
const { notifyOwner } = require('../lib/email');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const SERVICES = {
  'pre-wedding': 'Pre-Wedding Liaison Service',
  'wedding-day': 'Wedding Day Package',
  both: 'Both: pre-wedding support and the wedding day',
  unsure: 'Not sure yet'
};

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method Not Allowed' });
  const data = parseBody(event);
  if (!data) return json(400, { error: 'Invalid request.' });
  if (data.website) return json(200, { ok: true });

  const name = clean(data.name, 100);
  const email = clean(data.email, 160).toLowerCase();
  const phone = clean(data.phone, 40);
  const service = SERVICES[data.service] ? data.service : 'unsure';
  const eventType = clean(data.eventType, 80);
  const eventDate = clean(data.eventDate, 60);
  const location = clean(data.location, 120);
  const guests = clean(data.guests, 40);
  const based = clean(data.based, 80);
  const message = clean(data.message, 2000);
  if (!name || !EMAIL_RE.test(email)) return json(400, { error: 'Please add your name and a valid email address.' });

  try {
    const db = getDb();
    const ip = ipHash(event);
    const recent = rowsOf(await db.sql`
      SELECT COUNT(*)::int AS n FROM liaison_requests WHERE ip_hash = ${ip} AND created_at > NOW() - INTERVAL '1 day'
    `)[0];
    if (recent && Number(recent.n) >= 5) return json(429, { error: 'We already have your request and will be in touch soon.' });

    await db.sql`
      INSERT INTO liaison_requests (name, email, phone, service, event_type, event_date, location, guests, based, message, ip_hash)
      VALUES (${name}, ${email}, ${phone || null}, ${service}, ${eventType || null}, ${eventDate || null},
              ${location || null}, ${guests || null}, ${based || null}, ${message || null}, ${ip})
    `;
    await notifyOwner('New Event Liaison consultation request: ' + name, [
      'Name: ' + name,
      'Contact: ' + email + (phone ? ' · ' + phone : ''),
      'Service: ' + SERVICES[service],
      eventType ? 'Event: ' + eventType : '',
      eventDate ? 'Date: ' + eventDate : '',
      location ? 'Location: ' + location : '',
      guests ? 'Guests: ' + guests : '',
      based ? 'Based in: ' + based : '',
      message ? 'Message: ' + message : ''
    ].filter(Boolean)).catch(() => {});
    return json(200, { ok: true });
  } catch (err) {
    console.error('liaison-request error:', err);
    return json(500, { error: 'Something went wrong sending your request. Please email vendoor.templates@gmail.com.' });
  }
};
