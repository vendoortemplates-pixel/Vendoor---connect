// Returns only the listings that belong to the currently logged-in vendor.
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

  try {
    const db = getDatabase();
    const result = await db.sql`
      SELECT * FROM listings WHERE vendor_id = ${user.sub} ORDER BY created_at DESC
    `;
    return { statusCode: 200, body: JSON.stringify({ listings: rowsOf(result) }) };
  } catch (err) {
    console.error('my-listings error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Something went wrong loading your listings.' }) };
  }
};
