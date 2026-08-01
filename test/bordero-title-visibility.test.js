const assert = require('assert');
const { filterBraniByTitleVisibility, annotateBraniByTitleVisibility } = require('../Bordero/js/title-visibility-utils');

function isExecuted(item) {
  return String(item?.flag || '').toUpperCase() === 'X';
}

function isRequested(item) {
  const value = String(item?.richieste ?? '').trim();
  if (!value || value === '-' || value === '0') return false;
  return true;
}

const brani = [
  { id: '1', titolo: 'Same Title', richieste: '2', flag: '' },
  { id: '2', titolo: 'Same Title', richieste: '2', flag: '' },
  { id: '3', titolo: 'Another', richieste: '1', flag: '' },
  { id: '4', titolo: 'Same Title', richieste: '2', flag: 'X' },
];

const visibleAfterExecution = filterBraniByTitleVisibility(brani, { isExecuted, isRequested });
assert.deepStrictEqual(
  visibleAfterExecution.map((item) => item.id),
  ['3', '4'],
  'Quando un duplicato richiesto è eseguito, solo quello eseguito resta visibile'
);

const restored = brani.map((item) => item.id === '4' ? { ...item, flag: '' } : item);
const visibleAfterRestore = filterBraniByTitleVisibility(restored, { isExecuted, isRequested });
assert.deepStrictEqual(
  visibleAfterRestore.map((item) => item.id),
  ['1', '2', '3', '4'],
  'Quando il brano eseguito viene ripristinato, tutti i duplicati tornano visibili'
);

const nonRequested = [
  { id: '5', titolo: 'Same Title', richieste: '0', flag: 'X' },
  { id: '6', titolo: 'Same Title', richieste: '0', flag: '' },
];
const visibleWithoutRequest = filterBraniByTitleVisibility(nonRequested, { isExecuted, isRequested });
assert.deepStrictEqual(
  visibleWithoutRequest.map((item) => item.id),
  ['5', '6'],
  'I brani non richiesti non devono essere nascosti dalla regola'
);

const annotated = annotateBraniByTitleVisibility(brani, { isExecuted, isRequested });
assert.strictEqual(annotated.find((item) => item.id === '4').displayState, 'executed');
assert.strictEqual(annotated.find((item) => item.id === '1').displayState, 'blocked');
assert.strictEqual(annotated.find((item) => item.id === '2').displayState, 'blocked');
assert.strictEqual(annotated.find((item) => item.id === '3').displayState, 'available');

console.log('bordero title visibility tests passed');
