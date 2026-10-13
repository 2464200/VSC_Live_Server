const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM } = require('jsdom');

const read = (file) => fs.readFileSync(file, 'utf8');
const copy = (value) => JSON.parse(JSON.stringify(value));
const tick = () => new Promise((resolve) => setImmediate(resolve));
const year = '2026-2027';
const season = (records = []) => ({ id: year, label: '2026/2027', records });
const record = (id, level = 'BASE', week = 1) => ({ id: `lesson-${id}`, branoId: id, level, week, trackTitle: `Coreografia ${id}`, author: '' });

async function harness(page = false) {
  const dom = new JSDOM(page ? read('Bordero/pages/coreografie-corsi.html') : '<body></body>', {
    url: 'http://localhost:5500/Bordero/pages/coreografie-corsi.html', runScripts: 'outside-only'
  });
  const { window } = dom;
  if (window.document.readyState === 'loading') {
    await new Promise((resolve) => window.document.addEventListener('DOMContentLoaded', resolve, { once: true }));
  }
  let remote = null;
  const writes = [];
  let fetchImpl = async () => ({ ok: true, json: async () => copy(remote) });
  window.fetch = (...args) => fetchImpl(...args);
  window.console.warn = () => {};
  window.eval(read('Bordero/js/choreo-program-store.js'));
  const store = window.choreoProgramStore;
  const authorize = () => {
    window.firebaseCloudClient = {
      authReady: Promise.resolve(), publisherAuth: { currentUser: { email: 'allowed@example.com' } },
      isAuthorizedPublisher: () => true,
      publisherDatabase: { ref: (path) => ({ update: async (updates) => {
        assert.equal(path, 'bordero/dance_curriculum');
        writes.push(copy(updates));
        remote ||= { seasons: {} };
        for (const [key, value] of Object.entries(updates)) {
          if (key.startsWith('seasons/')) {
            const id = key.slice(8);
            if (value === null) delete remote.seasons[id];
            else remote.seasons[id] = copy(value);
          } else remote[key] = value;
        }
      } }) }
    };
  };
  if (page) {
    window.dataLoader = {
      initialize: async () => {},
      loadBrani: async () => ['001', '002', '003', '004'].map((id) => ({ id, titolo: `Coreografia ${id}`, autore: 'Autore' }))
    };
    window.confirm = () => true;
    window.eval(read('Bordero/pages/coreografie-corsi.js'));
    window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
    await tick();
  }
  return { dom, window, store, writes, authorize, setRemote: (value) => { remote = copy(value); }, setFetch: (fn) => { fetchImpl = fn; } };
}

test('offline edits and active season survive polling and browser reload, then sync atomically', async (t) => {
  const h = await harness();
  t.after(() => h.dom.window.close());
  h.setRemote({ activeSeason: year, seasons: { [year]: season([record('001')]) } });
  await h.store.load({ force: true });
  const saved = await h.store.saveSeason(season([record('002')]));
  assert.equal(saved.synced, false);
  await h.store.setActiveSeason(year);
  await h.store.load({ force: true });
  assert.equal(h.store.getState().seasons[year].records[0].branoId, '002');
  const reload = new h.store.constructor();
  assert.equal(reload.getState().seasons[year].records[0].branoId, '002');
  h.authorize();
  await reload.syncAll();
  assert.equal(h.writes.length, 1);
  assert.equal(h.writes[0][`seasons/${year}`].records[0].branoId, '002');
  assert.equal(h.writes[0].activeSeason, year);
  assert.equal(Object.keys(reload.pendingSeasons).length, 0);
});

test('Firebase empty seasons and missing curriculum normalize to usable state', async (t) => {
  const h = await harness();
  t.after(() => h.dom.window.close());
  h.setRemote({ activeSeason: year, seasons: { [year]: { id: year, label: '2026/2027' } } });
  await h.store.load({ force: true });
  assert.equal(h.store.getState().seasons[year].records.length, 0);
  h.setRemote(null);
  await h.store.load({ force: true });
  assert.equal(Object.keys(h.store.getState().seasons).length, 0);
});

