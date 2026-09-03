// Public endpoint — returns published vendor listings for the client-facing
// directory (find-vendors.html). Supports optional filtering:
//   ?category=photography   filter by one category
//   ?q=search+term          case-insensitive match on business name or description
// Deliberately excludes vendor_email and vendor_id (internal/account fields),
// same as get-listing-public — those aren't for public display.
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
  const params = event.queryStringParameters || {};
  const category = (params.category || '').trim();
  const q = (params.q || '').trim();

  try {
    const db = getDb();
    let result;

    if (category && q) {
      const like = '%' + q + '%';
      result = await db.sql`
        SELECT id, business_name, category, city, price, description, portfolio, photo_data_url, created_at
        FROM listings
        WHERE category = ${category}
          AND (business_name ILIKE ${like} OR description ILIKE ${like})
        ORDER BY created_at DESC
      `;
    } else if (category) {
      result = await db.sql`
        SELECT id, business_name, category, city, price, description, portfolio, photo_data_url, created_at
        FROM listings
        WHERE category = ${category}
        ORDER BY created_at DESC
      `;
    } else if (q) {
      const like = '%' + q + '%';
      result = await db.sql`
        SELECT id, business_name, category, city, price, description, portfolio, photo_data_url, created_at
        FROM listings
        WHERE business_name ILIKE ${like} OR description ILIKE ${like}
        ORDER BY created_at DESC
      `;
    } else {
      result = await db.sql`
        SELECT id, business_name, category, city, price, description, portfolio, photo_data_url, created_at
        FROM listings
        ORDER BY created_at DESC
      `;
    }

    return { statusCode: 200, body: JSON.stringify({ listings: rowsOf(result) }) };
  } catch (err) {
    console.error('list-listings error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Something went wrong loading vendors.' }) };
  }
};
