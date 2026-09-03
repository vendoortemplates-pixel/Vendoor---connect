// Public endpoint (no login required) — anyone can submit a review of a
// vendor. If the vendor name matches an existing listing (case-insensitive),
// the review gets linked to that vendor's real profile automatically.
const { getDatabase } = require('@netlify/database');

// Netlify only auto-injects the database connection string for v2-style
// functions. These are Lambda-style (exports.handler), so we look the
// connection string up ourselves and pass it in explicitly. Falls back to
// the default behaviour if none of these are set.
function getDb() {
  var url = process.env.NETLIFY_DB_URL
    || process.env.NETLIFY_DATABASE_URL
    || process.env.DATABASE_URL
    || process.env.NEON_DATABASE_URL
    || process.env.POSTGRES_URL;
  return url ? getDatabase({ connectionString: url }) : getDatabase();
}

// @netlify/database (waddler driver) resolves a query to a PLAIN ARRAY of rows.
// Some other Postgres drivers return { rows: [...] } instead. This handles both
// so the code cannot break again if the driver shape changes.
function rowsOf(result) {
  if (Array.isArray(result)) return result;
  if (result && Array.isArray(result.rows)) return result.rows;
  return [];
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  let data;
  try {
    data = JSON.parse(event.body || '{}');
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request body.' }) };
  }

  var vendorName = (data.vendorName || '').trim();
  var vendorCategory = data.vendorCategory || null;
  var reviewerName = (data.reviewerName || '').trim();
  var rating = parseInt(data.rating, 10);
  var reviewText = (data.reviewText || '').trim();

  if (!vendorName || !reviewerName || !reviewText || !rating || rating < 1 || rating > 5) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing or invalid fields.' }) };
  }

  try {
    const db = getDb();

    // Try to match this review to a real listing by business name (case-insensitive, trimmed).
    const match = await db.sql`
      SELECT id FROM listings WHERE LOWER(TRIM(business_name)) = LOWER(${vendorName}) LIMIT 1
    `;
    const matchRows = rowsOf(match);
    const vendorId = matchRows.length > 0 ? matchRows[0].id : null;

    const result = await db.sql`
      INSERT INTO reviews (vendor_name, vendor_category, vendor_id, reviewer_name, rating, review_text)
      VALUES (${vendorName}, ${vendorCategory}, ${vendorId}, ${reviewerName}, ${rating}, ${reviewText})
      RETURNING *
    `;

    return { statusCode: 200, body: JSON.stringify({ review: rowsOf(result)[0], matched: !!vendorId }) };
  } catch (err) {
    console.error('submit-review error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Something went wrong submitting your review.' }) };
  }
};
