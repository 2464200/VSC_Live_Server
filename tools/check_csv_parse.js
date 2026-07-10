const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'Bordero', 'data', 'brani.csv');
const txt = fs.readFileSync(filePath, 'utf8');
const lines = txt.split('\n');
if (lines.length === 0) { console.error('Empty file'); process.exit(1); }
const headerLine = lines[0].trim();
const headers = headerLine.split(',').map(h=>h.trim());
console.log('Header cols:', headers.length, headers.join(', '));

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let insideQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i+1];
    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

let total = 0;
let parsed = 0;
const badLines = [];
for (let i = 1; i < lines.length; i++) {
  const raw = lines[i];
  if (!raw || raw.trim() === '') continue;
  total++;
  const vals = parseCSVLine(raw.trim());
  // mirror CSVParser.parse behavior: pad or merge extras
  if (vals.length < headers.length) {
    while (vals.length < headers.length) vals.push('');
  } else if (vals.length > headers.length) {
    const lastIndex = headers.length - 1;
    vals[lastIndex] = vals.slice(lastIndex).join(',');
    vals.length = headers.length;
  }
  // after normalization, consider line parsed
  parsed++;
}

console.log('Total data lines (non-empty):', total);
console.log('Parsed lines matching header cols:', parsed);
console.log('Skipped lines:', badLines.length);
if (badLines.length>0) console.log('Sample mismatches:', badLines.slice(0,10));
