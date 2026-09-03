// Public endpoint — returns reviews. Pass ?vendor_id=123 to get only that
// vendor's reviews (used on a vendor's profile page); omit it to get
// everything (used on the main Reviews page).
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
  const vendorId = event.queryStringParameters && event.queryStringParameters.vendor_id;

  try {
    const db = getDb();
    const result = vendorId
      ? await db.sql`SELECT * FROM reviews WHERE vendor_id = ${vendorId} ORDER BY created_at DESC`
      : await db.sql`SELECT * FROM reviews ORDER BY created_at DESC`;

    return { statusCode: 200, body: JSON.stringify({ reviews: rowsOf(result) }) };
  } catch (err) {
    console.error('get-reviews error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Something went wrong loading reviews.' }) };
  }
};
