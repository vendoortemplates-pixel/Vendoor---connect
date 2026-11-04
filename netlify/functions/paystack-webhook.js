// Paystack calls this URL after every payment (set it in Paystack:
// Settings > API Keys & Webhooks > Webhook URL). It records the order and
// emails the buyer even if they closed the page right after paying.
const crypto = require('crypto');
const { verifyAndRecord } = require('../lib/paystack');
const { sendOrderEmail } = require('../lib/email');
const packages = require('../lib/packages');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) return { statusCode: 500, body: 'Not configured' };

  const raw = event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString('utf8') : (event.body || '');
  const signature = (event.headers && (event.headers['x-paystack-signature'] || event.headers['X-Paystack-Signature'])) || '';
  const expected = crypto.createHmac('sha512', secret).update(raw).digest('hex');
  const a = Buffer.from(signature, 'utf8'), b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return { statusCode: 401, body: 'Bad signature' };

  let payload;
  try { payload = JSON.parse(raw); } catch (e) { return { statusCode: 400, body: 'Bad JSON' }; }
  if (payload.event !== 'charge.success' || !payload.data || !payload.data.reference) return { statusCode: 200, body: 'ignored' };

  try {
    const ref = String(payload.data.reference);
    // Vendor package payments (references start with VCP-): switch the package on.
    if (/^VCP-/.test(ref)) {
      const p = await packages.verifyAndApply(ref);
      if (p.ok) await packages.afterApply(p);
      else console.error('webhook: package verification failed', ref, p.code);
      return { statusCode: 200, body: 'ok' };
    }
    // Re-verify with Paystack's API (never trust the payload alone), then email.
    const r = await verifyAndRecord(ref);
    if (r.ok) await sendOrderEmail(r.order, false);
    else console.error('webhook: verification failed', payload.data.reference, r.code);
  } catch (err) {
    console.error('paystack-webhook error:', err);
    return { statusCode: 500, body: 'error' };
  }
  return { statusCode: 200, body: 'ok' };
};
