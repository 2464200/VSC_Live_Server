const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const root = path.join(__dirname, '..');
const clientScript = fs.readFileSync(path.join(root, 'pdf', 'assets', 'scriptpdf-workbench.js'), 'utf8');
const routes = [
  {
    source: 'pdf/viewers/ScriptPDF1.html',
    public: 'public/ScriptPDF1.html',
    mode: 'principale',
    retryCount: 1,
  },
  {
    source: 'Prova/ScriptPDF1.html',
    public: 'public/Prova/ScriptPDF1.html',
    mode: 'prova',
    retryCount: 2,
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

async function runPage({ source, mode, retryCount }) {
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
  let pdfFiles = [
    { name: '01-primo.pdf', path: 'C:\\VSC_SCRIPT_PDF\\01-primo.pdf', size: '1.00 MB', created: '08/10/2026' },
    { name: '02-secondo.pdf', path: 'C:\\VSC_SCRIPT_PDF\\02-secondo.pdf', size: '2.00 MB', created: '08/10/2026' },
  ];

  window.confirm = () => {
    confirmCalls += 1;
    return confirmation;
  };
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

  document.getElementById('previous-pdf').click();
  assert.equal(document.getElementById('pdf-name').textContent, '02-secondo.pdf', 'Previous navigation wraps to the last PDF.');
  document.getElementById('next-pdf').click();
  assert.equal(document.getElementById('pdf-name').textContent, '01-primo.pdf', 'Next navigation wraps to the first PDF.');

  document.getElementById('pdf-select').value = '1';
  document.getElementById('pdf-select').dispatchEvent(new window.Event('change'));
  document.getElementById('viewer-select').value = 'adobe';
  document.getElementById('adobe-path').value = 'C:\\Adobe\\Acrobat.exe';
  document.getElementById('save-adobe-path').click();
  assert.equal(window.localStorage.getItem('scriptpdf.adobePath'), 'C:\\Adobe\\Acrobat.exe');

  document.getElementById('open-pdf').click();
  await settle();
  const openRequest = requests.find((item) => item.pathname === '/api/open-pdf');
  assert.ok(openRequest, 'Opening the selected PDF calls the unified-server endpoint.');
  assert.deepEqual(JSON.parse(openRequest.options.body), {
    filePath: 'C:\\VSC_SCRIPT_PDF\\02-secondo.pdf',
    fileName: '02-secondo.pdf',
    viewer: 'adobe',
    adobePath: 'C:\\Adobe\\Acrobat.exe',
  });
  assert.equal(document.getElementById('pdf-message').dataset.state, 'success');

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

  pdfFiles = [];
  document.getElementById('refresh-pdf-list').click();
  await waitFor(() => document.getElementById('pdf-status').dataset.state === 'loading', `${mode} PDF list refresh`);
  await waitFor(
    () => document.getElementById('pdf-select').options[0]?.textContent === "Nessun PDF nell'elenco",
    `${mode} empty PDF list state`,
  );
  assert.equal(document.getElementById('pdf-status').dataset.state, 'ready');
  assert.equal(document.getElementById('open-pdf').disabled, true);

  window.close();
}

async function run() {
  for (const route of routes) {
    const sourceHtml = fs.readFileSync(path.join(root, route.source), 'utf8');
    const publicHtml = fs.readFileSync(path.join(root, route.public), 'utf8');
    assert.equal(publicHtml, sourceHtml, `${route.source} and ${route.public} should stay in sync.`);
    assert.match(sourceHtml, /\/pdf\/assets\/scriptpdf-workbench\.css/);
    assert.match(sourceHtml, /\/pdf\/assets\/scriptpdf-workbench\.js/);
    await runPage(route);
    console.log(`PASS: ${route.mode} page preserves PDF selection, navigation, viewer preferences, and managed-session controls.`);
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
