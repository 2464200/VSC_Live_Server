const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { resolveDjForState } = require('../Eventi/dj-association');

test('DJ association is required for booking, inherited on execution and cleared on cancellation', () => {
  const booked = [{ id: '101', stato: 'prenotato', dj: ' DJ West ' }];
  assert.equal(resolveDjForState([], '101', 'prenotato', ' DJ West '), 'DJ West');
  assert.equal(resolveDjForState([], '101', 'prenotato', null), null);
  assert.equal(resolveDjForState([], '101', 'eseguito', null), null);
  assert.equal(resolveDjForState(booked, '101', 'eseguito', null), 'DJ West');
  assert.equal(resolveDjForState([{ id: '101', stato: true, dj: 'DJ Legacy' }], '101', 'eseguito', null), 'DJ Legacy');
  assert.equal(resolveDjForState(booked, '101', 'eseguito', 'DJ Luca'), 'DJ Luca');
  assert.equal(resolveDjForState(booked, '101', 'disponibile', 'DJ West'), null);
  assert.equal(resolveDjForState([...booked, { id: '101', stato: 'disponibile', dj: null }], '101', 'eseguito', null), null);
});

test('all Eventi clients share and migrate the same DJ storage key', () => {
  const main = fs.readFileSync('Eventi/public/eventi.js', 'utf8');
  const lists = fs.readFileSync('Eventi/public/render.js', 'utf8');
  assert.match(main, /localStorage\.getItem\('EVENTI_DJ'\) \|\| localStorage\.getItem\('EVENTI_SELECTED_DJ'\)/);
  assert.match(lists, /localStorage\.getItem\('EVENTI_DJ'\) \|\| localStorage\.getItem\('EVENTI_SELECTED_DJ'\)/);
  assert.match(main, /Seleziona il DJ prima di prendere un brano/);
  assert.match(lists, /stato === 'disponibile' \? null/);
  assert.match(lists, /stato !== 'disponibile' && !djToSave/);
});
