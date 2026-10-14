const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM } = require('jsdom');

const read = (file) => fs.readFileSync(file, 'utf8');
const copy = (value) => JSON.parse(JSON.stringify(value));
const seasonId = '2026-2027';
const ids = (...numbers) => numbers.map((number) => String(number).padStart(3, '0'));
const allIds = ids(...Array.from({ length: 14 }, (_, index) => index + 1));
const catalog = allIds.map((id, originalIndex) => ({
  id, originalIndex, titolo: `Match ${id}`, info_livello: 'BASE', coreografo: 'A',
  autore: 'Rita', richieste: '2', videoclip: '🎬', flag: '',
  info_coreo_1: 'COPPIA', info_coreo_2: 'LINEA', collaboratori: 'Team', next_coreo: ''
}));
Object.assign(catalog[2], { richieste: '0' });
Object.assign(catalog[3], { videoclip: '' });
Object.assign(catalog[4], { autore: 'Lino' });
Object.assign(catalog[5], { coreografo: 'B' });
Object.assign(catalog[6], { info_livello: 'INTERMEDIO' });
Object.assign(catalog[9], { titolo: 'Other' });
Object.assign(catalog[10], { titolo: 'Empty', info_livello: null, coreografo: '-', autore: '', richieste: '   ', videoclip: '-' });
Object.assign(catalog[11], { titolo: 'Zero', richieste: '0,0' });
Object.assign(catalog[12], { titolo: 'Decimal comma', richieste: '0,5' });
Object.assign(catalog[13], { titolo: 'Decimal point', richieste: '0.50' });
const records = catalog.flatMap((brano) => {
  const number = Number(brano.id);
  if ([8, 11].includes(number)) return [];
  const weeks = number === 2 ? [5] : number === 9 ? [20] : [5, 20];
  return weeks.map((week) => ({ branoId: brano.id, level: brano.info_livello, week }));
});
const curriculum = { activeSeason: seasonId, seasons: { [seasonId]: { id: seasonId, label: '2026/2027', records } } };

async function harness(t) {
  const dom = new JSDOM(read('Bordero/pages/bordero.html'), {
    url: 'http://localhost:5500/Bordero/pages/bordero.html', runScripts: 'outside-only'
  });
  const { window } = dom;
  window.console.log = () => {};
  if (window.document.readyState === 'loading') {
    await new Promise((resolve) => window.document.addEventListener('DOMContentLoaded', resolve, { once: true }));
  }
  window.choreoProgramStore = { getState: () => copy(curriculum), load: async () => copy(curriculum), startPolling() {} };
  window.dataLoader = { loadBrani: async () => copy(catalog), getCurrentSerata: () => null };
  window.eval([
    read('Bordero/js/config.js'), read('Bordero/js/utils.js'), 'Toast.show = () => {};',
    read('Bordero/js/title-visibility-utils.js'), read('Bordero/js/video-only-brani.js'),
    read('Bordero/pages/bordero.js')
  ].join('\n'));
  const proto = window.BorderoTableManager.prototype;
  for (const method of ['init', 'setupDeselectionConfirmModal', 'setupMusicMatchModal', 'setupVirtualDjConsolePolling', 'updateConsoleStatus']) proto[method] = () => {};
  const manager = new window.BorderoTableManager();
  manager.allBrani = copy(catalog);
  manager.filteredBrani = [...manager.allBrani];
  manager.setupEventListeners();
  manager.setupCourseProgramFilter();
  await new Promise((resolve) => setImmediate(resolve));
  t.after(() => {
    manager.filterButtonClickTimers.forEach(clearTimeout);
    manager.headerSortClickTimers.forEach(clearTimeout);
    manager.sortButtonClickTimers.forEach(clearTimeout);
    dom.window.close();
  });
  const visible = () => Array.from(manager.filteredBrani, (brano) => brano.id).sort();
  const open = async (buttonId) => {
    window.document.getElementById(buttonId).click();
    await new Promise((resolve) => setTimeout(resolve, 250));
    assert.equal(window.document.getElementById('filter-picker-modal').hidden, false);
  };
  const choose = (text) => {
    const option = Array.from(window.document.querySelectorAll('.filter-picker-option')).find((button) => button.textContent === text);
    assert.ok(option, `Missing option ${text}`);
    option.click();
  };
  return { manager, window, visible, open, choose };
}

