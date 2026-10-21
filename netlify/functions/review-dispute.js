// Vendor (logged in): flag a published review of their business for the
// admin to look into (e.g. not a real client, wrong business, abusive).
// The review stays visible until the admin decides; vendors can't remove reviews.
const { getDb, rowsOf, json, parseBody, currentUser, clean } = require('../lib/common');
const { notifyOwner } = require('../lib/email');

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method Not Allowed' });
  const user = currentUser(context);
  if (!user) return json(401, { error: 'Please log in again.' });
  const data = parseBody(event);
  if (!data) return json(400, { error: 'Invalid request.' });
  const reviewId = parseInt(data.reviewId, 10);
  const reason = clean(data.reason, 1000);
  if (!reviewId) return json(400, { error: 'Missing review.' });
  if (reason.length < 10) return json(400, { error: 'Please explain briefly why you are disputing this review.' });

  try {
    const db = getDb();
    const owned = rowsOf(await db.sql`
      SELECT r.id, r.reviewer_name, l.business_name FROM reviews r JOIN listings l ON l.id = r.vendor_id
      WHERE r.id = ${reviewId} AND l.vendor_id = ${user.sub} AND r.status = 'approved'
    `);
    if (!owned.length) return json(403, { error: 'You can only dispute reviews of your own business.' });
    await db.sql`
      UPDATE reviews SET dispute_reason = ${reason}, disputed_at = NOW(), dispute_resolved_at = NULL WHERE id = ${reviewId}
    `;
    await notifyOwner('Review disputed: ' + owned[0].business_name, [
      owned[0].business_name + ' disputed the review by ' + owned[0].reviewer_name + '.',
      'Reason: ' + reason
    ]).catch(() => {});
    return json(200, { ok: true });
  } catch (err) {
    console.error('review-dispute error:', err);
    return json(500, { error: 'Something went wrong. Please try again.' });
  }
};
