// Vendor (logged in): approved reviews of their own listings.
const { getDb, rowsOf, json, currentUser } = require('../lib/common');

exports.handler = async (event, context) => {
  const user = currentUser(context);
  if (!user) return json(401, { error: 'Please log in again.' });
  try {
    const db = getDb();
    const result = await db.sql`
      SELECT r.id, r.vendor_id, r.vendor_name, r.reviewer_name, r.rating, r.review_text, r.event_type,
             r.vendor_reply, r.vendor_reply_at, r.disputed_at, r.dispute_resolved_at, r.created_at
      FROM reviews r JOIN listings l ON l.id = r.vendor_id
      WHERE l.vendor_id = ${user.sub} AND r.status = 'approved' AND COALESCE(review_type, 'vendor') = 'vendor'
      ORDER BY r.created_at DESC
    `;
    return json(200, { reviews: rowsOf(result) });
  } catch (err) {
    console.error('my-reviews error:', err);
    return json(500, { error: 'Something went wrong loading your reviews.' });
  }
};
