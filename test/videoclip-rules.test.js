const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

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
      getCurrentSerata() { return { metadata: {} }; },
      saveCurrentSerata() {}
    },
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
  return { VideoClipManager: context.VideoClipManager, context };
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
    const { VideoClipManager, context } = loadVideoClipManager(scriptPath);
    const manager = Object.create(VideoClipManager.prototype);
    const selected = { id: '005', titolo: '16 TONS' };
    const calls = [];
    let savedBrani;
    manager.brani = [selected];
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
    assert.deepEqual(calls, ['saved', 'main', 'secondary']);
  });
}
