// Public: APPROVED reviews only. ?vendor_id=123 for one vendor; ?limit=6 for
// the homepage; ?type=platform for reviews of Vendoor Connect itself. Reviewer emails and IP hashes are never returned.
const { getDb, rowsOf, json } = require('../lib/common');

exports.handler = async (event) => {
  const p = event.queryStringParameters || {};
  const vendorId = parseInt(p.vendor_id, 10) || 0;
  const limit = Math.min(Math.max(parseInt(p.limit, 10) || 200, 1), 200);
  const type = p.type === 'platform' ? 'platform' : 'vendor';

  try {
    const db = getDb();
    const result = await db.sql`
      SELECT id, vendor_name, vendor_category, vendor_id, reviewer_name, rating, review_text,
             event_type, vendor_reply, vendor_reply_at, review_type, created_at
      FROM reviews
      WHERE status = 'approved' AND COALESCE(review_type, 'vendor') = ${type}
        AND (${vendorId} = 0 OR vendor_id = ${vendorId})
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;
    const reviews = rowsOf(result);
    const summary = reviews.length
      ? { count: reviews.length, average: Math.round(reviews.reduce((a, r) => a + Number(r.rating), 0) / reviews.length * 10) / 10 }
      : { count: 0, average: 0 };
    return json(200, { reviews, summary });
  } catch (err) {
    console.error('get-reviews error:', err);
    return json(500, { error: 'Something went wrong loading reviews.' });
  }
};