test('polling detects record edits even when the root timestamp did not change', async (t) => {
  const h = await harness();
  t.after(() => h.dom.window.close());
  let poll;
  h.window.setInterval = (callback) => { poll = callback; return 1; };
  h.setRemote({ updatedAt: 'same', seasons: { [year]: season([record('001')]) } });
  await h.store.load({ force: true });
  let changed = 0;
  h.store.startPolling(() => { changed += 1; });
  h.setRemote({ updatedAt: 'same', seasons: { [year]: season([record('002')]) } });
  await poll();
  assert.equal(changed, 1);
});

test('a delayed cloud read cannot overwrite a newer acknowledged local save', async (t) => {
  const h = await harness();
  t.after(() => h.dom.window.close());
  let finish;
  h.setFetch(async () => ({ ok: true, json: () => new Promise((resolve) => { finish = resolve; }) }));
  const loading = h.store.load({ force: true });
  await tick();
  h.authorize();
  await h.store.saveSeason(season([record('002')]));
  finish({ seasons: { [year]: season([record('001')]) } });
  await loading;
  assert.equal(h.store.getState().seasons[year].records[0].branoId, '002');
});

test('sync sends edited seasons only, preserving archives changed by another PC', async (t) => {
  const h = await harness();
  t.after(() => h.dom.window.close());
  const archive = { id: '2025-2026', label: '2025/2026', records: [record('003')] };
  h.setRemote({ seasons: { [year]: season(), [archive.id]: archive } });
  await h.store.load({ force: true });
  await h.store.saveSeason(season([record('001')]));
  h.setRemote({ seasons: { [archive.id]: { ...archive, records: [record('004')] } } });
  h.authorize();
  await h.store.syncAll();
  assert.equal(h.writes[0][`seasons/${archive.id}`], undefined);
  assert.equal(h.store.getState().seasons[archive.id].records[0].branoId, '004');
});

async function importText(h, text) {
  Object.defineProperty(h.window.document.getElementById('course-csv-file'), 'files', {
    configurable: true, value: [{ text: async () => text }]
  });
  await h.window.choreoCoursePage.importCsv();
}

test('CSV import creates and selects the correct season with leading-zero IDs; export reimports', async (t) => {
  const h = await harness(true);
  t.after(() => h.dom.window.close());
  const pattern = h.window.document.getElementById('new-season-label').pattern;
  assert.equal(new RegExp(`^(?:${pattern})$`, 'v').test('2026/2027'), true);
  await importText(h, '\uFEFFanno_accademico;livello;settimana;brano_id\r\n2026/2027;BASE;1;001\r\n2026/2027;INTERMEDIO;2;002\r\n');
  assert.equal(h.window.document.getElementById('course-season-select').value, year);
  const state = h.store.getState();
  assert.equal(state.activeSeason, year);
  assert.equal(state.seasons[year].records[0].branoId, '001');
  assert.match(h.window.document.getElementById('course-import-status').textContent, /Importate 2/);
  let exported;
  h.window.choreoCoursePage.download = (_name, text) => { exported = text; };
  h.window.choreoCoursePage.exportSeason();
  await importText(h, exported);
  assert.equal(h.store.getState().seasons[year].records.length, 2);
});

test('invalid CSV cannot replace a saved program: weekly limit, duplicates, years, unknown IDs', async (t) => {
  const h = await harness(true);
  t.after(() => h.dom.window.close());
  const header = 'anno_accademico,livello,settimana,brano_id\n';
  await importText(h, `${header}2026/2027,BASE,1,001`);
  const original = JSON.stringify(h.store.getState());
  let confirmations = 0;
  h.window.confirm = () => { confirmations += 1; return true; };
  for (const rows of [
    ['001', '002', '003', '004'].map((id) => `2026/2027,BASE,1,${id}`).join('\n'),
    '2026/2027,BASE,1,001\n2026/2027,BASE,2,001',
    '2026/2027,BASE,1,001\n2027/2028,BASE,1,002',
    '2026/2027,BASE,1,999',
    '2026/2028,BASE,1,001',
    '2026/2027,BASE,53,001'
  ]) {
    await importText(h, header + rows);
    assert.equal(JSON.stringify(h.store.getState()), original);
    assert.equal(h.window.document.getElementById('course-import-status').classList.contains('is-error'), true);
  }
  assert.equal(confirmations, 0);
});

