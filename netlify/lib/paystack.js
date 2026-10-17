// Verifies a Paystack payment and records it as an order (once per reference).
// Paystack is the source of truth — never the browser.
const { getDb, rowsOf } = require('./common');
const VENDOOR = require('../../catalog.js');

async function verifyAndRecord(reference) {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) return { ok: false, code: 'not_configured', error: 'Payment verification is not fully set up yet on our end.' };

  const db = getDb();
  // Already verified before? Don't call Paystack again.
  const existing = rowsOf(await db.sql`SELECT * FROM orders WHERE reference = ${reference}`);
  if (existing.length) return { ok: true, order: existing[0] };

  const res = await fetch('https://api.paystack.co/transaction/verify/' + encodeURIComponent(reference), {
    headers: { Authorization: 'Bearer ' + secret }
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data || !data.status || !data.data || data.data.status !== 'success') {
    return { ok: false, code: 'not_successful', error: 'We could not verify this payment as successful.' };
  }
  const tx = data.data;
  const fields = (tx.metadata && tx.metadata.custom_fields) || [];
  const field = name => { const f = fields.filter(x => x.variable_name === name)[0]; return f ? String(f.value) : null; };
  const slug = field('product_slug');
  const product = slug && VENDOOR.CATALOG[slug];
  if (!product) return { ok: false, code: 'unknown_product', error: 'This payment is not for a template we sell.' };
  if (tx.currency !== 'NGN' || Number(tx.amount) < product.price * 100) {
    console.error('verify: amount mismatch', reference, tx.amount, tx.currency, slug);
    return { ok: false, code: 'amount_mismatch', error: 'The amount paid does not match the template price. Please contact us.' };
  }

  const email = tx.customer && tx.customer.email ? String(tx.customer.email).toLowerCase() : null;
  await db.sql`
    INSERT INTO orders (reference, product_slug, template_name, email, amount_kobo, currency, paid_at)
    VALUES (${tx.reference}, ${slug}, ${product.name}, ${email}, ${Number(tx.amount)}, ${tx.currency}, ${tx.paid_at || tx.paidAt || null})
    ON CONFLICT (reference) DO NOTHING
  `;
  const order = rowsOf(await db.sql`SELECT * FROM orders WHERE reference = ${tx.reference}`)[0];
  return { ok: true, order };
}

module.exports = { verifyAndRecord, VENDOOR };
