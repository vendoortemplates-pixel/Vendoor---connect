// Runs every morning (see netlify.toml). Emails vendors whose package is
// about to end, and once more when it has ended, each with a one-click renew
// link. Nothing is charged automatically: when the end date passes, the
// badge or sponsored placement stops showing on its own because every
// listing query checks the date.
const { getDb, rowsOf } = require('../lib/common');
const { PACKAGES, renewLink } = require('../lib/packages');
const { sendPackageEmail } = require('../lib/email');

const RANK = { '': 0, soon: 1, last: 2, ended: 3 };
const DAY = 24 * 3600 * 1000;

function stageFor(until, firstNoticeDays) {
  const left = (new Date(until).getTime() - Date.now()) / DAY;
  if (left <= 0) return left > -3 ? 'ended' : null; // only tell them in the first few days after
  if (left <= 1.5) return 'last';
  if (left <= firstNoticeDays) return 'soon';
  return null;
}

async function run() {
  const db = getDb();
  const sent = [];
  // Sponsored placements (30 days): first reminder 5 days before.
  const featured = rowsOf(await db.sql`
    SELECT id, business_name, vendor_email, featured_until AS until, featured_package AS pkg, featured_reminded AS reminded
    FROM listings
    WHERE featured_until IS NOT NULL AND featured_until > NOW() - INTERVAL '3 days' AND featured_until < NOW() + INTERVAL '5 days'
  `);
  // Founding membership (12 months): first reminder 14 days before.
  const founding = rowsOf(await db.sql`
    SELECT id, business_name, vendor_email, membership_until AS until, 'founding' AS pkg, membership_reminded AS reminded
    FROM listings
    WHERE membership = 'founding' AND membership_until IS NOT NULL
      AND membership_until > NOW() - INTERVAL '3 days' AND membership_until < NOW() + INTERVAL '14 days'
  `);
  const jobs = featured.map(l => ({ l, kind: 'featured', first: 5 })).concat(founding.map(l => ({ l, kind: 'founding', first: 14 })));

  for (const { l, kind, first } of jobs) {
    const stage = stageFor(l.until, first);
    if (!stage || RANK[stage] <= RANK[l.reminded || '']) continue;
    const pkgKey = PACKAGES[l.pkg] ? l.pkg : 'spotlight';
    const pkg = PACKAGES[pkgKey];
    const r = await sendPackageEmail(stage, {
      to: l.vendor_email, businessName: l.business_name, packageName: pkg.name, price: pkg.price,
      term: pkg.term, until: l.until, renewUrl: renewLink(l.id, pkgKey)
    });
    if (!r.ok) { console.error('reminder failed', l.id, stage, r.error); continue; }
    if (kind === 'featured') await db.sql`UPDATE listings SET featured_reminded = ${stage} WHERE id = ${l.id}`;
    else await db.sql`UPDATE listings SET membership_reminded = ${stage} WHERE id = ${l.id}`;
    sent.push(l.id + ':' + kind + ':' + stage);
  }
  return sent;
}

exports.handler = async () => {
  try {
    const sent = await run();
    console.log('package-reminders sent', sent.length, sent.join(', '));
    return { statusCode: 200, body: JSON.stringify({ sent }) };
  } catch (err) {
    console.error('package-reminders error:', err);
    return { statusCode: 500, body: 'error' };
  }
};
exports.run = run;
