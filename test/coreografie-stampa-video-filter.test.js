const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function loadPrintPage() {
  const context = {
    window: { isVideoOnlyBrano: () => false },
    document: { addEventListener() {} },
    console
  };
  vm.createContext(context);
  const source = fs.readFileSync('Bordero/pages/coreografie-stampa.js', 'utf8')
    .replace(/document\.addEventListener\('DOMContentLoaded',[\s\S]*$/, 'globalThis.CoreografieStampaPage = CoreografieStampaPage;');
  vm.runInContext(source, context);
  return Object.create(context.CoreografieStampaPage.prototype);
}

test('stampa coreografie excludes video positions 600-606 and keeps normal songs', () => {
  const page = loadPrintPage();
  const videos = Array.from({ length: 7 }, (_, index) => ({
    id: String(600 + index),
    titolo: `VIDEO ${index}`
  }));
  const groups = page.groupByInitial([
    { id: '599', titolo: 'Brano valido' },
    ...videos,
    { id: '607', titolo: 'Coreografia valida' }
  ]);
  const printed = Object.values(groups).flat();

  assert.deepEqual(printed.map((item) => item.id).sort(), ['599', '607']);
});

test('stampa coreografie recognizes excluded video titles after renumbering', () => {
  const page = loadPrintPage();
  assert.equal(page.isExcludedFromPrint({ id: '900', titolo: 'ESIBIZIONE DUE TORRI - Black Coffee' }), true);
  assert.equal(page.isExcludedFromPrint({ id: '901', titolo: 'NEW VIDEO PROMO CORSI 2026' }), true);
  assert.equal(page.isExcludedFromPrint({ id: '902', titolo: 'Normale coreografia' }), false);
});
