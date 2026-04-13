const fs = require('fs');
const path = require('path');

const BASE_CSV_NAME = 'Elenco_Brani_statico.csv';
const EXTRA_CSV_NAME = 'Coreografie_Aggiuntive.csv';

const BASE_CSV_PATH = path.join(__dirname, BASE_CSV_NAME);
const EXTRA_CSV_PATH = path.join(__dirname, EXTRA_CSV_NAME);
const BRANI_JSON_PATH = path.join(__dirname, 'data', 'brani.json');
const EXTRA_CSV_HEADER = 'Colonna 1;Colonna 2;ID;coreografia;brano;autore;richieste;info livello;info coreo 1;info coreo 2;studiate;coreografo;collaboratori;descrizione coreo';

function normalizeValue(value) {
  return (value || '').trim();
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
  const seed = [titolo, brano, autore].map(makeSlug).filter(Boolean).join('-');
  return `EXTRA-${seed || `riga-${rowNumber}`}`.toUpperCase();
}

function parseCsvRows(csvPath, sourceName, options = {}) {
  const { optional = false } = options;

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

  for (let i = 1; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols = line.split(';');
    const titolo = normalizeValue(cols[3]);
    const brano = normalizeValue(cols[4]);
    const autore = normalizeValue(cols[5]);

    if (!titolo) {
      skipped += 1;
      continue;
    }

    let id = normalizeValue(cols[2]);
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
  const base = parseCsvRows(BASE_CSV_PATH, 'base');
  const extra = parseCsvRows(EXTRA_CSV_PATH, 'extra', { optional: true });

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

  const prefix = fs.readFileSync(EXTRA_CSV_PATH, 'utf-8').endsWith('\n') ? '' : '\n';
  fs.appendFileSync(EXTRA_CSV_PATH, `${prefix}${extraCols.join(';')}\n`, 'utf-8');

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

  let found = false;
  const updatedLines = lines.map((line, lineIndex) => {
    if (lineIndex === 0) return line; // header

    const cols = line.split(';');
    const rowId = normalizeValue(cols[2]);

    if (rowId === id) {
      found = true;
      const newCoreografia = sanitizeCsvCell(payload.coreografia || cols[3] || '');
      const newBrano = sanitizeCsvCell(payload.brano || cols[4] || '');
      const newAutore = sanitizeCsvCell(payload.autore || cols[5] || '');

      // Ricostruisci la riga con i dati aggiornati
      cols[3] = newCoreografia;
      cols[4] = newBrano;
      cols[5] = newAutore;

      return cols.join(';');
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

module.exports = {
  BASE_CSV_NAME,
  EXTRA_CSV_NAME,
  EXTRA_CSV_HEADER,
  BASE_CSV_PATH,
  EXTRA_CSV_PATH,
  BRANI_JSON_PATH,
  appendExtraBrano,
  updateExtraBrano,
  loadBraniFromSources,
  saveBraniJson,
  syncBraniJson
};
