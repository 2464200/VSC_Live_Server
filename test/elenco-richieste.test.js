const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const { parse } = require('csv-parse/sync');

const pageSource = fs.readFileSync(
  path.join(__dirname, '..', 'Bordero', 'pages', 'elenco-richieste.js'),
  'utf8'
);

test('Elenco Richieste shows source names and dates, including responses without a name', async () => {
  const csv = [
    'Informazioni cronologiche,Nome,Tipo,Coreografia',
    '13/11/2026 12.40.50,"Alice & Bob",Line dance,ALTITUDE',
    '13/11/2026 13.10.19,,Coreo N - Z,AFTER MIDNIGHT',
    '13/11/2026 13.20.00,Daniele,Line dance,A BAR SONG',
    '13/11/2026 13.30.00,LUCA100,Coreo 0 - 9,4 COWBOY'
  ].join('\n');
  const elements = {
    'richieste-tbody': { innerHTML: '', querySelectorAll: () => [] },
    'empty-richieste': { style: {} },
    'richieste-count': { textContent: '' }
  };
  let statusCalls = 0;
  const context = {
    URL,
    window: { location: { href: 'http://localhost:5500/Bordero/pages/elenco-richieste.html' } },
    document: {
      addEventListener() {},
      getElementById: (id) => elements[id]
    },
    logger: { info() {}, debug() {}, warn() {}, error() {} },
    CSVParser: {
      parseCSVLine: (line) => parse(line, { relax_column_count: true })[0] || []
    },
    fetch: async (url) => {
      if (String(url).includes('/api/bordero/sync-google/status')) {
        statusCalls += 1;
        return {
          ok: true,
          async json() {
            return { state: { inProgress: statusCalls === 1 } };
          }
        };
      }

      return {
        ok: true,
        async text() {
          return csv;
        }
      };
    },
    setTimeout: (callback) => {
      callback();
    }
  };

  vm.runInNewContext(
    `${pageSource}\nglobalThis.TestElencoRichiestePage = ElencoRichiestePage;`,
    context,
    { filename: 'elenco-richieste.js' }
  );

  const page = Object.create(context.TestElencoRichiestePage.prototype);
  page.brani = [
    { id: '024', titolo: 'ALTITUDE', coreografia: 'ALTITUDE', richieste: '' },
    { id: '019', titolo: 'AFTER MIDNIGHT', coreografia: 'AFTER MIDNIGHT', richieste: '' },
    { id: '015', titolo: 'A BAR SONG', brano: 'a bar song (tipsy)', richieste: '' },
    { id: '255', titolo: 'TIPSY', brano: 'a bar song (tipsy)', richieste: '' },
    { id: '507', titolo: '4 COWBOY', brano: 'rough ride for a cowboy', richieste: '' },
    { id: '492', titolo: 'COWBOY', brano: 'i wanna be your cowboy', richieste: '' }
  ];
  page.requested = [];
  page.requestDetailsByBranoId = new Map();
  page.cloudState = null;

  await page.waitForInitialGoogleSync();
  await page.loadRequestersFromAccoda();
  page.requested = page.getUniqueRequestedBrani(page.brani);
  page.renderRequested();

  assert.equal(statusCalls, 2);
  assert.deepEqual(
    Array.from(page.requested, (brano) => brano.id),
    ['024', '019', '015', '507']
  );
  assert.match(elements['richieste-tbody'].innerHTML, /Alice &amp; Bob/);
  assert.match(elements['richieste-tbody'].innerHTML, /13\/11\/2026 12\.40\.50/);
  assert.match(elements['richieste-tbody'].innerHTML, /13\/11\/2026 13\.10\.19/);
  assert.match(elements['richieste-tbody'].innerHTML, /13\/11\/2026 13\.20\.00/);
  assert.match(elements['richieste-tbody'].innerHTML, /13\/11\/2026 13\.30\.00/);
  assert.match(elements['richieste-tbody'].innerHTML, /<td class="col-nome">--<\/td>/);
  assert.equal(elements['richieste-count'].textContent, '4 brani unici');
});
