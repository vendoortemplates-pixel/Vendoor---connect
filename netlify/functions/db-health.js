// TEMPORARY DIAGNOSTIC ENDPOINT.
// Reports whether the database connection works and which tables exist.
// Always returns HTTP 200 so the real error text is readable in a browser
// instead of being hidden behind a generic 500. No data or credentials are
// exposed. Safe to delete once the database is confirmed healthy.
const { getDatabase } = require('@netlify/database');

exports.handler = async () => {
  const report = {
    ok: false,
    step: 'start',
    hasConnectionUrl: Boolean(process.env.NETLIFY_DB_URL),
    driver: null,
    resultShape: null,
    tables: [],
    error: null
  };

  try {
    report.step = 'getDatabase';
    const db = getDatabase();
    report.driver = db.driver || null;

    report.step = 'query';
    const result = await db.sql`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;

    const rows = Array.isArray(result)
      ? result
      : (result && Array.isArray(result.rows) ? result.rows : []);

    report.resultShape = Array.isArray(result) ? 'array' : typeof result;
    report.tables = rows.map(function (r) { return r.table_name; });
    report.ok = true;
    report.step = 'done';
  } catch (err) {
    report.error = {
      name: err && err.name ? err.name : 'Error',
      message: err && err.message ? err.message : String(err)
    };
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(report, null, 2)
  };
};
