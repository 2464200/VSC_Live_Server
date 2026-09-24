const assert = require('assert');
const { partitionExecutedAndSimilar } = require('../Bordero/js/executed-order-utils.js');

const brani = [
  { id: '3', titolo: 'Altra', flag: '' },
  { id: '1', titolo: 'L\'Estate Blu!', flag: 'X' },
  { id: '2', titolo: 'L Estate Blu', flag: '' },
  { id: '4', titolo: 'Finale', executed: '' },
];

const result = partitionExecutedAndSimilar(brani);
assert.deepStrictEqual(result.pending.map(item => item.id), ['3', '4']);
assert.deepStrictEqual(result.executed.map(item => item.id), ['1']);
assert.deepStrictEqual(result.similar.map(item => item.id), ['2']);
assert.deepStrictEqual(result.all.map(item => item.id), ['3', '4', '1', '2']);
assert.strictEqual(result.similar[0].flag, '');

console.log('TEST PASSED: executed tracks and title-similar tracks are consistently ordered');
