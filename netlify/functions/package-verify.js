// The vendor dashboard calls this after Paystack sends the vendor back.
// GET ?reference=VCP-...  -> { ok, packageName, until, businessName }
const { json, clean } = require('../lib/common');
const { verifyAndApply, afterApply, PACKAGES } = require('../lib/packages');

exports.handler = async (event) => {
  const reference = clean((event.queryStringParameters || {}).reference, 120);
  if (!/^VCP-/.test(reference)) return json(400, { ok: false, error: 'Missing payment reference.' });
  try {
    const r = await verifyAndApply(reference);
    if (!r.ok) return json(200, { ok: false, code: r.code, error: r.error });
    await afterApply(r);
    const pkg = PACKAGES[r.order.package] || {};
    return json(200, { ok: true, packageName: pkg.name, until: r.order.active_until, businessName: r.listing ? r.listing.business_name : null });
  } catch (err) {
    console.error('package-verify error:', err);
    return json(200, { ok: false, code: 'error', error: 'We could not confirm your payment just now.' });
  }
};
