// Updates a listing, but only if it belongs to the currently logged-in vendor.
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
  if (event.httpMethod !== 'POST' && event.httpMethod !== 'PUT') {
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

  const { id, businessName, category, city, price, description, portfolio, photoDataUrl } = data;
  if (!id) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing listing id.' }) };
  }

  try {
    const db = getDatabase();

    const existing = await db.sql`SELECT vendor_id, photo_data_url FROM listings WHERE id = ${id}`;
    const existingRows = rowsOf(existing);
    if (existingRows.length === 0) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Listing not found.' }) };
    }
    if (existingRows[0].vendor_id !== user.sub) {
      return { statusCode: 403, body: JSON.stringify({ error: 'You do not own this listing.' }) };
    }

    const finalPhoto = photoDataUrl !== undefined && photoDataUrl !== null
      ? photoDataUrl
      : existingRows[0].photo_data_url;

    const result = await db.sql`
      UPDATE listings
      SET business_name = ${businessName},
          category = ${category},
          city = ${city},
          price = ${price},
          description = ${description},
          portfolio = ${portfolio},
          photo_data_url = ${finalPhoto},
          updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;

    return { statusCode: 200, body: JSON.stringify({ listing: rowsOf(result)[0] }) };
  } catch (err) {
    console.error('update-listing error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Something went wrong updating your listing.' }) };
  }
};
