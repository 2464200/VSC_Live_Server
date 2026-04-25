const fs = require('fs');
const path = require('path');

const BASE_CSV_NAME = 'Elenco_Brani_statico.csv';
const LEGACY_BASE_CSV_NAME = 'display.csv';
const EXTRA_CSV_NAME = 'Coreografie_Aggiuntive.csv';

const BASE_CSV_PATH = path.join(__dirname, BASE_CSV_NAME);
const LEGACY_BASE_CSV_PATH = path.join(__dirname, '..', LEGACY_BASE_CSV_NAME);
const EXTRA_CSV_PATH = path.join(__dirname, EXTRA_CSV_NAME);
const BRANI_JSON_PATH = path.join(__dirname, 'data', 'brani.json');
const EXTRA_CSV_HEADER = 'Colonna 1,Colonna 2,ID,coreografia,brano,autore,richieste,info livello,info coreo 1,info coreo 2,studiate,coreografo,collaboratori,descrizione coreo';

function detectCsvDelimiter(line) {
  if (typeof line !== 'string' || line.trim() === '') {
    return ',';
  }
  const commaCount = (line.match(/,/g) || []).length;
  const semicolonCount = (line.match(/;/g) || []).length;
  if (commaCount === 0 && semicolonCount === 0) {
    return ',';
  }
  return commaCount >= semicolonCount ? ',' : ';';
}

