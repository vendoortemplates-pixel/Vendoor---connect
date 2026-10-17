// Admin only (the site owner's Netlify Identity account — see ADMIN_EMAILS in
// netlify/lib/common.js). Powers admin.html.
//   GET  ?view=summary | reviews&status=pending|approved|rejected | orders | listings
//   POST { action: 'approve'|'reject'|'delete', reviewId }
//   POST { action: 'hide'|'show', listingId }
//   POST { action: 'resend-email', reference }
const { getDb, rowsOf, json, parseBody, currentUser, isAdmin } = require('../lib/common');
const { sendOrderEmail } = require('../lib/email');

exports.handler = async (event, context) => {
  const user = currentUser(context);
  if (!user) return json(401, { error: 'Please log in.' });
  if (!isAdmin(user)) return json(403, { error: 'This account does not have admin access.' });
  const db = getDb();

  try {
    if (event.httpMethod === 'GET') {
      const p = event.queryStringParameters || {};
      const view = p.view || 'summary';

      if (view === 'summary') {
        const r = rowsOf(await db.sql`
          SELECT
            (SELECT COUNT(*)::int FROM reviews WHERE status = 'pending') AS pending_reviews,
            (SELECT COUNT(*)::int FROM reviews WHERE status = 'approved') AS approved_reviews,
            (SELECT COUNT(*)::int FROM listings) AS listings,
            (SELECT COUNT(*)::int FROM orders) AS orders,
            (SELECT COALESCE(SUM(amount_kobo), 0)::bigint FROM orders) AS revenue_kobo
        `)[0];
        Object.keys(r).forEach(k => { r[k] = Number(r[k]); });
        return json(200, { summary: r });
      }
      if (view === 'reviews') {
        const status = ['pending', 'approved', 'rejected'].indexOf(p.status) !== -1 ? p.status : 'pending';
        const rows = rowsOf(await db.sql`
          SELECT id, vendor_name, vendor_category, vendor_id, reviewer_name, reviewer_email, rating,
                 review_text, event_type, vendor_reply, status, COALESCE(review_type, 'vendor') AS review_type, created_at
          FROM reviews WHERE status = ${status} ORDER BY created_at DESC LIMIT 300
        `);
        return json(200, { reviews: rows });
      }
      if (view === 'orders') {
        const rows = rowsOf(await db.sql`
          SELECT id, reference, product_slug, template_name, email, amount_kobo, currency, paid_at,
                 download_count, email_sent_at, email_had_file, created_at
          FROM orders ORDER BY created_at DESC LIMIT 500
        `);
        return json(200, { orders: rows });
      }
      if (view === 'listings') {
        const rows = rowsOf(await db.sql`
          SELECT id, business_name, category, city, vendor_email, COALESCE(status, 'active') AS status, created_at
          FROM listings ORDER BY created_at DESC LIMIT 500
        `);
        return json(200, { listings: rows });
      }
      return json(400, { error: 'Unknown view.' });
    }

    if (event.httpMethod === 'POST') {
      const data = parseBody(event);
      if (!data) return json(400, { error: 'Invalid request.' });
      const reviewId = parseInt(data.reviewId, 10);
      const listingId = parseInt(data.listingId, 10);

      if (reviewId && (data.action === 'approve' || data.action === 'reject')) {
        const status = data.action === 'approve' ? 'approved' : 'rejected';
        await db.sql`UPDATE reviews SET status = ${status}, moderated_at = NOW() WHERE id = ${reviewId}`;
        return json(200, { ok: true });
      }
      if (reviewId && data.action === 'delete') {
        await db.sql`DELETE FROM reviews WHERE id = ${reviewId}`;
        return json(200, { ok: true });
      }
      if (data.action === 'resend-email' && data.reference) {
        const o = rowsOf(await db.sql`SELECT * FROM orders WHERE reference = ${String(data.reference)}`)[0];
        if (!o) return json(404, { error: 'Order not found.' });
        const r = await sendOrderEmail(o, true);
        if (!r.ok) return json(500, { error: r.error || 'Email could not be sent.' });
        return json(200, { ok: true, hasFile: r.hasFile });
      }
      if (listingId && (data.action === 'hide' || data.action === 'show')) {
        const status = data.action === 'hide' ? 'hidden' : 'active';
        await db.sql`UPDATE listings SET status = ${status} WHERE id = ${listingId}`;
        return json(200, { ok: true });
      }
      return json(400, { error: 'Unknown action.' });
    }

    return json(405, { error: 'Method Not Allowed' });
  } catch (err) {
    console.error('admin error:', err);
    return json(500, { error: 'Something went wrong on the server.' });
  }
};
