// TEMPORARY DIAGNOSTIC ENDPOINT.
// Reports whether the database connection works, which connection-string
// environment variables exist (NAMES ONLY, never values), and which tables
// exist. Always returns HTTP 200 so the real error text is readable in a
// browser instead of being hidden behind a generic 500.
// Safe to delete once the database is confirmed healthy.
const { getDatabase } = require('@netlify/database');

const CANDIDATES = [
  'NETLIFY_DB_URL',
  'NETLIFY_DATABASE_URL',
  'DATABASE_URL',
  'NEON_DATABASE_URL',
  'POSTGRES_URL'
];

exports.handler = async () => {
  const report = {
    ok: false,
    step: 'start',
    candidateVarsPresent: CANDIDATES.filter(function (k) { return Boolean(process.env[k]); }),
    otherDbLookingVars: Object.keys(process.env).filter(function (k) {
      return /(^|_)(DB|DATABASE|NEON|POSTGRES|PG)(_|$)/.test(k) && CANDIDATES.indexOf(k) === -1;
    }),
    usedVar: null,
    driver: null,
    resultShape: null,
    tables: [],
    error: null
  };

  try {
    report.step = 'getDatabase';
    let db;
    const found = CANDIDATES.filter(function (k) { return Boolean(process.env[k]); })[0];
    if (found) {
      report.usedVar = found;
      db = getDatabase({ connectionString: process.env[found] });
    } else {
      report.usedVar = '(none - relying on automatic injection)';
      db = getDatabase();
    }
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
