// Sends the "your template is ready" email after a confirmed payment,
// using Resend (resend.com). Needs RESEND_API_KEY set in Netlify.
// Replies go to the owner's Gmail; the owner also gets a copy (BCC).
const { getDb, rowsOf } = require('./common');
const { fileFor } = require('./deliverables');
const VENDOOR = require('../../catalog.js');

function orderItems(order) {
  const list = order && order.items ? String(order.items).split(',') : [order && order.product_slug];
  return list.filter(x => x && VENDOOR.CATALOG[x]).map(slug => ({ slug, name: VENDOOR.CATALOG[slug].name, hasFile: !!fileFor(slug) }));
}

const SITE = 'https://vendoorconnect.com';
const OWNER = 'vendoor.templates@gmail.com';
const FROM = process.env.EMAIL_FROM || 'Vendoor Connect <orders@vendoorconnect.com>';

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function naira(kobo) { return '₦' + (Number(kobo) / 100).toLocaleString('en-NG'); }

function buildEmail(order, hasFile) {
  const items = orderItems(order);
  const multi = items.length > 1;
  const name = order.template_name || 'planning template';
  const base = SITE + '/.netlify/functions/download?reference=' + encodeURIComponent(order.reference);
  const linkFor = it => multi ? base + '&item=' + encodeURIComponent(it.slug) : base;
  const link = base;
  const subject = hasFile ? (multi ? 'Your planners are ready to download' : 'Your ' + name + ' is ready to download') : 'Thank you for your order: ' + name;
  const buttons = items.filter(it => it.hasFile).map(it =>
    `<p style="margin:0 0 12px"><a href="${linkFor(it)}" style="display:inline-block;background:#C97A5A;color:#fff;text-decoration:none;font-weight:600;padding:14px 28px;border-radius:2px">Download ${multi ? esc(it.name) : 'your template'}</a></p>`).join('');
  const waiting = items.filter(it => !it.hasFile);
  const partNote = items.some(it => it.hasFile) && waiting.length
    ? `<p style="margin:0 0 20px;color:#5B4636;line-height:1.7">Your <strong>${esc(waiting.map(w => w.name).join(' and '))}</strong> ${waiting.length > 1 ? 'are' : 'is'} being prepared. We'll email ${waiting.length > 1 ? 'them' : 'it'} to you within <strong>24 hours</strong>.</p>`
    : '';

  const steps = hasFile || items.some(it => it.hasFile)
    ? `<div style="margin:0 0 22px">${buttons}</div>${partNote}
       <h2 style="font-family:Georgia,serif;font-size:18px;color:#5B4636;margin:0 0 10px">How to use it</h2>
       <ol style="padding-left:20px;margin:0 0 20px;color:#5B4636;line-height:1.7">
         <li>Click <strong>Download your template</strong> above. It saves a PDF file to your phone or computer.</li>
         <li>Open the PDF. On a phone it opens in your Files or Books app; on a computer, in any PDF reader.</li>
         <li>Fill it in digitally with a PDF app (like Adobe Acrobat Reader or GoodNotes), or print it at home or at a print shop.</li>
         <li>Save the file somewhere safe. Your link works up to 15 times. If you lose this email, you can get your links again anytime at <a href="${SITE}/delivery-policy.html#resend" style="color:#C97A5A">vendoorconnect.com/delivery-policy.html</a>.</li>
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
        <tr><td>${multi ? 'Templates' : 'Template'}</td><td style="text-align:right;color:#5B4636">${esc(name)}</td></tr>
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
    items.some(it => it.hasFile) ? items.filter(it => it.hasFile).map(it => 'Download ' + it.name + ': ' + linkFor(it)).join('\n') + '\n\nHow to use it:\n1. Open the link to save the PDF.\n2. Open it in any PDF app.\n3. Fill it in digitally or print it.\n4. Save the file somewhere safe. The link works up to 15 times.'
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
  const its = orderItems(order);
  const hasFile = its.length > 0 && its.every(it => it.hasFile);
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

// Short heads-up to the owner's inbox (new membership enquiry, review dispute).
async function notifyOwner(subject, lines, replyTo) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, error: 'RESEND_API_KEY is not set' };
  const text = lines.join('\n');
  const html = '<div style="font-family:Arial,sans-serif;color:#5B4636;line-height:1.6">' +
    lines.map(l => '<p style="margin:0 0 8px">' + esc(l) + '</p>').join('') +
    '<p style="margin-top:16px"><a href="' + SITE + '/admin.html">Open the admin page</a></p></div>';
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.assign({ from: FROM, to: [OWNER], subject, html, text }, replyTo ? { reply_to: replyTo } : {}))
    });
    return { ok: res.ok };
  } catch (e) { return { ok: false, error: e && e.message }; }
}

// ----- Vendor package emails -----
// stage: 'confirmed' | 'soon' | 'last' | 'ended'
function fmtDate(d) {
  const dt = new Date(d);
  return isNaN(dt) ? '' : dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Lagos' });
}
function buildPackageEmail(stage, info) {
  const pkg = esc(info.packageName), biz = esc(info.businessName), until = fmtDate(info.until);
  const price = '₦' + Number(info.price).toLocaleString('en-NG');
  const copy = {
    confirmed: {
      subject: 'Your ' + info.packageName + ' is live',
      title: 'You\'re all set',
      body: `Thank you. Your payment is confirmed and <strong>${pkg}</strong> is now live for <strong>${biz}</strong> until <strong>${until}</strong>.` +
        (info.instagram ? ' We\'ll be in touch on WhatsApp or email to plan your Instagram feature.' : '') +
        ` It won't renew or charge you again by itself. We'll email you a few days before it ends so you can decide.`,
      button: null
    },
    soon: {
      subject: info.packageName + ' ends on ' + until,
      title: 'A quick heads-up',
      body: `<strong>${pkg}</strong> for <strong>${biz}</strong> ends on <strong>${until}</strong>. To keep it going, renew below. The extra ${esc(info.term)} are added on top of your current end date, so you won't lose any days.`,
      button: 'Renew for ' + price
    },
    last: {
      subject: 'Last day: ' + info.packageName + ' ends soon',
      title: 'Ends in about a day',
      body: `<strong>${pkg}</strong> for <strong>${biz}</strong> ends on <strong>${until}</strong>. If you'd like to keep it, renew below and it carries on without a break.`,
      button: 'Renew for ' + price
    },
    ended: {
      subject: info.packageName + ' has ended',
      title: 'Your package has ended',
      body: `<strong>${pkg}</strong> for <strong>${biz}</strong> ended on <strong>${until}</strong>. Your free listing is still live in the directory. Whenever you're ready, you can switch it back on in one tap.`,
      button: 'Switch it back on for ' + price
    }
  }[stage];

  const btn = copy.button
    ? `<p style="margin:0 0 18px"><a href="${info.renewUrl}" style="display:inline-block;background:#C97A5A;color:#fff;text-decoration:none;font-weight:600;padding:14px 28px;border-radius:2px">${esc(copy.button)}</a></p>
       <p style="margin:0 0 18px;font-size:14px;color:#8A7C6F;line-height:1.6">The button opens a secure Paystack checkout (card, bank transfer or USSD). You don't need to log in.</p>`
    : `<p style="margin:0 0 18px"><a href="${SITE}/vendor-portal.html" style="color:#C97A5A">Open your vendor dashboard</a></p>`;

  const html = `<!doctype html><html><body style="margin:0;background:#F8F5EF;font-family:Arial,Helvetica,sans-serif">
  <div style="max-width:560px;margin:0 auto;padding:32px 20px">
    <p style="text-align:center;font-family:Georgia,serif;font-size:20px;letter-spacing:2px;color:#C8A96A;margin:0 0 24px">VENDOOR CONNECT</p>
    <div style="background:#fff;border:1px solid #ECE3D8;padding:32px 28px">
      <h1 style="font-family:Georgia,serif;font-size:24px;color:#5B4636;margin:0 0 12px">${copy.title}</h1>
      <p style="margin:0 0 22px;color:#5B4636;line-height:1.7">${copy.body}</p>
      ${btn}
      ${info.reference ? `<p style="margin:0;font-size:14px;color:#8A7C6F">Payment reference: ${esc(info.reference)}</p>` : ''}
      <p style="margin:18px 0 0;font-size:14px;color:#8A7C6F;line-height:1.6">Questions? Just reply to this email.</p>
    </div>
    <p style="text-align:center;font-size:12px;color:#8A7C6F;margin:20px 0 0">Vendoor Connect · <a href="${SITE}" style="color:#8A7C6F">vendoorconnect.com</a></p>
  </div></body></html>`;
  const text = copy.body.replace(/<[^>]+>/g, '') + '\n\n' +
    (copy.button ? copy.button + ': ' + info.renewUrl : 'Your dashboard: ' + SITE + '/vendor-portal.html') +
    '\n\nQuestions? Just reply to this email.';
  return { subject: copy.subject, html, text };
}

