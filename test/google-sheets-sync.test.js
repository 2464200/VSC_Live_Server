const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { mergeSourceTables, syncSheet } = require('../Bordero/server/google-sheets-sync');

test('merge keeps values under later duplicate response headers', () => {
  const header = Array(43).fill('');
  header[0] = 'Informazioni cronologiche';
  header[1] = 'Se vuoi, dimmi il tuo NOME';
  header[2] = 'TIPOLOGIA';
  header[32] = 'Coreo G - M';
  header[42] = 'Coreo G - M';

  const row = Array(43).fill('');
  row[0] = '04/11/2026 18.17.19';
  row[2] = 'Coreo G - M';
  row[32] = '';
  row[42] = 'MY MARIA';

  const merged = mergeSourceTables([{ values: [header, row] }]);

  assert.equal(merged.length, 2);
  assert.equal(merged[1][32], '');
  assert.equal(merged[1][42], 'MY MARIA');
});

test('merge retains business values in each occurrence of a duplicate header', () => {
  const header = ['Informazioni cronologiche', 'TIPOLOGIA', 'Coreo A - F', 'Coreo A - F'];
  const row = ['04/11/2026 18.17.19', 'Coreo A - F', 'PIM PAM', 'SHORT TIME'];

  const merged = mergeSourceTables([{ values: [header, row] }]);

  assert.equal(merged.length, 2);
  assert.deepEqual(merged[1], row);
});

test('empty Google response tabs fail without replacing the last valid CSVs', async () => {
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'google-sheets-sync-'));
  const sheet = {
    name: 'Accoda 8+12',
    output: 'Accoda 8+12.csv',
    richiesteOutput: 'brani.csv',
    baseSource: { name: 'Elenco Brani' },
    mergeSources: [{ name: 'Modulo 8' }, { name: 'Modulo 12' }]
  };
  const mergedPath = path.join(outputDir, sheet.output);
  const basePath = path.join(outputDir, sheet.richiesteOutput);
  const previousMerged = 'last valid response rows';
  const previousBase = 'last valid song rows';
  fs.writeFileSync(mergedPath, previousMerged);
  fs.writeFileSync(basePath, previousBase);

  try {
    const result = await syncSheet(sheet, {
      outputDir,
      fetchSheetValuesFromSource: async () => [[
        'Informazioni cronologistiche',
        'TIPOLOGIA',
        'Coreo A - F'
      ]]
    });

    assert.equal(result.success, false);
    assert.equal(result.rows, 0);
    assert.match(result.error, /non contengono righe dati/i);
    assert.equal(fs.readFileSync(mergedPath, 'utf8'), previousMerged);
    assert.equal(fs.readFileSync(basePath, 'utf8'), previousBase);
  } finally {
    fs.rmSync(outputDir, { recursive: true, force: true });
  }
});

test('successful Google response imports update merged and request CSVs together', async () => {
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'google-sheets-sync-'));
  const sheet = {
    name: 'Accoda 8+12',
    output: 'Accoda 8+12.csv',
    richiesteOutput: 'brani.csv',
    baseSource: { name: 'Elenco Brani' },
    mergeSources: [{ name: 'Modulo 8' }, { name: 'Modulo 12' }]
  };
  const responseHeader = [
    'Informazioni cronologistiche',
    'TIPOLOGIA',
    'Nome',
    'Coreo A - F'
  ];
  const responses = {
    'Modulo 8': [responseHeader, ['04/11/2026 18:17:19', 'Coreo A - F', '', 'PIM PAM']],
    'Modulo 12': [responseHeader, ['04/11/2026 18:18:19', 'Coreo A - F', '', 'SHORT TIME']],
    'Elenco Brani': [['Coreografia', 'Richieste'], ['PIM PAM', '']]
  };

  try {
    const result = await syncSheet(sheet, {
      outputDir,
      fetchSheetValuesFromSource: async (source) => responses[source.name]
    });

    assert.equal(result.success, true);
    assert.equal(result.rows, 2);
    assert.equal(result.richiesteDiagnostics.effectiveResponseRows, 2);
    assert.equal(fs.existsSync(path.join(outputDir, sheet.output)), true);
    assert.match(fs.readFileSync(path.join(outputDir, sheet.richiesteOutput), 'utf8'), /PIM PAM,1/);
  } finally {
    fs.rmSync(outputDir, { recursive: true, force: true });
  }
});
