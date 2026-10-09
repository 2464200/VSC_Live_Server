const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const { indexedDB } = require('fake-indexeddb');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'USERFORM', 'pages', 'SERVIZIO.html'), 'utf8');
const registry = fs.readFileSync(path.join(root, 'USERFORM', 'js', 'userform-registry.js'), 'utf8');
const pageScript = fs.readFileSync(path.join(root, 'USERFORM', 'js', 'userform-page.js'), 'utf8');
const actions = fs.readFileSync(path.join(root, 'USERFORM', 'js', 'servizio-actions.js'), 'utf8');
const channels = [];
let objectUrlSequence = 0;

class TestBroadcastChannel {
  constructor(name) {
    this.name = name;
    this.listeners = new Map();
    channels.push(this);
  }

  addEventListener(type, callback) {
    this.listeners.set(type, callback);
  }

  postMessage(data) {
    channels
      .filter((channel) => channel !== this && channel.name === this.name)
      .forEach((channel) => channel.listeners.get('message')?.({ data }));
  }

  close() {}
}

function createPage(url) {
  return new JSDOM(html, {
    url,
    runScripts: 'outside-only',
    beforeParse(window) {
      window.indexedDB = indexedDB;
      window.URL.createObjectURL = () => `blob:servizio-test-${++objectUrlSequence}`;
      window.URL.revokeObjectURL = () => {};
    },
  });
}

async function settle() {
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
}

