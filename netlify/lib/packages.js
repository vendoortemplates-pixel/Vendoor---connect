// Vendor packages: Founding Vendor, Homepage Spotlight, Website + Instagram.
//
// How it works:
//  1. The vendor taps a package. The server (never the browser) sets the
//     price from catalog.js and opens a Paystack checkout.
//  2. Paystack confirms the payment (webhook, or the vendor landing back on
//     the dashboard). We re-check it with Paystack's API, then switch the
//     package on with an end date. Paying again before it ends adds time on
//     top, so no days are lost.
//  3. Nothing renews by itself. package-reminders emails a renew link before
//     the end date, and when the date passes the badge/placement simply stops
//     showing (every listing query checks the date).
const crypto = require('crypto');
const { getDb, rowsOf, FOUNDING_LIMIT, FEATURED_LIMIT } = require('./common');
const VENDOOR = require('../../catalog.js');

const PACKAGES = VENDOOR.PACKAGES;

function siteUrl() {
  return (process.env.URL || 'https://vendoorconnect.com').replace(/\/+$/, '');
}

function newReference() {
  return 'VCP-' + Date.now().toString(36).toUpperCase() + '-' + crypto.randomBytes(6).toString('hex').toUpperCase();
}

// ----- One-click renew links (in reminder emails, no login needed) -----
// The link can only start a payment for that listing and package, so it is
// harmless if forwarded. It expires after 45 days.
function renewSecret() {
  return process.env.RENEW_SECRET || process.env.PAYSTACK_SECRET_KEY || '';
}
function makeRenewToken(listingId, pkg) {
  const exp = Math.floor(Date.now() / 1000) + 45 * 24 * 3600;
  const body = listingId + '.' + pkg + '.' + exp;
  const sig = crypto.createHmac('sha256', renewSecret()).update(body).digest('base64url').slice(0, 32);
  return Buffer.from(body).toString('base64url') + '.' + sig;
}
function readRenewToken(token) {
  if (!token || !renewSecret()) return null;
  const parts = String(token).split('.');
  if (parts.length !== 2) return null;
  let body;
  try { body = Buffer.from(parts[0], 'base64url').toString('utf8'); } catch (e) { return null; }
  const expected = crypto.createHmac('sha256', renewSecret()).update(body).digest('base64url').slice(0, 32);
  const a = Buffer.from(parts[1]), b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  const [id, pkg, exp] = body.split('.');
  if (!PACKAGES[pkg] || Number(exp) < Date.now() / 1000) return null;
  return { listingId: parseInt(id, 10), pkg };
}
function renewLink(listingId, pkg) {
  return siteUrl() + '/.netlify/functions/package-checkout?renew=' + encodeURIComponent(makeRenewToken(listingId, pkg));
}

// Founding spots are capped. A vendor who already holds one can always renew.
async function foundingAvailable(listingId) {
  const db = getDb();
  const r = rowsOf(await db.sql`
    SELECT
      (SELECT COUNT(*)::int FROM listings WHERE membership = 'founding' AND (membership_until IS NULL OR membership_until > NOW())) AS taken,
      (SELECT COUNT(*)::int FROM listings WHERE id = ${listingId} AND membership = 'founding' AND (membership_until IS NULL OR membership_until > NOW())) AS mine
  `)[0] || {};
  return Number(r.mine) > 0 || Number(r.taken) < FOUNDING_LIMIT;
}

// Opens a Paystack checkout and returns the page to send the vendor to.
async function startCheckout(listing, pkgKey) {
  const pkg = PACKAGES[pkgKey];
  if (!pkg) return { ok: false, status: 400, error: 'That package does not exist.' };
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) return { ok: false, status: 500, error: 'Payments are not fully set up yet. Please try again later.' };
  if (listing.status === 'hidden') return { ok: false, status: 400, error: 'This listing is hidden. Please contact us first.' };
  if (pkg.kind === 'founding' && !(await foundingAvailable(listing.id))) {
    return { ok: false, status: 409, error: 'All founding spots are taken. Homepage Spotlight is still available.' };
  }
  if (pkg.kind === 'featured') {
    const f = rowsOf(await getDb().sql`
      SELECT
        (SELECT COUNT(*)::int FROM listings WHERE featured_until > NOW()) AS taken,
        (SELECT COUNT(*)::int FROM listings WHERE id = ${listing.id} AND featured_until > NOW()) AS mine,
        (SELECT MIN(featured_until) FROM listings WHERE featured_until > NOW()) AS next_free
    `)[0] || {};
    if (!Number(f.mine) && Number(f.taken) >= FEATURED_LIMIT) {
      const when = f.next_free ? new Date(f.next_free).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', timeZone: 'Africa/Lagos' }) : 'soon';
      return { ok: false, status: 409, error: 'All sponsored spots are booked right now. The next one opens on ' + when + '.' };
    }
  }
  const reference = newReference();
  const res = await fetch('https://api.paystack.co/transaction/initialize', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + secret, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: listing.vendor_email,
      amount: String(pkg.price * 100),
      currency: 'NGN',
      reference,
      callback_url: siteUrl() + '/vendor-portal.html?package_paid=1',
      metadata: {
        vc_kind: 'package',
        package: pkgKey,
        listing_id: listing.id,
        custom_fields: [
          { display_name: 'Package', variable_name: 'package', value: pkg.name },
          { display_name: 'Business', variable_name: 'business', value: listing.business_name }
        ]
      }
    })
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data || !data.status || !data.data || !data.data.authorization_url) {
    console.error('package checkout init failed', res.status, data && data.message);
    return { ok: false, status: 502, error: 'The secure checkout could not start. Please try again in a minute.' };
  }
  return { ok: true, url: data.data.authorization_url, reference };
}

