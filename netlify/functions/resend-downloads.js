// "Resend my download": a buyer enters their email and we re-send the order
// email (with download links) for every template order on that address.
// Always gives the same answer, so it never reveals whether an email has
// bought anything. Each order can be re-sent at most once every 10 minutes.
//   POST { email, website(honeypot) }
const { getDb, rowsOf, json, parseBody, clean } = require('../lib/common');
const { sendOrderEmail } = require('../lib/email');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const DONE = { ok: true, message: 'If that email has orders with us, we\'ve sent your download links to it. Check your spam or promotions folder too.' };

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method Not Allowed' });
  const data = parseBody(event);
  if (!data) return json(400, { error: 'Invalid request.' });
  if (data.website) return json(200, DONE);
  const email = clean(data.email, 160).toLowerCase();
  if (!EMAIL_RE.test(email)) return json(400, { error: 'Please enter the email address you used at checkout.' });
  try {
    const db = getDb();
    const orders = rowsOf(await db.sql`
      UPDATE orders SET resent_at = NOW()
      WHERE id IN (
        SELECT id FROM orders
        WHERE LOWER(email) = ${email} AND (resent_at IS NULL OR resent_at < NOW() - INTERVAL '10 minutes')
        ORDER BY created_at DESC LIMIT 5
      )
      RETURNING *
    `);
    for (const o of orders) {
      const r = await sendOrderEmail(o, true);
      if (!r.ok) console.error('resend-downloads failed', o.reference, r.error);
    }
    return json(200, DONE);
  } catch (err) {
    console.error('resend-downloads error:', err);
    return json(500, { error: 'Something went wrong. Please email vendoor.templates@gmail.com and we\'ll send it to you.' });
  }
};
