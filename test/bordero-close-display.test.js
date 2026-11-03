const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const { JSDOM } = require('jsdom');

async function createHarness() {
  const html = fs.readFileSync('Bordero/pages/bordero.html', 'utf8');
  const dom = new JSDOM(html, {
    url: 'http://localhost:5500/Bordero/pages/bordero.html',
    runScripts: 'outside-only'
  });
  const { window } = dom;
  await new Promise((resolve) => setImmediate(resolve));
  window.eval([
    fs.readFileSync('Bordero/js/config.js', 'utf8'),
    fs.readFileSync('Bordero/js/utils.js', 'utf8'),
    fs.readFileSync('Bordero/pages/bordero.js', 'utf8'),
    'window.testSecretCode = BORDERO_CONFIG.APP_CLOSE_SECRET_CODE;'
  ].join('\n'));
  return {
    dom,
    window,
    manager: Object.create(window.BorderoTableManager.prototype)
  };
}

test('closing DISPLAY requires the configured secret before invoking Electron', async (t) => {
  const { dom, window, manager } = await createHarness();
  t.after(() => dom.window.close());
  let closeCalls = 0;
  window.electronAPI = {
    windowManager: {
      async openSecondaryPage() {
        return { success: true, secondaryUpdated: true };
      },
      async closeDisplayPage() {
        closeCalls += 1;
        return { success: true, closed: true };
      }
    }
  };

  const closePromise = manager.closeDisplayWindow();
  const modal = window.document.getElementById('close-display-code-modal');
  const input = window.document.getElementById('close-display-code-input');
  const confirm = window.document.getElementById('close-display-code-confirm');
  const error = window.document.getElementById('close-display-code-error');
  assert.equal(modal.hidden, false);

  input.value = 'incorrect';
  confirm.click();
  assert.equal(closeCalls, 0, 'incorrect code must not invoke the close command');
  assert.equal(error.hidden, false);

  input.value = ` ${window.testSecretCode} `;
  confirm.click();
  await closePromise;
  assert.equal(closeCalls, 1);
  assert.equal(modal.hidden, true);
  assert.match(window.document.querySelector('.toast-success').textContent, /Display chiuso/);
});

test('cancelling DISPLAY closure leaves the page open', async (t) => {
  const { dom, window, manager } = await createHarness();
  t.after(() => dom.window.close());
  let closeCalls = 0;
  window.electronAPI = {
    windowManager: {
      async openSecondaryPage() {
        return { success: true, secondaryUpdated: true };
      },
      async closeDisplayPage() {
        closeCalls += 1;
        return { success: true, closed: true };
      }
    }
  };

  const closePromise = manager.closeDisplayWindow();
  window.document.getElementById('close-display-code-cancel').click();
  await closePromise;
  assert.equal(closeCalls, 0);
  assert.equal(window.document.getElementById('close-display-code-modal').hidden, true);
});

test('DISPLAY closure reports that it requires the Electron app when the bridge is unavailable', async (t) => {
  const { dom, window, manager } = await createHarness();
  t.after(() => dom.window.close());
  window.electronAPI = {};

  await manager.closeDisplayWindow();
  assert.equal(window.document.getElementById('close-display-code-modal').hidden, true);
  assert.match(window.document.querySelector('.toast-warning').textContent, /solo nell’app Electron/);
});

test('a manually closed DISPLAY restores its blinking button state after Bordero reload', async (t) => {
  const { dom, window, manager } = await createHarness();
  t.after(() => dom.window.close());
  window.electronAPI = {
    windowManager: {
      async getDisplayStatus() {
        return { success: true, closed: true };
      }
    }
  };

  await manager.syncDisplayWindowButtonState();
  const button = window.document.getElementById('btn-close-display-remote');
  assert.equal(manager.displayWindowManuallyClosed, true);
  assert.equal(button.textContent, 'RIPRISTINA DISPLAY');
  assert.equal(button.classList.contains('remote-action-pending'), true);
});

test('the next CHIUDI DISPLAY click restores DISPLAY on the secondary monitor', async (t) => {
  const { dom, window, manager } = await createHarness();
  t.after(() => dom.window.close());
  const openedPaths = [];
  window.electronAPI = {
    windowManager: {
      async closeDisplayPage() {
        return { success: true, closed: true };
      },
      async openSecondaryPage(payload) {
        openedPaths.push(payload.path);
        return { success: true, secondaryUpdated: true };
      }
    }
  };

  const closePromise = manager.closeDisplayWindow();
  window.document.getElementById('close-display-code-input').value = window.testSecretCode;
  window.document.getElementById('close-display-code-confirm').click();
  await closePromise;
  assert.equal(manager.displayWindowManuallyClosed, true);
  const displayButton = window.document.getElementById('btn-close-display-remote');
  assert.equal(displayButton.textContent, 'RIPRISTINA DISPLAY');
  assert.equal(displayButton.classList.contains('remote-action-pending'), true);

  await manager.closeDisplayWindow();
  assert.deepEqual(openedPaths, ['/Bordero/pages/display.html']);
  assert.equal(manager.displayWindowManuallyClosed, false);
  assert.equal(displayButton.textContent, 'CHIUDI DISPLAY');
  assert.equal(displayButton.classList.contains('remote-action-pending'), false);
  const successMessages = [...window.document.querySelectorAll('.toast-success')].map((toast) => toast.textContent);
  assert.match(successMessages.at(-1), /ripristinato sul monitor secondario/i);
});

test('CHIUDI DISPLAY button invokes its guarded closure flow', async (t) => {
  const { dom, window, manager } = await createHarness();
  t.after(() => dom.window.close());
  let closeFlowCalls = 0;
  manager.closeDisplayWindow = async () => {
    closeFlowCalls += 1;
  };
  for (const method of [
    'setupFilterValuePicker',
    'setupDeselectionConfirmModal',
    'setupMusicMatchModal',
    'updateConsoleStatus',
    'setupVirtualDjConsolePolling',
    'bindSortButton',
    'setupColumnHeaderSorting',
    'bindMoveExecutedBottomButton',
    'bindFilterPopupButton'
  ]) {
    manager[method] = () => {};
  }

  manager.setupEventListeners();
  window.document.getElementById('btn-close-display-remote').click();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(closeFlowCalls, 1);
});
