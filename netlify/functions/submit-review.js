// Public: submit a vendor review. Every review starts as "pending" and only
// appears on the site after the admin approves it in admin.html.
// Spam protection: hidden honeypot field, length limits, max 5 reviews per
// visitor per day, and one review per email per vendor.
const { getDb, rowsOf, json, parseBody, clean, ipHash, CATEGORIES } = require('../lib/common');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method Not Allowed' });
  const data = parseBody(event);
  if (!data) return json(400, { error: 'Invalid request.' });

  // Bots fill every field; humans never see this one.
  if (data.website) return json(200, { ok: true, status: 'pending' });

  const vendorIdIn = parseInt(data.vendorId, 10) || null;
  let vendorName = clean(data.vendorName, 120);
  let vendorCategory = CATEGORIES.indexOf(data.vendorCategory) !== -1 ? data.vendorCategory : null;
  const reviewerName = clean(data.reviewerName, 80);
  const reviewerEmail = clean(data.reviewerEmail, 160).toLowerCase();
  const eventType = clean(data.eventType, 60) || null;
  const rating = parseInt(data.rating, 10);
  const reviewText = clean(data.reviewText, 2000);

  if ((!vendorName && !vendorIdIn) || !reviewerName || !reviewText || !(rating >= 1 && rating <= 5)) {
    return json(400, { error: 'Please fill in the vendor, your name, a star rating and your review.' });
  }
  if (!EMAIL_RE.test(reviewerEmail)) {
    return json(400, { error: 'Please enter a valid email address. It is never shown publicly.' });
  }
  if (reviewText.length < 20) {
    return json(400, { error: 'Please write a little more about your experience (at least 20 characters).' });
  }

  try {
    const db = getDb();
    const ip = ipHash(event);

    const recent = rowsOf(await db.sql`
      SELECT COUNT(*)::int AS n FROM reviews WHERE ip_hash = ${ip} AND created_at > NOW() - INTERVAL '1 day'
    `);
    if (recent.length && Number(recent[0].n) >= 5) {
      return json(429, { error: 'You have submitted several reviews today. Please try again tomorrow.' });
    }

    // Link to a real listing: by id (from a vendor's profile page) or by exact name.
    let vendorId = null;
    if (vendorIdIn) {
      const m = rowsOf(await db.sql`SELECT id, business_name, category FROM listings WHERE id = ${vendorIdIn}`);
      if (m.length) { vendorId = m[0].id; vendorName = m[0].business_name; vendorCategory = m[0].category; }
    }
    if (!vendorId && vendorName) {
      const m = rowsOf(await db.sql`
        SELECT id, category FROM listings WHERE LOWER(TRIM(business_name)) = LOWER(${vendorName}) LIMIT 1
      `);
      if (m.length) { vendorId = m[0].id; vendorCategory = vendorCategory || m[0].category; }
    }
    if (!vendorName) return json(400, { error: 'Please enter the vendor name.' });

    const dupe = rowsOf(await db.sql`
      SELECT id FROM reviews
      WHERE reviewer_email = ${reviewerEmail} AND LOWER(TRIM(vendor_name)) = LOWER(${vendorName})
        AND status <> 'rejected'
      LIMIT 1
    `);
    if (dupe.length) {
      return json(409, { error: 'You have already reviewed this vendor. Thank you!' });
    }

    await db.sql`
      INSERT INTO reviews (vendor_name, vendor_category, vendor_id, reviewer_name, reviewer_email,
                           rating, review_text, event_type, ip_hash, status)
      VALUES (${vendorName}, ${vendorCategory}, ${vendorId}, ${reviewerName}, ${reviewerEmail},
              ${rating}, ${reviewText}, ${eventType}, ${ip}, 'pending')
    `;
    return json(200, { ok: true, status: 'pending', matched: !!vendorId });
  } catch (err) {
    console.error('submit-review error:', err);
    return json(500, { error: 'Something went wrong submitting your review. Please try again.' });
  }
};
