const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM } = require('jsdom');

const read = (file) => fs.readFileSync(file, 'utf8');
const copy = (value) => JSON.parse(JSON.stringify(value));
const tick = () => new Promise((resolve) => setImmediate(resolve));
const waitForClick = () => new Promise((resolve) => setTimeout(resolve, 250));
const activeSeason = '2026-2027';
const lesson = (branoId, week, level = 'BASE') => ({ branoId, week, level });
const catalog = [
  ['001', 'Alpha', 'BASE', 'COPPIA', 'A', '2', ''],
  ['002', 'Bravo', 'INTERMEDIO', 'COPPIA', 'B', '', ''],
  ['003', 'Charlie', 'BASE', 'COPPIA', 'A', '', ''],
  ['004', 'Delta', 'BASE', 'CERCHIO', 'A', '', 'X'],
  ['005', 'Echo', 'BASE', 'COPPIA', 'A', '', ''],
  ['006', 'Foxtrot', 'BASE', 'COPPIA', 'A', '', '']
].map(([id, titolo, info_livello, info_coreo_1, coreografo, richieste, flag], originalIndex) => ({
  id, titolo, info_livello, info_coreo_1, coreografo, richieste, flag, originalIndex, autore: 'Autore'
}));
const curriculum = () => ({
  activeSeason,
  seasons: {
    [activeSeason]: { id: activeSeason, label: '2026/2027', records: [
      lesson('001', 2), lesson('001', 10, 'INTERMEDIO'), lesson('002', 10, 'INTERMEDIO'),
      lesson('003', 1), lesson('004', 2), lesson('006', 21)
    ] },
    '2025-2026': { id: '2025-2026', label: '2025/2026', records: [lesson('001', 50), lesson('005', 48)] }
  }
});

async function harness(t) {
  const dom = new JSDOM(read('Bordero/pages/bordero.html'), {
    url: 'http://localhost:5500/Bordero/pages/bordero.html', runScripts: 'outside-only'
  });
  t.after(() => dom.window.close());
  const { window } = dom;
  window.console.log = () => {};
  if (window.document.readyState === 'loading') {
    await new Promise((resolve) => window.document.addEventListener('DOMContentLoaded', resolve, { once: true }));
  }
  let state = curriculum();
  window.choreoProgramStore = { getState: () => copy(state), load: async () => copy(state), startPolling() {} };
  window.dataLoader = { loadBrani: async () => copy(catalog), getCurrentSerata: () => null };
  window.eval([
    read('Bordero/js/config.js'), read('Bordero/js/utils.js'),
    'Toast.show = () => {};',
    read('Bordero/js/title-visibility-utils.js'), read('Bordero/js/video-only-brani.js'),
    read('Bordero/pages/bordero.js')
  ].join('\n'));
  window.BorderoTableManager.prototype.init = () => {};
  const manager = new window.BorderoTableManager();
  manager.allBrani = copy(catalog);
  manager.filteredBrani = [...manager.allBrani];
  manager.setupColumnHeaderSorting();
  manager.setupFilterValuePicker();
  manager.bindFilterPopupButton('btn-filter-settimana', 'course_week', 'SETTIMANA');
  manager.setupCourseProgramFilter();
  await tick();
  const visibleIds = () => Array.from(manager.filteredBrani, (brano) => brano.id);
  const column = () => window.document.querySelector('th[data-col="course_week"]');
  return { window, manager, visibleIds, column, setState: (value) => {
    state = copy(value);
    window.dispatchEvent(new window.CustomEvent('bordero:choreo-program-updated'));
  } };
}