const popupCases = [
  ['LIVELLO', 'btn-filter-coreografia', 'info_livello', 'BASE', allIds.filter((id) => !ids(7, 11).includes(id)), ids(11)],
  ['SETTIMANA', 'btn-filter-settimana', 'course_week', '20', allIds.filter((id) => !ids(2, 8, 11).includes(id)), ids(8, 11)],
  ['COREOGRAFO', 'btn-filter-livello', 'coreografo', 'A', allIds.filter((id) => !ids(6, 11).includes(id)), ids(11)],
  ['AUTORE', 'btn-filter-altro', 'autore', 'Rita', allIds.filter((id) => !ids(5, 11).includes(id)), ids(11)],
  ['RICHIESTE', 'btn-filter-richieste', 'richieste', '0.5', ids(13, 14), ids(11)]
];
for (const [label, buttonId, field, value, expected, emptyIds] of popupCases) {
  test(`${label}: exact selection, reopen, VUOTI and TUTTI affect only that filter`, async (t) => {
    const h = await harness(t);
    await h.open(buttonId);
    h.choose(value);
    assert.deepEqual(h.visible(), expected);
    assert.equal(h.window.document.getElementById(buttonId).getAttribute('aria-pressed'), 'true');
    await h.open(buttonId);
    assert.equal(h.manager.currentFilters[field].value, value);
    const selected = h.window.document.querySelector('.filter-picker-option[aria-pressed="true"]');
    assert.equal(selected.textContent, value);
    h.window.document.querySelector('[data-filter-special="empty-value"]').click();
    assert.deepEqual(h.visible(), emptyIds);
    await h.open(buttonId);
    h.window.document.querySelector('.is-clear').click();
    assert.deepEqual(h.visible(), allIds);
    assert.equal(h.manager.currentFilters[field], undefined);
    assert.equal(h.window.document.getElementById(buttonId).getAttribute('aria-pressed'), 'false');
  });
}

test('RICHIESTE numeric zeros, decimal formats and special options have consistent meanings', async (t) => {
  const h = await harness(t);
  for (const [option, expected] of [
    ['0', ids(3, 12)], ['0.5', ids(13, 14)],
    ['NON RICHIESTE', ids(3, 11, 12)],
    ['RICHIESTE', allIds.filter((id) => !ids(3, 11, 12).includes(id))]
  ]) {
    await h.open('btn-filter-richieste');
    h.choose(option);
    assert.deepEqual(h.visible(), expected, option);
  }
  h.manager.allBrani[0].richieste = 'SI';
  await h.open('btn-filter-richieste');
  h.choose('SI');
  assert.deepEqual(h.visible(), ids(1));
});

test('all 256 combinations intersect the active criteria regardless of their activation order', async (t) => {
  const h = await harness(t);
  // Le combinazioni verificano la selezione; il DOM e la paginazione hanno test dedicati.
  h.manager.renderTable = () => {};
  h.manager.updateStats = () => {};
  const criteria = [
    ['info_livello', { mode: 'exactValue', value: 'BASE' }, allIds.filter((id) => !ids(7, 11).includes(id))],
    ['course_week', { mode: 'exactValue', value: '20' }, allIds.filter((id) => !ids(2, 8, 11).includes(id))],
    ['coreografo', { mode: 'exactValue', value: 'A' }, allIds.filter((id) => !ids(6, 11).includes(id))],
    ['autore', { mode: 'exactValue', value: 'Rita' }, allIds.filter((id) => !ids(5, 11).includes(id))],
    ['richieste', { mode: 'richiesteNonZero' }, allIds.filter((id) => !ids(3, 11, 12).includes(id))],
    ['videoclip', { mode: 'hasValue' }, allIds.filter((id) => !ids(4, 11).includes(id))],
    ['curriculum', null, allIds.filter((id) => !ids(7, 8, 9, 11).includes(id))],
    ['search', null, ids(1, 2, 3, 4, 5, 6, 7, 8, 9)]
  ];
  for (let mask = 0; mask < 256; mask++) {
    const active = criteria.filter((_, index) => mask & (1 << index));
    const expected = allIds.filter((id) => active.every(([, , matchingIds]) => matchingIds.includes(id)));
    for (const order of [active, [...active].reverse()]) {
      h.manager.currentFilters = {};
      h.manager.courseSelection = { seasonId, level: '', week: 52 };
      h.manager.currentSearch = '';
      for (const [field, config] of order) {
        if (field === 'curriculum') h.manager.courseSelection = { seasonId, level: 'BASE', week: 10 };
        else if (field === 'search') h.manager.currentSearch = 'Match';
        else h.manager.currentFilters[field] = copy(config);
      }
      h.manager.applyFilters();
      assert.deepEqual(h.visible(), expected, `Combination ${mask}`);
    }
  }
});

