const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const source = fs.readFileSync(path.join(__dirname, '../public/base-path.js'), 'utf8');
const navSource = fs.readFileSync(path.join(__dirname, '../public/nav.js'), 'utf8');

test('root-relative URLs under a mounted public path are resolved only once', async () => {
  const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', {
    url: 'http://localhost:5500/public/mobile1.html',
    runScripts: 'outside-only',
  });
  dom.window.fetch = () => Promise.resolve();
  dom.window.eval(source);

  const originalHref = '/Bordero/assets/css/primary-monitor-layout.css';
  const link = dom.window.document.createElement('link');
  link.rel = 'stylesheet';
  link.href = originalHref;
  dom.window.document.head.appendChild(link);
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(link.getAttribute('href'), '/public/Bordero/assets/css/primary-monitor-layout.css');
  assert.equal(dom.window.resolveAppUrl(link.getAttribute('href')), link.getAttribute('href'));
  dom.window.close();
});

test('mobile displays do not inject the desktop monitor theme', () => {
  const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', {
    url: 'http://localhost:5500/public/mobile1.html',
    runScripts: 'outside-only',
  });
  dom.window.fetch = () => Promise.resolve();
  dom.window.eval(source);
  dom.window.eval(navSource);

  assert.equal(dom.window.document.querySelector('script[data-machine-ui-theme]'), null);
  dom.window.close();
});