test('SETTIMANA is placed between INFO LIVELLO and INFO COREO 1 and derives only active-season weeks', async (t) => {
  const h = await harness(t);
  const header = h.column();
  assert.equal(header.previousElementSibling.dataset.col, 'info_livello');
  assert.equal(header.nextElementSibling.dataset.col, 'info_coreo_1');
  const cell = h.window.document.querySelector('[data-brano-id="001"] .col-settimana');
  assert.equal(cell.textContent, '2, 10');
  assert.equal(cell.previousElementSibling.className, 'col-livello');
  assert.equal(cell.nextElementSibling.className, 'col-coreo-1');
  assert.match(cell.title, /BASE · settimana 2/);
  assert.match(cell.title, /INTERMEDIO · settimana 10/);
  assert.equal(h.window.document.querySelector('[data-brano-id="005"] .col-settimana').textContent, '-');
  assert.equal(h.window.document.querySelector('#brani-tbody tr').children.length, h.window.document.querySelectorAll('#brani-table th').length);
  assert.deepEqual(Array.from(h.manager.getUniqueFieldValues('course_week')), ['1', '2', '10', '21']);
  const level = h.window.document.getElementById('course-board-level');
  level.value = 'INTERMEDIO';
  level.dispatchEvent(new h.window.Event('change'));
  assert.equal(h.window.document.querySelector('[data-brano-id="001"] .col-settimana').textContent, '10');
  assert.deepEqual(h.visibleIds(), ['001', '002']);
  assert.deepEqual(Array.from(h.manager.getUniqueFieldValues('course_week')), ['10']);
});

test('SETTIMANA header follows click toggling, exclusive sort, keyboard and double-click reset rules', async (t) => {
  const h = await harness(t);
  const { manager, window } = h;
  manager.currentPage = 2;
  h.column().click();
  await waitForClick();
  assert.equal(manager.currentSort, 'course_week');
  assert.equal(manager.currentSortDirection, 'asc');
  assert.equal(manager.currentPage, 1);
  assert.deepEqual(h.visibleIds(), ['005', '003', '004', '001', '002', '006']);
  assert.equal(h.column().classList.contains('active-sort'), true);
  h.column().click();
  await waitForClick();
  assert.equal(manager.currentSortDirection, 'desc');
  assert.deepEqual(h.visibleIds(), ['006', '002', '001', '004', '003', '005']);
  window.document.querySelector('th[data-col="info_coreo_1"]').dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter' }));
  assert.equal(manager.currentSort, 'info_coreo_1');
  assert.equal(h.column().classList.contains('active-sort'), false);
  h.column().dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter' }));
  assert.equal(manager.currentSortDirection, 'asc');
  h.column().dispatchEvent(new window.KeyboardEvent('keydown', { key: ' ' }));
  assert.equal(manager.currentSortDirection, 'desc');
  h.column().click();
  h.column().dispatchEvent(new window.MouseEvent('dblclick', { bubbles: true }));
  await waitForClick();
  assert.equal(manager.currentSort, null);
  assert.equal(manager.headerSortClickTimers.size, 0);
  assert.deepEqual(h.visibleIds(), catalog.map((brano) => brano.id));
});

