// Public: vendor directory. Optional ?category=, ?q= (name/description/city),
// ?city=, ?sort=newest|rating. Founding members are listed first (priority
// placement); is_featured marks paid Sponsored placements. Never exposes vendor_email / vendor_id.
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
             (l.membership = 'founding' AND (l.membership_until IS NULL OR l.membership_until > NOW())) AS is_founding,
             (l.featured_until IS NOT NULL AND l.featured_until > NOW()) AS is_featured,
             COALESCE(r.avg_rating, 0) AS avg_rating, COALESCE(r.review_count, 0) AS review_count
      FROM listings l
      LEFT JOIN (
        SELECT vendor_id, ROUND(AVG(rating)::numeric, 1) AS avg_rating, COUNT(*)::int AS review_count
        FROM reviews WHERE status = 'approved' AND COALESCE(review_type, 'vendor') = 'vendor' AND vendor_id IS NOT NULL GROUP BY vendor_id
      ) r ON r.vendor_id = l.id
      WHERE COALESCE(l.status, 'active') = 'active'
        AND (${category} = '' OR l.category = ${category})
        AND (${city} = '' OR l.city ILIKE ${cityLike})
        AND (${q} = '' OR l.business_name ILIKE ${like} OR l.description ILIKE ${like} OR l.city ILIKE ${like})
      ORDER BY (l.membership = 'founding' AND (l.membership_until IS NULL OR l.membership_until > NOW())) DESC NULLS LAST, l.created_at DESC
    `;
    let listings = rowsOf(result).map(l => Object.assign(l, { avg_rating: Number(l.avg_rating), review_count: Number(l.review_count), is_founding: !!l.is_founding, is_featured: !!l.is_featured }));
    if (byRating) {
      listings.sort((a, b) => (b.is_founding - a.is_founding) || (b.avg_rating - a.avg_rating) || (b.review_count - a.review_count));
    }
    return json(200, { listings });
  } catch (err) {
    console.error('list-listings error:', err);
    return json(500, { error: 'Something went wrong loading vendors.' });
  }
};
