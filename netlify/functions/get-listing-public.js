// Public endpoint — returns one listing's public-safe fields by id, for the
// public vendor-profile.html page. Deliberately excludes vendor_email and
// vendor_id (internal/account fields), those aren't for public display.
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
  const id = event.queryStringParameters && event.queryStringParameters.id;
  if (!id) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing listing id.' }) };
  }

  try {
    const db = getDb();
    const result = await db.sql`
      SELECT id, business_name, category, city, price, description, portfolio, photo_data_url, created_at
      FROM listings WHERE id = ${id}
    `;
    const rows = rowsOf(result);
    if (rows.length === 0) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Vendor not found.' }) };
    }
    return { statusCode: 200, body: JSON.stringify({ listing: rows[0] }) };
  } catch (err) {
    console.error('get-listing-public error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Something went wrong loading this vendor.' }) };
  }
};