test('SETTIMANA exact filter matches any planned week and coexists with existing filters, sort and reset', async (t) => {
  const h = await harness(t);
  const { window, manager } = h;
  const button = window.document.getElementById('btn-filter-settimana');
  button.click();
  await waitForClick();
  Array.from(window.document.querySelectorAll('.filter-picker-option')).find((item) => item.textContent === '10').click();
  assert.deepEqual(h.visibleIds(), ['001', '002']);
  assert.equal(button.classList.contains('active'), true);
  manager.currentFilters.info_livello = { mode: 'exactValue', value: 'BASE' };
  manager.currentFilters.info_coreo_1 = { mode: 'exactValue', value: 'COPPIA' };
  manager.currentFilters.coreografo = { mode: 'exactValue', value: 'A' };
  manager.currentFilters.richieste = { mode: 'richiesteNonZero' };
  manager.currentFilters.autore = { mode: 'exactValue', value: 'Autore' };
  manager.currentFilters.videoclip = { mode: 'hasValue' };
  manager.clearColumnFiltersExcept('id');
  manager.clearVideoClipPresenceFilterOnOtherHeader('id');
  assert.equal(manager.currentFilters.autore, undefined);
  assert.equal(manager.currentFilters.videoclip, undefined);
  for (const field of ['course_week', 'info_livello', 'info_coreo_1', 'coreografo', 'richieste']) assert.ok(manager.currentFilters[field]);
  manager.applyFilters();
  assert.deepEqual(h.visibleIds(), ['001']);
  window.document.querySelector('th[data-col="id"]').dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter' }));
  assert.deepEqual(h.visibleIds(), ['001']);
  assert.equal(manager.currentFilters.course_week.value, '10');
  button.click();
  assert.equal(manager.currentFilters.course_week, undefined);
  assert.equal(button.classList.contains('active'), false);
  manager.resetFilters({ silent: true });
  manager.currentFilters.course_week = { mode: 'exactValue', value: '1' };
  manager.applyFilters();
  assert.deepEqual(h.visibleIds(), ['003']);
  manager.resetFilters({ sortById: true, silent: true });
  assert.deepEqual(h.visibleIds(), catalog.map((brano) => brano.id));
  assert.equal(Object.keys(manager.currentFilters).length, 0);
  manager.togglePresenceFilter('course_week');
  assert.equal(h.visibleIds().includes('005'), false);
  manager.resetFilters({ silent: true });
  manager.currentSearch = '21';
  manager.applyFilters();
  assert.deepEqual(h.visibleIds(), ['006']);
});

test('week sorting preserves NEXT priority and executed-bottom mode without restoring filtered-out NEXT', async (t) => {
  const h = await harness(t);
  const { manager } = h;
  manager.allBrani.find((brano) => brano.id === '002').next_selected = true;
  manager.keepExecutedAtBottom = true;
  manager.sortBy('course_week', true);
  assert.deepEqual(h.visibleIds(), ['002', '005', '003', '001', '006', '004']);
  manager.sortBy('course_week');
  assert.deepEqual(h.visibleIds(), ['002', '006', '001', '003', '005', '004']);
  manager.currentFilters.course_week = { mode: 'exactValue', value: '1' };
  manager.applyFilters();
  assert.deepEqual(h.visibleIds(), ['003']);
  assert.equal(manager.allBrani.find((brano) => brano.id === '002').next_selected, true);
  assert.equal(manager.allBrani.find((brano) => brano.id === '004').flag, 'X');
});

test('week values, selected sort and filter stay current after curriculum edits and catalog refresh', async (t) => {
  const h = await harness(t);
  const { manager, window } = h;
  manager.sortBy('course_week', true);
  const edited = curriculum();
  edited.seasons[activeSeason].records = [lesson('001', 30), lesson('002', 2), lesson('003', 1), lesson('004', 2), lesson('006', 21)];
  h.setState(edited);
  assert.equal(manager.currentSort, 'course_week');
  // A parità di settimana il gestore comune conserva l'ordine precedente.
  assert.deepEqual(h.visibleIds(), ['005', '003', '004', '002', '006', '001']);
  manager.currentFilters.course_week = { mode: 'exactValue', value: '30' };
  manager.applyFilters();
  manager.refreshVideoClipAvailability = async () => {};
  manager.populateDJSelect = async () => {};
  manager.setupLocationPicker = async () => {};
  await manager.refreshFromCurrentData();
  assert.deepEqual(h.visibleIds(), ['001']);
  assert.equal(window.document.querySelector('[data-brano-id="001"] .col-settimana').textContent, '30');
  manager.resetFilters({ silent: true });
  h.setState({ ...edited, activeSeason: '2025-2026' });
  assert.equal(window.document.querySelector('[data-brano-id="001"] .col-settimana').textContent, '50');
  assert.equal(window.document.querySelector('[data-brano-id="005"] .col-settimana').textContent, '48');
  assert.equal(window.document.querySelector('[data-brano-id="002"] .col-settimana').textContent, '-');
  h.setState({ activeSeason: '', seasons: {} });
  assert.equal(Array.from(window.document.querySelectorAll('.col-settimana')).slice(1).every((cell) => cell.textContent === '-'), true);
});
