const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const express = require('express');
const http = require('node:http');
const { JSDOM } = require('jsdom');
const { createMachineUiPreferencesStore } = require('../config/machine-ui-preferences');
const { createUiPreferencesRouter } = require('../Bordero/server/ui-preferences-routes');
const { registerUiPreferencesHandlers } = require('../electron/ui-preferences');
const root = path.resolve(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
const tick = () => new Promise((resolve) => setImmediate(resolve));

function makeStore(t, machine = 'pc') {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'bordero-ui-'));
  t.after(() => fs.rmSync(temporary, { recursive: true, force: true }));
  const file = path.join(temporary, machine, '.local/bordero/ui-preferences.json');
  return { store: createMachineUiPreferencesStore(file), file };
}

test('theme defaults to night, persists across sessions and stays separate for each machine', (t) => {
  const a = makeStore(t, 'pc-a');
  const b = makeStore(t, 'pc-b');
  assert.equal(a.store.read().primaryTheme, 'night');
  a.store.save('day');
  assert.equal(createMachineUiPreferencesStore(a.file).read().primaryTheme, 'day');
  assert.equal(b.store.read().primaryTheme, 'night');
  assert.throws(() => a.store.save('unexpected'), /Modalità non valida/);
  assert.equal(a.store.read().primaryTheme, 'day');
  a.store.save('night');
  assert.equal(a.store.read().primaryTheme, 'night');
  assert.deepEqual(fs.readdirSync(path.dirname(a.file)), ['ui-preferences.json']);
});

test('local browser preferences share disk state with Electron and reject foreign origins and hosts', async (t) => {
  const { store, file } = makeStore(t);
  const app = express();
  app.use(express.json());
  app.use('/preferences', createUiPreferencesRouter(store));
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/preferences`;
  const save = (theme, headers = {}) => fetch(base, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ primaryTheme: theme })
  });
  assert.equal((await save('day')).status, 200);
  assert.equal(createMachineUiPreferencesStore(file).read().primaryTheme, 'day');
  assert.equal((await save('invalid')).status, 400);
  assert.equal((await save('night', { Origin: 'https://example.com' })).status, 403);
  assert.equal((await save('night', { 'Sec-Fetch-Site': 'cross-site' })).status, 403);
  const status = await new Promise((resolve, reject) => {
    http.get(base, { headers: { Host: 'example.com' } }, (res) => { res.resume(); resolve(res.statusCode); }).on('error', reject);
  });
  assert.equal(status, 403);
  const response = await fetch(base);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal((await response.json()).primaryTheme, 'day');
});

function registerNative(store) {
  const handlers = new Map();
  const notifications = [];
  const primary = {};
  const secondary = {};
  registerUiPreferencesHandlers({
    ipcMain: { handle: (name, handler) => handlers.set(name, handler) }, store,
    getWindowRole: (sender) => sender === primary ? 'primary' : sender === secondary ? 'secondary' : 'unknown',
    onChanged: (value) => notifications.push(value)
  });
  const event = (sender = primary, page = 'admin', host = 'localhost') => ({
    sender, senderFrame: { url: `http://${host}:5500/Bordero/pages/${page}.html` }
  });
  return { handlers, notifications, primary, secondary, event };
}

test('native preference changes are restricted to ADMIN in the actual main window', (t) => {
  const { store } = makeStore(t);
  const { handlers, primary, secondary, event, notifications } = registerNative(store);
  const get = handlers.get('bordero-ui-preferences:get');
  const save = handlers.get('bordero-ui-preferences:set');
  assert.equal(get(event(secondary, 'lista-serata')).windowRole, 'secondary');
  assert.equal(save(event(secondary), { primaryTheme: 'day' }).ok, false);
  assert.equal(save(event(primary, 'bordero'), { primaryTheme: 'day' }).ok, false);
  assert.equal(save(event(primary, 'admin', 'example.com'), { primaryTheme: 'day' }).ok, false);
  const subframe = event(primary);
  subframe.sender = { mainFrame: {} };
  assert.equal(get(subframe).ok, false);
  assert.equal(save(event(primary), { primaryTheme: 'day' }).ok, true);
  assert.equal(store.read().primaryTheme, 'day');
  assert.equal(notifications.length, 1);
  assert.equal(get(event(secondary, 'lista-serata')).primaryTheme, 'day');
});

