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
  // Cart checkouts send product_slugs ("a,b,c"); single "Buy now" sends product_slug.
  const list = (field('product_slugs') || field('product_slug') || '').split(',').map(x => x.trim()).filter(Boolean);
  const slugs = list.filter((x, i) => list.indexOf(x) === i);
  if (!slugs.length || slugs.some(x => !VENDOOR.CATALOG[x])) return { ok: false, code: 'unknown_product', error: 'This payment is not for a template we sell.' };
  const total = slugs.reduce((sum, x) => sum + VENDOOR.CATALOG[x].price, 0);
  if (tx.currency !== 'NGN' || Number(tx.amount) < total * 100) {
    console.error('verify: amount mismatch', reference, tx.amount, tx.currency, slugs.join(','));
    return { ok: false, code: 'amount_mismatch', error: 'The amount paid does not match the template price. Please contact us.' };
  }
  const slug = slugs[0];
  const names = slugs.map(x => VENDOOR.CATALOG[x].name).join(' + ');
  const items = slugs.length > 1 ? slugs.join(',') : null;

  const email = tx.customer && tx.customer.email ? String(tx.customer.email).toLowerCase() : null;
  await db.sql`
    INSERT INTO orders (reference, product_slug, template_name, email, amount_kobo, currency, paid_at, items)
    VALUES (${tx.reference}, ${slug}, ${names}, ${email}, ${Number(tx.amount)}, ${tx.currency}, ${tx.paid_at || tx.paidAt || null}, ${items})
    ON CONFLICT (reference) DO NOTHING
  `;
  const order = rowsOf(await db.sql`SELECT * FROM orders WHERE reference = ${tx.reference}`)[0];
  return { ok: true, order };
}

// The templates in an order (one for "Buy now", several for a cart).
function itemsOf(order) {
  const list = order && order.items ? String(order.items).split(',') : [order && order.product_slug];
  return list.filter(x => x && VENDOOR.CATALOG[x]);
}

module.exports = { verifyAndRecord, itemsOf, VENDOOR };
