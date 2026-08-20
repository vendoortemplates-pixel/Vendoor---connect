// Deletes a listing, but only if it belongs to the currently logged-in vendor.
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
  const user = context.clientContext && context.clientContext.user;
  if (!user) {
    return { statusCode: 401, body: JSON.stringify({ error: 'You must be logged in.' }) };
  }

  const id = event.queryStringParameters && event.queryStringParameters.id;
  if (!id) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing listing id.' }) };
  }

  try {
    const db = getDatabase();

    const existing = await db.sql`SELECT vendor_id FROM listings WHERE id = ${id}`;
    const existingRows = rowsOf(existing);
    if (existingRows.length === 0) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Listing not found.' }) };
    }
    if (existingRows[0].vendor_id !== user.sub) {
      return { statusCode: 403, body: JSON.stringify({ error: 'You do not own this listing.' }) };
    }

    await db.sql`DELETE FROM listings WHERE id = ${id}`;
    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  } catch (err) {
    console.error('delete-listing error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Something went wrong deleting your listing.' }) };
  }
};
