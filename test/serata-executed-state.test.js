const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

const dataLoaderScripts = [
  'Bordero/js/data-loader.js',
  'public/Bordero/js/data-loader.js'
];

function loadDataLoader(scriptPath) {
  const values = new Map();
  const context = {
    window: {
      isVideoOnlyBrano(brano) {
        return String(brano?.id ?? '') === '596' || String(brano?.id ?? '') === '597';
      },
      dispatchEvent() {}
    },
    Storage: {
      get(key, fallback = null) {
        return values.has(key) ? values.get(key) : fallback;
      },
      set(key, value) {
        values.set(key, value);
      }
    },
    BORDERO_CONFIG: {
      CACHE_KEY_CURRENT_SERATA: 'bordero_currentSerata'
    },
    DateUtils: { now: () => Date.now() },
    Toast: { success() {} },
    logger: { info() {}, debug() {} },
    Date,
    Event
  };
  const sourcePath = path.join(__dirname, '..', ...scriptPath.split('/'));
  const source = fs.readFileSync(sourcePath, 'utf8');
  vm.runInNewContext(`${source}\nglobalThis.TestDataLoader = DataLoader;`, context, {
    filename: sourcePath
  });
  return new context.TestDataLoader();
}

for (const scriptPath of dataLoaderScripts) {
  test(`${scriptPath}: partial serata saves retain omitted executed tracks`, () => {
    const dataLoader = loadDataLoader(scriptPath);
    dataLoader.saveCurrentSerata({}, [
      { id: '5', titolo: 'Normal video', flag: 'X', timestamp: '20:00' },
      { id: '596', titolo: 'Video-only entry', flag: 'X' },
      { id: '6', titolo: 'Not executed', flag: '' }
    ]);

    const updated = dataLoader.saveCurrentSerata({}, [
      { id: '6', titolo: 'Not executed', flag: '' }
    ]);

    assert.equal(updated.brani.find((brano) => brano.id === '5')?.flag, 'X');
    assert.equal(
      updated.brani.some((brano) => brano.id === '596'),
      false,
      'video-only entries must not be restored as executed'
    );
    assert.equal(updated.brani.length, 2);
  });

  test(`${scriptPath}: explicit unmark and full-session reset clear executed flags`, () => {
    const dataLoader = loadDataLoader(scriptPath);
    dataLoader.saveCurrentSerata({}, [
      { id: '5', titolo: 'Normal video', flag: 'X' },
      { id: '6', titolo: 'Another track', flag: 'X' }
    ]);

    const explicitlyUnmarked = dataLoader.saveCurrentSerata({}, [
      { id: '5', titolo: 'Normal video', flag: '' }
    ]);
    assert.equal(explicitlyUnmarked.brani.find((brano) => brano.id === '5')?.flag, '');
    assert.equal(explicitlyUnmarked.brani.find((brano) => brano.id === '6')?.flag, 'X');

    const reset = dataLoader.saveCurrentSerata({}, [
      { id: '5', titolo: 'Normal video', flag: '' },
      { id: '6', titolo: 'Another track', flag: '' }
    ]);
    assert.equal(reset.brani.some((brano) => brano.flag === 'X'), false);
  });
}
