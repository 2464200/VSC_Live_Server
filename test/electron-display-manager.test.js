const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');
const { pickDisplayTargets, resolveDisplayTargetsForWindows, buildDisplayLayoutConfig } = require('../electron/display-manager');

function loadElectronMainFor(tempDir) {
  const mainSource = fs.readFileSync(path.join(__dirname, '..', 'electron', 'main.js'), 'utf8');

  const createdWindows = [];
  const sandbox = {
    console,
    process: {
      env: {
        ELECTRON_CONTROL_PORT: String(process.env.ELECTRON_CONTROL_PORT || '5514')
      },
      versions: { electron: '1.0.0' },
      cwd: () => tempDir,
      platform: process.platform,
      arch: process.arch,
      execPath: process.execPath,
      stdout: { write() {} },
      stderr: { write() {} },
      kill() {},
    },
    __dirname: tempDir,
    __filename: path.join(tempDir, 'main.js'),
    module: { exports: {} },
    exports: {},
    require: (name) => {
      if (name === 'electron') {
        return {
          app: {
            commandLine: { appendSwitch() {} },
            on() {},
            once() {},
            whenReady() { return Promise.resolve(); },
            quit() {},
            exit() {},
            isQuitting: false,
          },
          BrowserWindow: class {
            constructor(options = {}) {
              this.options = options;
              this.webContents = {
                on() {},
                send() {},
                getURL() { return options.url || ''; },
                loadURL() { return Promise.resolve(); },
                setZoomFactor() {},
                setWindowOpenHandler() { return { action: 'allow' }; },
              };
              this.closed = false;
              this.isDestroyed = () => this.closed;
              createdWindows.push(this);
            }
            loadURL() { return Promise.resolve(); }
            setMenuBarVisibility() {}
            setVisibleOnAllWorkspaces() {}
            setAlwaysOnTop() {}
            setFullScreen() {}
            setBounds() {}
            show() {}
            focus() {}
            once(_event, callback) { if (_event === 'closed') this.onClosed = callback; }
            destroy() { this.closed = true; }
          },
          ipcMain: { handle() {}, on() {}, once() {} },
          screen: {
            getAllDisplays() { return [
              { id: 1, isPrimary: true, bounds: { x: 0, y: 0, width: 1920, height: 1080 }, scaleFactor: 1 },
              { id: 2, isPrimary: false, bounds: { x: 1920, y: 0, width: 1920, height: 1080 }, scaleFactor: 1 },
            ]; },
            on() {}
          },
          dialog: { showMessageBox() { return { response: 0 }; } },
        };
      }

      if (name === './display-manager') {
        return {
          resolveDisplayTargetsForWindows(displays, options = {}) {
            const primary = displays.find(d => d.isPrimary) || displays[0];
            const secondary = displays.find(d => !d.isPrimary) || displays[0];
            return {
              mainDisplay: options.swapPrimarySecondary ? secondary : primary,
              monitorDisplay: options.swapPrimarySecondary ? primary : secondary,
            };
          },
          buildDisplayLayoutConfig(display, options = {}) {
            return { x: display.bounds.x, y: display.bounds.y, width: options.width || display.bounds.width, height: options.height || display.bounds.height, zoomFactor: 1 };
          },
          buildElectronAppConfig() {
            return {
              primaryUrl: 'http://localhost:5500/Bordero/pages/bordero.html',
              secondaryUrl: 'http://localhost:5500/Bordero/pages/display.html',
              windowOptions: {},
            };
          },
        };
      }

      return require(name);
    },
    Buffer,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    URL,
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
    fs,
    path,
  };

  vm.runInNewContext(mainSource, sandbox, { filename: 'electron-main.js' });
  return { sandbox, createdWindows };
}

test('pickDisplayTargets chooses the primary display and a secondary one', () => {
  const displays = [
    { id: 1, isPrimary: true, bounds: { x: 0, y: 0, width: 1920, height: 1080 } },
    { id: 2, isPrimary: false, bounds: { x: 1920, y: 0, width: 1920, height: 1080 } }
  ];

  const result = pickDisplayTargets(displays);

  assert.equal(result.primary.id, 1);
  assert.equal(result.secondary.id, 2);
});

test('pickDisplayTargets falls back to the primary display when no secondary display exists', () => {
  const displays = [
    { id: 1, isPrimary: true, bounds: { x: 0, y: 0, width: 1920, height: 1080 } }
  ];

  const result = pickDisplayTargets(displays);

  assert.equal(result.primary.id, 1);
  assert.equal(result.secondary.id, 1);
});

test('resolveDisplayTargetsForWindows swaps displays when requested', () => {
  const displays = [
    { id: 10, isPrimary: true, bounds: { x: 0, y: 0, width: 1920, height: 1080 } },
    { id: 20, isPrimary: false, bounds: { x: 1920, y: 0, width: 1920, height: 1080 } }
  ];

  const normal = resolveDisplayTargetsForWindows(displays, { swapPrimarySecondary: false });
  const swapped = resolveDisplayTargetsForWindows(displays, { swapPrimarySecondary: true });

  assert.equal(normal.mainDisplay.id, 10);
  assert.equal(normal.monitorDisplay.id, 20);
  assert.equal(swapped.mainDisplay.id, 20);
  assert.equal(swapped.monitorDisplay.id, 10);
});

test('buildDisplayLayoutConfig uses the actual monitor size and DPI-aware zoom', () => {
  const display = {
    id: 20,
    isPrimary: false,
    bounds: { x: 2560, y: 0, width: 2560, height: 1440 },
    scaleFactor: 1.25
  };

  const layout = buildDisplayLayoutConfig(display, { width: 1280, height: 720, fullscreen: true });

  assert.equal(layout.width, 2560);
  assert.equal(layout.height, 1440);
  assert.equal(layout.zoomFactor, 0.8);
  assert.equal(layout.scaleFactor, 1.25);
});

test('ensureWindows recreates a missing secondary window when primary already exists', async () => {
  const tempDir = path.join(__dirname, '..', '.tmp-electron-window-repair');
  fs.rmSync(tempDir, { recursive: true, force: true });
  fs.mkdirSync(tempDir, { recursive: true });

  try {
    const { sandbox, createdWindows } = loadElectronMainFor(tempDir);
    sandbox.primaryWindow = {
      isDestroyed: () => false,
      webContents: { on() {}, send() {}, getURL() { return 'http://localhost:5500/Bordero/pages/bordero.html'; }, loadURL() { return Promise.resolve(); }, setZoomFactor() {} },
      setMenuBarVisibility() {},
      setVisibleOnAllWorkspaces() {},
      setAlwaysOnTop() {},
      setFullScreen() {},
      setBounds() {},
      show() {},
      focus() {},
      once() {},
      destroy() {},
    };
    sandbox.secondaryWindow = null;
    sandbox.ensureUnifiedServer = async () => {};
    sandbox.ensurePrimaryMonitorSelectionPreference = async () => ({
      swapPrimarySecondary: false,
      autoConfigureDisplay: true,
      dpiAutoScale: true,
    });

    await vm.runInContext('ensureWindows();', sandbox);

    const hasPrimary = vm.runInContext('Boolean(primaryWindow && !primaryWindow.isDestroyed())', sandbox);
    const hasSecondary = vm.runInContext('Boolean(secondaryWindow && !secondaryWindow.isDestroyed())', sandbox);

    assert.ok(hasPrimary, 'primaryWindow should remain available');
    assert.ok(hasSecondary, 'secondaryWindow should be recreated');
    assert.equal(createdWindows.length >= 2, true, 'ensureWindows should create both windows');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
