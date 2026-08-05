const { app, BrowserWindow, ipcMain, screen, dialog } = require('electron');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { resolveDisplayTargetsForWindows, getWindowBoundsForDisplay, buildElectronAppConfig } = require('./display-manager');

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

let primaryWindow;
let secondaryWindow;
let videoPlayerWindow;
let serverProcess;
let ensureUnifiedServerPromise = null;
let currentSwapMonitors = false;
let monitorPreferenceWatcher = null;

const MONITOR_PREFERENCES_FILE = path.join(__dirname, 'monitor-preferences.json');
const DISPLAY_PAGE_PATH = '/Bordero/pages/display.html';
const PRIMARY_DEFAULT_PAGE_PATH = '/Bordero/pages/bordero.html';

function readMonitorPreferences() {
  try {
    if (!fs.existsSync(MONITOR_PREFERENCES_FILE)) {
      return {
        swapPrimarySecondary: false,
        primaryMonitorChoice: null,
        selectionConfirmed: false
      };
    }
    const raw = fs.readFileSync(MONITOR_PREFERENCES_FILE, 'utf8').replace(/^\uFEFF/, '').trim();
    if (!raw) {
      return {
        swapPrimarySecondary: false,
        primaryMonitorChoice: null,
        selectionConfirmed: false
      };
    }
    const parsed = JSON.parse(raw);

    const explicitChoice = Number(parsed?.primaryMonitorChoice);
    let primaryMonitorChoice = null;
    if (explicitChoice === 1 || explicitChoice === 2) {
      primaryMonitorChoice = explicitChoice;
    }

    const swapPrimarySecondary = primaryMonitorChoice === null
      ? Boolean(parsed && parsed.swapPrimarySecondary)
      : primaryMonitorChoice === 2;

    return {
      swapPrimarySecondary,
      primaryMonitorChoice,
      selectionConfirmed: Boolean(parsed && parsed.selectionConfirmed)
    };
  } catch (error) {
    console.warn('Failed to read monitor preferences, using default:', error.message || error);
    return {
      swapPrimarySecondary: false,
      primaryMonitorChoice: null,
      selectionConfirmed: false
    };
  }
}

function applyWindowLayout() {
  if (!primaryWindow || primaryWindow.isDestroyed() || !secondaryWindow || secondaryWindow.isDestroyed()) {
    if (videoPlayerWindow && !videoPlayerWindow.isDestroyed()) {
      const targets = resolveDisplayTargetsForWindows(screen.getAllDisplays(), {
        swapPrimarySecondary: currentSwapMonitors
      });
      const monitorBounds = getWindowBoundsForDisplay(targets.monitorDisplay, { width: 1280, height: 720 });
      videoPlayerWindow.setBounds(monitorBounds);
      videoPlayerWindow.setFullScreen(true);
    }
    return;
  }

  const targets = resolveDisplayTargetsForWindows(screen.getAllDisplays(), {
    swapPrimarySecondary: currentSwapMonitors
  });

  const mainBounds = getWindowBoundsForDisplay(targets.mainDisplay, { width: 1400, height: 900 });
  primaryWindow.setBounds(mainBounds);
  primaryWindow.setFullScreen(true);

  const monitorBounds = getWindowBoundsForDisplay(targets.monitorDisplay, { width: 1280, height: 720 });
  secondaryWindow.setBounds(monitorBounds);
  secondaryWindow.setFullScreen(true);

  if (videoPlayerWindow && !videoPlayerWindow.isDestroyed()) {
    videoPlayerWindow.setBounds(monitorBounds);
    videoPlayerWindow.setFullScreen(true);
  }
}

function buildMonitorPreferencesPayload(preferences = {}, defaults = {}) {
  const explicitChoice = Number(preferences?.primaryMonitorChoice);
  const fallbackChoice = Number(defaults?.primaryMonitorChoice) === 2 ? 2 : 1;

  const primaryMonitorChoice = (explicitChoice === 1 || explicitChoice === 2)
    ? explicitChoice
    : fallbackChoice;

  const swapPrimarySecondary = primaryMonitorChoice === 2;
  const selectionConfirmed = Object.prototype.hasOwnProperty.call(preferences, 'selectionConfirmed')
    ? Boolean(preferences.selectionConfirmed)
    : Boolean(defaults.selectionConfirmed);

  const payload = {
    primaryMonitorChoice,
    swapPrimarySecondary,
    selectionConfirmed,
    updatedAt: new Date().toISOString()
  };

  if (preferences?.source) {
    payload.source = String(preferences.source);
  }

  return payload;
}

function writeMonitorPreferences(preferences = {}, defaults = {}) {
  const payload = buildMonitorPreferencesPayload(preferences, defaults);
  fs.mkdirSync(path.dirname(MONITOR_PREFERENCES_FILE), { recursive: true });
  fs.writeFileSync(MONITOR_PREFERENCES_FILE, JSON.stringify(payload, null, 2), 'utf8');
  return payload;
}

