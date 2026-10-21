// Public: vendor membership / sponsored placement enquiries.
//   GET  -> { foundingLimit, foundingTaken, foundingLeft }
//   POST { businessName, contactName, email, phone, interest, message, website(honeypot) }
// Memberships are activated by hand from admin.html once payment is confirmed.
const { getDb, rowsOf, json, parseBody, clean, ipHash, currentUser, FOUNDING_LIMIT } = require('../lib/common');
const { notifyOwner } = require('../lib/email');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const INTERESTS = {
  founding: 'Founding Vendor Membership (₦30,000 / 12 months)',
  spotlight: 'Homepage Spotlight (₦15,000 / month)',
  spotlight_instagram: 'Website + Instagram Feature (₦25,000)',
  unsure: 'Not sure yet, tell me more'
};

exports.handler = async (event, context) => {
  const db = getDb();
  try {
    if (event.httpMethod === 'GET') {
      const r = rowsOf(await db.sql`
        SELECT COUNT(*)::int AS n FROM listings WHERE membership = 'founding'
      `)[0] || { n: 0 };
      const taken = Number(r.n);
      return json(200, { foundingLimit: FOUNDING_LIMIT, foundingTaken: taken, foundingLeft: Math.max(0, FOUNDING_LIMIT - taken) });
    }
    if (event.httpMethod !== 'POST') return json(405, { error: 'Method Not Allowed' });

    const data = parseBody(event);
    if (!data) return json(400, { error: 'Invalid request.' });
    if (data.website) return json(200, { ok: true });

    const businessName = clean(data.businessName, 120);
    const contactName = clean(data.contactName, 80);
    const email = clean(data.email, 160).toLowerCase();
    const phone = clean(data.phone, 40);
    const interest = INTERESTS[data.interest] ? data.interest : 'unsure';
    const message = clean(data.message, 1500);
    if (!businessName || !EMAIL_RE.test(email)) {
      return json(400, { error: 'Please add your business name and a valid email address.' });
    }

    const ip = ipHash(event);
    const recent = rowsOf(await db.sql`
      SELECT COUNT(*)::int AS n FROM membership_inquiries WHERE ip_hash = ${ip} AND created_at > NOW() - INTERVAL '1 day'
    `)[0];
    if (recent && Number(recent.n) >= 5) return json(429, { error: 'We already have your enquiry. We will be in touch soon.' });

    // If the vendor is logged in, link the enquiry to their listing.
    let listingId = null;
    const user = currentUser(context);
    if (user) {
      const l = rowsOf(await db.sql`SELECT id FROM listings WHERE vendor_id = ${user.sub} ORDER BY created_at LIMIT 1`)[0];
      if (l) listingId = l.id;
    }

    await db.sql`
      INSERT INTO membership_inquiries (business_name, contact_name, email, phone, interest, listing_id, message, ip_hash)
      VALUES (${businessName}, ${contactName || null}, ${email}, ${phone || null}, ${interest}, ${listingId}, ${message || null}, ${ip})
    `;
    await notifyOwner('New vendor membership enquiry: ' + businessName, [
      'Business: ' + businessName,
      'Contact: ' + (contactName || '-') + ' · ' + email + (phone ? ' · ' + phone : ''),
      'Interested in: ' + INTERESTS[interest],
      message ? 'Message: ' + message : ''
    ].filter(Boolean)).catch(() => {});
    return json(200, { ok: true });
  } catch (err) {
    console.error('membership-inquiry error:', err);
    return json(500, { error: 'Something went wrong sending your enquiry. Please email vendoor.templates@gmail.com.' });
  }
};
