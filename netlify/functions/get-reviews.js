// Public endpoint — returns reviews. Pass ?vendor_id=123 to get only that
// vendor's reviews (used on a vendor's profile page); omit it to get
// everything (used on the main Reviews page).
const { getDatabase } = require('@netlify/database');

exports.handler = async (event) => {
  const vendorId = event.queryStringParameters && event.queryStringParameters.vendor_id;

  try {
    const db = getDatabase();
    const result = vendorId
      ? await db.sql`SELECT * FROM reviews WHERE vendor_id = ${vendorId} ORDER BY created_at DESC`
      : await db.sql`SELECT * FROM reviews ORDER BY created_at DESC`;

    return { statusCode: 200, body: JSON.stringify({ reviews: result.rows }) };
  } catch (err) {
    console.error('get-reviews error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Something went wrong loading reviews.' }) };
  }
};
