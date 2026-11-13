const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const source = fs.readFileSync(path.join(__dirname, '../Bordero/js/data-loader.js'), 'utf8');

function createDataLoaderDom({ parsedRows, cachedRows = null, fetchError = null }) {
  const stored = new Map();
  if (cachedRows) stored.set('bordero_brani', cachedRows);
  const dom = new JSDOM('<!doctype html><html><body></body></html>', {
    url: 'http://localhost:5500/Bordero/pages/bordero.html',
    runScripts: 'outside-only',
    beforeParse(window) {
      window.BORDERO_CONFIG = {
        CSV_BRANI: '../data/brani.csv',
        CACHE_KEY_BRANI: 'bordero_brani',
        CACHE_KEY_SYNC: 'bordero_sync',
      };
      window.Storage = {
        get: (key, fallback = null) => stored.has(key) ? stored.get(key) : fallback,
        set: (key, value) => stored.set(key, value),
        remove: (key) => stored.delete(key),
      };
      window.Network = {
        fetchCSV: async () => {
          if (fetchError) throw fetchError;
          return 'test csv';
        },
      };
      window.CSVParser = { parse: () => parsedRows };
      window.DateUtils = { now: () => '2026-03-07T12:00:00.000Z' };
      window.logger = { info() {}, warn() {}, error() {}, debug() {} };
      window.Toast = { success() {}, error() {} };
    },
  });
  dom.window.eval(`${source}\nwindow.__dataLoaderForTest = dataLoader;`);
  return { dom, stored };
}

test('successful catalog reads emit an update event for the next cloud sync cycle', async () => {
  const { dom, stored } = createDataLoaderDom({
    parsedRows: [{ id: '008', titolo: 'Dance', brano: 'Song' }],
  });
  const dataLoader = dom.window.__dataLoaderForTest;
  let updates = 0;
  dom.window.addEventListener('bordero:data-updated', () => { updates += 1; });

  const brani = await dataLoader.loadBrani({ silent: true });

  assert.equal(brani.length, 1);
  assert.equal(updates, 1);
  assert.equal(stored.get('bordero_brani').length, 1);
  dom.window.close();
});

test('empty or failed catalog reads preserve the last valid cache without publishing', async () => {
  for (const options of [
    { parsedRows: [], cachedRows: [{ id: '008', titolo: 'Cached Dance' }] },
    { parsedRows: [], fetchError: new Error('temporary import failure'), cachedRows: [{ id: '008', titolo: 'Cached Dance' }] },
  ]) {
    const { dom, stored } = createDataLoaderDom(options);
    const dataLoader = dom.window.__dataLoaderForTest;
    let updates = 0;
    dom.window.addEventListener('bordero:data-updated', () => { updates += 1; });

    const brani = await dataLoader.loadBrani({ silent: true });

    assert.equal(brani[0].titolo, 'Cached Dance');
    assert.equal(updates, 0);
    assert.equal(stored.get('bordero_brani')[0].titolo, 'Cached Dance');
    dom.window.close();
  }
});
