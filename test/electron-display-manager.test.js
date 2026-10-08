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
      if (name === 'http') {
        return {
          createServer() {
            return {
              listen(_port, _host, callback) {
                callback?.();
                return this;
              },
              on() { return this; },
            };
          },
        };
      }

      if (name === 'electron') {
        return {
          app: {
            commandLine: { appendSwitch() {} },
            on() {},
            once() {},
            whenReady() { return new Promise(() => {}); },
            quit() {},
            exit() {},
            isQuitting: false,
          },
          BrowserWindow: class {
            static getAllWindows() { return createdWindows; }

            constructor(options = {}) {
              this.options = options;
              this.events = {};
              this.fullScreen = Boolean(options.fullscreen);
              let currentUrl = options.url || '';
              this.webContents = {
                on() {},
                send() {},
                getURL() { return currentUrl; },
                loadURL(url) { currentUrl = url; return Promise.resolve(); },
                setZoomFactor() {},
                setWindowOpenHandler() { return { action: 'allow' }; },
              };
              this.closed = false;
              this.visible = false;
              this.focused = false;
              this.isDestroyed = () => this.closed;
              createdWindows.push(this);
            }
            loadURL(url) { return this.webContents.loadURL(url); }
            setMenuBarVisibility() {}
            setVisibleOnAllWorkspaces() {}
            setAlwaysOnTop() {}
            setFullScreen(value) { this.fullScreen = value; }
            isFullScreen() { return this.fullScreen; }
            setBounds() {}
            show() { this.visible = true; }
            focus() { this.focused = true; }
            on(event, callback) { this.events[event] = callback; }
            once(_event, callback) { if (_event === 'closed') this.onClosed = callback; }
            close() { this.closed = true; this.onClosed?.(); }
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

      if (name === './google-auth-popup') {
        return require('../electron/google-auth-popup');
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
    const secondary = createdWindows.find((window) => window.options.kiosk);
    assert.ok(secondary, 'secondary monitor window should be created in kiosk mode');
    assert.equal(secondary.fullScreen, true, 'secondary monitor window should start fullscreen');
    secondary.setFullScreen(false);
    secondary.events['leave-full-screen']();
    assert.equal(secondary.fullScreen, true, 'secondary monitor window should return to fullscreen after leaving it');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('secondary display remains loaded while a temporary secondary page is foregrounded', async () => {
  const tempDir = path.join(__dirname, '..', '.tmp-electron-temporary-secondary');
  fs.rmSync(tempDir, { recursive: true, force: true });
  fs.mkdirSync(tempDir, { recursive: true });

  try {
    const { sandbox } = loadElectronMainFor(tempDir);
    sandbox.ensureUnifiedServer = async () => {};
    sandbox.ensurePrimaryMonitorSelectionPreference = async () => ({
      swapPrimarySecondary: false,
      autoConfigureDisplay: true,
      dpiAutoScale: true,
    });

    await vm.runInContext('ensureWindows();', sandbox);
    const result = await vm.runInContext("loadInTemporarySecondaryWindow('http://localhost:5500/userform/pages/servizio-pubblica.html?text=debug');", sandbox);
    const state = vm.runInContext('({ secondary: secondaryWindow.webContents.getURL(), temporary: temporarySecondaryWindow && temporarySecondaryWindow.webContents.getURL() })', sandbox);

    assert.equal(result, true, `temporary secondary load failed: ${JSON.stringify(result)}`);
    assert.match(state.secondary, /Bordero\/pages\/display\.html/i, `persistent secondary URL: ${state.secondary}`);
    assert.match(state.temporary, /userform\/pages\/servizio-pubblica\.html/i, `temporary secondary URL: ${state.temporary}`);

    vm.runInContext('closeTemporarySecondaryWindow();', sandbox);
    assert.equal(vm.runInContext('Boolean(!temporarySecondaryWindow)', sandbox), true, 'temporary secondary page should close and reveal the persistent Display window');
    assert.equal(vm.runInContext('Boolean(secondaryWindow && secondaryWindow.focused)', sandbox), true, 'persistent Display window should be restored to the foreground');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('ScriptPDF pages use a temporary always-on-top window above the persistent Display page', async () => {
  const tempDir = path.join(__dirname, '..', '.tmp-electron-scriptpdf-secondary');
  fs.rmSync(tempDir, { recursive: true, force: true });
  fs.mkdirSync(tempDir, { recursive: true });

  try {
    const { sandbox } = loadElectronMainFor(tempDir);
    sandbox.ensureUnifiedServer = async () => {};
    sandbox.ensurePrimaryMonitorSelectionPreference = async () => ({
      swapPrimarySecondary: false,
      autoConfigureDisplay: true,
      dpiAutoScale: true,
    });

    const result = await vm.runInContext("routeUrlByPolicy('http://localhost:5500/pdf/pages/script-pdf-gestione.html', 'test-scriptpdf-route');", sandbox);
    const state = vm.runInContext('({ primary: primaryWindow.webContents.getURL(), secondary: secondaryWindow.webContents.getURL(), temporary: temporarySecondaryWindow.webContents.getURL(), options: temporarySecondaryWindow.options })', sandbox);

    assert.equal(result.primaryUpdated, false, 'ScriptPDF should not replace the primary window.');
    assert.equal(result.secondaryUpdated, true, 'ScriptPDF should open on the secondary display.');
    assert.match(state.primary, /Bordero\/pages\/bordero\.html/i, 'The primary Bordero page should remain unchanged.');
    assert.match(state.secondary, /Bordero\/pages\/display\.html/i, 'Persistent Display should remain underneath the temporary page.');
    assert.match(state.temporary, /pdf\/pages\/script-pdf-gestione\.html/i, 'The ScriptPDF page should be loaded in the temporary window.');
    assert.equal(state.options.alwaysOnTop, true, 'The ScriptPDF window should remain above Display.');
    assert.equal(state.options.fullscreen, true, 'The ScriptPDF window should use the established fullscreen presentation.');

    const pdfResult = await vm.runInContext("routeUrlByPolicy('http://localhost:5500/pdf/viewers/pdf-viewer.html?file=C%3A%5CVSC_SCRIPT_PDF%5Ctest.pdf&name=test.pdf', 'test-pdf-overlay');", sandbox);
    const pdfState = vm.runInContext('({ secondary: secondaryWindow.webContents.getURL(), temporary: temporarySecondaryWindow.webContents.getURL(), options: temporarySecondaryWindow.options })', sandbox);
    assert.equal(pdfResult.secondaryUpdated, true, 'The PDF viewer should route to the managed secondary display.');
    assert.match(pdfState.secondary, /Bordero\/pages\/display\.html/i, 'DISPLAY should remain underneath the PDF viewer.');
    assert.match(pdfState.temporary, /pdf\/viewers\/pdf-viewer\.html\?file=/i, 'The selected PDF should load in the temporary window.');
    assert.equal(pdfState.options.alwaysOnTop, true, 'The PDF viewer should remain above DISPLAY.');

    vm.runInContext('closeTemporarySecondaryWindow();', sandbox);
    assert.equal(vm.runInContext('Boolean(!temporarySecondaryWindow)', sandbox), true, 'Closing ScriptPDF should close its temporary window.');
    assert.match(vm.runInContext('secondaryWindow.webContents.getURL()', sandbox), /Bordero\/pages\/display\.html/i, 'Closing ScriptPDF should restore Display.');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('webcam control stays out of managed USERFORM routes while standard pages remain managed', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'USERFORM', 'js', 'userform-page.js'), 'utf8');
  const start = source.indexOf('function normalizeRouteTarget');
  const end = source.indexOf('function openManagedPage');
  const snippet = source.slice(start, end);
  const context = {
    window: { location: { href: 'http://localhost:5500/' } },
    URL,
    console,
  };

  vm.runInNewContext(`${snippet}\nthis.isCanonicalUserFormRoute = isCanonicalUserFormRoute;`, context);

  assert.equal(context.isCanonicalUserFormRoute('http://localhost:5500/USERFORM/pages/WEBCAM.html'), false, 'webcam should not be routed to the secondary monitor');
  assert.equal(context.isCanonicalUserFormRoute('http://localhost:5500/USERFORM/pages/webcam.html?mode=preview#camera'), false, 'webcam must remain excluded with query strings and fragments');
  assert.equal(context.isCanonicalUserFormRoute('http://localhost:5500/USERFORM/pages/pagina03.html'), true, 'valid managed UserForm pages should still be routed');
});
