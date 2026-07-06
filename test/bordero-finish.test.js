const fs = require('fs');
const vm = require('vm');

const context = {
  console,
  setTimeout,
  clearTimeout,
  Date,
  Math,
  JSON,
  String,
  Number,
  Array,
  Object,
  RegExp,
  Boolean,
  Promise,
};

context.window = context;
const createElement = () => ({
  style: {},
  classList: { add() {}, remove() {}, toggle() {} },
  setAttribute() {},
  appendChild() {},
  click() {},
  remove() {},
  innerHTML: '',
  textContent: '',
  querySelector() { return null; },
  querySelectorAll() { return []; },
  append() {},
});

const elements = {
  'brani-tbody': createElement(),
  'empty-state': createElement(),
  'stat-total': createElement(),
  'stat-completed': createElement(),
  'stat-pending': createElement(),
  'stat-last-action': createElement(),
  'pagination-info': createElement(),
  'btn-first-page': createElement(),
  'btn-prev-page': createElement(),
  'btn-next-page': createElement(),
  'btn-last-page': createElement(),
  'search-box': createElement(),
  'btn-search-general': createElement(),
  'btn-search-title': createElement(),
  'btn-search-id': createElement(),
};

context.document = {
  addEventListener() {},
  getElementById(id) { return elements[id] || null; },
  querySelector() { return null; },
  querySelectorAll() { return []; },
  createElement,
  body: { appendChild() {}, removeChild() {}, innerHTML: '' },
};
context.location = { href: '' };
context.navigator = { userAgent: 'node' };
context.window.document = context.document;
context.window.location = context.location;
context.window.navigator = context.navigator;
context.window.console = console;
context.window.setTimeout = setTimeout;
context.window.clearTimeout = clearTimeout;
context.window.Date = Date;
context.window.Math = Math;
context.window.JSON = JSON;
context.window.String = String;
context.window.Number = Number;
context.window.Array = Array;
context.window.Object = Object;
context.window.RegExp = RegExp;
context.window.Boolean = Boolean;
context.window.Promise = Promise;
context.window.localStorage = {
  store: {},
  setItem(key, value) { this.store[key] = String(value); },
  getItem(key) { return Object.prototype.hasOwnProperty.call(this.store, key) ? this.store[key] : null; },
  removeItem(key) { delete this.store[key]; },
  clear() { this.store = {}; },
};

context.logger = {
  info: (...a) => console.log('[info]', ...a),
  debug: (...a) => console.log('[debug]', ...a),
  warn: (...a) => console.warn('[warn]', ...a),
  error: (...a) => console.error('[error]', ...a),
};

context.Toast = {
  success: (m) => console.log('[Toast.success]', m),
  info: (m) => console.log('[Toast.info]', m),
  warning: (m) => console.log('[Toast.warning]', m),
  error: (m) => console.log('[Toast.error]', m),
};

context.DateUtils = {
  now: () => new Date().toISOString(),
  formatDate: (d) => (d instanceof Date ? d.toISOString() : (d || '')),
  formatTime: (d) => (d instanceof Date ? d.toTimeString().split(' ')[0] : (d || '')),
};

context.ObjectUtils = {
  sortByField: (arr, field, asc = true) => [...arr].sort((a, b) => {
    const A = (a[field] || '').toString();
    const B = (b[field] || '').toString();
    if (A < B) return asc ? -1 : 1;
    if (A > B) return asc ? 1 : -1;
    return 0;
  }),
  filterByField: (arr, field, value) => arr.filter(i => String(i[field] || '').includes(String(value))),
  searchMultiField: (arr, q, fields) => arr.filter(item => fields.some(f => String(item[f] || '').toLowerCase().includes(q.toLowerCase()))),
};

context.DOMUtils = {
  show: (el) => { if (el) el.style.display = ''; },
  hide: (el) => { if (el) el.style.display = 'none'; },
};

context.Storage = {
  set: (k, v) => { context.window.localStorage.setItem(k, JSON.stringify(v)); },
  get: (k, def = null) => { const item = context.window.localStorage.getItem(k); return item ? JSON.parse(item) : def; },
  remove: (k) => { context.window.localStorage.removeItem(k); },
  clear: () => { context.window.localStorage.clear(); },
};

context.BORDERO_CONFIG = {
  CACHE_KEY_CURRENT_SERATA: 'bordero_currentSerata',
  CACHE_KEY_BRANI: 'bordero_brani',
  ITEMS_PER_PAGE: 50,
};

context.dataLoader = {
  _current: null,
  async initialize() { return Promise.resolve(); },
  async loadBrani() {
    return [
      { id: '1', titolo: 'A', flag: '' },
      { id: '2', titolo: 'B', flag: '' },
      { id: '3', titolo: 'C', flag: '' },
      { id: '4', titolo: 'D', flag: '' },
      { id: '5', titolo: 'E', flag: '' },
    ];
  },
  async loadDJ() { return []; },
  async loadComuni() { return []; },
  getCurrentSerata() { return this._current; },
  saveCurrentSerata(meta, brani) { this._current = { metadata: meta, brani, savedAt: new Date().toISOString() }; return this._current; },
  archiveCurrentSerata(meta, brani) { return this.saveCurrentSerata(meta, brani); },
  newSerata() { this._current = null; },
};

const scriptContent = fs.readFileSync('Bordero/pages/bordero.js', 'utf8');
vm.createContext(context);
vm.runInContext(scriptContent, context);

const BaseManager = context.BorderoTableManager;
BaseManager.prototype.init = function initStub() {
  this.allBrani = [
    { id: '1', titolo: 'A', flag: '', originalIndex: 0 },
    { id: '2', titolo: 'B', flag: '', originalIndex: 1 },
    { id: '3', titolo: 'C', flag: '', originalIndex: 2 },
    { id: '4', titolo: 'D', flag: '', originalIndex: 3 },
    { id: '5', titolo: 'E', flag: '', originalIndex: 4 },
  ];
  this.filteredBrani = [...this.allBrani];
  this.displayedBrani = [];
  this.currentSort = null;
  this.currentSortDirection = 'asc';
  this.currentFilters = {};
  this.currentSearch = '';
  this.searchMode = 'general';
  this.currentPage = 1;
  this.itemsPerPage = context.BORDERO_CONFIG.ITEMS_PER_PAGE;
  this.lastActionTime = null;
  this.serata = { dj: '', data: '', luogo: '', evento: '' };
};

const manager = new BaseManager();
manager.markAsCompleted('2');
manager.markAsCompleted('4');
manager.moveExecutedToBottom();

const movedOrder = manager.allBrani.map(b => b.id);
console.log('After moveExecutedToBottom:', movedOrder);
if (JSON.stringify(movedOrder) !== JSON.stringify(['1','3','5','2','4'])) {
  throw new Error(`Unexpected order after moveExecutedToBottom: ${movedOrder.join(',')}`);
}

const flags = manager.allBrani.map(b => ({ id: b.id, flag: b.flag }));
console.log('Flags after moveExecutedToBottom:', flags);
if (!flags.some(f => f.id === '2' && f.flag === 'X')) {
  throw new Error('Completed track was not preserved');
}

console.log('TEST PASSED: Executed tracks move to the bottom as expected');
