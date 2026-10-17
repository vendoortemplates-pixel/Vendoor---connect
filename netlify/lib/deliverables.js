// Finds a template's finished file. Files live in /deliverables and are
// bundled into the download function (see netlify.toml) — they are NOT
// publicly reachable by URL.
const fs = require('fs');
const path = require('path');

function candidates() {
  return [
    path.join(__dirname, '..', '..', 'deliverables'),
    path.join(__dirname, 'deliverables'),
    path.join(process.cwd(), 'deliverables'),
    path.join(process.env.LAMBDA_TASK_ROOT || '/var/task', 'deliverables')
  ];
}

function deliverablesDir() {
  for (const dir of candidates()) {
    if (fs.existsSync(path.join(dir, 'manifest.json'))) return dir;
  }
  return null;
}

function fileFor(slug) {
  const dir = deliverablesDir();
  if (!dir) return null;
  let manifest;
  try { manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8')); } catch (e) { return null; }
  const name = manifest[slug];
  if (!name || typeof name !== 'string' || name.indexOf('/') !== -1 || name.indexOf('..') !== -1) return null;
  const full = path.join(dir, name);
  return fs.existsSync(full) ? { name, full } : null;
}

module.exports = { fileFor };