test('local browser loads a CSV from the program folder and saves exports/models back to that folder', async (t) => {
  const h = await harness(true);
  t.after(() => h.dom.window.close());
  const csv = 'anno_accademico,livello,settimana,brano_id\n2026/2027,BASE,1,001\n';
  const saved = [];
  h.setFetch(async (url, options = {}) => ({ ok: true, status: 200, json: async () => {
    if (options.method === 'POST') {
      const file = JSON.parse(options.body);
      saved.push(file);
      return { ok: true, directory: 'C:\\VSC_PROGRAMMA', filePath: `C:\\VSC_PROGRAMMA\\${file.name}` };
    }
    return { ok: true, directory: 'C:\\VSC_PROGRAMMA', files: [{ name: 'programma.csv' }], name: 'programma.csv', content: csv };
  } }));
  const page = h.window.choreoCoursePage;
  await page.pickCsv();
  assert.equal(h.window.document.getElementById('course-file-picker-panel').hidden, false);
  h.window.document.getElementById('course-file-list').value = 'programma.csv';
  await page.chooseFolderCsv();
  assert.equal(h.window.document.getElementById('course-selected-csv').textContent, 'programma.csv');
  await page.importCsv();
  assert.equal(h.store.getState().seasons[year].records[0].branoId, '001');
  await page.exportSeason();
  await page.downloadTemplate();
  assert.equal(saved[0].name, 'programma-coreografie-2026-2027.csv');
  assert.equal(saved[1].name, 'programma-coreografie-modello.csv');
  assert.match(saved[0].content, /2026\/2027,BASE,1,001/);
  assert.match(h.window.document.getElementById('course-import-status').textContent, /CSV salvato: C:\\VSC_PROGRAMMA/);
});

test('Electron program import/export uses the native file bridge and retains selected file on cancellation', async (t) => {
  const h = await harness(true);
  t.after(() => h.dom.window.close());
  const csv = 'anno_accademico,livello,settimana,brano_id\n2026/2027,BASE,1,001\n';
  let canceled = false;
  const saved = [];
  h.window.electronAPI = { courseProgramFiles: {
    getDirectory: async () => ({ ok: true, directory: 'C:\\VSC_PROGRAMMA' }),
    openCsv: async () => canceled ? { ok: true, canceled: true } : { ok: true, name: 'programma.csv', content: csv },
    saveCsv: async (file) => { saved.push(file); return { ok: true, filePath: `C:\\VSC_PROGRAMMA\\${file.name}` }; }
  } };
  const page = h.window.choreoCoursePage;
  await page.initializeFileDirectory();
  assert.equal(h.window.document.getElementById('course-file-directory').textContent, 'Cartella programma: C:\\VSC_PROGRAMMA');
  await page.pickCsv();
  canceled = true;
  await page.pickCsv();
  assert.equal(page.selectedCsv.name, 'programma.csv');
  await page.importCsv();
  await page.exportSeason();
  await page.downloadTemplate();
  assert.equal(saved.length, 2);
  assert.equal(saved[0].name, 'programma-coreografie-2026-2027.csv');
  assert.equal(saved[1].name, 'programma-coreografie-modello.csv');
});

test('canceling replacement of an existing program CSV does not overwrite it', async (t) => {
  const h = await harness(true);
  t.after(() => h.dom.window.close());
  let attempts = 0;
  h.setFetch(async () => { attempts += 1; return { ok: false, status: 409, json: async () => ({ error: 'Il CSV esiste già.' }) }; });
  h.window.confirm = () => false;
  await h.window.choreoCoursePage.download('programma.csv', 'contenuto', 'text/csv');
  assert.equal(attempts, 1);
});

