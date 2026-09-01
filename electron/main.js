const { app, BrowserWindow, ipcMain, screen, dialog } = require('electron');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { resolveDisplayTargetsForWindows, buildDisplayLayoutConfig, buildElectronAppConfig } = require('./display-manager');

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

const PAGE_POLICY_FILE = path.join(__dirname, 'page-policy.json');

let primaryWindow;
let secondaryWindow;
let videoPlayerWindow;
let serverProcess;
let electronControlServer = null;
let ensureUnifiedServerPromise = null;
let currentSwapMonitors = false;
let currentAutoConfigureDisplay = true;
let currentDpiAutoScale = true;
let monitorPreferenceWatcher = null;
let isProgrammaticPrimaryLoad = false;
let isProgrammaticSecondaryLoad = false;
let secondaryPageBeforeLedDisplay = '';
let lastMonitorRouteEvent = null;
let electronVideoPlayerState = {
  active: false,
  mode: '',
  url: '',
  cameraName: '',
  lastPlayRequestedAt: '',
  lastStoppedAt: '',
  lastCompletedAt: '',
  lastEvent: 'idle'
};

const MONITOR_PREFERENCES_FILE = path.join(__dirname, 'monitor-preferences.json');
const ELECTRON_CONTROL_PORT = process.env.ELECTRON_CONTROL_PORT ? parseInt(process.env.ELECTRON_CONTROL_PORT, 10) : 5512;
const DISPLAY_PAGE_PATH = '/Bordero/pages/display.html';
const PRIMARY_DEFAULT_PAGE_PATH = '/Bordero/pages/bordero.html';
const PRIMARY_ONLY_PREFIXES = ['/userform/', '/operatore/', '/operator/'];
const PAGE_POLICY = new Map([
  ['/bordero/pages/admin.html', { primary: true, secondary: false }],
  ['/bordero/pages/bordero-presentazione.html', { primary: true, secondary: true }],
  ['/bordero/pages/bordero.html', { primary: true, secondary: false }],
  ['/bordero/index.html', { primary: true, secondary: false }],
  ['/bordero/pages/brani-eseguiti.html', { primary: true, secondary: true }],
  ['/bordero/pages/display.html', { primary: false, secondary: true }],
  ['/bordero/pages/elenco-richieste.html', { primary: true, secondary: false }],
  ['/bordero/pages/lista-serata.html', { primary: true, secondary: true }],
  ['/bordero/pages/location.html', { primary: true, secondary: false }],
  ['/bordero/pages/next-coreo.html', { primary: true, secondary: true }],
  ['/bordero/pages/risultati.html', { primary: true, secondary: true }],
  ['/bordero/pages/video-player.html', { primary: false, secondary: true }],
  ['/bordero/pages/videoclip.html', { primary: true, secondary: false }],
  ['/eventi/eventi.html', { primary: true, secondary: false }],
  ['/led-display/', { primary: false, secondary: true }],
  ['/led-display/off.html', { primary: false, secondary: true }],
  ['/leddisplay.html', { primary: true, secondary: false }],
  ['/userform/pages/qrcode.html', { primary: true, secondary: false }],
  ['/userform/pages/servizio.html', { primary: true, secondary: false }],
  ['/userform/pages/servizio-pubblica.html', { primary: false, secondary: true }],
  ['/userform/pages/wecam.html', { primary: true, secondary: false }],
  ['/userform/pages/pagina03.html', { primary: true, secondary: false }],
  ['/userform/pages/pagina04.html', { primary: true, secondary: false }],
  ['/userform/pages/pagina06.html', { primary: true, secondary: false }],
  ['/userform/pages/pagina07.html', { primary: true, secondary: false }],
  ['/userform/pages/pagina08.html', { primary: true, secondary: false }],
  ['/userform/pages/pagina09.html', { primary: true, secondary: false }],
  ['/userform/pages/pagina10.html', { primary: true, secondary: false }],
  ['/userform/pages/pagina11.html', { primary: true, secondary: false }]
]);

