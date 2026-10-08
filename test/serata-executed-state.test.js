const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

const dataLoaderScripts = [
  'Bordero/js/data-loader.js',
  'public/Bordero/js/data-loader.js'
];
const firebaseClientScripts = [
  'Bordero/js/firebase-cloud-client.js',
  'public/Bordero/js/firebase-cloud-client.js'
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

for (const scriptPath of firebaseClientScripts) {
  test(`${scriptPath}: partial cloud snapshots retain omitted executed tracks`, () => {
    const values = new Map();
    const storage = {
      get(key, fallback = null) {
        return values.has(key) ? values.get(key) : fallback;
      },
      set(key, value) {
        values.set(key, value);
      },
      remove(key) {
        values.delete(key);
      }
    };
    const currentKey = 'bordero_currentSerata';
    const context = {
      window: {
        location: {
          hostname: 'localhost',
          port: '5500',
          pathname: '/Bordero/pages/display.html',
          search: ''
        },
        addEventListener() {},
        dispatchEvent() {}
      },
      document: {
        readyState: 'loading',
        addEventListener() {},
        getElementById() { return null; }
      },
      Storage: storage,
      BORDERO_CONFIG: {
        CACHE_KEY_BRANI: 'bordero_brani',
        CACHE_KEY_CURRENT_SERATA: currentKey
      },
      dataLoader: {
        getCurrentSerata() {
          return storage.get(currentKey);
        },
        mergeMissingExecutedBrani(incoming, previous = []) {
          const includedIds = new Set(incoming.map((brano) => String(brano.id)));
          const omittedExecuted = previous.filter((brano) => (
            String(brano.flag || '').toUpperCase() === 'X'
            && !includedIds.has(String(brano.id))
          ));
          return [...incoming, ...omittedExecuted];
        }
      },
      CustomEvent: class CustomEvent {
        constructor(type, options) {
          this.type = type;
          this.detail = options?.detail;
        }
      },
      Date,
      console,
      setTimeout,
      clearTimeout,
      setInterval,
      clearInterval
    };

    const sourcePath = path.join(__dirname, '..', ...scriptPath.split('/'));
    const source = fs.readFileSync(sourcePath, 'utf8');
    const instrumentedSource = source.replace(
      /\}\)\(\);\s*$/,
      'globalThis.TestFirebaseCloudClient = FirebaseCloudClient;\n})();'
    );
    assert.notEqual(instrumentedSource, source, 'test harness must expose the cloud client class');
    vm.runInNewContext(instrumentedSource, context, { filename: sourcePath });

    const previouslyExecuted = { id: '5', titolo: 'Normal videoclip', flag: 'X' };
    storage.set(currentKey, { metadata: { dj: 'DJ' }, brani: [previouslyExecuted] });
    const client = Object.create(context.TestFirebaseCloudClient.prototype);
    client.lastStateTimestamp = null;
    client.latestCloudState = null;
    client.hasFreshCloudState = false;
    client.updateStatusBadge = () => {};
    client.clearExpiredStoredSerata = () => {};
    client.handleCloudState({
      serata: { dj: 'DJ' },
      brani: [{ id: '6', titolo: 'Another track', flag: '' }],
      updatedAt: new Date().toISOString()
    });

    assert.equal(
      storage.get(currentKey).brani.find((brano) => brano.id === '5')?.flag,
      'X',
      'cloud refresh must preserve an executed brano omitted from its partial snapshot'
    );
  });
}
