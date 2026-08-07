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

function parseCsvRows(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const ch = text[index];
    const next = text[index + 1];

    if (ch === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === ',' && !inQuotes) {
      row.push(cell);
      cell = '';
      continue;
    }

    if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && next === '\n') index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      continue;
    }

    cell += ch;
  }

  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
}

function csvEscape(value) {
  const text = String(value ?? '');
  if (!/[",\r\n]/.test(text)) {
    return text;
  }
  return `"${text.replace(/"/g, '""')}"`;
}

function writeCsv(fileName, values) {
  const output = ['value', ...values].join('\n');
  fs.writeFileSync(path.join(dataDir, fileName), output, 'utf8');
}

function writeCameraProfilesCsv(values) {
  const filePath = path.join(dataDir, 'get-camera-name.csv');
  const header = [
    'value',
    'Codifica',
    'dshow-size',
    'dshow-fps',
    'ELENCO WEBCAM',
    'profile-id',
    'is-default',
    'is-enabled',
    'last-used-at',
    'last-mode',
    'last-status',
    'usage-count',
    'last-size',
    'last-fps',
    'last-codec',
    'notes'
  ];

  const existingMap = new Map();
  if (fs.existsSync(filePath)) {
    const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
    const rows = parseCsvRows(raw).filter((row) => row.some((cell) => String(cell || '').trim()));
    if (rows.length > 1) {
      const sourceHeader = rows[0].map((cell) => String(cell || '').trim().toLowerCase());
      const indexOf = (name) => sourceHeader.indexOf(name.toLowerCase());

      rows.slice(1).forEach((row) => {
        const name = String(row[indexOf('value')] || '').trim();
        if (!name) return;
        existingMap.set(name.toLowerCase(), {
          value: name,
          Codifica: String(row[indexOf('codifica')] || row[indexOf('codec')] || '').trim(),
          'dshow-size': String(row[indexOf('dshow-size')] || row[indexOf('size')] || '').trim(),
          'dshow-fps': String(row[indexOf('dshow-fps')] || row[indexOf('fps')] || '').trim(),
          'ELENCO WEBCAM': String(row[indexOf('elenco webcam')] || row[indexOf('label')] || '').trim(),
          'profile-id': String(row[indexOf('profile-id')] || '').trim(),
          'is-default': String(row[indexOf('is-default')] || '').trim(),
          'is-enabled': String(row[indexOf('is-enabled')] || '').trim(),
          'last-used-at': String(row[indexOf('last-used-at')] || '').trim(),
          'last-mode': String(row[indexOf('last-mode')] || '').trim(),
          'last-status': String(row[indexOf('last-status')] || '').trim(),
          'usage-count': String(row[indexOf('usage-count')] || '').trim(),
          'last-size': String(row[indexOf('last-size')] || '').trim(),
          'last-fps': String(row[indexOf('last-fps')] || '').trim(),
          'last-codec': String(row[indexOf('last-codec')] || '').trim(),
          notes: String(row[indexOf('notes')] || '').trim()
        });
      });
    }
  }

  const sourceNames = uniqueValues(values.map((item) => String(item || '').trim()).filter(Boolean));
  const mergedNames = [...sourceNames];
  existingMap.forEach((row) => {
    if (!mergedNames.some((name) => name.toLowerCase() === row.value.toLowerCase())) {
      mergedNames.push(row.value);
    }
  });

  const rows = mergedNames.map((name) => {
    const existing = existingMap.get(name.toLowerCase()) || {};
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || `camera-${Date.now()}`;
    return {
      value: name,
      Codifica: existing.Codifica || 'yuyv422',
      'dshow-size': existing['dshow-size'] || '1280x720',
      'dshow-fps': existing['dshow-fps'] || '30',
      'ELENCO WEBCAM': existing['ELENCO WEBCAM'] || name,
      'profile-id': existing['profile-id'] || slug,
      'is-default': existing['is-default'] || '0',
      'is-enabled': existing['is-enabled'] || '1',
      'last-used-at': existing['last-used-at'] || '',
      'last-mode': existing['last-mode'] || '',
      'last-status': existing['last-status'] || '',
      'usage-count': existing['usage-count'] || '0',
      'last-size': existing['last-size'] || existing['dshow-size'] || '1280x720',
      'last-fps': existing['last-fps'] || existing['dshow-fps'] || '30',
      'last-codec': existing['last-codec'] || existing.Codifica || 'yuyv422',
      notes: existing.notes || ''
    };
  });

  if (rows.length > 0 && !rows.some((row) => String(row['is-default'] || '').trim() === '1')) {
    rows[0]['is-default'] = '1';
  }

  const lines = [header.join(',')];
  rows.forEach((row) => {
    const line = header.map((column) => csvEscape(row[column] || '')).join(',');
    lines.push(line);
  });

  fs.writeFileSync(filePath, `${lines.join('\r\n')}\r\n`, 'utf8');
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
    const distinct = uniqueValues(values);
    if (fileName === 'get-camera-name.csv') {
      writeCameraProfilesCsv(distinct);
    } else {
      writeCsv(fileName, distinct);
    }
    console.log(`✓ ${fileName}: ${distinct.length} valori`);
  });
}

main();
