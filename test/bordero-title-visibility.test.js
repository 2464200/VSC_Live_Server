const assert = require('assert');
const { filterBraniByTitleVisibility, partitionBraniByExecutedTitle, annotateBraniByTitleVisibility } = require('../Bordero/js/title-visibility-utils');

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

const partitionedAfterExecution = partitionBraniByExecutedTitle(brani, { isExecuted });
assert.deepStrictEqual(
  partitionedAfterExecution.main.map((item) => item.id),
  ['3'],
  'Le coreografie senza eseguiti restano nella parte principale della tabella'
);
assert.deepStrictEqual(
  partitionedAfterExecution.bottom.map((item) => item.id),
  ['4', '1', '2'],
  'Il brano eseguito e tutti i suoi doppioni restano visibili insieme in fondo'
);

const restored = brani.map((item) => item.id === '4' ? { ...item, flag: '' } : item);
const visibleAfterRestore = filterBraniByTitleVisibility(restored, { isExecuted, isRequested });
assert.deepStrictEqual(
  visibleAfterRestore.map((item) => item.id),
  ['1', '2', '3', '4'],
  'Quando il brano eseguito viene ripristinato, tutti i duplicati tornano visibili'
);
const partitionedAfterRestore = partitionBraniByExecutedTitle(restored, { isExecuted });
assert.deepStrictEqual(partitionedAfterRestore.main.map((item) => item.id), ['1', '2', '3', '4']);
assert.deepStrictEqual(partitionedAfterRestore.bottom, []);

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

const similarButNotDuplicate = [
  { id: '7', titolo: 'Black Coffee', richieste: '2', flag: 'X' },
  { id: '8', titolo: 'Black Coffee!', richieste: '2', flag: '' },
  { id: '9', titolo: 'Another Song', richieste: '1', flag: '' },
];
const visibleForSimilarTitles = filterBraniByTitleVisibility(similarButNotDuplicate, { isExecuted, isRequested });
assert.deepStrictEqual(
  visibleForSimilarTitles.map((item) => item.id),
  ['7', '8', '9'],
  'Titoli simili ma non identici non devono essere trattati come duplicati eseguiti'
);

const annotated = annotateBraniByTitleVisibility(brani, { isExecuted, isRequested });
assert.strictEqual(annotated.find((item) => item.id === '4').displayState, 'executed');
assert.strictEqual(annotated.find((item) => item.id === '1').displayState, 'blocked');
assert.strictEqual(annotated.find((item) => item.id === '2').displayState, 'blocked');
assert.strictEqual(annotated.find((item) => item.id === '3').displayState, 'available');

console.log('bordero title visibility tests passed');
