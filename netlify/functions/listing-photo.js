// Public: a vendor's listing photo as a real image file.
// The directory and profile pages link to /.netlify/functions/listing-photo?id=12&v=<version>,
// so photos load in parallel, lazily, and are cached by the CDN and the browser.
// A new version number is used whenever the vendor edits their listing.
const { getDb, rowsOf } = require('../lib/common');

exports.handler = async (event) => {
  const id = parseInt((event.queryStringParameters || {}).id, 10);
  if (!id) return { statusCode: 400, body: 'Missing id' };
  try {
    const row = rowsOf(await getDb().sql`
      SELECT photo_data_url FROM listings WHERE id = ${id} AND COALESCE(status, 'active') = 'active'
    `)[0];
    const m = row && row.photo_data_url && /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(row.photo_data_url);
    if (!m) return { statusCode: 404, headers: { 'Cache-Control': 'no-store' }, body: 'Not found' };
    return {
      statusCode: 200,
      isBase64Encoded: true,
      headers: {
        'Content-Type': m[1],
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Netlify-CDN-Cache-Control': 'public, durable, max-age=31536000, immutable',
        'Netlify-Vary': 'query'
      },
      body: m[2]
    };
  } catch (err) {
    console.error('listing-photo error:', err);
    return { statusCode: 500, headers: { 'Cache-Control': 'no-store' }, body: 'Error' };
  }
};
