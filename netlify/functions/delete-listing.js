// Vendor (logged in): delete one of their own listings.
const { getDb, rowsOf, json, currentUser } = require('../lib/common');

exports.handler = async (event, context) => {
  const user = currentUser(context);
  if (!user) return json(401, { error: 'Please log in again.' });
  const id = parseInt((event.queryStringParameters || {}).id, 10);
  if (!id) return json(400, { error: 'Missing listing id.' });

  try {
    const db = getDb();
    const existing = rowsOf(await db.sql`SELECT vendor_id FROM listings WHERE id = ${id}`);
    if (!existing.length) return json(404, { error: 'Listing not found.' });
    if (existing[0].vendor_id !== user.sub) return json(403, { error: 'You do not own this listing.' });
    await db.sql`DELETE FROM listings WHERE id = ${id}`;
    return json(200, { success: true });
  } catch (err) {
    console.error('delete-listing error:', err);
    return json(500, { error: 'Something went wrong deleting your listing.' });
  }
};
