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
          attributes: {},
          setAttribute(name, value) { this.attributes[name] = value; },
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

  test(`${scriptPath}: clicking PLAY uses the secondary player without starting a duplicate HTML5 decode`, async () => {
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
    manager.pauseMainVideoForSecondaryPlayback = () => calls.push('preview-paused');
    manager.playSecondaryVideo = () => {
      manager.currentPlaybackBranoId = manager.currentBrano.id;
      calls.push('secondary');
      return Promise.resolve(true);
    };
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
    assert.deepEqual(calls, ['preview-paused', 'secondary', 'saved']);

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

  test(`${scriptPath}: failed secondary startup falls back to the local HTML5 player`, async () => {
    const { VideoClipManager, context } = loadVideoClipManager(scriptPath);
    const manager = Object.create(VideoClipManager.prototype);
    const calls = [];
    manager.currentBrano = { id: '005', titolo: '16 TONS' };
    manager.currentVideoUrl = 'http://localhost:5500/videos/005%2016%20TONS.mp4';
    manager.appendPersistentLog = () => {};
    manager.pauseMainVideoForSecondaryPlayback = () => calls.push('preview-paused');
    manager.playSecondaryVideo = async () => {
      calls.push('secondary');
      return false;
    };
    manager.playMainVideo = async () => calls.push('html5-fallback');

    manager.setupListeners();
    const playButton = context.document.getElementById('btn-play');
    await playButton.onclick({ preventDefault() {}, stopPropagation() {} });

    assert.deepEqual(calls, ['preview-paused', 'secondary', 'html5-fallback']);
    assert.equal(manager.isStartingSecondaryPlayback, false);
    assert.equal(playButton.disabled, false);
  });

  test(`${scriptPath}: PAUSA toggles the active secondary player and blinks only while paused`, async () => {
    const { VideoClipManager, context } = loadVideoClipManager(scriptPath);
    const manager = Object.create(VideoClipManager.prototype);
    const commands = [];
    const pauseButton = context.document.getElementById('btn-pause');
    const playbackStatus = context.document.getElementById('secondary-playback-status');
    const classChanges = [];
    pauseButton.classList.toggle = (name, enabled) => classChanges.push([name, enabled]);
    manager.activeSecondaryBackend = 'electron';
    manager.isSecondaryVideoPaused = false;
    manager.isTogglingSecondaryPause = false;
    context.window.electronAPI = {
      videoPlayer: {
        async pause() { commands.push('pause'); return { success: true }; },
        async resume() { commands.push('resume'); return { success: true }; }
      }
    };

    await manager.pauseSecondaryVideo();
    assert.deepEqual(commands, ['pause']);
    assert.equal(manager.isSecondaryVideoPaused, true);
    assert.equal(playbackStatus.textContent, 'Monitor secondario: Electron in pausa.');
    assert.deepEqual(classChanges.at(-1), ['is-paused', true]);
    assert.equal(pauseButton.attributes['aria-pressed'], 'true');

    await manager.pauseSecondaryVideo();
    assert.deepEqual(commands, ['pause', 'resume']);
    assert.equal(manager.isSecondaryVideoPaused, false);
    assert.equal(playbackStatus.textContent, 'Monitor secondario: Electron in riproduzione.');
    assert.deepEqual(classChanges.at(-1), ['is-paused', false]);
    assert.equal(pauseButton.attributes['aria-pressed'], 'false');
  });

  test(`${scriptPath}: VLC PAUSA resumes the current player without a new video URL`, async () => {
    const { VideoClipManager, context } = loadVideoClipManager(scriptPath);
    const manager = Object.create(VideoClipManager.prototype);
    const actions = [];
    manager.activeSecondaryBackend = 'vlc';
    manager.isSecondaryVideoPaused = false;
    manager.isTogglingSecondaryPause = false;
    manager.fetchVideoApi = async (_path, options) => {
      actions.push(JSON.parse(options.body));
      return { response: { ok: true, json: async () => ({ success: true }) }, origin: 'http://localhost:5500' };
    };

    await manager.pauseSecondaryVideo();
    await manager.pauseSecondaryVideo();
    assert.deepEqual(actions, [{ action: 'pause' }, { action: 'play' }]);
    assert.equal(manager.isSecondaryVideoPaused, false);
    assert.equal(context.document.getElementById('btn-pause').attributes['aria-pressed'], 'false');
  });

  test(`${scriptPath}: VLC completion polling is single-flight and stops cleanly`, async () => {
    const { VideoClipManager, context } = loadVideoClipManager(scriptPath);
    const manager = Object.create(VideoClipManager.prototype);
    let tick;
    let intervalDelay = 0;
    let clearedTimer = null;
    let pollCount = 0;
    let finishPoll;
    context.setInterval = (callback, delay) => {
      tick = callback;
      intervalDelay = delay;
      return 42;
    };
    context.clearInterval = (timer) => {
      clearedTimer = timer;
    };
    manager.vlcCompletionWatcherTimer = null;
    manager.vlcCompletionWatcherGeneration = 0;
    manager.vlcCompletionPollInFlight = false;
    manager.vlcCompletionPollGeneration = null;
    manager.pollVlcCompletion = () => {
      pollCount += 1;
      return new Promise((resolve) => {
        finishPoll = resolve;
      });
    };

    manager.startVlcCompletionWatcher();
    assert.equal(intervalDelay, 1500);
    tick();
    tick();
    assert.equal(pollCount, 1, 'overlapping interval ticks must not start concurrent requests');

    manager.stopVlcCompletionWatcher();
    assert.equal(manager.vlcCompletionWatcherTimer, null);
    assert.equal(clearedTimer, 42);
    finishPoll();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(manager.vlcCompletionPollInFlight, false);
  });
}

for (const playerPath of ['Bordero/pages/video-player.js', 'public/Bordero/pages/video-player.js']) {
  test(`${playerPath}: natural completion keeps the player open until STOP`, async () => {
    const sourcePath = path.join(__dirname, '..', ...playerPath.split('/'));
    const source = fs.readFileSync(sourcePath, 'utf8');
    const windowListeners = {};
    const videoListeners = {};
    let pauseListener;
    let stopListener;
    let resumeListener;
    let playCalls = 0;
    let completed = 0;
    let closeCount = 0;
    const video = {
      srcObject: null,
      currentTime: 9,
      paused: false,
      addEventListener(event, handler) { videoListeners[event] = handler; },
      load() {},
      play() { playCalls += 1; this.paused = false; return Promise.resolve(); },
      pause() { this.paused = true; },
    };
    const elements = new Map([
      ['electron-video', video],
      ['player-status', { textContent: '' }],
      ['live-disclaimer', { hidden: true }],
    ]);
    const context = {
      window: {
        location: { search: '?src=https%3A%2F%2Fexample.test%2Fclip.mp4' },
        addEventListener(event, handler) { windowListeners[event] = handler; },
        close() { closeCount += 1; },
        electronAPI: {
          videoPlayerWindow: {
            onPause(handler) { pauseListener = handler; },
            onResume(handler) { resumeListener = handler; },
            onStop(handler) { stopListener = handler; },
            complete() { completed += 1; },
          },
        },
      },
      document: {
        body: { classList: { toggle() {} } },
        getElementById(id) { return elements.get(id); },
      },
      navigator: {},
      URLSearchParams,
      Promise,
      String,
      Number,
      Math,
    };

    vm.runInNewContext(source, context, { filename: sourcePath });
    windowListeners.DOMContentLoaded();
    await new Promise((resolve) => setImmediate(resolve));
    video.currentTime = 27;
    pauseListener();
    assert.equal(video.paused, true);
    resumeListener();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(video.currentTime, 27, 'resume must preserve the paused playback position');
    assert.equal(playCalls, 2, 'resume reuses play() on the same loaded media');

    videoListeners.ended();
    assert.equal(completed, 1, 'Natural completion should still notify Electron.');
    assert.equal(closeCount, 0, 'Natural completion must not close the player window.');
    assert.equal(elements.get('player-status').textContent, 'Riproduzione terminata.');

    stopListener();
    assert.equal(video.currentTime, 0, 'STOP should rewind the video.');
    assert.equal(closeCount, 1, 'STOP should close the player window.');
  });

  test(`${playerPath}: buffering and decoding diagnostics are opt-in and report errors`, async () => {
    const sourcePath = path.join(__dirname, '..', ...playerPath.split('/'));
    const source = fs.readFileSync(sourcePath, 'utf8');
    const windowListeners = {};
    const videoListeners = {};
    const reports = [];
    const video = {
      srcObject: null,
      currentTime: 3,
      paused: true,
      readyState: 2,
      networkState: 2,
      error: { code: 3 },
      buffered: { length: 1, end: () => 5 },
      addEventListener(event, handler) { videoListeners[event] = handler; },
      getVideoPlaybackQuality() { return { totalVideoFrames: 100, droppedVideoFrames: 4 }; },
      load() {},
      play() { return Promise.resolve(); },
      pause() {},
    };
    const elements = new Map([
      ['electron-video', video],
      ['player-status', { textContent: '' }],
      ['player-diagnostics', { hidden: true, textContent: '' }],
      ['live-disclaimer', { hidden: true }],
    ]);
    let activeTimer = null;
    let clearedTimer = null;
    const context = {
      window: {
        location: { search: '?src=https%3A%2F%2Fexample.test%2Fclip.mp4&diagnostics=1' },
        addEventListener(event, handler) { windowListeners[event] = handler; },
        electronAPI: {
          videoPlayerWindow: {
            onPause() {},
            onResume() {},
            onStop() {},
            reportPlaybackState(payload) { reports.push(payload); },
          },
        },
      },
      document: {
        body: { classList: { toggle() {} } },
        getElementById(id) { return elements.get(id); },
      },
      navigator: {},
      URLSearchParams,
      Promise,
      String,
      Number,
      Math,
      setInterval(callback, delay) {
        activeTimer = { callback, delay };
        return activeTimer;
      },
      clearInterval(timer) {
        clearedTimer = timer;
      },
    };

    vm.runInNewContext(source, context, { filename: sourcePath });
    windowListeners.DOMContentLoaded();
    await new Promise((resolve) => setImmediate(resolve));
    video.paused = false;
    videoListeners.playing();
    videoListeners.waiting();
    videoListeners.stalled();
    videoListeners.error();

    assert.equal(elements.get('player-diagnostics').hidden, false);
    assert.equal(activeTimer.delay, 5000, 'diagnostic frame sampling should be limited to one sample every five seconds');
    assert.equal(clearedTimer, activeTimer, 'sampling must stop on playback error');
    assert.equal(reports.at(-1).event, 'error');
    assert.equal(reports.at(-1).errorCode, 3);
    assert.equal(reports.at(-1).diagnostics.bufferingCount, 1);
    assert.equal(reports.at(-1).diagnostics.stalledCount, 1);
    assert.equal(reports.at(-1).diagnostics.droppedFrames, 4);
    assert.match(elements.get('player-status').textContent, /Errore video/);
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