async function themePage(t, store, windowRole, page = 'lista-serata', nativeEnabled = true) {
  const dom = new JSDOM('<!doctype html><html><head></head><body><video></video><canvas></canvas></body></html>', {
    url: `http://localhost:5500/Bordero/pages/${page}.html`, runScripts: 'outside-only'
  });
  t.after(() => dom.window.close());
  const w = dom.window;
  w.setInterval = () => 0;
  if (nativeEnabled) w.electronAPI = { uiPreferences: {
    get: async () => ({ ok: true, ...store.read(), windowRole }),
    set: async ({ primaryTheme }) => ({ ok: true, ...store.save(primaryTheme), windowRole })
  } };
  else w.fetch = async (_url, options) => ({ ok: true, json: async () => ({ ok: true,
    ...(options.method === 'POST' ? store.save(JSON.parse(options.body).primaryTheme) : store.read()) }) });
  w.eval(read('Bordero/js/machine-ui-theme.js'));
  await w.machineUiTheme.refresh();
  return w;
}

test('same dual-monitor page turns white only in the main window and restores the original night styles', async (t) => {
  const { store } = makeStore(t);
  store.save('day');
  const main = await themePage(t, store, 'primary');
  const secondary = await themePage(t, store, 'secondary');
  const unknown = await themePage(t, store, 'unknown');
  assert.equal(main.document.documentElement.dataset.primaryTheme, 'day');
  assert.equal(main.document.documentElement.dataset.monitorRole, 'primary');
  assert.equal(main.document.querySelectorAll('#primary-monitor-layout-css').length, 1);
  assert.equal(main.document.querySelectorAll('#machine-ui-theme-css').length, 1);
  assert.equal(secondary.document.documentElement.hasAttribute('data-primary-theme'), false);
  assert.equal(unknown.document.documentElement.hasAttribute('data-primary-theme'), false);
  assert.equal(secondary.document.documentElement.hasAttribute('data-monitor-role'), false);
  assert.equal(unknown.document.documentElement.hasAttribute('data-monitor-role'), false);
  assert.equal(secondary.document.querySelector('#primary-monitor-layout-css'), null);
  assert.equal(secondary.document.querySelector('#machine-ui-theme-css'), null);
  await main.machineUiTheme.setTheme('night');
  assert.equal(main.document.documentElement.hasAttribute('data-primary-theme'), false);
  assert.equal(main.document.documentElement.dataset.monitorRole, 'primary');
  await main.machineUiTheme.setTheme('day');
  assert.equal(main.document.querySelectorAll('#machine-ui-theme-css').length, 1);
  assert.equal(main.document.querySelectorAll('#primary-monitor-layout-css').length, 1);
  assert.equal(main.document.querySelector('video').getAttribute('style'), null);
  assert.equal(main.document.querySelector('canvas').getAttribute('style'), null);
  main.localStorage.clear();
  assert.equal(store.read().primaryTheme, 'day');
});

test('browser display stays dark and a second local browser reads the same machine preference', async (t) => {
  const { store } = makeStore(t);
  store.save('day');
  const browser = await themePage(t, store, 'primary', 'admin', false);
  const display = await themePage(t, store, 'secondary', 'display', false);
  assert.equal(browser.document.documentElement.dataset.primaryTheme, 'day');
  assert.equal(display.document.documentElement.hasAttribute('data-primary-theme'), false);
  await browser.machineUiTheme.setTheme('night');
  const reopened = await themePage(t, store, 'primary', 'coreografie-corsi', false);
  assert.equal(reopened.machineUiTheme.getCurrent().primaryTheme, 'night');
});

