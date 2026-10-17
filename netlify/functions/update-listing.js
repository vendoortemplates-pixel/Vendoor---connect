// Vendor (logged in): update one of their own listings.
const { getDb, rowsOf, json, parseBody, currentUser } = require('../lib/common');
const readListing = require('../lib/listing-input');

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST' && event.httpMethod !== 'PUT') return json(405, { error: 'Method Not Allowed' });
  const user = currentUser(context);
  if (!user) return json(401, { error: 'Please log in again.' });
  const data = parseBody(event);
  if (!data) return json(400, { error: 'Invalid request.' });
  const id = parseInt(data.id, 10);
  if (!id) return json(400, { error: 'Missing listing id.' });
  const r = readListing(data);
  if (r.error) return json(400, { error: r.error });
  const v = r.value;

  try {
    const db = getDb();
    const existing = rowsOf(await db.sql`SELECT vendor_id, photo_data_url FROM listings WHERE id = ${id}`);
    if (!existing.length) return json(404, { error: 'Listing not found.' });
    if (existing[0].vendor_id !== user.sub) return json(403, { error: 'You do not own this listing.' });

    const photo = data.removePhoto ? null : (v.photo || existing[0].photo_data_url);
    const result = await db.sql`
      UPDATE listings SET
        business_name = ${v.businessName}, category = ${v.category}, city = ${v.city}, price = ${v.price},
        description = ${v.description}, portfolio = ${v.portfolio}, whatsapp = ${v.whatsapp},
        instagram = ${v.instagram}, photo_data_url = ${photo}, updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;
    // Keep review links pointing at the current business name.
    await db.sql`UPDATE reviews SET vendor_name = ${v.businessName} WHERE vendor_id = ${id}`;
    return json(200, { listing: rowsOf(result)[0] });
  } catch (err) {
    console.error('update-listing error:', err);
    return json(500, { error: 'Something went wrong updating your listing.' });
  }
};
