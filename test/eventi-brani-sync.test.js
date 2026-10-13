const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { parse } = require('csv-parse/sync');
const { loadBraniFromSources, syncBraniJson, BORDERO_CSV_NAME } = require('../Eventi/brani-utils');

test('Eventi uses the same valid Google catalog as Bordero without merging local extras', (t) => {
  const csvPath = path.join(__dirname, '..', 'Bordero', 'data', 'brani.csv');
  const borderoRows = parse(fs.readFileSync(csvPath, 'utf8'), {
    columns: true, skip_empty_lines: true, relax_column_count: true, bom: true
  }).filter((row) => String(row.coreografia || '').trim());
  const loaded = loadBraniFromSources();
  assert.equal(loaded.stats.baseFile, BORDERO_CSV_NAME);
  assert.equal(loaded.stats.total, borderoRows.length);
  assert.equal(loaded.brani.length, borderoRows.length);
  assert.equal(loaded.brani.some((item) => String(item.id).startsWith('EXTRA')), false);
  assert.ok(loaded.stats.extraCount >= 0, 'local extras remain accounted for separately');

  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'eventi-brani-sync-'));
  t.after(() => fs.rmSync(temporary, { recursive: true, force: true }));
  const output = path.join(temporary, 'brani.json');
  const synced = syncBraniJson(output);
  assert.equal(synced.stats.total, borderoRows.length);
  assert.equal(JSON.parse(fs.readFileSync(output, 'utf8')).length, borderoRows.length);
});
