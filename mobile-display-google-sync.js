const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');

function clean(value) {
  return String(value ?? '').trim();
}

function readRows(filePath, skipRows = 0) {
  if (!fs.existsSync(filePath)) return [];
  return parse(fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, ''), {
    relax_column_count: true,
    skip_empty_lines: true
  }).slice(skipRows);
}

function createMobileDisplayGoogleSync(rootDir) {
  const endpoint = clean(process.env.GOOGLE_DISPLAY_WEB_APP_URL);
  const secret = clean(process.env.GOOGLE_DISPLAY_SHARED_SECRET);
  const enabled = /^https:\/\/script\.google\.com\/macros\/s\//i.test(endpoint) && secret.length >= 16;
  const displayPath = path.join(rootDir, 'display.csv');
  const nextPath = path.join(rootDir, 'NextCoreo.csv');
  const metadataPath = path.join(rootDir, 'public', 'serata_meta.json');
  let timer = null;

  function snapshot() {
    const metadata = fs.existsSync(metadataPath)
      ? JSON.parse(fs.readFileSync(metadataPath, 'utf8').replace(/^\uFEFF/, '') || '{}')
      : {};
    const next = readRows(nextPath)[0] || [];
    const items = readRows(displayPath, 3).map((row) => ({
      flag: clean(row[0]), id: clean(row[1]), title: clean(row[2]), song: clean(row[3]),
      author: clean(row[4]), choreographer: clean(row[5])
    })).filter((item) => item.id || item.title);
    return {
      metadata: { dj: clean(metadata.dj), data: clean(metadata.data), luogo: clean(metadata.luogo), evento: clean(metadata.evento) },
      next: { id: clean(next[0]), title: clean(next[1]), infoLevel: clean(next[2]), infoCoreo: clean(next[3]) },
      items,
      updatedAt: new Date().toISOString()
    };
  }

  async function publish(payload = snapshot()) {
    if (!enabled) return { enabled: false };
    try {
      const response = await fetch(`${endpoint}?token=${encodeURIComponent(secret)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = await response.json().catch(() => ({}));
      if (result?.ok !== true) throw new Error(result?.error || 'Risposta Google non valida');
      return { enabled: true };
    } catch (error) {
      console.warn('[GOOGLE MOBILE] Pubblicazione non riuscita:', error.message || error);
      return { enabled: true, error: error.message || String(error) };
    }
  }

  function schedulePublish() {
    clearTimeout(timer);
    timer = setTimeout(() => publish(), 300);
  }

  function start() {
    if (!enabled) {
      console.log('[GOOGLE MOBILE] Disabilitato: configura GOOGLE_DISPLAY_WEB_APP_URL e GOOGLE_DISPLAY_SHARED_SECRET.');
      return;
    }
    [displayPath, nextPath, metadataPath].forEach((filePath) => fs.watchFile(filePath, { interval: 1000 }, schedulePublish));
    publish();
    console.log('[GOOGLE MOBILE] Bridge display attivo.');
  }

  return { enabled, start, publish, snapshot };
}

module.exports = { createMobileDisplayGoogleSync };