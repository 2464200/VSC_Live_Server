const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const { JSDOM } = require('jsdom');

const pageHtml = fs.readFileSync('USERFORM/pages/SERVIZIO.html', 'utf8');
const actions = fs.readFileSync('USERFORM/js/servizio-actions.js', 'utf8');

function createDisplay(text, options = {}) {
  const dom = new JSDOM(pageHtml, {
    url: `http://localhost:5500/USERFORM/pages/SERVIZIO.html?${new URLSearchParams({
      mode: 'display',
      output: 'text',
      text,
      ...options
    })}`,
    runScripts: 'outside-only'
  });
  const { window } = dom;
  const message = window.document.getElementById('published-message');
  const dimensions = { width: 1000, height: 600 };

  Object.defineProperties(message, {
    clientWidth: { get: () => dimensions.width },
    clientHeight: { get: () => dimensions.height },
    scrollWidth: {
      get() {
        const fontSize = Number.parseFloat(message.style.fontSize) || 1;
        const maxLineLength = Math.max(...message.textContent.split('\n').map((line) => line.length), 1);
        return Math.min(dimensions.width, Math.ceil(maxLineLength * fontSize * 0.56));
      }
    },
    scrollHeight: {
      get() {
        const fontSize = Number.parseFloat(message.style.fontSize) || 1;
        const charsPerLine = Math.max(1, Math.floor(dimensions.width / (fontSize * 0.56)));
        const wrappedLines = message.textContent.split('\n')
          .reduce((count, line) => count + Math.max(1, Math.ceil(line.length / charsPerLine)), 0);
        return Math.ceil(wrappedLines * fontSize * 1.08);
      }
    }
  });
  window.eval(actions);
  return { dom, window, message, dimensions };
}

test('SERVIZIO display centers text and grows it to use the available area', (t) => {
  const { dom, window, message, dimensions } = createDisplay('Prossimo ballo');
  t.after(() => dom.window.close());

  assert.equal(window.document.body.classList.contains('service-display-mode'), true);
  assert.ok(Number.parseFloat(message.style.fontSize) > 0, 'font size should be fitted on initial publication');
  const initialSize = Number.parseFloat(message.style.fontSize);

  dimensions.width = 1600;
  dimensions.height = 900;
  window.dispatchEvent(new window.Event('resize'));
  const enlargedSize = Number.parseFloat(message.style.fontSize);
  assert.ok(enlargedSize > initialSize, 'font size should grow when more display area is available');
  assert.ok(message.scrollWidth <= dimensions.width + 1);
  assert.ok(message.scrollHeight <= dimensions.height + 1);

  assert.match(pageHtml, /\.service-presentation-content\s*\{[^}]*place-items:\s*center/s);
  assert.match(pageHtml, /\.published-message\s*\{[^}]*text-align:\s*center/s);
  assert.match(pageHtml, /\.published-message\s*\{[^}]*white-space:\s*pre-wrap/s);
});

test('SERVIZIO text fit accounts for explicit line breaks and long messages', (t) => {
  const text = `${'Messaggio importante per i partecipanti '.repeat(5)}\n${'La serata inizia tra poco. '.repeat(5)}`;
  const { dom, message, dimensions } = createDisplay(text);
  t.after(() => dom.window.close());

  const fontSize = Number.parseFloat(message.style.fontSize);
  assert.ok(fontSize > 0 && fontSize < 100, 'long multiline text should shrink to fit');
  assert.ok(message.scrollWidth <= dimensions.width + 1);
  assert.ok(message.scrollHeight <= dimensions.height + 1);
});

test('SERVIZIO applies a selected font and caps its size while keeping auto-fit as the default', (t) => {
  const { dom, message } = createDisplay('Messaggio personalizzato', { font: 'Georgia', fontSize: '48' });
  t.after(() => dom.window.close());

  assert.equal(message.style.fontFamily, '"Georgia", Tahoma, sans-serif');
  assert.ok(Number.parseFloat(message.style.fontSize) <= 48);

  const defaults = createDisplay('Messaggio predefinito');
  t.after(() => defaults.dom.window.close());
  assert.equal(defaults.message.style.fontFamily, '');
  assert.ok(Number.parseFloat(defaults.message.style.fontSize) > 48, 'default auto-fit should remain unchanged');
});
