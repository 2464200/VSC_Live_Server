const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const { JSDOM, VirtualConsole } = require('jsdom');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, ...file.split('/')), 'utf8');

test('NEXT then FLAG persists execution, updates yellow DISPLAY and Brani Eseguiti without VirtualDJ calls', async (t) => {
  const windows = [];
  const values = new Map();
  const errors = [];
  function createPage(name, scripts) {
    const dom = new JSDOM(read(`Bordero/pages/${name}.html`), {
      url: `http://localhost:5500/Bordero/pages/${name}.html`,
      runScripts: 'outside-only',
      virtualConsole: new VirtualConsole(),
    });
    const window = dom.window;
    windows.push(window);
    t.after(() => window.close());
    window.addEventListener('error', (event) => errors.push(event.error));
    window.fetch = () => { throw new Error('Unexpected network request'); };
    const listen = window.document.addEventListener.bind(window.document);
    window.document.addEventListener = (name, ...args) => {
      if (name !== 'DOMContentLoaded') listen(name, ...args);
    };
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: (key) => values.get(key) ?? null,
        setItem(key, value) {
          const oldValue = values.get(key) ?? null;
          values.set(key, String(value));
          for (const other of windows) {
            if (other !== window && oldValue !== String(value)) {
              other.dispatchEvent(new other.StorageEvent('storage', {
                key, oldValue, newValue: String(value),
              }));
            }
          }
        },
        removeItem(key) {
          values.delete(key);
        },
      },
    });
    for (const script of [
      'js/config.js', 'js/utils.js', 'js/title-visibility-utils.js',
      'js/video-only-brani.js', 'js/data-loader.js', ...scripts,
    ]) {
      vm.runInContext(read(`Bordero/${script}`), dom.getInternalVMContext(), { filename: script });
    }
    return window;
  }

  const main = createPage('bordero', ['pages/bordero.js']);
  const display = createPage('display', ['pages/display.js']);
  const executed = createPage('brani-eseguiti', ['pages/brani-eseguiti.js']);
  const mainStyle = main.document.createElement('style');
  mainStyle.textContent = read('Bordero/pages/bordero.css');
  main.document.head.append(mainStyle);
  const style = display.document.createElement('style');
  style.textContent = read('Bordero/pages/display.css');
  display.document.head.append(style);

  main.eval(`
    BorderoTableManager.prototype.init = () => {};
    window.tableManager = new BorderoTableManager();
    tableManager.allBrani = [
      { id: '001', titolo: '101', richieste: '0', flag: '', originalIndex: 0 },
      { id: '002', titolo: '1540', richieste: '1', flag: '', originalIndex: 1 }
    ];
    tableManager.filteredBrani = [...tableManager.allBrani];
    tableManager.publishCloudState = async () => {};
    tableManager.publishNextCoreoToCloud = async () => {};
    tableManager.resolveMusicArchiveMatch = async () => { throw new Error('FLAG must not search audio'); };
    tableManager.sendFileToVirtualDj = async () => { throw new Error('FLAG must not load a deck'); };
    Storage.set('BORDERO_DJ_SOFTWARE', 'virtualdj');
    tableManager.setupStorageSync();
    tableManager.renderTable();
  `);
  assert.equal(main.document.querySelector('#brani-table thead th[data-col="coreografia"]').textContent.trim(), 'Coreografia');
  assert.equal(main.document.querySelector('#brani-tbody tr .col-coreografia').textContent, '101');
  display.eval(`
    window.monitor = Object.create(DisplayMonitor.prototype);
    monitor.allBrani = [];
    monitor.executedIds = new Set();
    monitor.serata = {};
    monitor.setupControls();
  `);
  executed.eval(`
    window.executedPage = Object.create(BraniEseguitiPage.prototype);
    executedPage.brani = [];
    executedPage.serata = {};
    executedPage.setupStorageSync();
  `);

  const checkbox = () => main.document.querySelector('[data-brano-id="001"] .flag-checkbox');
  checkbox().click();
  assert.equal(checkbox().checked, false, 'NEXT must be selected first');
  assert.equal(main.eval('dataLoader.getCurrentSerata()'), null);

  main.document.querySelector('[data-brano-id="001"] .col-next-coreo').click();
  assert.equal(main.eval('tableManager.getActiveNextSelectionId()'), '001');
  main.eval(`
    tableManager.allBrani[0].consoleDeck = '1';
    tableManager.allBrani[0].consoleStatus = 'playing';
    tableManager.virtualDjCompletionTracker = { branoId: '001', deckNumber: 1, hasSeenPlaying: true };
  `);
  for (const endState of [
    { hasTrack: true, isPlaying: false, isPaused: false, timeRemainSeconds: 0 },
    { hasTrack: false, isPlaying: false, isPaused: false, isEmpty: true },
  ]) {
    await main.eval(`tableManager.refreshVirtualDjConsoleState([
      { deck: 1, unavailable: false, ...${JSON.stringify(endState)} },
      { deck: 2, unavailable: false, hasTrack: false, isPlaying: false, isPaused: false }
    ])`);
    assert.equal(checkbox().checked, false, 'VirtualDJ end/empty state must not confirm execution');
    assert.equal(main.eval('dataLoader.getCurrentSerata()'), null);
    assert.equal(main.eval('tableManager.getActiveNextSelectionId()'), '001');
  }
  checkbox().click();
  await Promise.resolve();
  assert.equal(checkbox().checked, true);
  assert.equal(main.getComputedStyle(checkbox()).accentColor, 'rgb(40, 167, 69)');
  assert.equal(main.eval('tableManager.getActiveNextSelectionId()'), null);
  const saved = JSON.parse(values.get('bordero_currentSerata'));
  const track = saved.brani.find((item) => item.id === '001');
  assert.equal(track.flag, 'X');
  assert.ok(track.timestamp);
  assert.equal(track.executed, true);

  const displayedRow = Array.from(display.document.querySelectorAll('#display-tbody tr'))
    .find((row) => row.querySelector('.col-id').textContent === '001');
  assert.ok(displayedRow, 'Executed tracks with zero requests must appear on DISPLAY');
  assert.equal(displayedRow.classList.contains('completed'), true);
  assert.equal(display.getComputedStyle(displayedRow).backgroundColor, 'rgb(255, 255, 0)');
  assert.equal(executed.document.querySelector('#executed-count').textContent, '1 brani');
  assert.equal(executed.document.querySelector('#executed-tbody .col-titolo').textContent, '101');

  executed.eval('executedPage.restoreBrano("001")');
  assert.equal(checkbox().checked, false);
  assert.equal(executed.document.querySelectorAll('#executed-tbody tr').length, 0);
  main.eval('tableManager.autoSaveSerata()');
  assert.equal(JSON.parse(values.get('bordero_currentSerata')).brani[0].flag, '');
  assert.deepEqual(errors, []);
});
