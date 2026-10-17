// Vendor (logged in): post or update a public reply to a review of their business.
const { getDb, rowsOf, json, parseBody, currentUser, clean } = require('../lib/common');

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method Not Allowed' });
  const user = currentUser(context);
  if (!user) return json(401, { error: 'Please log in again.' });
  const data = parseBody(event);
  if (!data) return json(400, { error: 'Invalid request.' });
  const reviewId = parseInt(data.reviewId, 10);
  const reply = clean(data.reply, 1000);
  if (!reviewId) return json(400, { error: 'Missing review.' });

  try {
    const db = getDb();
    const owned = rowsOf(await db.sql`
      SELECT r.id FROM reviews r JOIN listings l ON l.id = r.vendor_id
      WHERE r.id = ${reviewId} AND l.vendor_id = ${user.sub} AND r.status = 'approved'
    `);
    if (!owned.length) return json(403, { error: 'You can only reply to reviews of your own business.' });
    await db.sql`
      UPDATE reviews SET vendor_reply = NULLIF(${reply}, ''),
                         vendor_reply_at = CASE WHEN ${reply} = '' THEN NULL ELSE NOW() END
      WHERE id = ${reviewId}
    `;
    return json(200, { ok: true });
  } catch (err) {
    console.error('vendor-reply error:', err);
    return json(500, { error: 'Something went wrong saving your reply.' });
  }
};
