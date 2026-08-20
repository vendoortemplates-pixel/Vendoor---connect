// Returns only the listings that belong to the currently logged-in vendor.
const { getDatabase } = require('@netlify/database');

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
    return { statusCode: 200, body: JSON.stringify({ listings: result.rows }) };
  } catch (err) {
    console.error('my-listings error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Something went wrong loading your listings.' }) };
  }
};