test('weekly choreography input accepts ID, full name and suggestions while saving catalog IDs', async (t) => {
  const h = await harness(true);
  t.after(() => h.dom.window.close());
  await h.store.saveSeason(season());
  const page = h.window.choreoCoursePage;
  page.render(year);
  const input = h.window.document.getElementById('course-record-song');
  const options = h.window.document.getElementById(input.getAttribute('list'));
  assert.equal(input.tagName, 'INPUT');
  assert.equal(options.options.length, 4);
  input.value = '2';
  input.dispatchEvent(new h.window.Event('change'));
  assert.match(input.value, /^002 · Coreografia 002/);
  h.window.document.getElementById('course-record-level').value = 'BASE';
  await page.saveRecord({ preventDefault() {} });
  assert.equal(h.store.getState().seasons[year].records[0].branoId, '002');
  assert.equal(input.value, '');
  input.value = 'coreografia 001';
  assert.equal(page.selectedSongId(), '001');
  input.value = options.options[2].value;
  assert.equal(page.selectedSongId(), '003');
  h.window.document.querySelector('[data-action="edit"]').click();
  assert.match(input.value, /^002 · Coreografia 002/);
  h.window.document.getElementById('course-record-week').value = '2';
  await page.saveRecord({ preventDefault() {} });
  assert.equal(h.store.getState().seasons[year].records[0].branoId, '002');
  assert.equal(h.store.getState().seasons[year].records[0].week, 2);
});

test('unknown and ambiguous choreography text cannot be saved; choosing a suggestion resolves ambiguity', async (t) => {
  const h = await harness(true);
  t.after(() => h.dom.window.close());
  await h.store.saveSeason(season());
  const page = h.window.choreoCoursePage;
  page.brani[0].titolo = 'Stesso nome';
  page.brani[1].titolo = 'Stesso nome';
  page.populateSongOptions();
  page.render(year);
  const input = h.window.document.getElementById('course-record-song');
  h.window.document.getElementById('course-record-level').value = 'BASE';
  for (const value of ['inesistente', 'Stesso nome']) {
    input.value = value;
    await page.saveRecord({ preventDefault() {} });
    assert.equal(h.store.getState().seasons[year].records.length, 0);
    assert.equal(input.validity.customError, true);
  }
  input.value = '001 · Stesso nome — Autore';
  input.dispatchEvent(new h.window.Event('input'));
  assert.equal(input.validity.customError, false);
  await page.saveRecord({ preventDefault() {} });
  assert.equal(h.store.getState().seasons[year].records[0].branoId, '001');
});

test('season list defaults to descending weeks and every sort button toggles ascending then descending', async (t) => {
  const h = await harness(true);
  t.after(() => h.dom.window.close());
  const page = h.window.choreoCoursePage;
  const document = h.window.document;
  page.brani = [
    { id: '001', titolo: 'Zulu' },
    { id: '010', titolo: 'Alfa' },
    { id: '002', titolo: 'Beta' }
  ];
  const records = [record('001', 'BASE', 2), record('010', 'INTERMEDIO', 10), record('002', 'AVANZATO', 1)];
  await h.store.saveSeason(season(records));
  page.render(year);
  const body = document.getElementById('course-records-body');
  const visibleIds = () => Array.from(body.children, (row) => row.children[2].textContent);
  assert.deepEqual(visibleIds(), ['010', '001', '002']);
  assert.equal(document.querySelector('.course-records-table th').getAttribute('aria-sort'), 'descending');
  for (const [field, ascending, descending] of [
    ['week', ['002', '001', '010'], ['010', '001', '002']],
    ['level', ['002', '001', '010'], ['010', '001', '002']],
    ['id', ['001', '002', '010'], ['010', '002', '001']],
    ['title', ['010', '002', '001'], ['001', '002', '010']]
  ]) {
    const button = document.getElementById(`btn-sort-course-${field}`);
    button.click();
    assert.deepEqual(visibleIds(), ascending, `${field} ascending`);
    assert.match(button.textContent, /↑/);
    button.click();
    assert.deepEqual(visibleIds(), descending, `${field} descending`);
    assert.match(button.textContent, /↓/);
    assert.equal(button.getAttribute('aria-pressed'), 'true');
    page.render();
    assert.deepEqual(visibleIds(), descending, `${field} order survives refresh`);
    assert.match(document.getElementById('course-record-count').textContent, /3 coreografie registrate/);
    assert.equal(JSON.stringify(h.store.getState().seasons[year].records), JSON.stringify(records));
  }
  let exported;
  page.download = (_name, text) => { exported = text; };
  page.exportSeason();
  assert.match(exported, /,001/);
  assert.match(exported, /,002/);
  assert.match(exported, /,010/);
  await h.store.saveSeason({ id: '2025-2026', label: '2025/2026', records });
  const select = document.getElementById('course-season-select');
  select.value = '2025-2026';
  select.dispatchEvent(new h.window.Event('change'));
  assert.deepEqual(visibleIds(), ['010', '001', '002']);
  assert.equal(document.getElementById('btn-sort-course-week').getAttribute('aria-pressed'), 'true');
  assert.equal(document.getElementById('btn-sort-course-title').getAttribute('aria-pressed'), 'false');
});

