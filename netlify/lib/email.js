// Sends the "your template is ready" email after a confirmed payment,
// using Resend (resend.com). Needs RESEND_API_KEY set in Netlify.
// Replies go to the owner's Gmail; the owner also gets a copy (BCC).
const { getDb, rowsOf } = require('./common');
const { fileFor } = require('./deliverables');

const SITE = 'https://vendoorconnect.com';
const OWNER = 'vendoor.templates@gmail.com';
const FROM = process.env.EMAIL_FROM || 'Vendoor Connect <orders@vendoorconnect.com>';

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function naira(kobo) { return '₦' + (Number(kobo) / 100).toLocaleString('en-NG'); }

function buildEmail(order, hasFile) {
  const name = order.template_name || 'planning template';
  const link = SITE + '/.netlify/functions/download?reference=' + encodeURIComponent(order.reference);
  const subject = hasFile ? 'Your ' + name + ' is ready to download' : 'Thank you for your order: ' + name;

  const steps = hasFile
    ? `<p style="margin:0 0 22px"><a href="${link}" style="display:inline-block;background:#C97A5A;color:#fff;text-decoration:none;font-weight:600;padding:14px 28px;border-radius:2px">Download your template</a></p>
       <h2 style="font-family:Georgia,serif;font-size:18px;color:#5B4636;margin:0 0 10px">How to use it</h2>
       <ol style="padding-left:20px;margin:0 0 20px;color:#5B4636;line-height:1.7">
         <li>Click <strong>Download your template</strong> above. It saves a PDF file to your phone or computer.</li>
         <li>Open the PDF. On a phone it opens in your Files or Books app; on a computer, in any PDF reader.</li>
         <li>Fill it in digitally with a PDF app (like Adobe Acrobat Reader or GoodNotes), or print it at home or at a print shop.</li>
         <li>Save the file somewhere safe. Your link works up to 15 times, and you can always reply to this email if you need it again.</li>
       </ol>`
    : `<p style="margin:0 0 20px;color:#5B4636;line-height:1.7">Your template is being prepared. We'll email it to you within <strong>24 hours</strong>, along with simple steps for downloading, printing and filling it in. There's nothing else you need to do.</p>`;

  const html = `<!doctype html><html><body style="margin:0;background:#F8F5EF;font-family:Arial,Helvetica,sans-serif">
  <div style="max-width:560px;margin:0 auto;padding:32px 20px">
    <p style="text-align:center;font-family:Georgia,serif;font-size:20px;letter-spacing:2px;color:#C8A96A;margin:0 0 24px">VENDOOR CONNECT</p>
    <div style="background:#fff;border:1px solid #ECE3D8;padding:32px 28px">
      <h1 style="font-family:Georgia,serif;font-size:24px;color:#5B4636;margin:0 0 12px">Thank you for your order</h1>
      <p style="margin:0 0 22px;color:#5B4636;line-height:1.7">Your payment for the <strong>${esc(name)}</strong> is confirmed.</p>
      ${steps}
      <table style="width:100%;border-top:1px solid #ECE3D8;padding-top:14px;font-size:14px;color:#8A7C6F" cellpadding="4">
        <tr><td>Template</td><td style="text-align:right;color:#5B4636">${esc(name)}</td></tr>
        <tr><td>Amount paid</td><td style="text-align:right;color:#5B4636">${naira(order.amount_kobo)}</td></tr>
        <tr><td>Order reference</td><td style="text-align:right;color:#5B4636">${esc(order.reference)}</td></tr>
      </table>
      <p style="margin:22px 0 0;font-size:14px;color:#8A7C6F;line-height:1.6">Need help, or bought the wrong template? Just reply to this email. Change-of-mind purchases can be exchanged or turned into store credit within 7 days. See our <a href="${SITE}/refund-policy.html" style="color:#C97A5A">refund policy</a>.</p>
      <p style="margin:14px 0 0;font-size:14px;color:#8A7C6F;line-height:1.6">Once you've used your planner, we'd love your honest review: <a href="${SITE}/reviews.html?about=vendoorconnect#write" style="color:#C97A5A">review Vendoor Connect</a>.</p>
    </div>
    <p style="text-align:center;font-size:12px;color:#8A7C6F;margin:20px 0 0">Vendoor Connect · <a href="${SITE}" style="color:#8A7C6F">vendoorconnect.com</a> · ${OWNER}</p>
  </div></body></html>`;

  const text = [
    'Thank you for your order',
    'Your payment for the ' + name + ' is confirmed.',
    hasFile ? 'Download your template: ' + link + '\n\nHow to use it:\n1. Open the link to save the PDF.\n2. Open it in any PDF app.\n3. Fill it in digitally or print it.\n4. Save the file somewhere safe. The link works up to 15 times.'
            : 'Your template is being prepared and will be emailed to you within 24 hours.',
    'Amount paid: ' + naira(order.amount_kobo),
    'Order reference: ' + order.reference,
    'Need help? Reply to this email. Refund policy: ' + SITE + '/refund-policy.html',
    'Enjoyed your planner? Review Vendoor Connect: ' + SITE + '/reviews.html?about=vendoorconnect#write'
  ].join('\n\n');

  return { subject, html, text };
}

async function sendRaw(to, msg) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, error: 'RESEND_API_KEY is not set' };
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to: [to], bcc: [OWNER], reply_to: OWNER, subject: msg.subject, html: msg.html, text: msg.text })
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    return { ok: false, error: 'Resend ' + res.status + ': ' + body.slice(0, 300) };
  }
  return { ok: true };
}

// Sends the order email once. force=true (admin "Resend email") sends again.
async function sendOrderEmail(order, force) {
  if (!order || !order.email) return { ok: false, error: 'No buyer email on this order.' };
  if (!process.env.RESEND_API_KEY) return { ok: false, error: 'Email sending is not set up yet.' };
  const db = getDb();
  const hasFile = !!fileFor(order.product_slug);
  if (!force) {
    // Claim the send atomically so the webhook and the thank-you page can't both send it.
    const claimed = rowsOf(await db.sql`
      UPDATE orders SET email_sent_at = NOW(), email_had_file = ${hasFile}
      WHERE reference = ${order.reference} AND email_sent_at IS NULL
      RETURNING id
    `);
    if (!claimed.length) return { ok: true, skipped: true };
  }
  const r = await sendRaw(order.email, buildEmail(order, hasFile));
  if (!r.ok) {
    console.error('sendOrderEmail failed:', r.error);
    if (!force) await db.sql`UPDATE orders SET email_sent_at = NULL WHERE reference = ${order.reference}`;
    return r;
  }
  if (force) await db.sql`UPDATE orders SET email_sent_at = NOW(), email_had_file = ${hasFile} WHERE reference = ${order.reference}`;
  return { ok: true, hasFile };
}

module.exports = { sendOrderEmail, buildEmail };
