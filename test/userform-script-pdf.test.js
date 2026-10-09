const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'USERFORM', 'index.html'), 'utf8');
const registry = fs.readFileSync(path.join(root, 'USERFORM', 'js', 'userform-registry.js'), 'utf8');
const indexScript = fs.readFileSync(path.join(root, 'USERFORM', 'js', 'userform-index.js'), 'utf8');
const pageScript = fs.readFileSync(path.join(root, 'USERFORM', 'js', 'userform-page.js'), 'utf8');

async function run() {
  const dom = new JSDOM(html, {
    url: 'http://localhost:5500/USERFORM/index.html',
    runScripts: 'outside-only',
  });

  const { window } = dom;
  window.eval(registry);
  window.eval(indexScript);

  const scriptPdfCard = [...window.document.querySelectorAll('.form-card')]
    .find((card) => card.querySelector('h3')?.textContent === 'SCRIPT-PDF');
  assert.equal(scriptPdfCard?.querySelector('a')?.getAttribute('href'), '/pdf/pages/script-pdf-gestione.html');
  assert.equal(fs.existsSync(path.join(root, 'USERFORM', 'pages', 'SCRIPT-PDF.html')), false, 'The intermediate USERFORM launcher page should be removed.');

  for (const [pageId, selector] of [['PAGINA07', '#next-form'], ['PAGINA09', '#prev-form']]) {
    const navDom = new JSDOM('<a id="prev-form"></a><a id="next-form"></a>', {
      url: `http://localhost:5500/USERFORM/pages/${pageId}.html`,
      runScripts: 'outside-only',
    });
    navDom.window.eval(registry);
    navDom.window.eval(pageScript);
    assert.equal(
      navDom.window.document.querySelector(selector).getAttribute('href'),
      '/pdf/pages/script-pdf-gestione.html',
      `${pageId} navigation should point directly to canonical ScriptPDF management.`,
    );
    navDom.window.close();
  }

  window.close();
  console.log('PASS: USERFORM opens canonical ScriptPDF management directly from the form grid.');
  console.log('PASS: Previous/next USERFORM links resolve SCRIPT-PDF directly to the canonical page.');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
