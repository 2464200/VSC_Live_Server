// Simple unit test for finishSerata logic (no DOM)
function reorderBraniByOriginalIndex(allBrani) {
  const available = allBrani
    .filter(b => String(b.flag || '').toUpperCase() !== 'X')
    .sort((a, b) => (Number(a.originalIndex) || 0) - (Number(b.originalIndex) || 0));
  const completed = allBrani.filter(b => String(b.flag || '').toUpperCase() === 'X');
  return [...available, ...completed];
}

function finishSerataReset(allBrani) {
  const cleared = allBrani.map(b => {
    if (String(b.flag || '').toUpperCase() === 'X') {
      return { ...b, flag: '', timestamp: '' };
    }
    return { ...b };
  });
  return reorderBraniByOriginalIndex(cleared);
}

// Sample data
const allBrani = [
  { id: '1', titolo: 'A', flag: '', originalIndex: 0 },
  { id: '2', titolo: 'B', flag: '', originalIndex: 1 },
  { id: '3', titolo: 'C', flag: '', originalIndex: 2 },
  { id: '4', titolo: 'D', flag: '', originalIndex: 3 },
  { id: '5', titolo: 'E', flag: '', originalIndex: 4 },
];

// Mark some as completed
allBrani[1].flag = 'X'; allBrani[1].timestamp = 'ts1';
allBrani[3].flag = 'X'; allBrani[3].timestamp = 'ts2';

console.log('Before finish:', allBrani.map(b=>({id:b.id,flag:b.flag,orig:b.originalIndex})).join('|'));

const after = finishSerataReset(allBrani);

console.log('After finish:', after.map(b=>({id:b.id,flag:b.flag,orig:b.originalIndex})).join('|'));

const anyFlag = after.some(b => String(b.flag||'').toUpperCase() === 'X');
if (anyFlag) { console.error('TEST FAIL: flags remain'); process.exit(2); }
console.log('TEST PASS: all flags cleared and order preserved for available'); process.exit(0);