function parseCSVLine(line, delimiter = ',') {
  const result = [];
  let current = '';
  let insideQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === delimiter && !insideQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

function normalizeValue(value) {
  return (value || '').trim().replace(/^"|"$/g, '');
}

function normalizeKey(value) {
  return normalizeValue(value).toLowerCase();
}

function sanitizeCsvCell(value) {
  return normalizeValue(value).replace(/[;\r\n]+/g, ' ').replace(/\s{2,}/g, ' ');
}

function makeSlug(value) {
  return normalizeValue(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

function buildStableExtraId({ titolo, brano, autore }, rowNumber) {
  // Formato snello: EXTRA1, EXTRA2, EXTRA3, etc.
  // Se l'operatore inserisce un ID personalizzato, usa quello
  // Altrimenti genera un ID basato sul numero di riga
  return `EXTRA${rowNumber}`;
}

function resolveBaseCsvSource() {
  if (fs.existsSync(BASE_CSV_PATH)) {
    return {
      csvPath: BASE_CSV_PATH,
      fileName: BASE_CSV_NAME,
      sourceName: 'base-static',
      skipLines: 1
    };
  }

  if (fs.existsSync(LEGACY_BASE_CSV_PATH)) {
    return {
      csvPath: LEGACY_BASE_CSV_PATH,
      fileName: LEGACY_BASE_CSV_NAME,
      sourceName: 'base-legacy',
      skipLines: 3
    };
  }

  throw new Error(`File CSV principale non trovato: ${BASE_CSV_PATH}`);
}

function parseCsvRows(csvPath, sourceName, options = {}) {
  const { optional = false, skipLines = 1 } = options;

  if (!fs.existsSync(csvPath)) {
    if (optional) {
      return { rows: [], missing: true, skipped: 0 };
    }
    throw new Error(`File CSV non trovato: ${csvPath}`);
  }

  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const lines = csvContent.replace(/\r/g, '').split('\n');
  const rows = [];
  let skipped = 0;

  for (let i = skipLines; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line) continue;

    const delimiter = sourceName === 'base-static'
      ? ';'
      : sourceName === 'base-legacy'
        ? ','
        : detectCsvDelimiter(line);
    const cols = parseCSVLine(line, delimiter).map(c => normalizeValue(c));

    let idIndex, titoloIndex, branoIndex, autoreIndex;
    if (sourceName === 'base-static') {
      idIndex = 2;
      titoloIndex = 3;
      branoIndex = 4;
      autoreIndex = 5;
    } else if (sourceName === 'base-legacy') {
      idIndex = 1;
      titoloIndex = 2;
      branoIndex = 3;
      autoreIndex = 4;
    } else {
      idIndex = 2;
      titoloIndex = 3;
      branoIndex = 4;
      autoreIndex = 5;
    }

    const titolo = cols[titoloIndex];
    const brano = cols[branoIndex];
    const autore = cols[autoreIndex];

    if (!titolo) {
      skipped += 1;
      continue;
    }

    let id = cols[idIndex];
    if (!id && sourceName === 'extra') {
      id = buildStableExtraId({ titolo, brano, autore }, i + 1);
    }

    if (!id) {
      skipped += 1;
      continue;
    }

    rows.push({
      id,
      titolo,
      brano: brano || '',
      autore: autore || '',
      _source: sourceName
    });
  }

  return { rows, missing: false, skipped };
}

function loadBraniFromSources() {
  const baseSource = resolveBaseCsvSource();
  const base = parseCsvRows(baseSource.csvPath, baseSource.sourceName, { skipLines: baseSource.skipLines });
  const extra = parseCsvRows(EXTRA_CSV_PATH, 'extra', { optional: true, skipLines: 1 });

  const seenIds = new Set();
  const seenTitles = new Set();
  const warnings = [];
  const brani = base.rows.map(item => ({
    id: item.id,
    titolo: item.titolo,
    brano: item.brano,
    autore: item.autore
  }));
  let skippedDuplicates = 0;

  base.rows.forEach(item => {
    const idKey = normalizeKey(item.id);
    const titleKey = normalizeKey(item.titolo);

    seenIds.add(idKey);
    if (titleKey) seenTitles.add(titleKey);
  });

  extra.rows.forEach(item => {
    const idKey = normalizeKey(item.id);
    const titleKey = normalizeKey(item.titolo);

    if (seenIds.has(idKey)) {
      skippedDuplicates += 1;
      warnings.push(`ID duplicato ignorato (${item.id}) dal file ${EXTRA_CSV_NAME}`);
      return;
    }

    if (titleKey && seenTitles.has(titleKey)) {
      skippedDuplicates += 1;
      warnings.push(`Coreografia duplicata ignorata (${item.titolo}) dal file ${EXTRA_CSV_NAME}`);
      return;
    }

    seenIds.add(idKey);
    if (titleKey) seenTitles.add(titleKey);

    brani.push({
      id: item.id,
      titolo: item.titolo,
      brano: item.brano,
      autore: item.autore
    });
  });

  return {
    brani,
    stats: {
      total: brani.length,
      baseCount: base.rows.length,
      extraCount: extra.rows.length,
      skippedInvalid: base.skipped + extra.skipped,
      skippedDuplicates,
      extraFileMissing: extra.missing,
      baseFile: baseSource.fileName,
      warnings
    }
  };
}

function saveBraniJson(brani, jsonPath = BRANI_JSON_PATH) {
  const dataDir = path.dirname(jsonPath);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  fs.writeFileSync(jsonPath, JSON.stringify(brani, null, 2), 'utf-8');
}

function ensureExtraCsvFile() {
  if (!fs.existsSync(EXTRA_CSV_PATH)) {
    fs.writeFileSync(EXTRA_CSV_PATH, `${EXTRA_CSV_HEADER}\n`, 'utf-8');
    return;
  }

  const current = fs.readFileSync(EXTRA_CSV_PATH, 'utf-8');
  if (!normalizeValue(current)) {
    fs.writeFileSync(EXTRA_CSV_PATH, `${EXTRA_CSV_HEADER}\n`, 'utf-8');
  }
}

function appendExtraBrano(payload, jsonPath = BRANI_JSON_PATH) {
  const titolo = sanitizeCsvCell(payload?.titolo);
  const brano = sanitizeCsvCell(payload?.brano);
  const autore = sanitizeCsvCell(payload?.autore);
  const requestedId = sanitizeCsvCell(payload?.id);

  if (!titolo) {
    throw new Error('Il titolo/coreografia è obbligatorio');
  }

  const { brani } = loadBraniFromSources();
  const duplicateByTitle = brani.find(item => normalizeKey(item.titolo) === normalizeKey(titolo));
  if (duplicateByTitle) {
    throw new Error(`La coreografia "${titolo}" esiste già con ID ${duplicateByTitle.id}`);
  }

  const id = requestedId || buildStableExtraId({ titolo, brano, autore }, Date.now());
  const duplicateById = brani.find(item => normalizeKey(item.id) === normalizeKey(id));
  if (duplicateById) {
    throw new Error(`L'ID ${id} è già presente nel catalogo`);
  }

  ensureExtraCsvFile();

  const csvContent = fs.readFileSync(EXTRA_CSV_PATH, 'utf-8');
  const delimiter = detectCsvDelimiter(csvContent.split('\n')[0] || '');
  const extraCols = [
    '',
    '',
    id,
    titolo,
    brano,
    autore,
    '',
    '',
    '',
    '',
    '',
    sanitizeCsvCell(payload?.coreografo),
    sanitizeCsvCell(payload?.collaboratori),
    sanitizeCsvCell(payload?.descrizione)
  ];

  const prefix = csvContent.endsWith('\n') ? '' : '\n';
  fs.appendFileSync(EXTRA_CSV_PATH, `${prefix}${extraCols.join(delimiter)}\n`, 'utf-8');

  const syncResult = syncBraniJson(jsonPath);
  return {
    entry: {
      id,
      titolo,
      brano,
      autore
    },
    stats: syncResult.stats
  };
}

function syncBraniJson(jsonPath = BRANI_JSON_PATH) {
  const { brani, stats } = loadBraniFromSources();
  saveBraniJson(brani, jsonPath);
  return { brani, stats, jsonPath };
}

function updateExtraBrano(id, payload = {}, csvPath = EXTRA_CSV_PATH) {
  if (!fs.existsSync(csvPath)) {
    throw new Error(`File CSV non trovato: ${csvPath}`);
  }

  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const lines = csvContent.replace(/\r/g, '').split('\n');
  const delimiter = detectCsvDelimiter(lines[0] || lines[1] || '');

  let found = false;
  const updatedLines = lines.map((line, lineIndex) => {
    if (lineIndex === 0) return line; // header
    if (!line.trim()) return line;

    const cols = parseCSVLine(line, delimiter);
    const rowId = normalizeValue(cols[2]);

    if (rowId === id) {
      found = true;
      const newCoreografia = sanitizeCsvCell(payload.coreografia || normalizeValue(cols[3]) || '');
      const newBrano = sanitizeCsvCell(payload.brano || normalizeValue(cols[4]) || '');
      const newAutore = sanitizeCsvCell(payload.autore || normalizeValue(cols[5]) || '');

      // Ricostruisci la riga con i dati aggiornati
      cols[3] = newCoreografia;
      cols[4] = newBrano;
      cols[5] = newAutore;

      return cols.join(delimiter);
    }

    return line;
  });

  if (!found) {
    throw new Error(`Coreografia con ID ${id} non trovata`);
  }

  fs.writeFileSync(csvPath, updatedLines.join('\n'), 'utf-8');

  // Sincronizza il file JSON
  const syncResult = syncBraniJson();

  return {
    ok: true,
    updated: {
      id,
      coreografia: payload.coreografia,
      brano: payload.brano,
      autore: payload.autore
    },
    stats: syncResult.stats
  };
}

function deleteExtraBrano(id, csvPath = EXTRA_CSV_PATH) {
  if (!fs.existsSync(csvPath)) {
    throw new Error(`File CSV non trovato: ${csvPath}`);
  }

  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const lines = csvContent.replace(/\r/g, '').split('\n');
  const delimiter = detectCsvDelimiter(lines[0] || lines[1] || '');

  if (lines.length === 0) {
    throw new Error(`File CSV vuoto: ${csvPath}`);
  }

  let removed = null;
  const remainingLines = lines.filter((line, lineIndex) => {
    if (lineIndex === 0) return true; // header
    if (!line.trim()) return false;

    const cols = parseCSVLine(line, delimiter);
    const rowId = normalizeValue(cols[2]);

    if (rowId === id) {
      removed = {
        id: rowId,
        coreografia: normalizeValue(cols[3]),
        brano: normalizeValue(cols[4]),
        autore: normalizeValue(cols[5])
      };
      return false;
    }

    return true;
  });

  if (!removed) {
    throw new Error(`Coreografia con ID ${id} non trovata`);
  }

  fs.writeFileSync(csvPath, `${remainingLines.join('\n')}\n`, 'utf-8');

  const syncResult = syncBraniJson();

  return {
    ok: true,
    deleted: removed,
    stats: syncResult.stats
  };
}

module.exports = {
  BASE_CSV_NAME,
  LEGACY_BASE_CSV_NAME,
  EXTRA_CSV_NAME,
  EXTRA_CSV_HEADER,
  BASE_CSV_PATH,
  LEGACY_BASE_CSV_PATH,
  EXTRA_CSV_PATH,
  BRANI_JSON_PATH,
  ensureExtraCsvFile,
  appendExtraBrano,
  updateExtraBrano,
  deleteExtraBrano,
  loadBraniFromSources,
  saveBraniJson,
  syncBraniJson
};