async function ensurePrimaryMonitorSelectionPreference() {
  const current = readMonitorPreferences();
  if (current.selectionConfirmed && (current.primaryMonitorChoice === 1 || current.primaryMonitorChoice === 2)) {
    return current;
  }

  try {
    const response = await dialog.showMessageBox({
      type: 'question',
      title: 'Bordero - Selezione Monitor Principale',
      message: 'Monitor principale su cui eseguire Bordero?',
      detail: 'Scegli 1 o 2. Il monitor 1 e predefinito.',
      buttons: ['1 (predefinito)', '2 (scambia monitor)'],
      defaultId: 0,
      cancelId: 0,
      noLink: true,
      normalizeAccessKeys: true
    });

    const primaryMonitorChoice = response?.response === 1 ? 2 : 1;
    const saved = writeMonitorPreferences({
      primaryMonitorChoice,
      selectionConfirmed: true,
      source: 'electron-prompt'
    }, current);

    console.log(`Primary monitor selected via prompt: ${saved.primaryMonitorChoice}`);
    return saved;
  } catch (error) {
    console.warn('Monitor selection prompt failed, using default monitor 1:', error?.message || error);
    const saved = writeMonitorPreferences({
      primaryMonitorChoice: 1,
      selectionConfirmed: true,
      source: 'electron-prompt-fallback'
    }, current);
    return saved;
  }
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

function toAbsoluteAppUrl(pagePath) {
  const raw = typeof pagePath === 'string' && pagePath.trim().length > 0
    ? pagePath.trim()
    : DISPLAY_PAGE_PATH;

  try {
    return new URL(raw, 'http://localhost:5500').toString();
  } catch (_) {
    return `http://localhost:5500${DISPLAY_PAGE_PATH}`;
  }
}

function isDisplayPageUrl(candidateUrl) {
  try {
    const parsed = new URL(String(candidateUrl || ''), 'http://localhost:5500');
    return parsed.pathname.toLowerCase().endsWith(DISPLAY_PAGE_PATH.toLowerCase());
  } catch (_) {
    return false;
  }
}

function getPrimaryDefaultUrl() {
  return `http://localhost:5500${PRIMARY_DEFAULT_PAGE_PATH}`;
}

async function loadInPrimaryWindow(url) {
  if (!primaryWindow || primaryWindow.isDestroyed()) {
    await ensureWindows();
  }

  if (!primaryWindow || primaryWindow.isDestroyed()) {
    return false;
  }

  try {
    await primaryWindow.loadURL(url || getPrimaryDefaultUrl());
    primaryWindow.setFullScreen(true);
    primaryWindow.show();
    primaryWindow.focus();
    applyWindowLayout();
    return true;
  } catch (error) {
    console.warn('Unable to load URL in primary window:', error?.message || error);
    return false;
  }
}

async function ensureSecondaryDisplayPage() {
  if (!secondaryWindow || secondaryWindow.isDestroyed()) {
    await ensureWindows();
  }

  if (!secondaryWindow || secondaryWindow.isDestroyed()) {
    return false;
  }

  const currentUrl = secondaryWindow.webContents.getURL();
  if (!isDisplayPageUrl(currentUrl)) {
    await secondaryWindow.loadURL(`http://localhost:5500${DISPLAY_PAGE_PATH}`);
  }

  secondaryWindow.setFullScreen(true);
  secondaryWindow.show();
  applyWindowLayout();
  return true;
}

function enforceSecondaryNavigationPolicy() {
  if (!secondaryWindow || secondaryWindow.isDestroyed()) {
    return;
  }

  secondaryWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!isDisplayPageUrl(url)) {
      loadInPrimaryWindow(url);
    }
    return { action: 'deny' };
  });

  secondaryWindow.webContents.on('will-navigate', (event, url) => {
    if (!isDisplayPageUrl(url)) {
      event.preventDefault();
      loadInPrimaryWindow(url);
      ensureSecondaryDisplayPage().catch((error) => {
        console.warn('Unable to keep display page on secondary monitor:', error?.message || error);
      });
    }
  });
}

function enforcePrimaryNavigationPolicy() {
  if (!primaryWindow || primaryWindow.isDestroyed()) {
    return;
  }

  primaryWindow.webContents.setWindowOpenHandler(({ url }) => {
    loadInPrimaryWindow(url);
    return { action: 'deny' };
  });
}

function getVideoPlayerUrl(videoUrl) {
  const playerUrl = new URL('http://localhost:5500/Bordero/pages/video-player.html');
  playerUrl.searchParams.set('src', videoUrl);
  playerUrl.searchParams.set('ts', String(Date.now()));
  return playerUrl.toString();
}

