const test = require('node:test');
const assert = require('node:assert/strict');
const { mergeSourceTables } = require('../Bordero/server/google-sheets-sync');

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
