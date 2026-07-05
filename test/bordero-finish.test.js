const fs = require('fs');
const vm = require('vm');
const { JSDOM } = require('jsdom');

// Minimal DOM skeleton with required IDs
const html = `
<!doctype html>
<html><body>
  <input id="data-serata" />
  <input id="evento-text" />
  <select id="dj-select"></select>
  <select id="luogo-select"></select>
  <div id="brani-tbody"></div>
  <div id="empty-state"></div>
  <span id="stat-total"></span>
  <span id="stat-completed"></span>
  <span id="stat-pending"></span>
  <span id="stat-last-action"></span>
  <div id="pagination-info"></div>
  <button id="btn-sort-id"></button>
  <button id="btn-sort-genere"></button>
  <button id="btn-sort-autore"></button>
  <button id="btn-view-executed"></button>
  <button id="btn-filter-coreografia"></button>
  <button id="btn-filter-genere"></button>
  <button id="btn-filter-livello"></button>
  <button id="btn-filter-altro"></button>
  <input id="search-box" />
  <button id="btn-search-general"></button>
  <button id="btn-search-title"></button>
  <button id="btn-search-id"></button>
  <button id="btn-reset-filters"></button>
  <button id="btn-reset-filters-empty"></button>
  <button id="btn-userform"></button>
  <button id="btn-export"></button>
  <button id="btn-print"></button>
  <button id="btn-finish-serata"></button>
  <button id="btn-first-page"></button>
  <button id="btn-prev-page"></button>
  <button id="btn-next-page"></button>
  <button id="btn-last-page"></button>
</body></html>`;

const dom = new JSDOM(html, { runScripts: 'outside-only' });
const { window } = dom;
global.window = window;
global.document = window.document;
global.location = window.location;

// Stubs for utilities used by bordero.js
global.logger = {
  info: (...a) => console.log('[info]', ...a),
  debug: (...a) => console.log('[debug]', ...a),
  warn: (...a) => console.warn('[warn]', ...a),
  error: (...a) => console.error('[error]', ...a),
};

global.Toast = {
  success: (m) => console.log('[Toast.success]', m),
  info: (m) => console.log('[Toast.info]', m),
  warning: (m) => console.log('[Toast.warning]', m),
  error: (m) => console.log('[Toast.error]', m),
};

global.DateUtils = {
  now: () => new Date().toISOString(),
  formatDate: (d) => (d instanceof Date ? d.toISOString() : (d || '')),
  formatTime: (d) => (d instanceof Date ? d.toTimeString().split(' ')[0] : (d || '')),
};

global.ObjectUtils = {
  sortByField: (arr, field, asc = true) => [...arr].sort((a,b)=>{
    const A = (a[field]||'').toString(); const B = (b[field]||'').toString();
    if (A < B) return asc ? -1 : 1; if (A > B) return asc ? 1 : -1; return 0;
  }),
  filterByField: (arr, field, value) => arr.filter(i => (i[field]||'').toString().includes(value)),
  searchMultiField: (arr, q, fields) => arr.filter(item => fields.some(f => (item[f]||'').toString().toLowerCase().includes(q.toLowerCase()))),
};

global.DOMUtils = {
  show: (el) => { if (el) el.style.display = ''; },
  hide: (el) => { if (el) el.style.display = 'none'; },
};

// Simple Storage wrapping jsdom localStorage
global.Storage = {
  set: (k,v) => { try{ window.localStorage.setItem(k, JSON.stringify(v)); }catch(e){} },
  get: (k, def=null) => { try{ const it = window.localStorage.getItem(k); return it?JSON.parse(it):def;}catch(e){return def;} },
  remove: (k) => { try{ window.localStorage.removeItem(k);}catch(e){} },
  clear: () => { try{ window.localStorage.clear(); }catch(e){} },
};

// Minimal config
global.BORDERO_CONFIG = {
  CACHE_KEY_CURRENT_SERATA: 'bordero_currentSerata',
  CACHE_KEY_BRANI: 'bordero_brani',
  ITEMS_PER_PAGE: 50,
};

