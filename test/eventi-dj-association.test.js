const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { resolveDjForState, resolveDjAction } = require('../Eventi/dj-association');

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

test('owner permissions independently guard execution and cancellation', () => {
  const log = [{ id: '101', stato: 'prenotato', dj: 'DJ Owner' }];
  const locked = { allowOtherDjExecute: false, allowOtherDjCancel: false };
  assert.equal(resolveDjAction(log, '101', 'eseguito', 'DJ Owner', 'DJ Guest', locked).status, 403);
  assert.equal(resolveDjAction(log, '101', 'disponibile', null, 'DJ Guest', locked).status, 403);
  assert.deepEqual(resolveDjAction(log, '101', 'eseguito', 'DJ Owner', 'DJ Owner', locked), {
    ok: true, dj: 'DJ Owner', actorDj: 'DJ Owner', ownerDj: 'DJ Owner'
  });
  const executeAllowed = resolveDjAction(log, '101', 'eseguito', 'DJ Owner', 'DJ Guest', { ...locked, allowOtherDjExecute: true });
  assert.equal(executeAllowed.ok, true);
  assert.equal(executeAllowed.dj, 'DJ Owner');
  assert.equal(executeAllowed.actorDj, 'DJ Guest');
  const cancelAllowed = resolveDjAction(log, '101', 'disponibile', null, 'DJ Guest', { ...locked, allowOtherDjCancel: true });
  assert.equal(cancelAllowed.ok, true);
  assert.equal(cancelAllowed.dj, null);
});

test('all Eventi clients share and migrate the same DJ storage key', () => {
  const main = fs.readFileSync('Eventi/public/eventi.js', 'utf8');
  const lists = fs.readFileSync('Eventi/public/render.js', 'utf8');
  assert.match(main, /localStorage\.getItem\('EVENTI_DJ'\) \|\| localStorage\.getItem\('EVENTI_SELECTED_DJ'\)/);
  assert.match(lists, /localStorage\.getItem\('EVENTI_DJ'\) \|\| localStorage\.getItem\('EVENTI_SELECTED_DJ'\)/);
  assert.match(main, /Seleziona il DJ prima di prendere un brano/);
  assert.match(lists, /stato === 'disponibile' \? null/);
  assert.match(lists, /const actorDj = getDJLocal\(\)/);
  assert.match(lists, /if \(!actorDj\)/);
  assert.match(lists, /actorDj,/);
});
