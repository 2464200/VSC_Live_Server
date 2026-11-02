const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const { JSDOM } = require('jsdom');

async function createHarness() {
  const html = fs.readFileSync('Eventi/public/eventi.html', 'utf8');
  const script = fs.readFileSync('Eventi/public/eventi.js', 'utf8');
  const dom = new JSDOM(html, {
    url: 'http://localhost:5500/eventi/eventi.html',
    runScripts: 'outside-only'
  });
  if (dom.window.document.readyState === 'loading') {
    await new Promise((resolve) => dom.window.document.addEventListener('DOMContentLoaded', resolve, { once: true }));
  }
  dom.window.eval(script);
  dom.window.eval('bindProtectedActionButtons();');
  return dom;
}

test('Borderò single DJ does not navigate when password verification fails', async (t) => {
  const dom = await createHarness();
  t.after(() => dom.window.close());
  const { window } = dom;
  const navigations = [];
  let verifiedAction = '';
  window.verifyPassword = async (action) => {
    verifiedAction = action;
    return false;
  };
  window.goEventiPage = (url) => navigations.push(url);

  const button = window.document.getElementById('btn-bordero-single-dj');
  const click = new window.MouseEvent('click', { bubbles: true, cancelable: true });
  assert.equal(button.dispatchEvent(click), false, 'the anchor default navigation must be prevented');
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(verifiedAction, 'Accesso Borderò single DJ');
  assert.deepEqual(navigations, []);
});

test('Borderò single DJ navigates only after successful password verification', async (t) => {
  const dom = await createHarness();
  t.after(() => dom.window.close());
  const { window } = dom;
  const navigations = [];
  let releaseVerification;
  window.verifyPassword = () => new Promise((resolve) => {
    releaseVerification = resolve;
  });
  window.goEventiPage = (url) => navigations.push(url);

  const button = window.document.getElementById('btn-bordero-single-dj');
  button.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(navigations, [], 'navigation waits until password validation resolves');

  releaseVerification(true);
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(navigations, ['/Bordero/pages/bordero.html']);
});