// Minimal dataLoader stub that persists into Storage
const dataLoader = {
  _current: null,
  async initialize() { return Promise.resolve(); },
  async loadBrani() {
    // Provide sample brani
    const sample = [
      { id: '1', titolo: 'A', flag: '' },
      { id: '2', titolo: 'B', flag: '' },
      { id: '3', titolo: 'C', flag: '' },
      { id: '4', titolo: 'D', flag: '' },
      { id: '5', titolo: 'E', flag: '' },
    ];
    return sample;
  },
  async loadDJ() { return []; },
  async loadComuni() { return []; },
  getCurrentSerata() { return this._current; },
  saveCurrentSerata(meta, brani) { this._current = { metadata: meta, brani: brani, savedAt: new Date().toISOString() }; window.localStorage.setItem(BORDERO_CONFIG.CACHE_KEY_CURRENT_SERATA, JSON.stringify(this._current)); return this._current; },
  archiveCurrentSerata(meta, brani) { const s = this.saveCurrentSerata(meta, brani); const history = JSON.parse(window.localStorage.getItem(BORDERO_CONFIG.CACHE_KEY_SERATA_HISTORY||'bordero_serataHistory')||'[]'); history.push(s); window.localStorage.setItem(BORDERO_CONFIG.CACHE_KEY_SERATA_HISTORY||'bordero_serataHistory', JSON.stringify(history)); return s; },
  newSerata() { this._current = null; window.localStorage.removeItem(BORDERO_CONFIG.CACHE_KEY_CURRENT_SERATA); },
};

global.dataLoader = dataLoader;

// Load the target script
const scriptContent = fs.readFileSync('Bordero/pages/bordero.js', 'utf8');
vm.createContext(global);
vm.runInContext(scriptContent, global);

// Instantiate an explicit manager instance to drive the test
let managerExplicit = null;
try {
  managerExplicit = new global.BorderoTableManager();
  console.log('DEBUG: created managerExplicit');
} catch (e) {
  console.error('DEBUG: failed creating managerExplicit', e);
}

// Wait for async init to finish by polling for tableManager
function waitForManager(timeout = 3000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();

    // Use the explicit manager instance if available
    let manager = managerExplicit || global.tableManager;

    (function poll(){
      if (!manager) manager = global.tableManager;
      if (manager && Array.isArray(manager.allBrani) && manager.allBrani.length>0) return resolve(manager);
      if (Date.now() - start > timeout) return reject(new Error('Timeout waiting for tableManager init'));
      setTimeout(poll, 50);
    })();
  });
}

(async () => {
  try {
    const manager = await waitForManager();
    console.log('Initial allBrani:', manager.allBrani.map(b=>({id:b.id,flag:b.flag})));

    // Simulate marking some brani as completed
    manager.markAsCompleted('2');
    manager.markAsCompleted('4');

    console.log('After marking completed:', manager.allBrani.map(b=>({id:b.id,flag:b.flag,timestamp:b.timestamp})));

    // Ensure current serata persisted
    const saved = dataLoader.getCurrentSerata();
    console.log('Saved serata brani flags:', saved.brani.map(b=>({id:b.id,flag:b.flag})));

    // Call finishSerata()
    manager.finishSerata();

    // Wait briefly for any async ops
    await new Promise(r => setTimeout(r, 200));

    console.log('After finishSerata allBrani:', manager.allBrani.map(b=>({id:b.id,flag:b.flag,timestamp:b.timestamp})));

    const savedAfter = dataLoader.getCurrentSerata();
    console.log('SavedAfter serata brani flags:', savedAfter.brani.map(b=>({id:b.id,flag:b.flag})));

    // Assertions
    const anyFlag = manager.allBrani.some(b => String(b.flag||'').toUpperCase() === 'X');
    if (anyFlag) throw new Error('Some flags remain after finishSerata');

    console.log('TEST PASSED: All flags cleared and persisted');
    process.exit(0);
  } catch (e) {
    console.error('TEST FAILED', e);
    process.exit(2);
  }
})();
