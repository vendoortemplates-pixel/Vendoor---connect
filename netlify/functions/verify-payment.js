// Called by thank-you.html after checkout. Verifies with Paystack, records the
// order, and tells the page whether an instant download is available.
const { json, clean } = require('../lib/common');
const { verifyAndRecord } = require('../lib/paystack');
const { fileFor } = require('../lib/deliverables');

exports.handler = async (event) => {
  const reference = clean((event.queryStringParameters || {}).reference, 120);
  if (!reference) return json(400, { ok: false, error: 'Missing payment reference.' });
  try {
    const r = await verifyAndRecord(reference);
    if (!r.ok) return json(200, { ok: false, code: r.code, error: r.error });
    const file = fileFor(r.order.product_slug);
    return json(200, {
      ok: true,
      reference: r.order.reference,
      productSlug: r.order.product_slug,
      templateName: r.order.template_name,
      amount: Number(r.order.amount_kobo),
      downloadUrl: file ? '/.netlify/functions/download?reference=' + encodeURIComponent(r.order.reference) : null
    });
  } catch (err) {
    console.error('verify-payment error:', err);
    return json(200, { ok: false, code: 'error', error: 'Something went wrong verifying your payment.' });
  }
};
