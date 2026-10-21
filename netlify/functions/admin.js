// Admin only (the site owner's Netlify Identity account — see ADMIN_EMAILS in
// netlify/lib/common.js). Powers admin.html.
//   GET  ?view=summary | reviews&status=pending|approved|rejected | orders | listings
//   POST { action: 'approve'|'reject'|'delete', reviewId }
//   POST { action: 'hide'|'show', listingId }
//   POST { action: 'resend-email', reference }
//   POST { action: 'founding-on'|'founding-off'|'feature'|'unfeature', listingId, days? }
//   POST { action: 'inquiry-status', inquiryId, status }
//   POST { action: 'resolve-dispute', reviewId }
//   GET ?view=liaison; POST { action: 'liaison-status', requestId, status }
const { getDb, rowsOf, json, parseBody, currentUser, isAdmin, FOUNDING_LIMIT } = require('../lib/common');
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
            (SELECT COALESCE(SUM(amount_kobo), 0)::bigint FROM orders) AS revenue_kobo,
            (SELECT COUNT(*)::int FROM membership_inquiries WHERE status = 'new') AS new_inquiries,
            (SELECT COUNT(*)::int FROM listings WHERE membership = 'founding') AS founding_members,
            (SELECT COUNT(*)::int FROM listings WHERE featured_until > NOW()) AS featured_now,
            (SELECT COUNT(*)::int FROM liaison_requests WHERE status = 'new') AS new_liaison,
            (SELECT COUNT(*)::int FROM reviews WHERE status = 'approved' AND disputed_at IS NOT NULL AND dispute_resolved_at IS NULL) AS open_disputes
        `)[0];
        Object.keys(r).forEach(k => { r[k] = Number(r[k]); });
        return json(200, { summary: r });
      }
      if (view === 'reviews') {
        const status = ['pending', 'approved', 'rejected', 'disputed'].indexOf(p.status) !== -1 ? p.status : 'pending';
        const rows = rowsOf(await db.sql`
          SELECT id, vendor_name, vendor_category, vendor_id, reviewer_name, reviewer_email, rating,
                 review_text, event_type, vendor_reply, status, COALESCE(review_type, 'vendor') AS review_type, created_at,
                 dispute_reason, disputed_at, dispute_resolved_at
          FROM reviews
          WHERE (${status} = 'disputed' AND status = 'approved' AND disputed_at IS NOT NULL AND dispute_resolved_at IS NULL) OR (${status} <> 'disputed' AND status = ${status})
          ORDER BY created_at DESC LIMIT 300
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
          SELECT l.id, l.business_name, l.category, l.city, l.vendor_email, COALESCE(l.status, 'active') AS status, l.created_at,
                 l.membership, l.membership_until, l.featured_until,
                 (SELECT COALESCE(SUM(count), 0)::int FROM listing_stats WHERE listing_id = l.id AND kind = 'view' AND day > CURRENT_DATE - 30) AS views_30d,
                 (SELECT COALESCE(SUM(count), 0)::int FROM listing_stats WHERE listing_id = l.id AND kind <> 'view' AND day > CURRENT_DATE - 30) AS clicks_30d
          FROM listings l ORDER BY l.created_at DESC LIMIT 500
        `);
        return json(200, { listings: rows });
      }
      if (view === 'inquiries') {
        const rows = rowsOf(await db.sql`
          SELECT i.*, l.business_name AS listing_name FROM membership_inquiries i
          LEFT JOIN listings l ON l.id = i.listing_id
          ORDER BY (i.status = 'new') DESC, i.created_at DESC LIMIT 300
        `);
        return json(200, { inquiries: rows });
      }
      if (view === 'liaison') {
        const rows = rowsOf(await db.sql`
          SELECT * FROM liaison_requests ORDER BY (status = 'new') DESC, created_at DESC LIMIT 300
        `);
        return json(200, { requests: rows });
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
      if (listingId && data.action === 'founding-on') {
        const n = rowsOf(await db.sql`SELECT COUNT(*)::int AS n FROM listings WHERE membership = 'founding' AND id <> ${listingId}`)[0];
        if (Number(n.n) >= FOUNDING_LIMIT) return json(400, { error: 'All ' + FOUNDING_LIMIT + ' founding spots are taken.' });
        await db.sql`UPDATE listings SET membership = 'founding', membership_until = NOW() + INTERVAL '12 months' WHERE id = ${listingId}`;
        return json(200, { ok: true });
      }
      if (listingId && data.action === 'founding-off') {
        await db.sql`UPDATE listings SET membership = NULL, membership_until = NULL WHERE id = ${listingId}`;
        return json(200, { ok: true });
      }
      if (listingId && data.action === 'feature') {
        const days = Math.min(Math.max(parseInt(data.days, 10) || 30, 1), 366);
        await db.sql`
          UPDATE listings SET featured_until = GREATEST(COALESCE(featured_until, NOW()), NOW()) + (${days} || ' days')::interval
          WHERE id = ${listingId}
        `;
        return json(200, { ok: true });
      }
      if (listingId && data.action === 'unfeature') {
        await db.sql`UPDATE listings SET featured_until = NULL WHERE id = ${listingId}`;
        return json(200, { ok: true });
      }
      if (data.action === 'inquiry-status') {
        const inquiryId = parseInt(data.inquiryId, 10);
        const st = ['new', 'contacted', 'active', 'closed'].indexOf(data.status) !== -1 ? data.status : null;
        if (!inquiryId || !st) return json(400, { error: 'Invalid enquiry update.' });
        await db.sql`UPDATE membership_inquiries SET status = ${st} WHERE id = ${inquiryId}`;
        return json(200, { ok: true });
      }
      if (data.action === 'liaison-status') {
        const rid = parseInt(data.requestId, 10);
        const st = ['new', 'contacted', 'booked', 'closed'].indexOf(data.status) !== -1 ? data.status : null;
        if (!rid || !st) return json(400, { error: 'Invalid update.' });
        await db.sql`UPDATE liaison_requests SET status = ${st} WHERE id = ${rid}`;
        return json(200, { ok: true });
      }
      if (reviewId && data.action === 'resolve-dispute') {
        await db.sql`UPDATE reviews SET dispute_resolved_at = NOW() WHERE id = ${reviewId}`;
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
