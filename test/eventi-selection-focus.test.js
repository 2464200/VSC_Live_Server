const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM } = require('jsdom');

test('a successful Eventi selection resets and focuses the next-song search', () => {
  const source = fs.readFileSync('Eventi/public/eventi.js', 'utf8');
  const start = source.indexOf('function prepareNextBranoSearch()');
  const end = source.indexOf('\nfunction renderRows(', start);
  const helper = source.slice(start, end);
  const selectionHandler = source.slice(source.indexOf("await salvaStato(brano.id, 'prenotato'"), source.indexOf('} catch (error)', source.indexOf("await salvaStato(brano.id, 'prenotato'")));
  assert.match(selectionHandler, /await refreshPageData\(\);\s*prepareNextBranoSearch\(\);/);
  assert.doesNotMatch(selectionHandler, /prenotati\.html/);

  const dom = new JSDOM('<input id="search-input" value="vecchia ricerca"><button class="alfabeto-btn" data-value="A"></button><button class="alfabeto-btn" data-value="ALL"></button>', { runScripts: 'outside-only' });
  const { window } = dom;
  const input = window.document.getElementById('search-input');
  let inputEvents = 0;
  let highlighted = '';
  let scrolled = false;
  input.addEventListener('input', () => { inputEvents += 1; });
  input.scrollIntoView = () => { scrolled = true; };
  window.pageState = { query: 'vecchia ricerca', alfabetoFilter: 'A' };
  window.evidenziaBtn = (value) => { highlighted = value; };
  window.eval(`${helper}; prepareNextBranoSearch();`);
  assert.equal(input.value, '');
  assert.equal(window.pageState.query, '');
  assert.equal(window.pageState.alfabetoFilter, 'ALL');
  assert.equal(window.document.activeElement, input);
  assert.equal(inputEvents, 1);
  assert.equal(highlighted, 'ALL');
  assert.equal(scrolled, true);
  dom.window.close();
});