async function sendPackageEmail(stage, info) {
  if (!info.to) return { ok: false, error: 'No vendor email.' };
  const msg = buildPackageEmail(stage, info);
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, error: 'RESEND_API_KEY is not set' };
  const payload = { from: FROM, to: [info.to], reply_to: OWNER, subject: msg.subject, html: msg.html, text: msg.text };
  if (stage === 'confirmed') payload.bcc = [OWNER];
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) return { ok: false, error: 'Resend ' + res.status + ': ' + (await res.text().catch(() => '')).slice(0, 300) };
    return { ok: true };
  } catch (e) { return { ok: false, error: e && e.message }; }
}

// ----- Vendor welcome (sent once, after a vendor confirms their account) -----
function buildWelcomeEmail() {
  const P = 'margin:0 0 14px;font-size:15px;line-height:1.7;color:#5B4636';
  const html = `<!doctype html><html><body style="margin:0;background:#F8F5EF;font-family:Arial,Helvetica,sans-serif">
  <div style="max-width:560px;margin:0 auto;padding:32px 20px">
    <p style="text-align:center;margin:0 0 6px"><img src="${SITE}/icon-192.png" width="56" height="56" alt="" style="display:inline-block;border:0"></p>
    <p style="text-align:center;font-family:Georgia,serif;font-size:18px;letter-spacing:3px;color:#B08A4F;margin:0 0 24px">VENDOOR CONNECT</p>
    <div style="background:#fff;border:1px solid #ECE3D8;padding:34px 30px">
      <h1 style="font-family:Georgia,serif;font-weight:normal;font-size:26px;line-height:1.25;color:#5B4636;margin:0 0 14px">Welcome to Vendoor Connect</h1>
      <p style="${P}">Your vendor account is confirmed. Thank you for joining a growing community of event businesses that clients can find, trust and book with confidence.</p>
      <p style="${P}"><strong>Three steps to get seen:</strong></p>
      <p style="${P}">1. <strong>Create your free listing.</strong> Add your best photo, your city, your starting price and your WhatsApp number so clients can reach you in one tap.</p>
      <p style="${P}">2. <strong>Ask your past clients for reviews.</strong> Your dashboard gives you a link to share. Every review is checked by our team before it goes live, so honest feedback really counts.</p>
      <p style="${P}">3. <strong>Reply to your reviews.</strong> A thoughtful reply shows the next client exactly how you treat people.</p>
      <p style="margin:24px 0 24px"><a href="${SITE}/vendor-portal.html" style="display:inline-block;background:#C97A5A;color:#fff;text-decoration:none;font-weight:bold;font-size:15px;padding:14px 30px;border-radius:2px">Go to my dashboard</a></p>
      <p style="${P}">Want to stand out from day one? Our first 50 businesses can become <a href="${SITE}/vendor-memberships.html" style="color:#C97A5A">Founding Vendors</a>, with a badge and priority placement in the directory.</p>
      <p style="margin:18px 0 0;font-size:14px;line-height:1.6;color:#8A7C6F">Questions? Reply to this email or message us on WhatsApp at 0813 918 9496. We're always happy to help.</p>
      <p style="margin:18px 0 0;font-size:15px;color:#5B4636">Ganiat Asuni<br><span style="color:#8A7C6F;font-size:13px">Founder, Vendoor Connect</span></p>
    </div>
    <p style="text-align:center;font-size:12px;color:#8A7C6F;margin:20px 0 0">Vendoor Connect &middot; <a href="${SITE}" style="color:#8A7C6F">vendoorconnect.com</a></p>
  </div></body></html>`;
  const text = 'Welcome to Vendoor Connect\n\nYour vendor account is confirmed.\n\n1. Create your free listing: ' + SITE + '/vendor-portal.html\n2. Ask your past clients for reviews using the link in your dashboard.\n3. Reply to your reviews.\n\nOur first 50 businesses can become Founding Vendors: ' + SITE + '/vendor-memberships.html\n\nQuestions? Reply to this email or WhatsApp 0813 918 9496.\n\nGaniat Asuni, Founder';
  return { subject: 'Welcome to Vendoor Connect', html, text };
}

