const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { hasDataRows, syncRegistro } = require('../scripts/sync-registro-sheets');

test('Registro import rejects an empty tab without replacing existing snapshots', async () => {
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'registro-google-sync-'));
  const previousFileName = 'Registrazioni.csv';
  const previousContents = 'timestamp,value\nlast valid snapshot,keep\n';
  fs.writeFileSync(path.join(outputDir, previousFileName), previousContents);
  fs.writeFileSync(
    path.join(outputDir, '.registro-sync-manifest.json'),
    JSON.stringify({ files: [previousFileName] })
  );

  try {
    await assert.rejects(
      syncRegistro({
        outputDir,
        getApiAuth: async () => ({}),
        listSheets: async () => [{ title: 'Registrazioni' }, { title: 'Vuoto' }],
        fetchSheetValues: async (sheet) => sheet.title === 'Registrazioni'
          ? [['timestamp', 'value'], ['new row', 'new value']]
          : [['timestamp', 'value']]
      }),
      /non contiene righe dati/
    );

    assert.equal(fs.readFileSync(path.join(outputDir, previousFileName), 'utf8'), previousContents);
    assert.deepEqual(fs.readdirSync(outputDir).sort(), [
      '.registro-sync-manifest.json',
      previousFileName
    ]);
  } finally {
    fs.rmSync(outputDir, { recursive: true, force: true });
  }
});

test('Registro row validation requires at least one populated data row', () => {
  assert.equal(hasDataRows([]), false);
  assert.equal(hasDataRows([['header']]), false);
  assert.equal(hasDataRows([['header'], ['', '  ']]), false);
  assert.equal(hasDataRows([['header'], ['', 'value']]), true);
});
