// Vendor (logged in): create a listing.
const { getDb, rowsOf, json, parseBody, currentUser } = require('../lib/common');
const readListing = require('../lib/listing-input');

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method Not Allowed' });
  const user = currentUser(context);
  if (!user) return json(401, { error: 'Please log in again.' });
  const data = parseBody(event);
  if (!data) return json(400, { error: 'Invalid request.' });
  const r = readListing(data);
  if (r.error) return json(400, { error: r.error });
  const v = r.value;

  try {
    const db = getDb();
    const count = rowsOf(await db.sql`SELECT COUNT(*)::int AS n FROM listings WHERE vendor_id = ${user.sub}`);
    if (count.length && Number(count[0].n) >= 5) {
      return json(400, { error: 'You can have up to 5 listings. Edit an existing one instead.' });
    }
    const result = await db.sql`
      INSERT INTO listings (vendor_id, vendor_email, business_name, category, city, price, description,
                            portfolio, whatsapp, instagram, photo_data_url)
      VALUES (${user.sub}, ${user.email}, ${v.businessName}, ${v.category}, ${v.city}, ${v.price}, ${v.description},
              ${v.portfolio}, ${v.whatsapp}, ${v.instagram}, ${v.photo || null})
      RETURNING *
    `;
    const listing = rowsOf(result)[0];
    // Reviews clients already left for this business (before it joined) now link to it.
    await db.sql`
      UPDATE reviews SET vendor_id = ${listing.id}
      WHERE vendor_id IS NULL AND LOWER(TRIM(vendor_name)) = LOWER(${v.businessName})
    `;
    return json(200, { listing });
  } catch (err) {
    console.error('create-listing error:', err);
    return json(500, { error: 'Something went wrong saving your listing.' });
  }
};