// Sends the welcome once per email address. Safe to call more than once.
async function sendVendorWelcome(email) {
  const to = String(email || '').toLowerCase().trim();
  if (!to || !process.env.RESEND_API_KEY) return { ok: false };
  const db = getDb();
  const claimed = rowsOf(await db.sql`INSERT INTO vendor_welcomes (email) VALUES (${to}) ON CONFLICT DO NOTHING RETURNING email`);
  if (!claimed.length) return { ok: true, skipped: true };
  const msg = buildWelcomeEmail();
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: [to], reply_to: OWNER, subject: msg.subject, html: msg.html, text: msg.text })
    });
    if (!res.ok) throw new Error('Resend ' + res.status);
    return { ok: true };
  } catch (e) {
    console.error('welcome email failed', e && e.message);
    await db.sql`DELETE FROM vendor_welcomes WHERE email = ${to}`; // let a later login retry
    return { ok: false };
  }
}

// ----- Review emails (reviewers never need an account) -----
function reviewShell(title, bodyHtml, button, noFooter) {
  const btn = button ? `<p style="margin:24px 0"><a href="${button.url}" style="display:inline-block;background:#C97A5A;color:#fff;text-decoration:none;font-weight:bold;font-size:15px;padding:14px 28px;border-radius:2px">${esc(button.text)}</a></p>` : '';
  return `<!doctype html><html><body style="margin:0;background:#F8F5EF;font-family:Arial,Helvetica,sans-serif">
  <div style="max-width:560px;margin:0 auto;padding:32px 20px">
    <p style="text-align:center;margin:0 0 6px"><img src="${SITE}/icon-192.png" width="56" height="56" alt="" style="display:inline-block;border:0"></p>
    <p style="text-align:center;font-family:Georgia,serif;font-size:18px;letter-spacing:3px;color:#B08A4F;margin:0 0 24px">VENDOOR CONNECT</p>
    <div style="background:#fff;border:1px solid #ECE3D8;padding:34px 30px">
      <h1 style="font-family:Georgia,serif;font-weight:normal;font-size:25px;line-height:1.25;color:#5B4636;margin:0 0 14px">${title}</h1>
      ${bodyHtml}${btn}
      ${noFooter ? '' : '<p style="margin:18px 0 0;font-size:14px;line-height:1.6;color:#8A7C6F">Questions? Just reply to this email.</p>'}
    </div>
    <p style="text-align:center;font-size:12px;color:#8A7C6F;margin:20px 0 0">Vendoor Connect &middot; <a href="${SITE}" style="color:#8A7C6F">vendoorconnect.com</a></p>
  </div></body></html>`;
}
const RP = 'margin:0 0 14px;font-size:15px;line-height:1.7;color:#5B4636';
function reviewAbout(r) { return r.review_type === 'platform' ? 'Vendoor Connect' : (r.vendor_name || 'the vendor'); }
function quoteBox(r) {
  const stars = '&#9733;'.repeat(Math.max(1, Math.min(5, Number(r.rating) || 0)));
  return `<div style="border-left:3px solid #C8A96A;background:#FBF7F1;padding:14px 18px;margin:0 0 18px"><p style="margin:0 0 6px;color:#C8A96A;font-size:15px">${stars}</p><p style="margin:0;font-size:14.5px;line-height:1.7;color:#5B4636;font-style:italic">${esc(String(r.review_text || '').slice(0, 600))}</p></div>`;
}
async function sendResend(payload) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, error: 'RESEND_API_KEY is not set' };
  try {
    const res = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign({ from: FROM, reply_to: OWNER }, payload)) });
    if (!res.ok) return { ok: false, error: 'Resend ' + res.status };
    return { ok: true };
  } catch (e) { return { ok: false, error: e && e.message }; }
}
function reviewLink(r) {
  return r.review_type === 'platform' ? SITE + '/reviews.html?about=vendoorconnect'
    : (r.vendor_id ? SITE + '/vendor-profile.html?id=' + r.vendor_id : SITE + '/reviews.html');
}
// stage: 'received' | 'published' | 'info'
async function sendReviewerEmail(stage, r, note) {
  if (!r || !r.reviewer_email) return { ok: false };
  const first = esc(String(r.reviewer_name || '').split(' ')[0]);
  const about = esc(reviewAbout(r));
  let subject, html;
  if (stage === 'received') {
    subject = 'Thank you for your review of ' + reviewAbout(r);
    html = reviewShell('Thank you' + (first ? ', ' + first : ''),
      `<p style="${RP}">We've received your review of <strong>${about}</strong>. A representative on our team reads every review before it goes live, usually within 48 hours, and we'll email you as soon as it's published.</p>${quoteBox(r)}<p style="${RP}">Honest reviews like yours help the next client choose with confidence. Thank you so much for taking the time.</p>`);
  } else if (stage === 'published') {
    subject = 'Your review of ' + reviewAbout(r) + ' is live';
    html = reviewShell('Your review is live',
      `<p style="${RP}">Thank you${first ? ', ' + first : ''}. ` + (r.review_type === 'platform'
        ? `Your review of <strong>Vendoor Connect</strong> is now live on our site.`
        : `Your review of <strong>${about}</strong> is now published on Vendoor Connect.`) + `</p>${quoteBox(r)}`,
      { text: 'See your review', url: reviewLink(r) });
  } else {
    subject = 'A quick question about your review of ' + reviewAbout(r);
    html = reviewShell('A quick question about your review',
      `<p style="${RP}">Hi${first ? ' ' + first : ''}, thank you for reviewing <strong>${about}</strong>. Before we publish it, we'd like to check one thing with you:</p><div style="background:#FBF7F1;padding:14px 18px;margin:0 0 18px;font-size:15px;line-height:1.7;color:#5B4636">${esc(note || '').replace(/\n/g, '<br>')}</div><p style="${RP}"><strong>Just reply to this email</strong> and we'll take it from there. Here's the review you sent:</p>${quoteBox(r)}`, null, true);
  }
  return sendResend({ to: [r.reviewer_email], subject, html });
}
// Tells a listed vendor that a new review of their business is live.
async function sendVendorNewReviewEmail(vendorEmail, r) {
  if (!vendorEmail) return { ok: false };
  return sendResend({ to: [vendorEmail], subject: 'You have a new review on Vendoor Connect',
    html: reviewShell('You have a new review',
      `<p style="${RP}">A client has reviewed <strong>${esc(r.vendor_name)}</strong> on Vendoor Connect. It's now live on your profile.</p>${quoteBox(r)}<p style="${RP}">A short, thoughtful reply shows future clients how you treat people. You can reply from your vendor dashboard.</p>`,
      { text: 'Reply from my dashboard', url: SITE + '/vendor-portal.html' }) });
}

module.exports = { sendReviewerEmail, sendVendorNewReviewEmail, sendVendorWelcome, buildWelcomeEmail, sendOrderEmail, buildEmail, notifyOwner, sendPackageEmail, buildPackageEmail };
