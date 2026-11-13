const fs = require('fs');
const path = require('path');
const { writeCsvFilesSafely } = require('./google-sheets-sync');

const MAX_DISPLAY_ROWS = 1000;
const DISPLAY_HEADER = [
  ['DISPLAY: COREOGRAFIE RICHIESTE', '', '', '', '', ''],
  ['', '', '', '', '', ''],
  ['?', 'ID', 'Coreografia', 'Brano', 'Autore', 'Coreografo'],
];

class DisplayCsvValidationError extends Error {}

function escapeCsv(value) {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function normalizeDisplayRows(rows) {
  if (!Array.isArray(rows) || rows.length === 0 || rows.length > MAX_DISPLAY_ROWS) {
    throw new DisplayCsvValidationError(`Sono richieste da 1 a ${MAX_DISPLAY_ROWS} righe display.`);
  }

  return rows.map((row, index) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) {
      throw new DisplayCsvValidationError(`Riga display ${index + 1} non valida.`);
    }

    const id = String(row.id ?? '').trim();
    const coreografia = String(row.coreografia ?? row.titolo ?? '').trim();
    const brano = String(row.brano ?? '').trim();
    if (!id && !coreografia && !brano) {
      throw new DisplayCsvValidationError(`Riga display ${index + 1} priva di dati.`);
    }

    const executed = row.executed === true || String(row.flag ?? '').trim().toUpperCase() === 'X';
    return [
      executed ? 'X' : '',
      id,
      coreografia,
      brano,
      String(row.autore ?? '').trim(),
      String(row.coreografo ?? '').trim(),
    ];
  });
}

function formatItalianDate(date) {
  return new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome' }).format(date);
}

function serializeDisplayCsv(rows, generatedAt = new Date()) {
  const normalizedRows = normalizeDisplayRows(rows);
  const header = DISPLAY_HEADER.map((row) => row.slice());
  header[1][0] = `Data: ${formatItalianDate(generatedAt)}   |   Origine: borderò`;
  return [...header, ...normalizedRows]
    .map((row) => row.map(escapeCsv).join(','))
    .join('\n') + '\n';
}

function createDisplayCsvSync({
  outputPaths,
  fileSystem = fs,
  writeFiles = writeCsvFilesSafely,
} = {}) {
  if (!Array.isArray(outputPaths) || outputPaths.length === 0) {
    throw new TypeError('È necessario indicare almeno un percorso display.csv.');
  }

  const resolvedPaths = outputPaths.map((filePath) => path.resolve(filePath));

  return function syncDisplayCsv(rows, generatedAt = new Date()) {
    const csvContent = serializeDisplayCsv(rows, generatedAt);
    const alreadyCurrent = resolvedPaths.every((filePath) => {
      try {
        return fileSystem.readFileSync(filePath, 'utf8') === csvContent;
      } catch (error) {
        if (error.code === 'ENOENT') return false;
        throw error;
      }
    });

    if (alreadyCurrent) {
      return { changed: false, rows: rows.length };
    }

    for (const filePath of resolvedPaths) {
      fileSystem.mkdirSync(path.dirname(filePath), { recursive: true });
    }
    writeFiles(resolvedPaths.map((filePath) => ({ filePath, csvContent })));
    return { changed: true, rows: rows.length };
  };
}

function createDisplayCsvHandler(synchronize, logger = console) {
  if (typeof synchronize !== 'function') {
    throw new TypeError('La funzione di sincronizzazione display è obbligatoria.');
  }

  return (req, res) => {
    const remoteAddress = req.socket?.remoteAddress;
    if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(remoteAddress)) {
      return res.status(403).json({ ok: false, error: 'Endpoint disponibile solo in locale.' });
    }

    try {
      const result = synchronize(req.body?.rows);
      return res.json({ ok: true, ...result });
    } catch (error) {
      logger.error('Aggiornamento display.csv non riuscito:', error);
      const status = error instanceof DisplayCsvValidationError ? 400 : 500;
      return res.status(status).json({ ok: false, error: error.message });
    }
  };
}

module.exports = {
  createDisplayCsvHandler,
  createDisplayCsvSync,
  DisplayCsvValidationError,
  normalizeDisplayRows,
  serializeDisplayCsv,
};
