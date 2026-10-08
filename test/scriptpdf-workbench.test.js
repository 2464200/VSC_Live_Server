const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const root = path.join(__dirname, '..');
const clientScript = fs.readFileSync(path.join(root, 'pdf', 'assets', 'scriptpdf-workbench.js'), 'utf8');
const publicClientScript = fs.readFileSync(path.join(root, 'public', 'pdf', 'assets', 'scriptpdf-workbench.js'), 'utf8');
const routes = [
  {
    source: 'pdf/pages/script-pdf-gestione.html',
    public: 'public/pdf/pages/script-pdf-gestione.html',
    mode: 'principale',
    retryCount: 1,
  },
];

function response(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return payload;
    },
  };
}

async function settle() {
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
}

async function waitFor(predicate, description) {
  const deadline = Date.now() + 3000;
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error(`Timed out waiting for ${description}.`);
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

async function runPage({ source, mode, retryCount }, electronMode = false) {
  const html = fs.readFileSync(path.join(root, source), 'utf8');
  const dom = new JSDOM(html, {
    url: `http://localhost:5500/${source}`,
    runScripts: 'outside-only',
  });
  const { window } = dom;
  const requests = [];
  let healthCalls = 0;
  let confirmCalls = 0;
  let confirmation = false;
  let closed = false;
  const electronRoutes = [];
  let pdfFiles = [
    { name: '01-primo.pdf', path: 'C:\\VSC_SCRIPT_PDF\\01-primo.pdf', size: '1.00 MB', created: '08/10/2026' },
    { name: '02-secondo.pdf', path: 'C:\\VSC_SCRIPT_PDF\\02-secondo.pdf', size: '2.00 MB', created: '08/10/2026' },
  ];

  window.confirm = () => {
    confirmCalls += 1;
    return confirmation;
  };
  if (electronMode) {
    window.electronAPI = {
      windowManager: {
        async openSecondaryPage(payload) {
          electronRoutes.push(payload.path);
          return { success: true };
        },
        async restoreSecondaryPage() {
          return { success: true };
        },
      },
    };
  }
  window.fetch = async (url, options = {}) => {
    const pathname = new URL(url).pathname;
    requests.push({ pathname, options });
    if (pathname === '/api/health') {
      healthCalls += 1;
      if (mode === 'prova' && healthCalls === 1) {
        return response({ error: 'temporaneamente non disponibile' }, 503);
      }
      return response({ status: 'ok', pdfFolder: 'C:\\VSC_SCRIPT_PDF' });
    }
    if (pathname === '/api/pdf-list') {
      return response({
        success: true,
        folder: 'C:\\VSC_SCRIPT_PDF',
        files: pdfFiles,
      });
    }
    if (pathname === '/api/open-pdf') {
      return response({ success: true, message: 'PDF avviato' });
    }
    if (pathname === '/api/opened-viewers') {
      return response({
        success: true,
        list: closed ? [] : [{ file: 'C:\\VSC_SCRIPT_PDF\\02-secondo.pdf', alive: true, pid: 1234, startedAt: Date.now() }],
      });
    }
    if (pathname === '/api/close-chrome') {
      closed = true;
      return response({ success: true, results: [{ pid: 1234, status: 'killed' }] });
    }
    throw new Error(`Unexpected API request: ${pathname}`);
  };

  window.eval(clientScript);
  await waitFor(() => window.document.getElementById('pdf-status').dataset.state !== 'loading', `${mode} server check`);

  const document = window.document;
  assert.equal(document.body.dataset.scriptpdfMode, mode);
  assert.equal(document.getElementById('pdf-status').dataset.state, 'ready');
  assert.equal(document.getElementById('pdf-select').options.length, 2);
  assert.equal(document.getElementById('pdf-name').textContent, '01-primo.pdf');
  assert.equal(healthCalls, retryCount);

  document.getElementById('pdf-search').value = 'secondo';
  document.getElementById('pdf-search').dispatchEvent(new window.Event('input'));
  assert.equal(document.getElementById('pdf-select').options.length, 1, 'Search filters by PDF filename.');
  assert.equal(document.getElementById('pdf-name').textContent, '02-secondo.pdf');
  document.getElementById('pdf-search').value = '';
  document.getElementById('pdf-search').dispatchEvent(new window.Event('input'));
  document.getElementById('pdf-filter').value = 'unopened';
  document.getElementById('pdf-filter').dispatchEvent(new window.Event('change'));
  assert.equal(document.getElementById('pdf-select').options.length, 2, 'Unopened filter includes PDFs absent from local history.');
  document.getElementById('pdf-filter').value = 'all';
  document.getElementById('pdf-filter').dispatchEvent(new window.Event('change'));
  document.getElementById('pdf-select').value = '0';
  document.getElementById('pdf-select').dispatchEvent(new window.Event('change'));

  document.getElementById('previous-pdf').click();
  assert.equal(document.getElementById('pdf-name').textContent, '02-secondo.pdf', 'Previous navigation wraps to the last PDF.');
  document.getElementById('next-pdf').click();
  assert.equal(document.getElementById('pdf-name').textContent, '01-primo.pdf', 'Next navigation wraps to the first PDF.');

  document.getElementById('pdf-select').value = '1';
  document.getElementById('pdf-select').dispatchEvent(new window.Event('change'));
  document.getElementById('toggle-preview').click();
  const previewUrl = new URL(document.getElementById('pdf-preview').src);
  assert.equal(previewUrl.pathname, '/api/serve-pdf');
  assert.equal(previewUrl.searchParams.get('file'), 'C:\\VSC_SCRIPT_PDF\\02-secondo.pdf');
  assert.equal(document.getElementById('pdf-preview-panel').hidden, false, 'Selected PDF can be previewed inline.');
  document.getElementById('viewer-select').value = 'adobe';
  document.getElementById('adobe-path').value = 'C:\\Adobe\\Acrobat.exe';
  document.getElementById('save-adobe-path').click();
  assert.equal(window.localStorage.getItem('scriptpdf.adobePath'), 'C:\\Adobe\\Acrobat.exe');

  document.getElementById('open-pdf').click();
  await settle();
  const openRequest = requests.find((item) => item.pathname === '/api/open-pdf');
  if (electronMode) {
    assert.equal(electronRoutes.length, 1, 'Electron should open one managed secondary window.');
    const viewerRoute = new URL(electronRoutes[0], 'http://localhost:5500');
    assert.equal(viewerRoute.pathname, '/pdf/viewers/pdf-viewer.html');
    assert.equal(viewerRoute.searchParams.get('file'), 'C:\\VSC_SCRIPT_PDF\\02-secondo.pdf');
    assert.equal(viewerRoute.searchParams.get('name'), '02-secondo.pdf');
    assert.equal(openRequest, undefined, 'Electron must not launch an external Acrobat/Chrome viewer.');
    assert.equal(document.getElementById('external-viewer-settings').hidden, true);
    assert.equal(document.getElementById('managed-viewer-sessions').hidden, true);
  } else {
    assert.ok(openRequest, 'Opening the selected PDF calls the unified-server endpoint in a browser.');
    assert.deepEqual(JSON.parse(openRequest.options.body), {
      filePath: 'C:\\VSC_SCRIPT_PDF\\02-secondo.pdf',
      fileName: '02-secondo.pdf',
      viewer: 'adobe',
      adobePath: 'C:\\Adobe\\Acrobat.exe',
    });
  }
  assert.equal(document.getElementById('pdf-message').dataset.state, 'success');
  const history = JSON.parse(window.localStorage.getItem('scriptpdf.openHistory'));
  assert.equal(history.length, 1);
  assert.equal(history[0].path, 'C:\\VSC_SCRIPT_PDF\\02-secondo.pdf');
  assert.equal(document.querySelectorAll('.pdf-history-open').length, 1, 'Recently opened PDFs are listed as selectable history entries.');
  document.getElementById('pdf-filter').value = 'recent';
  document.getElementById('pdf-filter').dispatchEvent(new window.Event('change'));
  assert.equal(document.getElementById('pdf-select').options.length, 1, 'Recent filter returns the PDF opened in this browser.');
  document.querySelector('.pdf-history-open').click();
  assert.equal(document.getElementById('pdf-name').textContent, '02-secondo.pdf', 'History entries reselect PDFs present in the current archive.');

  if (!electronMode) {
    document.getElementById('close-viewers').click();
    await settle();
    assert.equal(confirmCalls, 1, 'Closing managed viewer sessions requires confirmation.');
    assert.equal(requests.filter((item) => item.pathname === '/api/close-chrome').length, 0, 'Cancel leaves all viewer sessions open.');

    confirmation = true;
    document.getElementById('close-viewers').click();
    await settle();
    assert.equal(confirmCalls, 2);
    assert.equal(requests.filter((item) => item.pathname === '/api/close-chrome').length, 1);
    assert.match(document.getElementById('pdf-message').textContent, /sessioni PDF gestite chiuse/i);
  }

  pdfFiles = [];
  document.getElementById('refresh-pdf-list').click();
  await waitFor(() => document.getElementById('pdf-status').dataset.state === 'loading', `${mode} PDF list refresh`);
  await waitFor(
    () => document.getElementById('pdf-select').options[0]?.textContent === 'Nessun PDF corrispondente',
    `${mode} empty PDF list state`,
  );
  assert.equal(document.getElementById('pdf-status').dataset.state, 'ready');
  assert.equal(document.getElementById('open-pdf').disabled, true);

  window.close();
}

async function run() {
  assert.equal(publicClientScript, clientScript, 'source and public workbench scripts should stay in sync.');
  for (const route of routes) {
    const sourceHtml = fs.readFileSync(path.join(root, route.source), 'utf8');
    const publicHtml = fs.readFileSync(path.join(root, route.public), 'utf8');
    assert.equal(publicHtml, sourceHtml, `${route.source} and ${route.public} should stay in sync.`);
    assert.match(sourceHtml, /data-scriptpdf-mode="principale"/);
    assert.match(sourceHtml, /\/pdf\/assets\/scriptpdf-workbench\.css/);
    assert.match(sourceHtml, /\/pdf\/assets\/scriptpdf-workbench\.js/);
    await runPage(route);
    await runPage(route, true);
    console.log('PASS: canonical page preserves PDF browsing and uses Electron overlay with browser fallback.');
  }
  const legacyAliases = [
    ['pdf/viewers/ScriptPDF1.html', '/pdf/pages/script-pdf-gestione.html'],
    ['Prova/ScriptPDF1.html', '/pdf/pages/script-pdf-gestione.html'],
    ['public/ScriptPDF1.html', '/pdf/pages/script-pdf-gestione.html'],
    ['public/Prova/ScriptPDF1.html', '/pdf/pages/script-pdf-gestione.html'],
  ];
  for (const [aliasPath, canonicalRoute] of legacyAliases) {
    const alias = fs.readFileSync(path.join(root, aliasPath), 'utf8');
    assert.match(alias, new RegExp(canonicalRoute.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  for (const aliasPath of ['pdf/pages/script-pdf-prova.html', 'public/pdf/pages/script-pdf-prova.html']) {
    const alias = fs.readFileSync(path.join(root, aliasPath), 'utf8');
    assert.match(alias, /location\.replace\("\/pdf\/pages\/script-pdf-gestione\.html"\)/);
  }

  const viewerHtml = fs.readFileSync(path.join(root, 'pdf', 'viewers', 'pdf-viewer.html'), 'utf8');
  const viewerDom = new JSDOM(viewerHtml, {
    url: 'http://localhost:5500/pdf/viewers/pdf-viewer.html?file=C%3A%5CVSC_SCRIPT_PDF%5Ctest.pdf&name=test.pdf',
    runScripts: 'dangerously',
    beforeParse(window) {
      window.electronAPI = {
        windowManager: {
          async restoreSecondaryPage() {
            restoreCalls += 1;
            return { success: true };
          },
        },
      };
    },
  });
  let restoreCalls = 0;
  viewerDom.window.document.getElementById('close-btn').click();
  await settle();
  assert.equal(restoreCalls, 1, 'Closing the Electron PDF viewer should restore DISPLAY through the window manager.');
  viewerDom.window.close();
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
