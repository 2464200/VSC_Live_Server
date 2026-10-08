const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');

function loadElectronMainFor(tempDir) {
  const mainSource = fs.readFileSync(path.join(__dirname, '..', 'electron', 'main.js'), 'utf8');

  const sandbox = {
    console,
    process: {
      env: {},
      versions: { electron: '1.0.0' },
      cwd: () => tempDir,
      platform: process.platform,
      arch: process.arch,
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
            whenReady() { return new Promise(() => {}); },
            quit() {},
            isQuitting: false,
          },
          BrowserWindow: class {
            constructor() {
              this.webContents = {
                on() {},
                send() {},
                getURL() { return ''; },
                loadURL() { return Promise.resolve(); },
                setZoomFactor() {},
                setWindowOpenHandler() { return { action: 'allow' }; },
              };
            }
            loadURL() { return Promise.resolve(); }
            setMenuBarVisibility() {}
            setVisibleOnAllWorkspaces() {}
            setAlwaysOnTop() {}
            setFullScreen() {}
            setBounds() {}
            show() {}
            focus() {}
            once() {}
            isDestroyed() { return false; }
          },
          ipcMain: { handle() {}, on() {}, once() {} },
          screen: { getAllDisplays() { return []; }, on() {} },
          dialog: { showMessageBox() { return { response: 0 }; } },
        };
      }

      if (name === './display-manager') {
        return {
          resolveDisplayTargetsForWindows() {
            return {
              mainDisplay: { x: 0, y: 0, width: 1920, height: 1080 },
              monitorDisplay: { x: 1920, y: 0, width: 1920, height: 1080 },
            };
          },
          buildDisplayLayoutConfig() {
            return { x: 0, y: 0, width: 1280, height: 720, zoomFactor: 1 };
          },
          buildElectronAppConfig() {
            return { windowOptions: {} };
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
  return sandbox;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function withTempRuntime(files, callback) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vsc-live-electron-config-test-'));

  for (const [fileName, content] of Object.entries(files)) {
    const fullPath = path.join(tempDir, fileName);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content, 'utf8');
  }

  try {
    callback(tempDir);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

withTempRuntime(
  {
    'monitor-preferences.json': JSON.stringify({
      primaryMonitorChoice: 0,
      swapPrimarySecondary: true,
      selectionConfirmed: false,
      autoConfigureDisplay: false,
    }, null, 2),
    'page-policy.json': JSON.stringify({
      '/bad-route': { primary: false, secondary: false },
      '/good-route': { primary: true, secondary: false },
    }, null, 2),
  },
  (tempDir) => {
    const sandbox = loadElectronMainFor(tempDir);

    const prefs = vm.runInContext('readMonitorPreferences()', sandbox);
    assert(prefs.primaryMonitorChoice === 1, 'Invalid monitor preference should default to monitor 1.');
    assert(prefs.swapPrimarySecondary === false, 'Invalid monitor preference should not swap monitors.');
    assert(prefs.autoConfigureDisplay === false, 'Explicit autoConfigureDisplay should be respected.');

    const policyMap = vm.runInContext('readElectronPagePolicy()', sandbox);
    const invalidEntry = policyMap.get('/bad-route');
    const validEntry = policyMap.get('/good-route');
    const displayEntry = policyMap.get('/bordero/pages/display.html');
    const videoPlayerEntry = policyMap.get('/bordero/pages/video-player.html');
    const servicePublicationEntry = policyMap.get('/userform/pages/servizio-pubblica.html');
    const primaryBorderoEntry = policyMap.get('/bordero/pages/bordero.html');
    const userFormCollegamentiEntry = policyMap.get('/userform/pages/collegamenti.html');
    const userFormCollegamentiPolicy = vm.runInContext("getMonitorPolicyForUrl('http://localhost:5500/USERFORM/pages/COLLEGAMENTI.html')", sandbox);
    const legacyUserFormPagina06Entry = policyMap.get('/userform/pages/pagina06.html');
    const legacyUserFormPagina08Entry = policyMap.get('/userform/pages/pagina08.html');
    const userFormScriptPdfPolicy = vm.runInContext("getMonitorPolicyForUrl('http://localhost:5500/USERFORM/pages/SCRIPT-PDF.html')", sandbox);
    const scriptPdfManagementPolicy = vm.runInContext("getMonitorPolicyForUrl('http://localhost:5500/pdf/pages/script-pdf-gestione.html')", sandbox);
    const scriptPdfLegacyPagePolicy = vm.runInContext("getMonitorPolicyForUrl('http://localhost:5500/pdf/pages/script-pdf-prova.html')", sandbox);
    const scriptPdfViewerPagePolicy = vm.runInContext("getMonitorPolicyForUrl('http://localhost:5500/pdf/viewers/pdf-viewer.html')", sandbox);
    const scriptPdfPolicy = vm.runInContext("getMonitorPolicyForUrl('http://localhost:5500/ScriptPDF1.html')", sandbox);
    const scriptPdfTestPolicy = vm.runInContext("getMonitorPolicyForUrl('http://localhost:5500/Prova/ScriptPDF1.html')", sandbox);
    const scriptPdfViewerPolicy = vm.runInContext("getMonitorPolicyForUrl('http://localhost:5500/pdf/viewers/ScriptPDF1.html')", sandbox);
    const adminEntry = policyMap.get('/bordero/pages/admin.html');
    const newUserFormPolicy = vm.runInContext("getMonitorPolicyForUrl('http://localhost:5500/USERFORM/pages/scaletta.html')", sandbox);
    const newBorderoPolicy = vm.runInContext("getMonitorPolicyForUrl('http://localhost:5500/Bordero/pages/new-report.html')", sandbox);
    const newUserFormIsManaged = vm.runInContext("isManagedHtmlAppUrl('http://localhost:5500/USERFORM/pages/scaletta.html')", sandbox);
    const remoteHtmlIsManaged = vm.runInContext("isManagedHtmlAppUrl('https://example.com/new-report.html')", sandbox);
    const mainSource = fs.readFileSync(path.join(__dirname, '..', 'electron', 'main.js'), 'utf8');
    const preloadSource = fs.readFileSync(path.join(__dirname, '..', 'electron', 'preload.js'), 'utf8');

    assert(invalidEntry && invalidEntry.primary === true && invalidEntry.secondary === false, 'Invalid policy entry should be sanitized to a safe default.');
    assert(validEntry && validEntry.primary === true && validEntry.secondary === false, 'Valid policy entry should be preserved as-is.');
    assert(displayEntry && displayEntry.primary === false && displayEntry.secondary === true, 'Display page must remain on the secondary monitor.');
    assert(videoPlayerEntry && videoPlayerEntry.primary === false && videoPlayerEntry.secondary === true, 'Video-player page must remain on the secondary monitor.');
    assert(servicePublicationEntry && servicePublicationEntry.primary === false && servicePublicationEntry.secondary === true, 'Servizio pubblica must remain on the secondary monitor.');
    assert(primaryBorderoEntry && primaryBorderoEntry.primary === true && primaryBorderoEntry.secondary === false, 'Main Bordero page must remain on the primary monitor.');
    assert(userFormCollegamentiEntry && userFormCollegamentiEntry.primary === true && userFormCollegamentiEntry.secondary === false, 'USERFORM COLLEGAMENTI must be registered exclusively on the primary monitor.');
    assert(userFormCollegamentiPolicy.primary === true && userFormCollegamentiPolicy.secondary === false, 'USERFORM COLLEGAMENTI must be managed exclusively on the primary monitor.');
    assert(!legacyUserFormPagina06Entry, 'The renamed USERFORM page must not retain its previous Electron route.');
    assert(!legacyUserFormPagina08Entry, 'The renamed USERFORM page must not retain its previous Electron route.');
    assert(userFormScriptPdfPolicy.primary === true && userFormScriptPdfPolicy.secondary === false, 'USERFORM SCRIPT-PDF must be managed exclusively on the primary monitor.');
    assert(scriptPdfManagementPolicy.primary === false && scriptPdfManagementPolicy.secondary === true, 'Canonical ScriptPDF management page must be routed to the temporary secondary display.');
    assert(scriptPdfLegacyPagePolicy.primary === false && scriptPdfLegacyPagePolicy.secondary === true, 'Legacy ScriptPDF URL must remain routed to the temporary secondary display before redirecting.');
    assert(scriptPdfViewerPagePolicy.primary === false && scriptPdfViewerPagePolicy.secondary === true, 'PDF viewer page must be routed to the temporary secondary display.');
    assert(scriptPdfPolicy.primary === false && scriptPdfPolicy.secondary === true, 'The legacy main ScriptPDF alias must remain routed to the temporary secondary display.');
    assert(scriptPdfTestPolicy.primary === false && scriptPdfTestPolicy.secondary === true, 'The legacy ScriptPDF test alias must be routed to the temporary secondary display.');
    assert(scriptPdfViewerPolicy.primary === false && scriptPdfViewerPolicy.secondary === true, 'The legacy ScriptPDF viewer alias must be routed to the temporary secondary display.');
    assert(adminEntry && adminEntry.primary === true && adminEntry.secondary === false, 'Admin page must stay on the primary monitor.');
    assert(newUserFormIsManaged === true, 'New local USERFORM HTML pages must be managed without registering their filenames.');
    assert(newUserFormPolicy.primary === true && newUserFormPolicy.secondary === false, 'New USERFORM pages must stay on the primary monitor.');
    assert(newBorderoPolicy.primary === true && newBorderoPolicy.secondary === false, 'Unregistered Bordero HTML pages must use the primary monitor by default.');
    assert(remoteHtmlIsManaged === false, 'Remote HTML pages must not be captured by the project window manager.');
    assert(mainSource.includes("ipcMain.handle('bordero-window:open-primary'") && mainSource.includes("routeUrlByPolicy(targetUrl, 'ipc-open-primary')"), 'The page selector must route through the configured monitor policy.');
    assert(preloadSource.includes("openPrimaryPage: (payload) => ipcRenderer.invoke('bordero-window:open-primary', payload)"), 'The primary page route must be exposed to the Bordero renderer.');
    assert(mainSource.includes('bordero-window:stop-service-publication') && mainSource.includes('restoreSecondaryPageBeforeLedDisplay'), 'Service publication stop and restore hooks must be present in the Electron main process.');

    console.log('PASS: Electron runtime defaults and sanitization are resilient and project-safe.');
    console.log('PASS: display/video and service-publication route policy remains locked to the correct monitor assignment.');
  }
);