function createVideoPlayerWindow() {
  const config = buildElectronAppConfig({ baseUrl: 'http://localhost:5500', pageUrl: '/Bordero/pages/video-player.html', displayUrl: '/Bordero/pages/display.html' });
  const targets = resolveDisplayTargetsForWindows(screen.getAllDisplays(), {
    swapPrimarySecondary: currentSwapMonitors
  });
  const monitorBounds = getWindowBoundsForDisplay(targets.monitorDisplay, { width: 1280, height: 720 });

  const win = new BrowserWindow({
    ...config.windowOptions,
    x: monitorBounds.x,
    y: monitorBounds.y,
    width: monitorBounds.width,
    height: monitorBounds.height,
    show: false,
    fullscreen: true,
    kiosk: true,
    frame: false,
    autoHideMenuBar: true,
    skipTaskbar: true,
    backgroundColor: '#000000',
    alwaysOnTop: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  win.setMenuBarVisibility(false);
  win.setVisibleOnAllWorkspaces(false);
  win.setAlwaysOnTop(true, 'screen-saver');
  win.once('closed', () => {
    if (videoPlayerWindow === win) {
      videoPlayerWindow = null;
    }
  });

  win.webContents.on('did-finish-load', () => {
    if (!win.isDestroyed()) {
      win.show();
      win.focus();
      win.setAlwaysOnTop(true, 'screen-saver');
    }
  });

  return win;
}

async function ensureVideoPlayerWindow(videoUrl) {
  await ensureUnifiedServer();
  await ensureSecondaryDisplayPage();

  if (!videoPlayerWindow || videoPlayerWindow.isDestroyed()) {
    videoPlayerWindow = createVideoPlayerWindow();
  }

  const playerUrl = getVideoPlayerUrl(videoUrl);
  await videoPlayerWindow.loadURL(playerUrl);
  if (!videoPlayerWindow.isDestroyed()) {
    videoPlayerWindow.setAlwaysOnTop(true, 'screen-saver');
    videoPlayerWindow.show();
    videoPlayerWindow.focus();
  }
  applyWindowLayout();
  return videoPlayerWindow;
}

function closeVideoPlayerWindow() {
  if (videoPlayerWindow && !videoPlayerWindow.isDestroyed()) {
    videoPlayerWindow.close();
  }
}

ipcMain.handle('bordero-video-player:play', async (_event, payload) => {
  const videoUrl = typeof payload === 'string' ? payload : payload?.url;
  if (!videoUrl) {
    return { success: false, error: 'Missing video url' };
  }

  await ensureVideoPlayerWindow(videoUrl);
  return { success: true, url: videoUrl };
});

ipcMain.handle('bordero-video-player:pause', async () => {
  if (!videoPlayerWindow || videoPlayerWindow.isDestroyed()) {
    return { success: false, error: 'Video player window not available' };
  }

  videoPlayerWindow.webContents.send('bordero-video-player:pause');
  return { success: true };
});

ipcMain.handle('bordero-video-player:stop', async () => {
  if (!videoPlayerWindow || videoPlayerWindow.isDestroyed()) {
    return { success: true, stopped: false };
  }

  videoPlayerWindow.webContents.send('bordero-video-player:stop');
  return { success: true, stopped: true };
});

ipcMain.handle('bordero-window:open-secondary', async (_event, payload) => {
  try {
    await ensureWindows();

    if (!secondaryWindow || secondaryWindow.isDestroyed()) {
      return { success: false, error: 'Secondary window not available' };
    }

    const targetUrl = toAbsoluteAppUrl(payload?.path);
    if (isDisplayPageUrl(targetUrl)) {
      await secondaryWindow.loadURL(targetUrl);
      secondaryWindow.setFullScreen(true);
      secondaryWindow.show();
      applyWindowLayout();
      return { success: true, url: targetUrl, target: 'secondary' };
    }

    const loadedOnPrimary = await loadInPrimaryWindow(targetUrl);
    await ensureSecondaryDisplayPage();
    return {
      success: loadedOnPrimary,
      url: targetUrl,
      target: 'primary',
      redirected: true
    };
  } catch (error) {
    return { success: false, error: error?.message || String(error) };
  }
});

ipcMain.on('bordero-video-player:ended', (_event, payload) => {
  BrowserWindow.getAllWindows().forEach((win) => {
    if (!win.isDestroyed()) {
      win.webContents.send('bordero-video-player:ended', payload);
    }
  });

  closeVideoPlayerWindow();
  ensureSecondaryDisplayPage().catch((error) => {
    console.warn('Unable to restore display page after video ended:', error?.message || error);
  });
});

async function ensureWindows() {
  await ensureUnifiedServer();
  const monitorPreferences = await ensurePrimaryMonitorSelectionPreference();
  currentSwapMonitors = Boolean(monitorPreferences.swapPrimarySecondary);

  if (!primaryWindow || primaryWindow.isDestroyed()) {
    const config = buildElectronAppConfig({ baseUrl: 'http://localhost:5500' });

    primaryWindow = createWindow(config.primaryUrl, {
      ...config.windowOptions,
      x: 0,
      y: 0,
      width: 1400,
      height: 900,
      show: false,
      fullscreen: true,
      autoHideMenuBar: true
    });

    primaryWindow.setMenuBarVisibility(false);
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

    enforcePrimaryNavigationPolicy();
    enforceSecondaryNavigationPolicy();

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