let currentPagePolicy = new Map(PAGE_POLICY);

function normalizePolicyPath(pagePath) {
  const normalized = normalizePathname(pagePath || '');
  return normalized || String(pagePath || '').trim().toLowerCase();
}

function readElectronPagePolicy() {
  try {
    if (!fs.existsSync(PAGE_POLICY_FILE)) {
      return new Map(PAGE_POLICY);
    }

    const raw = fs.readFileSync(PAGE_POLICY_FILE, 'utf8').replace(/^\uFEFF/, '').trim();
    if (!raw) {
      return new Map(PAGE_POLICY);
    }

    const parsed = JSON.parse(raw);
    const persisted = new Map();

    if (parsed && typeof parsed === 'object') {
      for (const [pathKey, value] of Object.entries(parsed)) {
        const normalized = normalizePolicyPath(pathKey);
        if (!normalized) continue;
        persisted.set(normalized, {
          primary: Boolean(value?.primary),
          secondary: Boolean(value?.secondary)
        });
      }
    }

    const merged = new Map(PAGE_POLICY);
    for (const [pathKey, policy] of persisted.entries()) {
      merged.set(pathKey, policy);
    }
    return merged;
  } catch (error) {
    console.warn('Unable to read page policy file:', error?.message || error);
    return new Map(PAGE_POLICY);
  }
}