test('a UI filter chain survives sorts, individual changes and removals, NEXT and refresh', async (t) => {
  const h = await harness(t);
  const { manager, window } = h;
  const steps = [
    ['btn-filter-coreografia', 'BASE'], ['btn-filter-altro', 'Rita'],
    ['btn-filter-livello', 'A'], ['btn-filter-richieste', 'RICHIESTE'],
    ['btn-filter-settimana', '20']
  ];
  for (const [button, option] of steps) { await h.open(button); h.choose(option); }
  const videoHeader = window.document.querySelector('th[data-col="videoclip"]');
  videoHeader.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter' }));
  const filtersBefore = copy(manager.currentFilters);
  const level = window.document.getElementById('course-board-level');
  level.value = 'BASE';
  level.dispatchEvent(new window.Event('change'));
  const week = window.document.getElementById('course-board-week');
  week.value = '10';
  week.dispatchEvent(new window.Event('change'));
  const search = window.document.getElementById('search-box');
  search.value = '  match  ';
  search.dispatchEvent(new window.Event('input'));
  assert.deepEqual(h.visible(), ids(1));
  manager.allBrani.find((brano) => brano.id === '005').next_selected = true;
  manager.keepExecutedAtBottom = true;
  manager.applyFilters();
  assert.deepEqual(h.visible(), ids(1));
  for (const key of ['Enter', ' ']) {
    window.document.querySelector('th[data-col="id"]').dispatchEvent(new window.KeyboardEvent('keydown', { key }));
    assert.deepEqual(copy(manager.currentFilters), filtersBefore);
    assert.deepEqual(h.visible(), ids(1));
    for (const field of Object.keys(filtersBefore)) {
      assert.equal(window.document.querySelector(`th[data-col="${field}"]`).classList.contains('active-filter'), true);
    }
  }
  manager.refreshVideoClipAvailability = async () => {};
  manager.videoClipAvailableMap = new Map(catalog.filter((brano) => brano.videoclip === '🎬').map((brano) => [brano.id, 'file.mp4']));
  manager.populateDJSelect = async () => {};
  manager.setupLocationPicker = async () => {};
  await manager.refreshFromCurrentData();
  assert.deepEqual(copy(manager.currentFilters), filtersBefore);
  assert.deepEqual(h.visible(), ids(1));
  await h.open('btn-filter-altro');
  h.choose('Lino');
  assert.deepEqual(h.visible(), ids(5));
  await h.open('btn-filter-altro');
  window.document.querySelector('.is-clear').click();
  assert.deepEqual(h.visible(), ids(1, 5));
  assert.equal(manager.currentFilters.videoclip.mode, 'hasValue');
  videoHeader.dispatchEvent(new window.KeyboardEvent('keydown', { key: ' ' }));
  assert.deepEqual(h.visible(), ids(1, 4, 5));
  assert.equal(manager.currentFilters.course_week.value, '20');
});

test('search modes and RESET RICERCA preserve filters; RESET FILTRI + ID removes the entire chain', async (t) => {
  const h = await harness(t);
  const { manager, window } = h;
  manager.currentFilters.autore = { mode: 'exactValue', value: 'Rita' };
  const search = window.document.getElementById('search-box');
  search.value = 'Match';
  search.dispatchEvent(new window.Event('input'));
  for (const [button, expected] of [
    ['btn-search-title', ids(1, 2, 3, 4, 6, 7, 8, 9)],
    ['btn-search-id', []], ['btn-search-general', ids(1, 2, 3, 4, 6, 7, 8, 9)]
  ]) {
    window.document.getElementById(button).click();
    assert.deepEqual(h.visible(), expected);
    assert.equal(manager.currentFilters.autore.value, 'Rita');
  }
  window.document.getElementById('btn-reset-filters').click();
  assert.equal(search.value, '');
  assert.equal(manager.currentFilters.autore.value, 'Rita');
  assert.deepEqual(h.visible(), allIds.filter((id) => !ids(5, 11).includes(id)));
  manager.currentFilters.course_week = { mode: 'emptyValue' };
  manager.currentFilters.videoclip = { mode: 'hasValue' };
  manager.courseSelection = { seasonId, level: 'BASE', week: 10 };
  manager.currentSearch = 'Match';
  manager.sortBy('course_week', 'desc');
  manager.applyFilters();
  window.document.getElementById('btn-reset-filters-stats').click();
  assert.deepEqual(copy(manager.currentFilters), {});
  assert.equal(manager.currentSearch, '');
  assert.equal(manager.courseSelection.level, '');
  assert.equal(manager.courseSelection.week, 53);
  assert.equal(manager.currentSort, 'id');
  assert.equal(manager.currentSortDirection, 'asc');
  assert.deepEqual(Array.from(manager.filteredBrani, (brano) => brano.id), allIds);
  assert.equal(window.document.querySelectorAll('th.active-filter,.btn-filter.active').length, 0);
});

test('no-result chains clear stale rows and pagination; removing one filter restores the others', async (t) => {
  const h = await harness(t);
  const { manager, window } = h;
  manager.itemsPerPage = 2;
  manager.applyFilters();
  assert.equal(manager.displayedBrani.length, 2);
  manager.currentFilters.autore = { mode: 'exactValue', value: 'Rita' };
  manager.currentFilters.info_livello = { mode: 'exactValue', value: 'NON ESISTENTE' };
  manager.applyFilters();
  assert.deepEqual(h.visible(), []);
  assert.equal(manager.displayedBrani.length, 0);
  assert.equal(window.document.querySelectorAll('#brani-tbody tr').length, 0);
  for (const id of ['btn-first-page', 'btn-prev-page', 'btn-next-page', 'btn-last-page']) assert.equal(window.document.getElementById(id).disabled, true);
  manager.clearSingleColumnFilter('info_livello', 'LIVELLO');
  assert.deepEqual(h.visible(), allIds.filter((id) => !ids(5, 11).includes(id)));
  manager.currentSearch = 'undefined';
  manager.applyFilters();
  assert.deepEqual(h.visible(), []);
});
