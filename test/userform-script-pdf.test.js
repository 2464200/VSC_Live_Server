const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'USERFORM', 'pages', 'SCRIPT-PDF.html'), 'utf8');
const registry = fs.readFileSync(path.join(root, 'USERFORM', 'js', 'userform-registry.js'), 'utf8');
const pageScript = fs.readFileSync(path.join(root, 'USERFORM', 'js', 'userform-page.js'), 'utf8');
const actions = fs.readFileSync(path.join(root, 'USERFORM', 'js', 'script-pdf-actions.js'), 'utf8');

async function run() {
  const dom = new JSDOM(html, {
    url: 'http://localhost:5500/USERFORM/pages/SCRIPT-PDF.html',
    runScripts: 'outside-only',
  });

  const { window } = dom;
  const electronRoutes = [];
  window.eval(registry);
  window.eval(pageScript);
  window.electronAPI = {
    windowManager: {
      async openSecondaryPage(payload) {
        electronRoutes.push(payload.path);
        return { success: true };
      },
    },
  };
  window.eval(actions);

  window.document.getElementById('btn-scriptpdf-root').click();
  window.document.querySelector('.script-pdf-thumbnail-control[data-route="/pdf/pages/script-pdf-gestione.html"]').click();
  await new Promise((resolve) => setImmediate(resolve));

  assert.deepEqual(electronRoutes, [
    '/pdf/pages/script-pdf-gestione.html',
    '/pdf/pages/script-pdf-gestione.html',
  ]);
  assert.equal(window.document.querySelector('img[src="../../archivio/ScriptPDF-principale.jpg"]')?.closest('button')?.dataset.route, '/pdf/pages/script-pdf-gestione.html');

  window.electronAPI.windowManager.openSecondaryPage = async () => ({ success: false });
  window.document.getElementById('btn-scriptpdf-root').click();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(window.document.getElementById('script-pdf-status').dataset.state, 'error');
  assert.match(window.document.querySelector('.script-pdf-status-message').textContent, /Electron non ha completato/);

  const browserRoutes = [];
  delete window.electronAPI;
  window.openManagedPage = (url) => {
    browserRoutes.push(url);
    return true;
  };
  window.document.getElementById('btn-scriptpdf-root').click();
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(browserRoutes, ['http://localhost:5500/pdf/pages/script-pdf-gestione.html']);

  assert.equal(window.document.querySelectorAll('.script-pdf-launch-card').length, 1);
  assert.equal(window.document.querySelector('#prev-form').getAttribute('href'), 'PAGINA07.html');
  assert.equal(window.document.querySelector('#next-form').getAttribute('href'), 'PAGINA09.html');

  window.close();
  console.log('PASS: SCRIPT-PDF routes the single canonical page through Electron monitor policy.');
  console.log('PASS: SCRIPT-PDF validates Electron failures and preserves browser-mode fallback.');
  console.log('PASS: SCRIPT-PDF retains the previous/next USERFORM navigation.');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