function readMeta(tx) {
  let m = tx.metadata;
  if (typeof m === 'string') { try { m = JSON.parse(m); } catch (e) { m = null; } }
  return m || {};
}

// Checks a package payment with Paystack and switches the package on, once.
async function verifyAndApply(reference) {
  const db = getDb();
  const done = rowsOf(await db.sql`SELECT * FROM package_orders WHERE reference = ${reference}`)[0];
  if (done) return { ok: true, order: done, fresh: false };

  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) return { ok: false, code: 'not_configured', error: 'Payments are not fully set up yet.' };
  const res = await fetch('https://api.paystack.co/transaction/verify/' + encodeURIComponent(reference), {
    headers: { Authorization: 'Bearer ' + secret }
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data || !data.status || !data.data || data.data.status !== 'success') {
    return { ok: false, code: 'not_successful', error: 'We could not confirm this payment yet.' };
  }
  const tx = data.data;
  const meta = readMeta(tx);
  const pkgKey = meta.package;
  const pkg = PACKAGES[pkgKey];
  const listingId = parseInt(meta.listing_id, 10);
  if (meta.vc_kind !== 'package' || !pkg || !listingId) return { ok: false, code: 'unknown_product', error: 'This payment is not for a vendor package.' };
  if (tx.currency !== 'NGN' || Number(tx.amount) < pkg.price * 100) {
    console.error('package verify: amount mismatch', reference, tx.amount, tx.currency, pkgKey);
    return { ok: false, code: 'amount_mismatch', error: 'The amount paid does not match the package price. Please contact us.' };
  }
  const email = tx.customer && tx.customer.email ? String(tx.customer.email).toLowerCase() : null;

  // Claim this reference first so the webhook and the dashboard can't both apply it.
  const claimed = rowsOf(await db.sql`
    INSERT INTO package_orders (reference, listing_id, package, email, amount_kobo, paid_at)
    VALUES (${tx.reference}, ${listingId}, ${pkgKey}, ${email}, ${Number(tx.amount)}, ${tx.paid_at || tx.paidAt || null})
    ON CONFLICT (reference) DO NOTHING
    RETURNING id
  `);
  if (!claimed.length) {
    return { ok: true, order: rowsOf(await db.sql`SELECT * FROM package_orders WHERE reference = ${tx.reference}`)[0], fresh: false };
  }

  let until = null;
  try {
    const days = String(pkg.days);
    const rows = pkg.kind === 'founding'
      ? rowsOf(await db.sql`
          UPDATE listings SET membership = 'founding', membership_reminded = NULL,
            membership_until = GREATEST(COALESCE(CASE WHEN membership = 'founding' THEN membership_until END, NOW()), NOW()) + (${days} || ' days')::interval
          WHERE id = ${listingId} RETURNING membership_until AS until`)
      : rowsOf(await db.sql`
          UPDATE listings SET featured_package = ${pkgKey}, featured_reminded = NULL,
            featured_until = GREATEST(COALESCE(featured_until, NOW()), NOW()) + (${days} || ' days')::interval
          WHERE id = ${listingId} RETURNING featured_until AS until`);
    until = rows[0] ? rows[0].until : null;
    await db.sql`UPDATE package_orders SET active_until = ${until} WHERE reference = ${tx.reference}`;
  } catch (err) {
    // Release the claim so the next webhook retry can apply it.
    await db.sql`DELETE FROM package_orders WHERE reference = ${tx.reference}`;
    throw err;
  }
  const order = rowsOf(await db.sql`SELECT * FROM package_orders WHERE reference = ${tx.reference}`)[0];
  const listing = rowsOf(await db.sql`SELECT id, business_name, vendor_email FROM listings WHERE id = ${listingId}`)[0] || null;
  return { ok: true, order, listing, fresh: true };
}

// Runs once per new package payment: email the vendor, and give the owner a heads-up.
async function afterApply(r) {
  if (!r || !r.ok || !r.fresh) return;
  const { sendPackageEmail, notifyOwner } = require('./email');
  const pkg = PACKAGES[r.order.package];
  const listing = r.listing || {};
  const to = listing.vendor_email || r.order.email;
  try {
    await sendPackageEmail('confirmed', {
      to, businessName: listing.business_name || 'your business', packageName: pkg.name, price: pkg.price,
      term: pkg.term, until: r.order.active_until, reference: r.order.reference,
      instagram: r.order.package === 'spotlight_instagram'
    });
  } catch (e) { console.error('package confirm email failed', e); }
  const lines = [
    (listing.business_name || 'Listing #' + r.order.listing_id) + ' paid for ' + pkg.name + ' (₦' + pkg.price.toLocaleString('en-NG') + ').',
    'It is live until ' + new Date(r.order.active_until).toDateString() + '.',
    'Vendor email: ' + (to || 'unknown') + '. Reference: ' + r.order.reference
  ];
  if (!r.listing) lines.push('Heads-up: this listing no longer exists, so nothing could be switched on. Please contact the vendor.');
  if (r.order.package === 'spotlight_instagram') lines.push('Action for you: plan and post their Instagram feature.');
  try { await notifyOwner('New package payment: ' + pkg.name, lines); } catch (e) { console.error('owner notify failed', e); }
}

module.exports = { afterApply, PACKAGES, startCheckout, verifyAndApply, renewLink, readRenewToken, siteUrl, foundingAvailable };