async function waitFor(predicate, description) {
  const deadline = Date.now() + 2000;
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error(`Timed out waiting for ${description}.`);
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

async function readIndexedPresentation(id) {
  const database = await new Promise((resolve, reject) => {
    const request = indexedDB.open('userform-servizio-presentations', 1);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return new Promise((resolve, reject) => {
    const transaction = database.transaction('presentations', 'readonly');
    const request = transaction.objectStore('presentations').get(id);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => database.close();
  });
}

async function run() {
  const operatorDom = createPage('http://localhost:5500/USERFORM/pages/SERVIZIO.html');
  const operator = operatorDom.window;
  const routes = [];
  let stopCalls = 0;
  operator.BroadcastChannel = TestBroadcastChannel;
  operator.electronAPI = {
    windowManager: {
      async openSecondaryPage(payload) {
        routes.push(payload.path);
        return { success: true };
      },
      async stopServicePublication() {
        stopCalls += 1;
        return { success: true };
      },
    },
  };
  operator.eval(registry);
  operator.eval(pageScript);
  operator.eval(actions);

  assert.equal(operator.document.getElementById('service-operator').hidden, false);
  assert.equal(operator.document.getElementById('service-presentation').hidden, true);
  assert.equal(operator.document.getElementById('prev-form').getAttribute('href'), 'QRCODE.html');
  assert.equal(operator.document.getElementById('next-form').getAttribute('href'), 'PAGINA03.html');

  const defaultMessageInput = operator.document.getElementById('service-default-message');
  defaultMessageInput.value = 'Messaggio predefinito personalizzato';
  defaultMessageInput.dispatchEvent(new operator.Event('input'));
  assert.equal(operator.localStorage.getItem('userform-servizio-default-text'), 'Messaggio predefinito personalizzato');

  operator.document.getElementById('service-message-input').value = '';
  operator.document.getElementById('publish-text-btn').click();
  await settle();
  const textRoute = new URL(routes[0], 'http://localhost:5500');
  assert.equal(textRoute.pathname, '/USERFORM/pages/SERVIZIO.html');
  assert.equal(textRoute.searchParams.get('mode'), 'display');
  assert.equal(textRoute.searchParams.get('output'), 'text');
  assert.equal(textRoute.searchParams.get('text'), 'Messaggio predefinito personalizzato');
  assert.equal(operator.localStorage.getItem('userform-servizio-input'), '', 'A default publication must not replace the one-time message value.');
  assert.equal(operator.document.getElementById('stop-text-btn').classList.contains('is-publishing'), true);

  operator.document.getElementById('service-message-input').value = 'Messaggio valido solo questa volta';
  operator.document.getElementById('publish-text-btn').click();
  await settle();
  const overrideRoute = new URL(routes[1], 'http://localhost:5500');
  assert.equal(overrideRoute.searchParams.get('text'), 'Messaggio valido solo questa volta');

  const reloadedDom = createPage('http://localhost:5500/USERFORM/pages/SERVIZIO.html');
  reloadedDom.window.localStorage.setItem('userform-servizio-default-text', operator.localStorage.getItem('userform-servizio-default-text'));
  reloadedDom.window.eval(actions);
  assert.equal(reloadedDom.window.document.getElementById('service-default-message').value, 'Messaggio predefinito personalizzato');
  reloadedDom.window.close();

  const imageInput = operator.document.getElementById('service-image-input');
  const imageFile = new operator.File(['test-image'], 'logo.png', { type: 'image/png' });
  Object.defineProperty(imageInput, 'files', { configurable: true, value: [imageFile] });
  imageInput.dispatchEvent(new operator.Event('change'));
  await waitFor(() => !operator.document.getElementById('publish-logo-btn').disabled, 'image FileReader');
  assert.equal(operator.document.getElementById('publish-logo-btn').disabled, false);
  operator.document.getElementById('publish-logo-btn').click();
  await settle();
  const logoRoute = new URL(routes[2], 'http://localhost:5500');
  const logoId = logoRoute.searchParams.get('id');
  assert.equal(logoRoute.pathname, '/USERFORM/pages/SERVIZIO.html');
  assert.equal(logoRoute.searchParams.get('mode'), 'display');
  assert.equal(logoRoute.searchParams.get('output'), 'logo');
  assert.ok(logoId);
  assert.equal(JSON.parse(operator.localStorage.getItem('userform-servizio-logo:last')).name, 'logo.png');

  const slideshowInput = operator.document.getElementById('service-slideshow-input');
  const slideFiles = [
    new operator.File(['slide-one'], 'slide-one.png', { type: 'image/png' }),
    new operator.File(['slide-two'], 'slide-two.png', { type: 'image/png' }),
  ];
  Object.defineProperty(slideshowInput, 'files', { configurable: true, value: slideFiles });
  slideshowInput.dispatchEvent(new operator.Event('change'));
  await waitFor(() => operator.document.querySelectorAll('#service-slide-list .service-slide-item').length === 2, 'two selected slides');

  const slideTimes = operator.document.querySelectorAll('#service-slide-list input[type="number"]');
  slideTimes[0].value = '1';
  slideTimes[0].dispatchEvent(new operator.Event('change'));
  slideTimes[1].value = '1';
  slideTimes[1].dispatchEvent(new operator.Event('change'));
  operator.document.getElementById('service-total-duration').value = '2';
  operator.document.getElementById('service-total-duration').dispatchEvent(new operator.Event('change'));
  operator.document.getElementById('service-loop-forever').checked = true;
  operator.document.getElementById('service-loop-forever').dispatchEvent(new operator.Event('change'));
  assert.equal(operator.document.getElementById('service-total-duration').disabled, true, 'Permanent loop ignores the total projection duration.');
  operator.document.getElementById('service-loop-forever').checked = false;
  operator.document.getElementById('service-loop-forever').dispatchEvent(new operator.Event('change'));
  operator.document.getElementById('publish-slideshow-btn').click();
  await waitFor(() => routes.length === 4, 'slideshow secondary route');
  const slideshowRoute = new URL(routes[3], 'http://localhost:5500');
  const slideshowId = slideshowRoute.searchParams.get('id');
  assert.equal(slideshowRoute.searchParams.get('output'), 'slideshow');
  const savedPresentation = await readIndexedPresentation(slideshowId);
  assert.equal(savedPresentation.slides.length, 2);
  assert.deepEqual(savedPresentation.slides.map((slide) => slide.durationSeconds), [1, 1]);
  assert.equal(savedPresentation.loop, false);
  assert.equal(savedPresentation.totalDurationSeconds, 2);

  const slideshowDom = createPage(`http://localhost:5500/USERFORM/pages/SERVIZIO.html?mode=display&output=slideshow&id=${encodeURIComponent(slideshowId)}&session=slideshow-test`);
  const slideshowWindow = slideshowDom.window;
  let slideshowClosed = false;
  slideshowWindow.close = () => { slideshowClosed = true; };
  slideshowWindow.BroadcastChannel = TestBroadcastChannel;
  slideshowWindow.eval(actions);
  await waitFor(() => !slideshowWindow.document.querySelector('#published-image').hidden, 'first slide from IndexedDB');
  await waitFor(() => slideshowWindow.document.querySelector('#published-image').alt === 'slide-two.png', 'slide transition');
  await waitFor(() => slideshowClosed, 'automatic slideshow duration end');

  operator.document.getElementById('stop-text-btn').click();
  await settle();
  assert.equal(stopCalls, 1, 'STOP closes the Electron publication window.');
  assert.equal(operator.document.getElementById('stop-text-btn').classList.contains('is-publishing'), false);
  assert.match(operator.document.getElementById('service-status').textContent, /Pubblicazione fermata/i);

  const browserDom = createPage('http://localhost:5500/USERFORM/pages/SERVIZIO.html');
  const browser = browserDom.window;
  browser.BroadcastChannel = TestBroadcastChannel;
  browser.eval(actions);
  browser.document.getElementById('stop-text-btn').click();
  assert.match(browser.document.getElementById('service-status').textContent, /Pubblicazione fermata/i);

  const outputDom = createPage('http://localhost:5500/USERFORM/pages/SERVIZIO.html?mode=display&output=text&text=Prossimo%20ballo');
  const output = outputDom.window;
  output.BroadcastChannel = TestBroadcastChannel;
  output.localStorage.setItem('userform-servizio-logo:last', JSON.stringify({
    id: 'logo-1',
    name: 'logo.png',
    dataUrl: 'data:image/png;base64,ZmFrZQ==',
  }));
  output.eval(actions);
  assert.equal(output.document.body.classList.contains('service-display-mode'), true);
  assert.equal(output.document.getElementById('service-operator').hidden, true);
  assert.equal(output.document.getElementById('service-presentation').hidden, false);
  assert.equal(output.document.getElementById('published-message').textContent, 'Prossimo ballo');

  const logoDom = createPage('http://localhost:5500/USERFORM/pages/SERVIZIO.html?mode=display&output=logo&id=logo-1');
  const logoWindow = logoDom.window;
  logoWindow.BroadcastChannel = TestBroadcastChannel;
  logoWindow.localStorage.setItem('userform-servizio-logo:last', JSON.stringify({
    id: 'logo-1',
    name: 'logo.png',
    dataUrl: 'data:image/png;base64,ZmFrZQ==',
  }));
  let closed = false;
  logoWindow.close = () => { closed = true; };
  logoWindow.eval(actions);
  assert.equal(logoWindow.document.getElementById('published-image').hidden, false);
  assert.equal(logoWindow.document.getElementById('published-image').alt, 'logo.png');
  channels[0].postMessage({ type: 'stop' });
  assert.equal(closed, true, 'The display mode listens for stop messages.');

  operatorDom.window.close();
  browserDom.window.close();
  outputDom.window.close();
  logoDom.window.close();
  slideshowDom.window.close();
  console.log('PASS: SERVIZIO publishes text, images and timed slides through one operator/display page.');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});