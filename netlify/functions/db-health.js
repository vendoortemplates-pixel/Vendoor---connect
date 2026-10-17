// Health check: confirms the database connection and lists tables.
// Reveals no secrets or environment details.
const { getDb, rowsOf, json } = require('../lib/common');

exports.handler = async () => {
  try {
    const rows = rowsOf(await getDb().sql`
      SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name
    `);
    const cols = rowsOf(await getDb().sql`
      SELECT column_name FROM information_schema.columns WHERE table_name = 'reviews' AND column_name = 'status'
    `);
    return json(200, { ok: true, tables: rows.map(r => r.table_name), moderationReady: cols.length > 0, paymentsConfigured: !!process.env.PAYSTACK_SECRET_KEY });
  } catch (err) {
    return json(200, { ok: false, error: 'Database connection failed.' });
  }
};
