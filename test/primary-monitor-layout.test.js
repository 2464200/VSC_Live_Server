const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');

async function checkElectronLayout() {
  const { app, BrowserWindow, ipcMain, session } = require('electron');
  const http = require('node:http');
  const { createMachineUiPreferencesStore } = require('../config/machine-ui-preferences');
  const { registerUiPreferencesHandlers } = require('../electron/ui-preferences');
  const temporary = process.argv[2];
  app.setPath('userData', path.join(temporary, 'profile'));
  app.disableHardwareAcceleration();
  await app.whenReady();
  const store = createMachineUiPreferencesStore(path.join(temporary, 'preferences.json'));
  const roles = new Map();
  registerUiPreferencesHandlers({ ipcMain, store, getWindowRole: (sender) => roles.get(sender.id) || 'unknown' });
  const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
  const main = read('electron/main.js');
  const policy = main.slice(main.indexOf('const PAGE_POLICY ='), main.indexOf('let currentPagePolicy'));
  const routes = [...policy.matchAll(/\['([^']+)', \{ primary: true/g)].map((match) => match[1]);
  routes.push('/USERFORM/index.html');
  const cases = new Map();
  for (const route of routes) {
    const candidates = route.startsWith('/eventi/')
      ? [route.replace(/^\/eventi\/(?:public\/)?/, 'Eventi/public/'), route.slice(1)]
      : [route.slice(1), `public${route}`];
    const file = candidates.find((candidate) => fs.existsSync(path.join(root, candidate)));
    // Legacy aliases have their own routing regression tests and redirect to the current workbench.
    if (!file || /scriptpdf1\.html$/i.test(file) || cases.has(file.toLowerCase())) continue;
    let html = read(file).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<meta\b[^>]*http-equiv=["']?refresh[^>]*>/gi, '');
    html = html.replace(/<link\b[^>]*>/gi, (tag) => {
      if (!/rel=["']stylesheet["']/i.test(tag)) return '';
      const href = tag.match(/href=["']([^"']+)["']/i)?.[1]?.split('?')[0];
      if (!href || /^https?:/i.test(href)) return '';
      const stylesheet = href.startsWith('/') ? path.join(root, href.slice(1)) : path.resolve(root, path.dirname(file), href);
      return fs.existsSync(stylesheet) ? `<style>${fs.readFileSync(stylesheet, 'utf8')}</style>` : '';
    });
    cases.set(file.toLowerCase(), { route, html });
  }
  const assets = new Map([
    ['/Bordero/js/machine-ui-theme.js', 'Bordero/js/machine-ui-theme.js'],
    ['/Bordero/assets/css/primary-monitor-layout.css', 'Bordero/assets/css/primary-monitor-layout.css'],
    ['/Bordero/assets/css/machine-ui-theme.css', 'Bordero/assets/css/machine-ui-theme.css']
  ]);
  const fixtureByRoute = new Map([...cases.values()].map((entry) => [entry.route.toLowerCase(), entry.html]));
  const server = http.createServer((req, res) => {
    const requested = new URL(req.url, 'http://localhost').pathname;
    const html = fixtureByRoute.get(requested.toLowerCase());
    if (html) { res.setHeader('Content-Type', 'text/html; charset=utf-8'); return res.end(html); }
    if (assets.has(requested)) {
      res.setHeader('Content-Type', requested.endsWith('.js') ? 'application/javascript' : 'text/css');
      return res.end(read(assets.get(requested)));
    }
    res.statusCode = 404; res.end('');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    callback({ cancel: /^https?:/.test(details.url) && !details.url.startsWith(base + '/') });
  });
  const create = (role) => {
    const win = new BrowserWindow({ show: false, width: 1920, height: 1080, webPreferences: {
      offscreen: true, backgroundThrottling: false, contextIsolation: true,
      ...(role ? { preload: path.join(root, 'electron/preload.js') } : {})
    } });
    if (role) roles.set(win.webContents.id, role);
    return win;
  };
  const baseline = create();
  const primary = create('primary');
  const secondary = create('secondary');
  const snapshot = `(() => {
    const frames = [...document.querySelectorAll('body > .container,body > .layout,body > .presentation-shell,body > .screen-shell,body > .pdf-shell,body > .service-shell,body > .control-shell,body > .shell,body > .page,body > .grid,body > .card,body > .nav,.screen-shell > .settings-layout')]
      .filter(node => node.getBoundingClientRect().width > 0);
    const body = getComputedStyle(document.body);
    return {
      role: document.documentElement.dataset.monitorRole || '',
      theme: document.documentElement.dataset.primaryTheme || '',
      ready: !!document.getElementById('primary-monitor-layout-css')?.sheet,
      available: document.body.getBoundingClientRect().width - parseFloat(body.paddingLeft) - parseFloat(body.paddingRight),
      background: body.backgroundColor,
      frames: frames.map(node => ({name: node.className, width: node.getBoundingClientRect().width, font: getComputedStyle(node).fontSize})),
      buttons: [...document.querySelectorAll('button,.btn')].map(node => getComputedStyle(node).fontSize),
      dialogs: [...document.querySelectorAll('.modal-content,.filter-picker-content')].map(node => getComputedStyle(node).maxWidth),
      printWidth: document.getElementById('print-document') ? getComputedStyle(document.getElementById('print-document')).maxWidth : ''
    };
  })()`;
  const load = async (win, route, expectedRole = '') => {
    await win.loadURL(base + route);
    for (let attempt = 0; attempt < 30; attempt++) {
      const state = await win.webContents.executeJavaScript(snapshot);
      if (!expectedRole || state.role === expectedRole && state.ready) return state;
      await new Promise((resolve) => setTimeout(resolve, 30));
    }
    throw new Error(`${expectedRole} layout not loaded: ${route}`);
  };
  let expandedFrames = 0;
  for (const { route } of cases.values()) {
    baseline.setContentSize(1920, 1080);
    const original = await load(baseline, route, false);
    const secondaryState = await load(secondary, route, 'secondary');
    for (const frame of secondaryState.frames) {
      assert.ok(Math.abs(frame.width - secondaryState.available) <= 5, `Unused secondary width ${route}: ${JSON.stringify(frame)}, available ${secondaryState.available}`);
    }
    assert.deepEqual(secondaryState.buttons, original.buttons, `Secondary button font changed: ${route}`);
    assert.deepEqual(secondaryState.dialogs, original.dialogs, `Secondary dialog limits changed: ${route}`);
    assert.equal(secondaryState.background, original.background, `Secondary background changed: ${route}`);
    assert.equal(secondaryState.printWidth, original.printWidth, `Secondary A4 document changed: ${route}`);
    for (const width of [1366, 1920, 2560]) {
      baseline.setContentSize(width, 1080);
      const sameViewportOriginal = await load(baseline, route, false);
      primary.setContentSize(width, 1080);
      const state = await load(primary, route, 'primary');
      for (const frame of state.frames) {
        assert.ok(Math.abs(frame.width - state.available) <= 5, `Unused primary width ${route} at ${width}: ${JSON.stringify(frame)}, available ${state.available}`);
      }
      assert.deepEqual(state.buttons, sameViewportOriginal.buttons, `Button font changed: ${route}`);
      assert.deepEqual(state.dialogs, sameViewportOriginal.dialogs, `Dialog limits changed: ${route}`);
      assert.equal(state.background, sameViewportOriginal.background, `Night background changed: ${route}`);
      assert.equal(state.printWidth, sameViewportOriginal.printWidth, `A4 document changed: ${route}`);
      if (width === 1920) expandedFrames += state.frames.filter((frame, index) => frame.width > (original.frames[index]?.width || 0) + 20).length;
    }
  }
  const printRoute = '/bordero/pages/coreografie-stampa.html';
  for (const win of [baseline, primary]) {
    await load(win, printRoute, win === primary ? 'primary' : '');
    win.webContents.debugger.attach('1.3');
    await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia', { media: 'print' });
  }
  const originalPrint = await baseline.webContents.executeJavaScript(snapshot);
  const primaryPrint = await primary.webContents.executeJavaScript(snapshot);
  assert.deepEqual(primaryPrint.frames, originalPrint.frames, 'Print layout changed');
  assert.equal(primaryPrint.printWidth, originalPrint.printWidth, 'Printed A4 width changed');
  for (const win of [baseline, primary]) {
    await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia', { media: 'screen' });
    win.webContents.debugger.detach();
  }
  store.save('day');
  const day = await load(primary, '/bordero/pages/admin.html', 'primary');
  assert.equal(day.theme, 'day');
  assert.ok(day.frames.every((frame) => Math.abs(frame.width - day.available) <= 5));
  assert.ok(expandedFrames > 20, 'Expected broad coverage of previously capped primary frames');
  console.log(JSON.stringify({ pages: cases.size, resolutions: [1366, 1920, 2560], expandedFrames, secondary: 'full width', print: 'unchanged', dayAndNight: 'full width' }));
  baseline.destroy(); primary.destroy(); secondary.destroy(); server.close(); app.exit(0);
}

if (process.versions.electron) {
  checkElectronLayout().catch((error) => { console.error(error); require('electron').app.exit(1); });
} else {
  const test = require('node:test');
  const os = require('node:os');
  const { execFile } = require('node:child_process');
  test('actual Electron preload expands UI pages on both monitors while preserving fonts, dialogs and A4 print', { timeout: 190000 }, async (t) => {
    const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'bordero-primary-layout-'));
    t.after(() => fs.rmSync(temporary, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }));
    const env = { ...process.env };
    delete env.ELECTRON_RUN_AS_NODE;
    const output = await new Promise((resolve, reject) => execFile(require('electron'), [__filename, temporary], {
      cwd: root, env, windowsHide: true, timeout: 180000, maxBuffer: 1024 * 1024
    }, (error, stdout, stderr) => error ? reject(new Error(`${error.message}\n${stdout}\n${stderr}`)) : resolve(stdout)));
    console.log(output.trim());
  });
}
