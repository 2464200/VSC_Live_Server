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
  assert.equal(scriptPdfCard?.querySelector('a')?.getAttribute('href'), '/USERFORM/pages/SCRIPT-PDF.html');
  assert.equal(fs.existsSync(path.join(root, 'USERFORM', 'pages', 'SCRIPT-PDF.html')), true, 'SCRIPT-PDF should be a USERFORM page.');

  const registryCard = [...window.document.querySelectorAll('.form-card')]
    .find((card) => card.querySelector('h3')?.textContent === 'REGISTRO COREOGRAFIE');
  assert.equal(registryCard?.querySelector('.badge')?.textContent, 'MVP pronto');
  assert.equal(registryCard?.querySelector('a')?.getAttribute('href'), '/USERFORM/pages/REGISTRO-COREOGRAFIE.html');
  assert.equal(
    fs.existsSync(path.join(root, 'USERFORM', 'pages', 'REGISTRO-COREOGRAFIE.html')),
    true,
    'REGISTRO COREOGRAFIE should be a USERFORM page.',
  );
  const registryPage = fs.readFileSync(path.join(root, 'USERFORM', 'pages', 'REGISTRO-COREOGRAFIE.html'), 'utf8');
  assert.match(registryPage, /class="btn registry-project-access" href="https:\/\/script\.google\.com\/macros\/s\/AKfycbwz8qXT73Pv7t_vDaZZHQvAUAE8VwB3BS0jxwyt7ADA1v8-MvxWv8SDcMIf2sDJAgJ1Gw\/exec"/);
  assert.match(registryPage, /class="btn" href="https:\/\/docs\.google\.com\/spreadsheets\/d\/1SNiw3qc6bZ76duNSxIzxZ2GKHKO8XUpIcl_jZbXs5wY\/edit\?usp=drive_link"[^>]*>Apri Base Dati/);

  for (const [pageId, selector] of [['PAGINA07', '#next-form'], ['PAGINA09', '#prev-form']]) {
    const navDom = new JSDOM('<a id="prev-form"></a><a id="next-form"></a>', {
      url: `http://localhost:5500/USERFORM/pages/${pageId}.html`,
      runScripts: 'outside-only',
    });
    navDom.window.eval(registry);
    navDom.window.eval(pageScript);
    assert.equal(
      navDom.window.document.querySelector(selector).getAttribute('href'),
      '/USERFORM/pages/SCRIPT-PDF.html',
      `${pageId} navigation should point directly to the USERFORM ScriptPDF page.`,
    );
    navDom.window.close();
  }

  window.close();
  console.log('PASS: USERFORM opens its ScriptPDF page directly from the form grid.');
  console.log('PASS: Previous/next USERFORM links resolve SCRIPT-PDF directly to its page.');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
