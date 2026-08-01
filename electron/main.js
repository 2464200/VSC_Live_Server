const { app, BrowserWindow, screen } = require('electron');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { resolveDisplayTargetsForWindows, getWindowBoundsForDisplay, buildElectronAppConfig } = require('./display-manager');

let primaryWindow;
let secondaryWindow;
let serverProcess;
let ensureUnifiedServerPromise = null;
let currentSwapMonitors = false;
let monitorPreferenceWatcher = null;

const MONITOR_PREFERENCES_FILE = path.join(__dirname, 'monitor-preferences.json');

function readMonitorPreferences() {
  try {
    if (!fs.existsSync(MONITOR_PREFERENCES_FILE)) {
      return { swapPrimarySecondary: false };
    }
    const raw = fs.readFileSync(MONITOR_PREFERENCES_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      swapPrimarySecondary: Boolean(parsed && parsed.swapPrimarySecondary)
    };
  } catch (error) {
    console.warn('Failed to read monitor preferences, using default:', error.message || error);
    return { swapPrimarySecondary: false };
  }
}

function applyWindowLayout() {
  if (!primaryWindow || primaryWindow.isDestroyed() || !secondaryWindow || secondaryWindow.isDestroyed()) {
    return;
  }

  const targets = resolveDisplayTargetsForWindows(screen.getAllDisplays(), {
    swapPrimarySecondary: currentSwapMonitors
  });

  const mainBounds = getWindowBoundsForDisplay(targets.mainDisplay, { width: 1400, height: 900 });
  primaryWindow.setBounds(mainBounds);
  primaryWindow.setFullScreen(false);

  const monitorBounds = getWindowBoundsForDisplay(targets.monitorDisplay, { width: 1280, height: 720 });
  secondaryWindow.setBounds(monitorBounds);
  secondaryWindow.setFullScreen(true);
}

function syncMonitorPreferencesFromDisk() {
  const preferences = readMonitorPreferences();
  const shouldSwap = Boolean(preferences.swapPrimarySecondary);
  if (shouldSwap !== currentSwapMonitors) {
    currentSwapMonitors = shouldSwap;
    console.log(`Monitor swap preference changed: ${currentSwapMonitors ? 'ON' : 'OFF'}`);
  }
  applyWindowLayout();
}

function watchMonitorPreferences() {
  if (monitorPreferenceWatcher) {
    return;
  }

  monitorPreferenceWatcher = setInterval(syncMonitorPreferencesFromDisk, 1000);
}

function stopWatchMonitorPreferences() {
  if (monitorPreferenceWatcher) {
    clearInterval(monitorPreferenceWatcher);
    monitorPreferenceWatcher = null;
  }
}

function waitForServer(url, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();

    const attempt = () => {
      const req = http.get(url, (res) => {
        res.resume();
        resolve();
      });

      req.on('error', () => {
        if (Date.now() - startedAt > timeoutMs) {
          reject(new Error(`Server did not respond at ${url} within ${timeoutMs}ms`));
          return;
        }

        setTimeout(attempt, 1000);
      });
    };

    attempt();
  });
}

function ensureUnifiedServer() {
  if (ensureUnifiedServerPromise) {
    return ensureUnifiedServerPromise;
  }

  ensureUnifiedServerPromise = waitForServer('http://127.0.0.1:5500')
    .then(() => {
      console.log('Unified server already available');
    })
    .catch(() => {
      const serverScript = path.join(__dirname, '..', 'unified-server.js');
      serverProcess = spawn(process.execPath, [serverScript], {
        cwd: path.join(__dirname, '..'),
        windowsHide: false,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      serverProcess.stdout.on('data', (chunk) => {
        process.stdout.write(chunk);
      });

      serverProcess.stderr.on('data', (chunk) => {
        process.stderr.write(chunk);
      });

      serverProcess.on('exit', (code) => {
        if (code !== 0 && !app.isQuitting) {
          console.warn(`Unified server exited with code ${code}`);
        }
        if (serverProcess && serverProcess.exitCode !== null) {
          serverProcess = null;
        }
      });

      return waitForServer('http://127.0.0.1:5500', 20000);
    })
    .finally(() => {
      ensureUnifiedServerPromise = null;
    });

  return ensureUnifiedServerPromise;
}

function createWindow(url, options = {}) {
  const win = new BrowserWindow({
    ...options,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  win.loadURL(url);
  return win;
}

async function ensureWindows() {
  await ensureUnifiedServer();
  currentSwapMonitors = Boolean(readMonitorPreferences().swapPrimarySecondary);

  if (!primaryWindow || primaryWindow.isDestroyed()) {
    const config = buildElectronAppConfig({ baseUrl: 'http://localhost:5500' });

    primaryWindow = createWindow(config.primaryUrl, {
      ...config.windowOptions,
      x: 0,
      y: 0,
      width: 1400,
      height: 900,
      show: false,
      fullscreen: false
    });

    primaryWindow.setVisibleOnAllWorkspaces(false);
    primaryWindow.setAlwaysOnTop(false);
    primaryWindow.once('closed', () => {
      primaryWindow = null;
    });

    secondaryWindow = createWindow(config.secondaryUrl, {
      ...config.windowOptions,
      x: 0,
      y: 0,
      width: 1280,
      height: 720,
      show: false,
      fullscreen: true,
      kiosk: true,
      autoHideMenuBar: true
    });

    secondaryWindow.setMenuBarVisibility(false);
    secondaryWindow.setFullScreen(true);
    secondaryWindow.once('closed', () => {
      secondaryWindow = null;
    });
    secondaryWindow.webContents.on('did-finish-load', () => {
      secondaryWindow.show();
    });

    primaryWindow.webContents.on('did-finish-load', () => {
      primaryWindow.show();
    });

    applyWindowLayout();
  }
}

function handleDisplayChange() {
  applyWindowLayout();
}

app.whenReady().then(() => {
  ensureWindows().catch((error) => {
    console.error('Failed to initialize dual-monitor windows:', error);
  });
  watchMonitorPreferences();

  screen.on('display-added', handleDisplayChange);
  screen.on('display-removed', handleDisplayChange);
  screen.on('display-metrics-changed', handleDisplayChange);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      ensureWindows().catch((error) => {
        console.error('Failed to restore dual-monitor windows:', error);
      });
    }
  });
});

app.on('window-all-closed', () => {
  stopWatchMonitorPreferences();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
