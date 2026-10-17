// Public: one vendor's profile (public-safe fields + rating summary).
const { getDb, rowsOf, json } = require('../lib/common');

exports.handler = async (event) => {
  const id = parseInt((event.queryStringParameters || {}).id, 10);
  if (!id) return json(400, { error: 'Missing vendor id.' });

  try {
    const db = getDb();
    const result = await db.sql`
      SELECT l.id, l.business_name, l.category, l.city, l.price, l.description, l.portfolio,
             l.whatsapp, l.instagram, l.photo_data_url, l.created_at,
             (SELECT ROUND(AVG(rating)::numeric, 1) FROM reviews WHERE vendor_id = l.id AND status = 'approved') AS avg_rating,
             (SELECT COUNT(*)::int FROM reviews WHERE vendor_id = l.id AND status = 'approved') AS review_count
      FROM listings l
      WHERE l.id = ${id} AND COALESCE(l.status, 'active') = 'active'
    `;
    const rows = rowsOf(result);
    if (rows.length === 0) return json(404, { error: 'This vendor could not be found.' });
    const listing = rows[0];
    listing.avg_rating = listing.avg_rating === null ? 0 : Number(listing.avg_rating);
    listing.review_count = Number(listing.review_count || 0);
    return json(200, { listing });
  } catch (err) {
    console.error('get-listing-public error:', err);
    return json(500, { error: 'Something went wrong loading this vendor.' });
  }
};
