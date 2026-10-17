// Serves a purchased template file — only for a verified order reference.
const fs = require('fs');
const { getDb, json, clean } = require('../lib/common');
const { verifyAndRecord } = require('../lib/paystack');
const { fileFor } = require('../lib/deliverables');

const MAX_DOWNLOADS = 15;
const MAX_BYTES = 4.4 * 1024 * 1024; // Netlify function responses are limited to ~6MB after encoding.

exports.handler = async (event) => {
  const reference = clean((event.queryStringParameters || {}).reference, 120);
  if (!reference) return json(400, { error: 'Missing order reference.' });
  try {
    const r = await verifyAndRecord(reference);
    if (!r.ok) return json(403, { error: r.error });
    if (Number(r.order.download_count) >= MAX_DOWNLOADS) {
      return json(403, { error: 'This download link has reached its limit. Please contact us and we will email your file.' });
    }
    const file = fileFor(r.order.product_slug);
    if (!file) return json(404, { error: 'Your file is being prepared and will be emailed to you within 24 hours.' });
    const buf = fs.readFileSync(file.full);
    if (buf.length > MAX_BYTES) {
      console.error('download: file too large to serve from a function:', file.name, buf.length);
      return json(500, { error: 'Your file will be emailed to you within 24 hours.' });
    }
    await getDb().sql`UPDATE orders SET download_count = download_count + 1 WHERE reference = ${r.order.reference}`;
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    const types = { pdf: 'application/pdf', zip: 'application/zip', png: 'image/png', jpg: 'image/jpeg', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };
    return {
      statusCode: 200,
      isBase64Encoded: true,
      headers: {
        'Content-Type': types[ext] || 'application/octet-stream',
        'Content-Disposition': 'attachment; filename="' + file.name.replace(/"/g, '') + '"',
        'Cache-Control': 'private, no-store'
      },
      body: buf.toString('base64')
    };
  } catch (err) {
    console.error('download error:', err);
    return json(500, { error: 'Something went wrong preparing your download.' });
  }
};
