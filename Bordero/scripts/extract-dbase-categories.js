const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data');
const legacyPath = path.join(dataDir, 'dBase-old.csv');
const locationOptionsPath = path.join(dataDir, 'location_popup_options.csv');

function parseSimpleCsv(text) {
  return text
    .replace(/\r/g, '')
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => line.split(',').map((cell) => cell.trim()));
}

function parseHeaderCsv(text) {
  const lines = text
    .replace(/\r/g, '')
    .split('\n')
    .filter((line) => line.trim());

  if (lines.length === 0) return [];

  const header = lines[0].split(',').map((cell) => cell.trim());
  return lines.slice(1).map((line) => {
    const cells = line.split(',').map((cell) => cell.trim());
    const row = {};
    header.forEach((key, index) => {
      row[key] = cells[index] || '';
    });
    return row;
  });
}

function uniqueValues(values) {
  const seen = new Set();
  return values.filter((value) => {
    const normalized = value.toLowerCase();
    if (seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

function writeCsv(fileName, values) {
  const output = ['value', ...values].join('\n');
  fs.writeFileSync(path.join(dataDir, fileName), output, 'utf8');
}

function isLabelRow(row, labels) {
  return row.some((cell) => {
    const normalized = String(cell || '').trim().toLowerCase();
    return labels.some((label) => normalized === label.toLowerCase());
  });
}

function extractBlockValues(rows, labels, stopLabels = []) {
  const startIndex = rows.findIndex((row) => isLabelRow(row, labels));
  if (startIndex === -1) return [];

  const values = [];
  const firstValue = String(rows[startIndex][0] || '').trim();
  if (firstValue && !isLabelRow(rows[startIndex], stopLabels)) {
    values.push(firstValue);
  }

  for (let index = startIndex + 1; index < rows.length; index += 1) {
    const row = rows[index];
    const cells = row.map((cell) => String(cell || '').trim()).filter(Boolean);

    if (cells.length === 0) continue;
    if (isLabelRow(row, stopLabels)) break;
    if (isLabelRow(row, labels)) break;

    const firstCell = cells[0];
    const normalized = firstCell.toLowerCase();
    if (!firstCell) continue;
    if (normalized.includes('modulo') || normalized.includes('link') || normalized.includes('legenda') || normalized.includes('elenco coreo') || normalized.includes('xls') || normalized.includes('richiesta') || normalized.includes('google drive') || normalized.includes('web') || normalized.includes('funzione') || normalized.includes('monitor')) {
      continue;
    }
    if (/^[a-z]$/i.test(firstCell) && firstCell.length === 1) {
      continue;
    }

    values.push(firstCell);
  }

  return uniqueValues(values);
}

function extractCameraValues(rows) {
  const startIndex = rows.findIndex((row) => String(row[0] || '').trim().toLowerCase() === 'getcameraname');
  if (startIndex === -1) return [];

  const values = [];
  for (let index = startIndex + 1; index < rows.length; index += 1) {
    const row = rows[index];
    const cells = row.map((cell) => String(cell || '').trim()).filter(Boolean);
    if (cells.length === 0) continue;
    if (String(row[0] || '').trim().toLowerCase() === 'getcameraname') continue;
    if (String(row[0] || '').trim().toLowerCase().includes('elenco webcam')) break;
    values.push(String(row[0] || '').trim());
  }

  return uniqueValues(values);
}

function extractResponses(rows) {
  const values = [];
  const startIndex = rows.findIndex((row) => String(row[0] || '').trim().toLowerCase().includes('richiesta coreografie'));
  if (startIndex === -1) return [];

  for (let index = startIndex + 1; index < rows.length; index += 1) {
    const row = rows[index];
    const cells = row.map((cell) => String(cell || '').trim()).filter(Boolean);
    if (cells.length === 0) continue;
    const firstValue = String(row[0] || '').trim();
    const secondValue = String(row[1] || '').trim();
    if (firstValue.toLowerCase().includes('elenco coreo')) break;
    if (firstValue.toLowerCase().startsWith('modulo')) {
      values.push(secondValue || firstValue);
    }
  }

  return uniqueValues(values);
}

function main() {
  const legacyText = fs.readFileSync(legacyPath, 'utf8');
  const locationText = fs.readFileSync(locationOptionsPath, 'utf8');
  const legacyRows = parseSimpleCsv(legacyText);
  const locationRows = parseHeaderCsv(locationText);

  const outputs = [
    ['livello.csv', extractBlockValues(legacyRows, ['Livello'], ['Livello', 'info coreo 1', 'info coreo 2', 'studiate', 'GetCameraName'])],
    ['info-coreo-1.csv', extractBlockValues(legacyRows, ['info coreo 1'], ['Livello', 'info coreo 1', 'info coreo 2', 'studiate', 'GetCameraName'])],
    ['info-coreo-2.csv', extractBlockValues(legacyRows, ['info coreo 2'], ['Livello', 'info coreo 1', 'info coreo 2', 'studiate', 'GetCameraName'])],
    ['studiate.csv', extractBlockValues(legacyRows, ['studiate'], ['Livello', 'info coreo 1', 'info coreo 2', 'studiate', 'GetCameraName'])],
    ['get-camera-name.csv', extractCameraValues(legacyRows)],
    ['risposta.csv', extractResponses(legacyRows)],
    ['tipo-pista.csv', locationRows.filter((row) => String(row.group || '').trim().toLowerCase() === 'tipopista').map((row) => row.value).filter(Boolean)],
    ['tipo-prese-corrente.csv', locationRows.filter((row) => String(row.group || '').trim().toLowerCase() === 'tipopresecorrente').map((row) => row.value).filter(Boolean)]
  ];

  outputs.forEach(([fileName, values]) => {
    writeCsv(fileName, uniqueValues(values));
    console.log(`✓ ${fileName}: ${uniqueValues(values).length} valori`);
  });
}

main();
