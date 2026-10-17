// Public: vendor directory. Optional ?category=, ?q= (name/description/city),
// ?city=, ?sort=newest|rating. Never exposes vendor_email / vendor_id.
const { getDb, rowsOf, json, clean } = require('../lib/common');

exports.handler = async (event) => {
  const p = event.queryStringParameters || {};
  const category = clean(p.category, 40);
  const q = clean(p.q, 80);
  const city = clean(p.city, 80);
  const like = '%' + q + '%';
  const cityLike = '%' + city + '%';
  const byRating = p.sort === 'rating';

  try {
    const db = getDb();
    const result = await db.sql`
      SELECT l.id, l.business_name, l.category, l.city, l.price, l.description, l.portfolio,
             l.instagram, l.photo_data_url, l.created_at,
             COALESCE(r.avg_rating, 0) AS avg_rating, COALESCE(r.review_count, 0) AS review_count
      FROM listings l
      LEFT JOIN (
        SELECT vendor_id, ROUND(AVG(rating)::numeric, 1) AS avg_rating, COUNT(*)::int AS review_count
        FROM reviews WHERE status = 'approved' AND vendor_id IS NOT NULL GROUP BY vendor_id
      ) r ON r.vendor_id = l.id
      WHERE COALESCE(l.status, 'active') = 'active'
        AND (${category} = '' OR l.category = ${category})
        AND (${city} = '' OR l.city ILIKE ${cityLike})
        AND (${q} = '' OR l.business_name ILIKE ${like} OR l.description ILIKE ${like} OR l.city ILIKE ${like})
      ORDER BY l.created_at DESC
    `;
    let listings = rowsOf(result).map(l => Object.assign(l, { avg_rating: Number(l.avg_rating), review_count: Number(l.review_count) }));
    if (byRating) {
      listings.sort((a, b) => (b.avg_rating - a.avg_rating) || (b.review_count - a.review_count));
    }
    return json(200, { listings });
  } catch (err) {
    console.error('list-listings error:', err);
    return json(500, { error: 'Something went wrong loading vendors.' });
  }
};
