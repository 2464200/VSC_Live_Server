const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM } = require('jsdom');

function loadState(t) {
  const dom = new JSDOM('<!doctype html><body></body>', { runScripts: 'outside-only' });
  t.after(() => dom.window.close());
  dom.window.eval(fs.readFileSync('Eventi/public/stati.js', 'utf8'));
  return dom.window.EventiState;
}

test('Eventi applies the same Bordero non-zero RICHIESTE rule', (t) => {
  const state = loadState(t);
  for (const value of ['', ' ', '-', '0', '0,0', '0.00', 0]) assert.equal(state.isRequested(value), false, String(value));
  for (const value of ['1', '2', '0,5', 'SI', 3]) assert.equal(state.isRequested(value), true, String(value));
  const result = state.filterBrani([
    { id: '1', titolo: 'Zulu', richieste: '1' },
    { id: '2', titolo: 'Alfa', richieste: '3' },
    { id: '3', titolo: 'Beta', richieste: '0' }
  ], 'richiesti');
  assert.deepEqual(Array.from(result, (item) => item.id), ['2', '1']);
});

test('Eventi main rows and requested page expose the requested indicators and navigation', () => {
  const eventiHtml = fs.readFileSync('Eventi/public/eventi.html', 'utf8');
  const eventiJs = fs.readFileSync('Eventi/public/eventi.js', 'utf8');
  const richiestiHtml = fs.readFileSync('Eventi/public/richiesti.html', 'utf8');
  const renderJs = fs.readFileSync('Eventi/public/render.js', 'utf8');
  assert.match(eventiHtml, /href="richiesti\.html"/);
  assert.match(eventiJs, /EventiState\.isRequested\(brano\.richieste\)/);
  assert.match(eventiJs, /📌 PRENOTATO/);
  assert.match(richiestiHtml, /renderLista\('richiesti'\)/);
  assert.match(richiestiHtml, /goEventiPage\('eventi\.html'\)/);
  assert.match(renderJs, /renderState\.filtro === 'richiesti'[\s\S]*EventiState\.filterBrani\(renderState\.summaryBrani, 'richiesti'\)/);
});
