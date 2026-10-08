const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');
const { annotateBraniByTitleVisibility } = require('../Bordero/js/title-visibility-utils.js');

const videoclipScripts = [
  'Bordero/pages/videoclip.js',
  'public/Bordero/pages/videoclip.js'
];

function loadVideoClipManager(scriptPath) {
  const sourcePath = path.join(__dirname, '..', ...scriptPath.split('/'));
  const source = fs.readFileSync(sourcePath, 'utf8');
  const elements = new Map();
  const window = {
    location: { origin: 'http://localhost:5500', protocol: 'http:', hostname: 'localhost', port: '5500', search: '' },
    addEventListener() {},
    dispatchEvent() {},
    matchMedia() { return { matches: false }; },
    scrollTo() {},
    history: { replaceState() {} },
    videoClipManager: null
  };
  const storageValues = new Map();
  const document = {
    hidden: false,
    title: 'VideoClip test',
    addEventListener() {},
    hasFocus() { return true; },
    getElementById(id) {
      if (!elements.has(id)) {
        elements.set(id, {
          addEventListener() {},
          classList: { add() {}, remove() {}, toggle() {} },
          setAttribute() {},
          getAttribute() { return ''; },
          removeAttribute() {},
          pause() {},
          load() {},
          currentTime: 0,
          paused: true,
          ended: false
        });
      }
      return elements.get(id);
    }
  };
  const context = {
    window,
    document,
    console,
    logger: { debug() {}, info() {}, warn() {}, error() {} },
    dataLoader: {
      brani: [],
      getCurrentSerata() { return { metadata: {} }; },
      saveCurrentSerata() {}
    },
    Storage: {
      get(key, fallback = null) {
        return storageValues.has(key) ? storageValues.get(key) : fallback;
      },
      set(key, value) {
        storageValues.set(key, value);
      }
    },
    BORDERO_CONFIG: { CACHE_KEY_BRANI: 'bordero_brani' },
    DateUtils: { formatDate() { return '2026-10-08'; } },
    Toast: { success() {} },
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    Event,
    URL,
    URLSearchParams,
    Date,
    Map,
    Set,
    Array,
    String,
    Boolean,
    Number,
    Promise,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval
  };

  vm.runInNewContext(`${source}\nglobalThis.VideoClipManager = VideoClipManager;`, context, {
    filename: sourcePath
  });
  return { VideoClipManager: context.VideoClipManager, context, storageValues };
}

function loadDisplayMonitor(scriptPath) {
  const sourcePath = path.join(__dirname, '..', ...scriptPath.split('/'));
  const source = fs.readFileSync(sourcePath, 'utf8');
  const context = {
    window: {
      isVideoOnlyBrano() { return false; },
      addEventListener() {}
    },
    document: { addEventListener() {} },
    logger: { info() {}, debug() {} },
    BORDERO_CONFIG: {}
  };

  vm.runInNewContext(`${source}\nglobalThis.DisplayMonitor = DisplayMonitor;`, context, {
    filename: sourcePath
  });
  return context.DisplayMonitor;
}

