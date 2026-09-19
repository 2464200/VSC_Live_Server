const fs = require('fs');
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
            whenReady() { return Promise.resolve(); },
            quit() {},
          },
          BrowserWindow: class {},
          ipcMain: { handle() {}, on() {}, once() {} },
          screen: { getAllDisplays() { return []; } },
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
  const tempDir = path.join(__dirname, '..', '.tmp-electron-config-test');
  fs.rmSync(tempDir, { recursive: true, force: true });
  fs.mkdirSync(tempDir, { recursive: true });

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

    assert(invalidEntry && invalidEntry.primary === true && invalidEntry.secondary === false, 'Invalid policy entry should be sanitized to a safe default.');
    assert(validEntry && validEntry.primary === true && validEntry.secondary === false, 'Valid policy entry should be preserved as-is.');

    console.log('PASS: Electron runtime defaults and sanitization are resilient and project-safe.');
  }
);
