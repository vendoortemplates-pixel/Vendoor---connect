// Creates a new listing for the currently logged-in vendor.
// Requires the frontend to send the Identity JWT as:  Authorization: Bearer <token>
const { getDatabase } = require('@netlify/database');

// @netlify/database (waddler driver) resolves a query to a PLAIN ARRAY of rows.
// Some other Postgres drivers return { rows: [...] } instead. This handles both
// so the code cannot break again if the driver shape changes.
function rowsOf(result) {
  if (Array.isArray(result)) return result;
  if (result && Array.isArray(result.rows)) return result.rows;
  return [];
}

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  const user = context.clientContext && context.clientContext.user;
  if (!user) {
    return { statusCode: 401, body: JSON.stringify({ error: 'You must be logged in.' }) };
  }

  let data;
  try {
    data = JSON.parse(event.body || '{}');
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request body.' }) };
  }

  const { businessName, category, city, price, description, portfolio, photoDataUrl } = data;

  if (!businessName || !category || !city || !price || !description || !portfolio) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing required fields.' }) };
  }

  try {
    const db = getDatabase();
    const result = await db.sql`
      INSERT INTO listings
        (vendor_id, vendor_email, business_name, category, city, price, description, portfolio, photo_data_url)
      VALUES
        (${user.sub}, ${user.email}, ${businessName}, ${category}, ${city}, ${price}, ${description}, ${portfolio}, ${photoDataUrl || null})
      RETURNING *
    `;
    return { statusCode: 200, body: JSON.stringify({ listing: rowsOf(result)[0] }) };
  } catch (err) {
    console.error('create-listing error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Something went wrong saving your listing.' }) };
  }
};
