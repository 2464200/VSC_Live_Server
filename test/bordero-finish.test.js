const fs = require('fs');
const vm = require('vm');

(async () => {
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
  CustomEvent: class CustomEvent {
    constructor(type, options = {}) {
      this.type = type;
      this.detail = options.detail;
    }
  },
  Event: class Event {
    constructor(type) {
      this.type = type;
    }
  },
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
  'next-coreo': createElement(),
  'brani-tbody': createElement(),
  'empty-state': createElement(),
  'stat-total': createElement(),
  'stat-completed': createElement(),
  'stat-pending': createElement(),
  'stat-requested': createElement(),
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
context.window.CustomEvent = context.CustomEvent;
context.window.Event = context.Event;
context.window.dispatchEvent = () => {};
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

const titleVisibilityUtils = fs.readFileSync('Bordero/js/title-visibility-utils.js', 'utf8');
const scriptContent = fs.readFileSync('Bordero/pages/bordero.js', 'utf8');
vm.createContext(context);
vm.runInContext(titleVisibilityUtils, context);
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
manager.allBrani.find((brano) => brano.id === '2').next_selected = true;
manager.markAsCompleted('2');
manager.allBrani.find((brano) => brano.id === '4').next_selected = true;
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

const nextSelectionManager = new BaseManager();
nextSelectionManager.init();
nextSelectionManager.toggleNextCoreoSelection('3');
const selectedAfterFirstPick = nextSelectionManager.getActiveNextSelectionId();
const payloadAfterFirstPick = context.Storage.get('bordero_next_coreo_selection', null);
console.log('Selected after first pick:', selectedAfterFirstPick, payloadAfterFirstPick);
if (selectedAfterFirstPick !== '3') {
  throw new Error(`Expected active NEXT id to be 3 after selection, got ${selectedAfterFirstPick}`);
}
if (!payloadAfterFirstPick || String(payloadAfterFirstPick.id) !== '3') {
  throw new Error('NEXT selection payload was not stored correctly');
}
if (String(nextSelectionManager.allBrani[0].id) !== '3') {
  throw new Error('Expected selected NEXT track to be ordered first after selection');
}

nextSelectionManager.toggleNextCoreoSelection('3');
const selectedAfterToggleOff = nextSelectionManager.getActiveNextSelectionId();
const payloadAfterToggleOff = context.Storage.get('bordero_next_coreo_selection', null);
console.log('Selected after deselect:', selectedAfterToggleOff, payloadAfterToggleOff);
if (selectedAfterToggleOff !== null) {
  throw new Error(`Expected active NEXT id to be null after deselection, got ${selectedAfterToggleOff}`);
}
if (payloadAfterToggleOff !== null) {
  throw new Error('NEXT payload should be removed after deselection');
}

const numericTitleManager = new BaseManager();
numericTitleManager.init();
numericTitleManager.allBrani = [
  { id: '001', titolo: '101', flag: '', originalIndex: 0 },
];
numericTitleManager.filteredBrani = [...numericTitleManager.allBrani];
context.Storage.clear();
numericTitleManager.toggleNextCoreoSelection('001');

const numericTitlePayload = context.Storage.get('bordero_next_coreo_selection', null);
if (!numericTitlePayload || numericTitlePayload.id !== '001') {
  throw new Error('NEXT payload did not preserve the leading-zero choreography id');
}
if (numericTitlePayload.title !== '101' || numericTitlePayload.nextValue !== '101') {
  throw new Error(`Numeric choreography title was not preserved: ${JSON.stringify(numericTitlePayload)}`);
}

context.Storage.set('bordero_next_coreo_selection', {
  id: '1',
  title: '',
  nextValue: '',
});
numericTitleManager.allBrani[0].next_selected = false;
numericTitleManager.filteredBrani[0].next_selected = false;
numericTitleManager.restoreNextCoreoSelection();
if (numericTitleManager.getActiveNextSelectionId() !== '001') {
  throw new Error('NEXT selection was not restored for equivalent IDs 001 and 1');
}

const displayScript = fs.readFileSync('Bordero/pages/display.js', 'utf8');
context.window.addEventListener = () => {};
vm.runInContext(displayScript, context);

const overlayClasses = new Set();
const overlayAttributes = {};
const announcementOverlay = {
  classList: {
    add(name) { overlayClasses.add(name); },
    remove(name) { overlayClasses.delete(name); },
  },
  setAttribute(name, value) { overlayAttributes[name] = value; },
  get offsetWidth() { return 1; },
};
const announcementTitle = { textContent: '' };
elements['next-coreo-announcement'] = announcementOverlay;
elements['next-coreo-announcement-title'] = announcementTitle;

const originalSetTimeout = context.setTimeout;
const originalClearTimeout = context.clearTimeout;
let nextTimerId = 1;
const activeTimers = new Set();
context.setTimeout = () => {
  const timerId = nextTimerId++;
  activeTimers.add(timerId);
  return timerId;
};
context.clearTimeout = (timerId) => activeTimers.delete(timerId);

const displayMonitor = vm.runInContext('Object.create(DisplayMonitor.prototype)', context);
displayMonitor.nextCoreoSelectionStorageKey = 'bordero_next_coreo_selection';
displayMonitor.lastNextCoreoAnnouncementId = null;
displayMonitor.nextCoreoAnnouncementTimer = null;
let fallbackFetchCount = 0;
context.fetch = async () => {
  fallbackFetchCount += 1;
  return { ok: true, text: async () => ',CSV FALLBACK' };
};

context.Storage.clear();
await displayMonitor.loadNextCoreo({ announce: true });
if (overlayClasses.has('is-active') || overlayAttributes['aria-hidden'] !== 'true') {
  throw new Error('Overlay appeared without an explicit NEXT checkbox selection');
}
if (context.document.getElementById('next-coreo').textContent !== '--' || fallbackFetchCount !== 0) {
  throw new Error('Display used a CSV fallback without an explicit NEXT selection');
}

context.Storage.set('bordero_next_coreo_selection', { title: '101' });
await displayMonitor.loadNextCoreo({ announce: true });
if (overlayClasses.has('is-active')) {
  throw new Error('Overlay appeared for a cloud-style title without a NEXT checkbox source');
}

context.Storage.set('bordero_next_coreo_selection', {
  id: '001',
  title: '101',
  nextValue: '101',
  timestamp: 1001,
  source: 'next-checkbox',
});
await displayMonitor.loadNextCoreo({ announce: true });
if (!overlayClasses.has('is-active') || overlayAttributes['aria-hidden'] !== 'false') {
  throw new Error('Overlay did not activate for an explicit NEXT checkbox selection');
}
if (announcementTitle.textContent !== '101') {
  throw new Error(`Overlay showed the wrong numeric title: ${announcementTitle.textContent}`);
}

context.Storage.remove('bordero_next_coreo_selection');
await displayMonitor.loadNextCoreo({ announce: true });
if (overlayClasses.has('is-active') || overlayAttributes['aria-hidden'] !== 'true') {
  throw new Error('Overlay was not dismissed immediately after NEXT was deselected');
}
if (displayMonitor.nextCoreoAnnouncementTimer !== null || activeTimers.size !== 0) {
  throw new Error('Overlay dismissal did not cancel its pending timeout');
}
context.setTimeout = originalSetTimeout;
context.clearTimeout = originalClearTimeout;

console.log('TEST PASSED: Executed tracks move to the bottom as expected');
console.log('TEST PASSED: NEXT selection lifecycle is stable and persisted');
console.log('TEST PASSED: Leading-zero ID and numeric title are preserved');
console.log('TEST PASSED: Announcement requires explicit NEXT and dismisses on deselection');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
