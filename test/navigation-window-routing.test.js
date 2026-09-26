const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const navigationScript = fs.readFileSync('nav.js', 'utf8');
const displayPath = '/Bordero/pages/display.html';

function createNavigationHarness(pathname, options = {}) {
  let clickHandler = null;
  const openedWindows = [];
  const alerts = [];
  const state = {
    pathname,
    href: `http://localhost:5500${pathname}`,
    protocol: 'http:',
  };

  const document = {
    readyState: 'complete',
    querySelector: () => ({}),
    getElementById: () => null,
    addEventListener(type, handler, capture) {
      if (type === 'click' && capture) clickHandler = handler;
    },
  };

  const window = {
    location: state,
    name: '',
    opener: options.opener || null,
    closed: false,
    focus() {},
    alert(message) { alerts.push(message); },
    open(url, name, features) {
      const popup = {
        closed: false,
        location: {
          href: url || 'about:blank',
          replace(nextUrl) { this.href = nextUrl; },
        },
        moveTo(left, top) { this.position = { left, top }; },
        resizeTo(width, height) { this.size = { width, height }; },
      };
      openedWindows.push({ url, name, features, popup });
      return popup;
    },
    ...options.windowOverrides,
  };

  vm.runInNewContext(navigationScript, {
    window,
    document,
    URL,
    Promise,
    Number,
    String,
    console,
  });

  return {
    window,
    openedWindows,
    alerts,
    click(href) {
      const anchor = {
        href,
        getAttribute() { return href; },
        closest(selector) { return selector === 'a[href]' ? this : null; },
      };
      const event = {
        target: anchor,
        button: 0,
        defaultPrevented: false,
        preventDefault() { this.defaultPrevented = true; },
        stopPropagation() {},
      };
      clickHandler(event);
      return event;
    },
  };
}

async function run() {
  const primary = createNavigationHarness('/Bordero/pages/bordero.html', {
    windowOverrides: {
      getScreenDetails: async () => ({
        screens: [
          { isPrimary: true },
          { isPrimary: false, availLeft: 1920, availTop: 0, availWidth: 1920, availHeight: 1080 },
        ],
      }),
    },
  });
  const displayClick = primary.click(`http://localhost:5500${displayPath}`);
  assert.equal(displayClick.defaultPrevented, true);
  assert.equal(primary.window.name, 'bordero-primary');
  assert.equal(primary.openedWindows[0].name, 'bordero-display-secondary');
  assert.equal(primary.openedWindows[0].popup.location.href, `http://localhost:5500${displayPath}`);
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(primary.openedWindows[0].popup.position, { left: 1920, top: 0 });
  assert.deepEqual(primary.openedWindows[0].popup.size, { width: 1920, height: 1080 });

  const normalPage = createNavigationHarness('/Bordero/pages/bordero.html');
  const normalClick = normalPage.click('http://localhost:5500/Bordero/pages/next-coreo.html');
  assert.equal(normalClick.defaultPrevented, false);
  assert.equal(normalPage.openedWindows.length, 0);

  let primaryNavigation = '';
  let primaryFocused = false;
  const display = createNavigationHarness(displayPath, {
    opener: {
      closed: false,
      location: { assign(url) { primaryNavigation = url; } },
      focus() { primaryFocused = true; },
    },
  });
  const homeClick = display.click('http://localhost:5500/Bordero/index.html');
  assert.equal(homeClick.defaultPrevented, true);
  assert.equal(primaryNavigation, 'http://localhost:5500/Bordero/index.html');
  assert.equal(primaryFocused, true);
  assert.equal(display.openedWindows.length, 0);
  assert.equal(display.window.name, 'bordero-display-secondary');

  const standaloneDisplay = createNavigationHarness(displayPath);
  const standaloneClick = standaloneDisplay.click('http://localhost:5500/Bordero/index.html');
  assert.equal(standaloneClick.defaultPrevented, true);
  assert.equal(standaloneDisplay.openedWindows[0].name, 'bordero-primary');
  assert.equal(standaloneDisplay.openedWindows[0].url, 'http://localhost:5500/Bordero/index.html');

  let electronRoute = null;
  const electronPrimary = createNavigationHarness('/Bordero/pages/bordero.html', {
    windowOverrides: {
      electronAPI: {
        windowManager: {
          openSecondaryPage(payload) {
            electronRoute = payload;
            return Promise.resolve({ success: true });
          },
        },
      },
    },
  });
  const electronClick = electronPrimary.click(`http://localhost:5500${displayPath}`);
  assert.equal(electronClick.defaultPrevented, true);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(electronRoute?.path, displayPath);
  assert.equal(electronPrimary.openedWindows.length, 0);

  console.log('TEST PASSED: Display opens in a dedicated named window');
  console.log('TEST PASSED: Ordinary page links remain in the current primary window');
  console.log('TEST PASSED: Display navigation leaves the display window open');
  console.log('TEST PASSED: Electron navigation uses the monitor-policy router');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});