for (const scriptPath of videoclipScripts) {
  test(`${scriptPath}: library association uses only the three-digit filename prefix`, () => {
    const { VideoClipManager } = loadVideoClipManager(scriptPath);
    const manager = Object.create(VideoClipManager.prototype);
    manager.videoCatalog = [
      { prefix: '005', fullName: '005 16 TONS.mp4' },
      { prefix: '006', fullName: '006 DIFFERENT TITLE.mp4' }
    ];

    assert.equal(
      manager.findMatchingVideoFile({ id: '5', titolo: 'Different Title' }),
      '005 16 TONS.mp4'
    );
    assert.equal(
      manager.findMatchingVideoFile({ id: '007', titolo: '16 TONS' }),
      null,
      'matching titles must not override a mismatching numeric prefix'
    );
    assert.equal(manager.findMatchingVideoFile({ id: '1000', titolo: '16 TONS' }), null);

    manager.videoCatalog.push({ prefix: '005', fullName: '005 SECOND FILE.mp4' });
    assert.equal(
      manager.findMatchingVideoFile({ id: '005', titolo: '16 TONS' }),
      null,
      'duplicate numeric prefixes must not be resolved by title'
    );
  });

  test(`${scriptPath}: clicking PLAY marks the choreography executed before playback`, async () => {
    const { VideoClipManager, context, storageValues } = loadVideoClipManager(scriptPath);
    const manager = Object.create(VideoClipManager.prototype);
    const selected = { id: '005', titolo: '16 TONS' };
    const calls = [];
    let savedBrani;
    manager.brani = [selected];
    context.dataLoader.brani = [
      { id: '005', titolo: '16 TONS', richieste: '7' },
      { id: '006', titolo: 'OTHER TRACK', richieste: '2' }
    ];
    storageValues.set('bordero_brani', context.dataLoader.brani);
    storageValues.set('BORDERO_BRANI_DATA', context.dataLoader.brani);
    manager.filteredBrani = [selected];
    manager.currentBrano = selected;
    manager.currentPlaybackBranoId = null;
    manager.currentVideoUrl = 'http://localhost:5500/videos/005%2016%20TONS.mp4';
    manager.availableMap = new Map([['005', '005 16 TONS.mp4']]);
    manager.appendPersistentLog = () => {};
    manager.filterVideos = () => {};
    manager.updatePlayerInfo = () => {};
    manager.playMainVideo = () => {
      assert.equal(manager.brani[0].flag, 'X');
      calls.push('main');
      return Promise.resolve();
    };
    manager.playSecondaryVideo = () => {
      calls.push('secondary');
      return Promise.resolve();
    };
    manager.waitMs = () => Promise.resolve();
    context.dataLoader.saveCurrentSerata = (_metadata, brani) => {
      savedBrani = brani;
      calls.push('saved');
    };

    manager.setupListeners();
    const playButton = context.document.getElementById('btn-play');
    await playButton.onclick({ preventDefault() {}, stopPropagation() {} });
    await new Promise((resolve) => setImmediate(resolve));

    assert.equal(manager.brani[0].flag, 'X');
    assert.equal(manager.brani[0].executed, true);
    assert.equal(savedBrani[0].flag, 'X');
    for (const key of ['bordero_brani', 'BORDERO_BRANI_DATA']) {
      const cachedBrani = storageValues.get(key);
      assert.equal(cachedBrani.find((brano) => brano.id === '005')?.flag, 'X');
      assert.equal(cachedBrani.find((brano) => brano.id === '005')?.executed, true);
      assert.equal(cachedBrani.find((brano) => brano.id === '006')?.flag, undefined);
    }
    assert.equal(context.dataLoader.brani.find((brano) => brano.id === '005')?.flag, 'X');
    assert.deepEqual(calls, ['saved', 'main', 'secondary']);

    for (const displayPath of ['Bordero/pages/display.js', 'public/Bordero/pages/display.js']) {
      const DisplayMonitor = loadDisplayMonitor(displayPath);
      const display = Object.create(DisplayMonitor.prototype);
      display.allBrani = [storageValues.get('bordero_brani').find((brano) => brano.id === '005')];
      display.executedIds = display.buildExecutedIdSet({ brani: savedBrani }, display.allBrani);
      const displayedBrani = annotateBraniByTitleVisibility(
        display.buildDisplaySourceBrani({ brani: savedBrani }),
        {
          isExecuted: (brano) => display.isBranoExecuted(brano),
          isRequested: () => true
        }
      );

      assert.equal(displayedBrani.length, 1, `${displayPath}: executed video brano remains displayed`);
      assert.equal(display.isBranoExecuted(displayedBrani[0]), true);
      assert.match(
        display.createBranoRow(displayedBrani[0]),
        /brano-row completed/,
        `${displayPath}: executed video brano receives the completed orange-row class`
      );
    }
  });
}

for (const displayPath of ['Bordero/pages/display.js', 'public/Bordero/pages/display.js']) {
  test(`${displayPath}: refresh retains executed tracks omitted from a partial session snapshot`, () => {
    const DisplayMonitor = loadDisplayMonitor(displayPath);
    const display = Object.create(DisplayMonitor.prototype);
    const videoTrack = { id: '005', titolo: '16 TONS', richieste: '4', flag: 'X' };
    const otherTrack = { id: '006', titolo: 'OTHER TRACK', richieste: '2', flag: '' };
    const partialSerata = { brani: [otherTrack] };
    display.allBrani = [videoTrack, otherTrack];
    display.executedIds = display.buildExecutedIdSet(partialSerata, display.allBrani);

    const renderedSource = display.buildDisplaySourceBrani(partialSerata);
    const retainedVideoTrack = renderedSource.find((brano) => brano.id === '005');
    assert.equal(retainedVideoTrack.flag, 'X');
    assert.equal(display.isBranoExecuted(retainedVideoTrack), true);

    const explicitlyUnmarkedSerata = {
      brani: [{ ...videoTrack, flag: '', eseguito: 'X', executed: true }]
    };
    display.executedIds = display.buildExecutedIdSet(explicitlyUnmarkedSerata, display.allBrani);
    const explicitlyUnmarked = display.buildDisplaySourceBrani(explicitlyUnmarkedSerata)
      .find((brano) => brano.id === '005');
    assert.equal(explicitlyUnmarked.flag, '');
    assert.equal(display.isBranoExecuted(explicitlyUnmarked), false);

    const aliasExecutedSerata = { brani: [{ id: '005', titolo: '16 TONS', executed: true }] };
    display.executedIds = display.buildExecutedIdSet(aliasExecutedSerata, display.allBrani);
    const aliasExecuted = display.buildDisplaySourceBrani(aliasExecutedSerata)
      .find((brano) => brano.id === '005');
    assert.equal(aliasExecuted.flag, 'X');
    assert.equal(display.isBranoExecuted(aliasExecuted), true);
  });
}