async function adminPage(t, store, unavailable = false) {
  const html = read('Bordero/pages/admin.html').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
  const dom = new JSDOM(html, { url: 'http://localhost:5500/Bordero/pages/admin.html', runScripts: 'outside-only' });
  t.after(() => dom.window.close());
  const w = dom.window;
  const requests = [];
  const alerts = [];
  w.setInterval = () => 0;
  w.alert = (text) => alerts.push(text);
  w.confirm = () => true;
  w.logger = { info() {}, warn() {}, error() {} };
  w.Toast = { success() {}, warning() {}, error() {} };
  w.Storage = {
    get: (key, fallback) => JSON.parse(w.localStorage.getItem(key) || 'null') ?? fallback,
    set: (key, value) => w.localStorage.setItem(key, JSON.stringify(value))
  };
  w.dataLoader = { loadDJ: async () => [], loadBrani: async () => [], loadComuni: async () => [], loadLocations: async () => [] };
  w.excelSync = { excelFile: null };
  w.excelFileManager = { showSelectDialog: async () => null };
  w.BORDERO_CONFIG = { CACHE_KEY_LOCATION: 'BORDERO_LOCATION', CACHE_KEY_CURRENT_SERATA: 'BORDERO_CURRENT_SERATA' };
  w.fetch = async (url, options = {}) => {
    const pathname = new URL(url, w.location.href).pathname;
    requests.push({ pathname, ...options });
    let payload = { ok: true, success: true, rootPath: '', exists: false, fileCount: 0, directories: [], files: [], cameras: [], summary: {} };
    let ok = true;
    if (pathname === '/api/local-ui/preferences') {
      ok = !unavailable;
      payload = unavailable ? { error: 'servizio locale non disponibile' }
        : { ok: true, ...(options.method === 'POST' ? store.save(JSON.parse(options.body).primaryTheme) : store.read()) };
    } else if (pathname.startsWith('/api/admin/deploy/')) {
      payload.status = { intervalEnabled: false, sessionAutoEnabled: false };
      if (options.method === 'POST') payload.status.intervalEnabled = JSON.parse(options.body).enabled;
    } else if (pathname.endsWith('/page-policy')) payload.pagePolicy = {};
    return { ok, status: ok ? 200 : 503, json: async () => payload };
  };
  w.eval(read('Bordero/js/machine-ui-theme.js'));
  // Record the existing full initialization promise rather than disabling any ADMIN setup.
  w.eval(read('Bordero/pages/admin.js') + '\nconst originalAdminInit = AdminPanel.prototype.init; AdminPanel.prototype.init = function () { return this.ready = originalAdminInit.call(this); };');
  await tick();
  await w.adminPanel.ready;
  await tick();
  return { w, requests, alerts };
}

test('full ADMIN initialization preserves existing scroll/deploy/sync controls and saves both theme choices', async (t) => {
  const { store } = makeStore(t);
  const { w, requests } = await adminPage(t, store);
  assert.ok(w.adminPanel.consoleOutput.includes('✓ Admin Panel initialized'));
  assert.notEqual(w.document.getElementById('status-browser').textContent, '--');
  const day = w.document.getElementById('btn-primary-theme-day');
  assert.equal(day.disabled, false);
  day.click();
  await tick();
  assert.equal(store.read().primaryTheme, 'day');
  assert.equal(day.getAttribute('aria-pressed'), 'true');
  w.document.getElementById('btn-primary-theme-night').click();
  await tick();
  assert.equal(store.read().primaryTheme, 'night');
  assert.equal(w.document.documentElement.hasAttribute('data-primary-theme'), false);
  w.document.getElementById('display-scroll-speed').value = '22';
  w.document.getElementById('btn-save-display-scroll').click();
  assert.equal(w.adminPanel.readDisplayScrollSettings().stepMs, 22);
  w.document.getElementById('btn-reset-display-scroll').click();
  assert.equal(w.adminPanel.readDisplayScrollSettings().stepMs, 16);
  w.document.getElementById('btn-deploy-interval').click();
  await tick();
  assert.equal(w.document.getElementById('btn-deploy-interval').getAttribute('aria-pressed'), 'true');
  w.document.getElementById('btn-sync-brani').click();
  assert.ok(w.adminPanel.consoleOutput.some((line) => line.includes('Nessun file selezionato')));
  assert.ok(requests.some((entry) => entry.pathname === '/api/admin/deploy/interval'));
  assert.ok(w.adminPanel.getMonitorPageRoutes().some((entry) => entry.path.endsWith('/coreografie-corsi.html')));
  assert.ok(w.adminPanel.getMonitorPageRouteDefaults().some((entry) => entry.path.endsWith('/coreografie-corsi.html') && entry.primary && !entry.secondary));
  assert.ok(w.document.getElementById('firebase-cloud-auth'));
  w.localStorage.clear();
  assert.equal(store.read().primaryTheme, 'night');
});

test('unavailable machine settings do not interrupt other ADMIN controls or pretend to save the theme', async (t) => {
  const { store } = makeStore(t);
  const { w } = await adminPage(t, store, true);
  assert.ok(w.adminPanel.consoleOutput.includes('✓ Admin Panel initialized'));
  assert.equal(w.document.getElementById('btn-primary-theme-day').disabled, true);
  assert.match(w.document.getElementById('primary-theme-status').textContent, /non disponibile/);
  w.document.getElementById('btn-save-display-scroll').click();
  assert.equal(w.adminPanel.readDisplayScrollSettings().stepMs, 16);
  assert.equal(store.read().primaryTheme, 'night');
});
