// Starts a Paystack checkout for a vendor package.
//   POST { listingId, package }  (logged-in vendor) -> { url }
//   GET  ?renew=TOKEN            (one-click link from a reminder email) -> redirect to Paystack
const { getDb, rowsOf, json, parseBody, currentUser } = require('../lib/common');
const { startCheckout, readRenewToken, siteUrl } = require('../lib/packages');

function redirect(url) {
  return { statusCode: 302, headers: { Location: url, 'Cache-Control': 'no-store' }, body: '' };
}

exports.handler = async (event, context) => {
  const db = getDb();
  try {
    if (event.httpMethod === 'GET') {
      const t = readRenewToken((event.queryStringParameters || {}).renew);
      if (!t) return redirect(siteUrl() + '/vendor-portal.html?renew_error=expired');
      const listing = rowsOf(await db.sql`SELECT * FROM listings WHERE id = ${t.listingId}`)[0];
      if (!listing) return redirect(siteUrl() + '/vendor-portal.html?renew_error=missing');
      const r = await startCheckout(listing, t.pkg);
      if (!r.ok) return redirect(siteUrl() + '/vendor-portal.html?renew_error=' + (r.status === 409 ? 'full' : 'failed'));
      return redirect(r.url);
    }
    if (event.httpMethod !== 'POST') return json(405, { error: 'Method Not Allowed' });

    const user = currentUser(context);
    if (!user) return json(401, { error: 'Please log in again.' });
    const data = parseBody(event);
    if (!data) return json(400, { error: 'Invalid request.' });
    const listingId = parseInt(data.listingId, 10);
    const listing = listingId && rowsOf(await db.sql`SELECT * FROM listings WHERE id = ${listingId} AND vendor_id = ${user.sub}`)[0];
    if (!listing) return json(404, { error: 'We could not find that listing on your account.' });
    const r = await startCheckout(listing, String(data.package || ''));
    if (!r.ok) return json(r.status || 400, { error: r.error });
    return json(200, { url: r.url });
  } catch (err) {
    console.error('package-checkout error:', err);
    return json(500, { error: 'Something went wrong starting checkout. Please try again.' });
  }
};