function writeElectronPagePolicy(policyMap) {
  const payload = {};
  for (const [pathKey, value] of policyMap.entries()) {
    payload[pathKey] = {
      primary: Boolean(value.primary),
      secondary: Boolean(value.secondary)
    };
  }

  try {
    fs.writeFileSync(PAGE_POLICY_FILE, JSON.stringify(payload, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.warn('Unable to write page policy file:', error?.message || error);
    return false;
  }
}

function loadElectronPagePolicy() {
  currentPagePolicy = readElectronPagePolicy();
  return currentPagePolicy;
}

function updateElectronPagePolicy(pathname, primary, secondary) {
  const normalized = normalizePolicyPath(pathname);
  if (!normalized) {
    throw new Error('Invalid page path');
  }

  const existingPolicy = currentPagePolicy.has(normalized)
    ? currentPagePolicy.get(normalized)
    : (PAGE_POLICY.get(normalized) || { primary: true, secondary: false });

  let effectivePrimary = primary !== undefined ? Boolean(primary) : Boolean(existingPolicy.primary);
  const effectiveSecondary = secondary !== undefined ? Boolean(secondary) : Boolean(existingPolicy.secondary);

  if (!effectivePrimary && !effectiveSecondary) {
    effectivePrimary = true;
  }

  currentPagePolicy.set(normalized, {
    primary: effectivePrimary,
    secondary: effectiveSecondary
  });
  writeElectronPagePolicy(currentPagePolicy);
  return currentPagePolicy.get(normalized);
}

function getPagePolicyEntries() {
  return Array.from(currentPagePolicy.entries()).map(([pathKey, policy]) => ({
    path: pathKey,
    primary: Boolean(policy.primary),
    secondary: Boolean(policy.secondary)
  }));
}

loadElectronPagePolicy();

function readMonitorPreferences() {
  try {
    if (!fs.existsSync(MONITOR_PREFERENCES_FILE)) {
      return {
        swapPrimarySecondary: false,
        primaryMonitorChoice: null,
        selectionConfirmed: false,
        autoConfigureDisplay: true,
        dpiAutoScale: true,
        secondaryMonitorAutoScale: true
      };
    }
    const raw = fs.readFileSync(MONITOR_PREFERENCES_FILE, 'utf8').replace(/^\uFEFF/, '').trim();
    if (!raw) {
      return {
        swapPrimarySecondary: false,
        primaryMonitorChoice: null,
        selectionConfirmed: false,
        autoConfigureDisplay: true,
        dpiAutoScale: true,
        secondaryMonitorAutoScale: true
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
      selectionConfirmed: Boolean(parsed && parsed.selectionConfirmed),
      autoConfigureDisplay: parsed?.autoConfigureDisplay !== false,
      dpiAutoScale: parsed?.dpiAutoScale !== false,
      secondaryMonitorAutoScale: parsed?.secondaryMonitorAutoScale !== false
    };
  } catch (error) {
    console.warn('Failed to read monitor preferences, using default:', error.message || error);
    return {
      swapPrimarySecondary: false,
      primaryMonitorChoice: null,
      selectionConfirmed: false,
      autoConfigureDisplay: true,
      dpiAutoScale: true,
      secondaryMonitorAutoScale: true
    };
  }
}

function applyWindowLayout() {
  const displays = screen.getAllDisplays();
  const targets = resolveDisplayTargetsForWindows(displays, {
    swapPrimarySecondary: currentSwapMonitors
  });

  const primaryLayout = currentAutoConfigureDisplay
    ? buildDisplayLayoutConfig(targets.mainDisplay, { width: 1400, height: 900, fullscreen: true })
    : { x: 0, y: 0, width: 1400, height: 900, zoomFactor: 1 };
  const secondaryLayout = currentAutoConfigureDisplay
    ? buildDisplayLayoutConfig(targets.monitorDisplay, { width: 1280, height: 720, fullscreen: true })
    : { x: 0, y: 0, width: 1280, height: 720, zoomFactor: 1 };

  const applyLayout = (win, layout) => {
    if (!win || win.isDestroyed()) {
      return;
    }

    try {
      win.setBounds({
        x: layout.x,
        y: layout.y,
        width: layout.width,
        height: layout.height
      });
    } catch (error) {
      console.warn('Unable to set window bounds:', error?.message || error);
    }

    try {
      win.setFullScreen(true);
    } catch (error) {
      console.warn('Unable to set fullscreen for window:', error?.message || error);
    }

    try {
      win.webContents.setZoomFactor(layout.zoomFactor);
    } catch (error) {
      console.warn('Unable to apply zoom factor:', error?.message || error);
    }
  };

  if (primaryWindow && !primaryWindow.isDestroyed()) {
    applyLayout(primaryWindow, primaryLayout);
  }

  if (secondaryWindow && !secondaryWindow.isDestroyed()) {
    applyLayout(secondaryWindow, secondaryLayout);
  }

  if (videoPlayerWindow && !videoPlayerWindow.isDestroyed()) {
    applyLayout(videoPlayerWindow, secondaryLayout);
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
    autoConfigureDisplay: Object.prototype.hasOwnProperty.call(preferences, 'autoConfigureDisplay') ? Boolean(preferences.autoConfigureDisplay !== false) : true,
    dpiAutoScale: Object.prototype.hasOwnProperty.call(preferences, 'dpiAutoScale') ? Boolean(preferences.dpiAutoScale !== false) : true,
    secondaryMonitorAutoScale: Object.prototype.hasOwnProperty.call(preferences, 'secondaryMonitorAutoScale') ? Boolean(preferences.secondaryMonitorAutoScale !== false) : true,
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

  currentAutoConfigureDisplay = Boolean(preferences.autoConfigureDisplay !== false);
  currentDpiAutoScale = Boolean(preferences.dpiAutoScale !== false);
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

function tryParseUrl(candidateUrl) {
  try {
    return new URL(String(candidateUrl || ''), 'http://localhost:5500');
  } catch (_) {
    return null;
  }
}

function normalizePathname(candidateUrl) {
  const parsed = tryParseUrl(candidateUrl);
  if (!parsed) {
    return '';
  }

  return String(parsed.pathname || '').toLowerCase();
}

function isManagedHtmlAppUrl(candidateUrl) {
  const parsed = tryParseUrl(candidateUrl);
  if (!parsed) {
    return false;
  }

  const host = (parsed.hostname || '').toLowerCase();
  if (host && host !== 'localhost' && host !== '127.0.0.1') {
    return false;
  }

  return normalizePathname(parsed.toString()).endsWith('.html');
}

const USERFORM_CANONICAL_PAGE_IDS = new Set(
  ['qrcode', 'servizio', 'pagina03', 'pagina04', 'wecam', 'pagina06', 'pagina07', 'pagina08', 'pagina09', 'pagina10', 'pagina11']
);

function isCanonicalUserFormPage(candidateUrl) {
  const normalizedPath = normalizePathname(candidateUrl);
  const fileName = normalizedPath.split('/').filter(Boolean).pop() || '';
  const stem = fileName.replace(/\.html$/i, '').toLowerCase();
  return Boolean(stem) && USERFORM_CANONICAL_PAGE_IDS.has(stem) && normalizedPath.includes('/userform/pages/');
}

function getMonitorPolicyForUrl(candidateUrl) {
  const normalizedPath = normalizePathname(candidateUrl);

  if (currentPagePolicy.has(normalizedPath)) {
    return currentPagePolicy.get(normalizedPath);
  }

  if (PAGE_POLICY.has(normalizedPath)) {
    return PAGE_POLICY.get(normalizedPath);
  }

  if (isCanonicalUserFormPage(candidateUrl)) {
    return { primary: true, secondary: false };
  }

  if (PRIMARY_ONLY_PREFIXES.some((prefix) => normalizedPath.startsWith(prefix))) {
    return { primary: true, secondary: false };
  }

  // Default prudente: pagine non canonicali o non gestite non vengono routeate come pagine USERFORM.
  return { primary: false, secondary: false };
}

function broadcastMonitorPolicyRouteEvent(payload = {}) {
  const eventPayload = {
    timestamp: new Date().toISOString(),
    ...payload
  };

  lastMonitorRouteEvent = eventPayload;

  BrowserWindow.getAllWindows().forEach((win) => {
    if (!win.isDestroyed()) {
      win.webContents.send('bordero-monitor-policy:routed', eventPayload);
    }
  });
}

function isDisplayPageUrl(candidateUrl) {
  return normalizePathname(candidateUrl).endsWith(DISPLAY_PAGE_PATH.toLowerCase());
}

function isLedDisplayPageUrl(candidateUrl) {
  const pathname = normalizePathname(candidateUrl);
  return pathname === '/led-display' || pathname === '/led-display/';
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
    isProgrammaticPrimaryLoad = true;
    await primaryWindow.loadURL(url || getPrimaryDefaultUrl());
    primaryWindow.setFullScreen(true);
    primaryWindow.show();
    primaryWindow.focus();
    applyWindowLayout();
    return true;
  } catch (error) {
    console.warn('Unable to load URL in primary window:', error?.message || error);
    return false;
  } finally {
    isProgrammaticPrimaryLoad = false;
  }
}

async function loadInSecondaryWindow(url) {
  if (!secondaryWindow || secondaryWindow.isDestroyed()) {
    await ensureWindows();
  }

  if (!secondaryWindow || secondaryWindow.isDestroyed()) {
    return false;
  }

  try {
    const targetUrl = url || `http://localhost:5500${DISPLAY_PAGE_PATH}`;
    const currentUrl = secondaryWindow.webContents.getURL();
    if (isLedDisplayPageUrl(targetUrl) && currentUrl && !isLedDisplayPageUrl(currentUrl)) {
      secondaryPageBeforeLedDisplay = currentUrl;
    }
    isProgrammaticSecondaryLoad = true;
    await secondaryWindow.loadURL(targetUrl);
    secondaryWindow.setFullScreen(true);
    secondaryWindow.show();
    secondaryWindow.focus();
    applyWindowLayout();
    return true;
  } catch (error) {
    console.warn('Unable to load URL in secondary window:', error?.message || error);
    return false;
  } finally {
    isProgrammaticSecondaryLoad = false;
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

async function restoreSecondaryPageBeforeLedDisplay() {
  const restoreUrl = secondaryPageBeforeLedDisplay || `http://localhost:5500${DISPLAY_PAGE_PATH}`;
  secondaryPageBeforeLedDisplay = '';
  return loadInSecondaryWindow(restoreUrl);
}

async function routeUrlByPolicy(targetUrl, source = 'unknown') {
  await ensureWindows();

  const absoluteTargetUrl = toAbsoluteAppUrl(targetUrl);
  const policy = getMonitorPolicyForUrl(absoluteTargetUrl);

  const result = {
    url: absoluteTargetUrl,
    source,
    policy,
    primaryUpdated: false,
    secondaryUpdated: false
  };

  if (policy.primary) {
    result.primaryUpdated = await loadInPrimaryWindow(absoluteTargetUrl);
  }

  if (policy.secondary) {
    result.secondaryUpdated = await loadInSecondaryWindow(absoluteTargetUrl);
  } else {
    result.secondaryUpdated = await ensureSecondaryDisplayPage();
  }

  broadcastMonitorPolicyRouteEvent({
    source,
    url: absoluteTargetUrl,
    path: normalizePathname(absoluteTargetUrl),
    policy,
    primaryUpdated: Boolean(result.primaryUpdated),
    secondaryUpdated: Boolean(result.secondaryUpdated),
    swapPrimarySecondary: Boolean(currentSwapMonitors)
  });

  return result;
}

function enforceSecondaryNavigationPolicy() {
  if (!secondaryWindow || secondaryWindow.isDestroyed()) {
    return;
  }

  secondaryWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!isManagedHtmlAppUrl(url)) {
      return { action: 'allow' };
    }

    routeUrlByPolicy(url, 'secondary-window-open').catch((error) => {
      console.warn('Unable to route secondary window.open URL by policy:', error?.message || error);
    });
    return { action: 'deny' };
  });

  secondaryWindow.webContents.on('will-navigate', (event, url) => {
    if (isProgrammaticSecondaryLoad) {
      return;
    }

    if (!isManagedHtmlAppUrl(url)) {
      return;
    }

    const policy = getMonitorPolicyForUrl(url);
    if (policy.secondary && !policy.primary) {
      return;
    }

    event.preventDefault();
    routeUrlByPolicy(url, 'secondary-will-navigate').catch((error) => {
      console.warn('Unable to route secondary navigation by policy:', error?.message || error);
    });
  });
}

function enforcePrimaryNavigationPolicy() {
  if (!primaryWindow || primaryWindow.isDestroyed()) {
    return;
  }

  primaryWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!isManagedHtmlAppUrl(url)) {
      return { action: 'allow' };
    }

    routeUrlByPolicy(url, 'primary-window-open').catch((error) => {
      console.warn('Unable to route primary window.open URL by policy:', error?.message || error);
    });
    return { action: 'deny' };
  });

  primaryWindow.webContents.on('will-navigate', (event, url) => {
    if (isProgrammaticPrimaryLoad) {
      return;
    }

    if (!isManagedHtmlAppUrl(url)) {
      return;
    }

    const policy = getMonitorPolicyForUrl(url);
    if (policy.primary && !policy.secondary) {
      ensureSecondaryDisplayPage().catch((error) => {
        console.warn('Unable to keep secondary monitor in display state:', error?.message || error);
      });
      return;
    }

    event.preventDefault();
    routeUrlByPolicy(url, 'primary-will-navigate').catch((error) => {
      console.warn('Unable to route primary navigation by policy:', error?.message || error);
    });
  });
}

