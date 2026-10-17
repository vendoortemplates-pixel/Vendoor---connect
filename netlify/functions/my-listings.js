// Vendor (logged in): their own listings, with rating summary.
const { getDb, rowsOf, json, currentUser } = require('../lib/common');

exports.handler = async (event, context) => {
  const user = currentUser(context);
  if (!user) return json(401, { error: 'Please log in again.' });
  try {
    const db = getDb();
    const result = await db.sql`
      SELECT l.*,
        (SELECT ROUND(AVG(rating)::numeric, 1) FROM reviews WHERE vendor_id = l.id AND status = 'approved') AS avg_rating,
        (SELECT COUNT(*)::int FROM reviews WHERE vendor_id = l.id AND status = 'approved') AS review_count,
        (SELECT COUNT(*)::int FROM reviews WHERE vendor_id = l.id AND status = 'pending') AS pending_count
      FROM listings l WHERE l.vendor_id = ${user.sub} ORDER BY l.created_at DESC
    `;
    return json(200, { listings: rowsOf(result) });
  } catch (err) {
    console.error('my-listings error:', err);
    return json(500, { error: 'Something went wrong loading your listings.' });
  }
};