test('switching seasons cancels editing so a record cannot be moved accidentally', async (t) => {
  const h = await harness(true);
  t.after(() => h.dom.window.close());
  await h.store.saveSeason(season([record('001')]));
  await h.store.saveSeason({ id: '2025-2026', label: '2025/2026', records: [] });
  const page = h.window.choreoCoursePage;
  page.render(year);
  h.window.document.querySelector('[data-action="edit"]').click();
  assert.equal(page.editingRecordId, 'lesson-001');
  const select = h.window.document.getElementById('course-season-select');
  select.value = '2025-2026';
  select.dispatchEvent(new h.window.Event('change'));
  assert.equal(page.editingRecordId, '');
  assert.equal(h.window.document.getElementById('course-record-song').value, '');
});

test('Bordero combines curriculum level/week with existing filters and resets when season changes', async (t) => {
  const h = await harness();
  t.after(() => h.dom.window.close());
  h.window.document.body.innerHTML = '<select id="course-board-level"></select><input id="course-board-week"><span id="course-board-season"></span><p id="course-board-status"></p>';
  h.window.BORDERO_CONFIG = { LIVELLI: ['BASE', 'INTERMEDIO'], CACHE_KEY_CHOREO_LEVEL_SELECTION: 'selection' };
  const values = new Map();
  h.window.Storage = { get: (key, fallback) => values.get(key) || fallback, set: (key, value) => values.set(key, value) };
  h.window.logger = { info() {}, debug() {} };
  h.window.filterBraniByDuplicateTitleVisibility = (items) => items;
  h.setRemote({ activeSeason: year, seasons: { [year]: season([record('001'), record('002', 'BASE', 3), record('003', 'INTERMEDIO', 1)]) } });
  await h.store.load({ force: true });
  h.window.eval(read('Bordero/pages/bordero.js'));
  const manager = Object.create(h.window.BorderoTableManager.prototype);
  Object.assign(manager, {
    allBrani: [{ id: '001', richieste: '1' }, { id: '002', richieste: '' }, { id: '003', richieste: '1' }, { id: '004', richieste: '' }],
    currentFilters: {}, currentSearch: '', currentSort: null, renderTable() {}, updateStats() {}, applyNextSelectionPriority: (items) => items
  });
  manager.setupCourseProgramFilter();
  const level = h.window.document.getElementById('course-board-level');
  const week = h.window.document.getElementById('course-board-week');
  level.value = 'BASE';
  level.dispatchEvent(new h.window.Event('change'));
  week.value = '1';
  week.dispatchEvent(new h.window.Event('change'));
  assert.deepEqual(Array.from(manager.filteredBrani, (item) => item.id), ['001']);
  week.value = '3';
  week.dispatchEvent(new h.window.Event('change'));
  assert.deepEqual(Array.from(manager.filteredBrani, (item) => item.id), ['001', '002']);
  manager.currentFilters = { richieste: { mode: 'hasValue' } };
  manager.applyFilters();
  assert.deepEqual(Array.from(manager.filteredBrani, (item) => item.id), ['001']);
  h.setRemote({ activeSeason: '2025-2026', seasons: { '2025-2026': { id: '2025-2026', records: [] } } });
  await tick();
  await h.store.load({ force: true });
  assert.equal(level.value, '');
  assert.equal(manager.filteredBrani.length, 2);
});