function getVideoPlayerUrl(payload = {}) {
  const videoUrl = typeof payload === 'string' ? payload : payload?.url;
  const mode = typeof payload === 'object' && payload?.mode === 'webcam-live' ? 'webcam-live' : 'video';
  const playerUrl = new URL('http://localhost:5500/Bordero/pages/video-player.html');
  if (mode === 'webcam-live') {
    if (payload?.cameraName) {
      playerUrl.searchParams.set('camera', String(payload.cameraName));
    }
    if (payload?.size) {
      playerUrl.searchParams.set('size', String(payload.size));
    }
    if (payload?.fps) {
      playerUrl.searchParams.set('fps', String(payload.fps));
    }
    playerUrl.searchParams.set('mode', 'webcam-live');
  } else {
    playerUrl.searchParams.set('src', videoUrl);
  }
  playerUrl.searchParams.set('ts', String(Date.now()));
  return playerUrl.toString();
}

function createVideoPlayerWindow() {
  const config = buildElectronAppConfig({ baseUrl: 'http://localhost:5500', pageUrl: '/Bordero/pages/video-player.html', displayUrl: '/Bordero/pages/display.html' });
  const targets = resolveDisplayTargetsForWindows(screen.getAllDisplays(), {
    swapPrimarySecondary: currentSwapMonitors
  });
  const secondaryLayout = buildDisplayLayoutConfig(targets.monitorDisplay, { width: 1280, height: 720, fullscreen: true });

  const win = new BrowserWindow({
    ...config.windowOptions,
    x: secondaryLayout.x,
    y: secondaryLayout.y,
    width: secondaryLayout.width,
    height: secondaryLayout.height,
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

async function ensureVideoPlayerWindow(payload = {}) {
  await ensureUnifiedServer();
  await ensureSecondaryDisplayPage();

  if (!videoPlayerWindow || videoPlayerWindow.isDestroyed()) {
    videoPlayerWindow = createVideoPlayerWindow();
  }

  const playerUrl = getVideoPlayerUrl(payload);
  const mode = typeof payload === 'object' && payload?.mode === 'webcam-live' ? 'webcam-live' : 'video';
  await videoPlayerWindow.loadURL(playerUrl);
  if (!videoPlayerWindow.isDestroyed()) {
    videoPlayerWindow.setAlwaysOnTop(true, 'screen-saver');
    videoPlayerWindow.show();
    videoPlayerWindow.focus();
  }
  electronVideoPlayerState = {
    ...electronVideoPlayerState,
    active: true,
    mode,
    url: typeof payload === 'string' ? payload : (payload?.url || ''),
    cameraName: payload?.cameraName || '',
    lastPlayRequestedAt: new Date().toISOString(),
    lastEvent: 'play-requested'
  };
  applyWindowLayout();
  return videoPlayerWindow;
}

function closeVideoPlayerWindow() {
  electronVideoPlayerState = {
    ...electronVideoPlayerState,
    active: false,
    lastStoppedAt: new Date().toISOString(),
    lastEvent: 'window-closed'
  };
  if (videoPlayerWindow && !videoPlayerWindow.isDestroyed()) {
    videoPlayerWindow.close();
  }
}

function sendElectronControlJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += String(chunk || '');
      if (raw.length > 1024 * 1024) {
        reject(new Error('Request body too large'));
      }
    });
    req.on('end', () => {
      if (!raw.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

function startElectronControlServer() {
  if (electronControlServer) {
    return electronControlServer;
  }

  electronControlServer = http.createServer(async (req, res) => {
    try {
      const requestUrl = new URL(req.url || '/', `http://127.0.0.1:${ELECTRON_CONTROL_PORT}`);

      if (req.method === 'GET' && requestUrl.pathname === '/health') {
        sendElectronControlJson(res, 200, { ok: true, pid: process.pid, hasVideoPlayerWindow: Boolean(videoPlayerWindow && !videoPlayerWindow.isDestroyed()), playerState: electronVideoPlayerState });
        return;
      }

      if (req.method === 'GET' && requestUrl.pathname === '/page-policy') {
        sendElectronControlJson(res, 200, { ok: true, policy: getPagePolicyEntries() });
        return;
      }

      if (req.method === 'POST' && requestUrl.pathname === '/page-policy') {
        const payload = await readJsonBody(req);
        const pagePath = String(payload?.path || '').trim();
        const primary = payload?.primary !== undefined ? Boolean(payload.primary) : undefined;
        const secondary = payload?.secondary !== undefined ? Boolean(payload.secondary) : undefined;

        if (!pagePath) {
          sendElectronControlJson(res, 400, { success: false, error: 'path obbligatorio' });
          return;
        }

        try {
          const policy = updateElectronPagePolicy(pagePath, primary, secondary);
          sendElectronControlJson(res, 200, { ok: true, policy });
        } catch (error) {
          sendElectronControlJson(res, 400, { success: false, error: error?.message || String(error) });
        }
        return;
      }

      if (req.method === 'GET' && requestUrl.pathname === '/video-player/state') {
        sendElectronControlJson(res, 200, { ok: true, pid: process.pid, hasVideoPlayerWindow: Boolean(videoPlayerWindow && !videoPlayerWindow.isDestroyed()), playerState: electronVideoPlayerState });
        return;
      }

      if (req.method === 'POST' && requestUrl.pathname === '/video-player/play') {
        const payload = await readJsonBody(req);
        const mode = typeof payload === 'object' && payload?.mode === 'webcam-live' ? 'webcam-live' : 'video';
        const videoUrl = typeof payload === 'string' ? payload : payload?.url;
        if (mode === 'video' && !videoUrl) {
          sendElectronControlJson(res, 400, { success: false, error: 'Missing video url' });
          return;
        }
        await ensureVideoPlayerWindow(payload || { url: videoUrl });
        sendElectronControlJson(res, 200, { success: true, mode, url: videoUrl || '', cameraName: payload?.cameraName || '' });
        return;
      }

      if (req.method === 'POST' && requestUrl.pathname === '/video-player/stop') {
        if (!videoPlayerWindow || videoPlayerWindow.isDestroyed()) {
          sendElectronControlJson(res, 200, { success: true, stopped: false });
          return;
        }
        electronVideoPlayerState = {
          ...electronVideoPlayerState,
          active: false,
          lastStoppedAt: new Date().toISOString(),
          lastEvent: 'stop-requested'
        };
        videoPlayerWindow.webContents.send('bordero-video-player:stop');
        sendElectronControlJson(res, 200, { success: true, stopped: true });
        return;
      }

      sendElectronControlJson(res, 404, { success: false, error: 'Not found' });
    } catch (error) {
      sendElectronControlJson(res, 500, { success: false, error: error?.message || String(error) });
    }
  });

  electronControlServer.listen(ELECTRON_CONTROL_PORT, '127.0.0.1', () => {
    console.log(`Electron control bridge listening on http://127.0.0.1:${ELECTRON_CONTROL_PORT}`);
  });

  electronControlServer.on('error', (error) => {
    console.warn('Electron control bridge error:', error?.message || error);
  });

  return electronControlServer;
}

ipcMain.handle('bordero-video-player:play', async (_event, payload) => {
  const mode = typeof payload === 'object' && payload?.mode === 'webcam-live' ? 'webcam-live' : 'video';
  const videoUrl = typeof payload === 'string' ? payload : payload?.url;

  if (mode === 'video' && !videoUrl) {
    return { success: false, error: 'Missing video url' };
  }

  await ensureVideoPlayerWindow(payload || { url: videoUrl });
  return { success: true, url: videoUrl || '', mode, cameraName: payload?.cameraName || '' };
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

  electronVideoPlayerState = {
    ...electronVideoPlayerState,
    active: false,
    lastStoppedAt: new Date().toISOString(),
    lastEvent: 'stop-requested'
  };
  videoPlayerWindow.webContents.send('bordero-video-player:stop');
  return { success: true, stopped: true };
});

ipcMain.handle('bordero-window:open-secondary', async (_event, payload) => {
  try {
    const targetUrl = toAbsoluteAppUrl(payload?.path);
    const routeResult = await routeUrlByPolicy(targetUrl, 'ipc-open-secondary');
    return {
      success: Boolean(routeResult.primaryUpdated || routeResult.secondaryUpdated),
      url: targetUrl,
      policy: routeResult.policy,
      primaryUpdated: routeResult.primaryUpdated,
      secondaryUpdated: routeResult.secondaryUpdated
    };
  } catch (error) {
    return { success: false, error: error?.message || String(error) };
  }
});

ipcMain.handle('bordero-window:restore-secondary', async () => {
  try {
    return { success: await restoreSecondaryPageBeforeLedDisplay() };
  } catch (error) {
    return { success: false, error: error?.message || String(error) };
  }
});

ipcMain.on('bordero-video-player:ended', (_event, payload) => {
  electronVideoPlayerState = {
    ...electronVideoPlayerState,
    active: false,
    lastCompletedAt: new Date().toISOString(),
    lastEvent: 'ended',
    url: payload?.url || electronVideoPlayerState.url
  };
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

ipcMain.handle('bordero-monitor-policy:last-event', async () => {
  return {
    ok: true,
    event: lastMonitorRouteEvent
  };
});

ipcMain.handle('bordero-file-picker:pick-directory', async () => {
  try {
    const { dialog } = require('electron');
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory', 'showHiddenFiles']
    });

    if (result.canceled) {
      return '';
    }

    const selected = result.filePaths && result.filePaths[0] ? result.filePaths[0] : '';
    return selected;
  } catch (error) {
    console.warn('Unable to open directory picker:', error?.message || error);
    return '';
  }
});

ipcMain.handle('bordero-file-picker:list-directory', async (_event, targetPath = '') => {
  try {
    const candidate = String(targetPath || '').trim();
    const resolved = candidate && fs.existsSync(candidate) ? candidate : (process.env.HOMEDRIVE && process.env.HOMEPATH ? path.join(process.env.HOMEDRIVE, process.env.HOMEPATH) : 'C:\\');
    const stats = fs.existsSync(resolved) && fs.statSync(resolved).isDirectory() ? fs.statSync(resolved) : null;
    if (!stats) {
      return { entries: [] };
    }

    const entries = fs.readdirSync(resolved, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => ({
        name: entry.name,
        path: path.join(resolved, entry.name),
        isDirectory: true
      }))
      .sort((left, right) => left.name.localeCompare(right.name));

    return { entries };
  } catch (error) {
    console.warn('Unable to list directory for picker:', error?.message || error);
    return { entries: [] };
  }
});

async function ensureWindows() {
  await ensureUnifiedServer();
  const monitorPreferences = await ensurePrimaryMonitorSelectionPreference();
  currentSwapMonitors = Boolean(monitorPreferences.swapPrimarySecondary);
  currentAutoConfigureDisplay = Boolean(monitorPreferences.autoConfigureDisplay !== false);
  currentDpiAutoScale = Boolean(monitorPreferences.dpiAutoScale !== false);

  if (!primaryWindow || primaryWindow.isDestroyed()) {
    const config = buildElectronAppConfig({ baseUrl: 'http://localhost:5500' });
    const displays = screen.getAllDisplays();
    const targets = resolveDisplayTargetsForWindows(displays, {
      swapPrimarySecondary: currentSwapMonitors
    });
    const primaryLayout = buildDisplayLayoutConfig(targets.mainDisplay, { width: 1400, height: 900, fullscreen: true });

    primaryWindow = createWindow(config.primaryUrl, {
      ...config.windowOptions,
      x: primaryLayout.x,
      y: primaryLayout.y,
      width: primaryLayout.width,
      height: primaryLayout.height,
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

    const secondaryLayout = buildDisplayLayoutConfig(targets.monitorDisplay, { width: 1280, height: 720, fullscreen: true });

    secondaryWindow = createWindow(config.secondaryUrl, {
      ...config.windowOptions,
      x: secondaryLayout.x,
      y: secondaryLayout.y,
      width: secondaryLayout.width,
      height: secondaryLayout.height,
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
  startElectronControlServer();
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
  if (electronControlServer) {
    electronControlServer.close();
    electronControlServer = null;
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
