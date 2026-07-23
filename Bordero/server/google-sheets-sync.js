#!/usr/bin/env node
/**
 * Google Sheets Sync - Download CSV data from Google Sheets.
 *
 * Supports:
 * - Service Account JSON credentials (preferred)
 * - Google API Key fallback
 * - Public CSV export fallback
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { URL } = require('url');

let google;
let dotenv;

try {
  ({ google } = require('googleapis'));
} catch (err) {
  google = null;
  console.warn('⚠️ googleapis non disponibile: il sync Google verrà saltato e si userà il fallback CSV/URL pubblico.');
}

try {
  dotenv = require('dotenv');
} catch (err) {
  dotenv = null;
  console.warn('⚠️ dotenv non disponibile: si useranno le variabili d’ambiente del sistema.');
}

const envPath = path.join(__dirname, '..', 'config', '.env');
if (dotenv && fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else if (!fs.existsSync(envPath)) {
  console.warn('⚠️ File .env non trovato; si procede con variabili d’ambiente o fallback pubblico.');
}

const API_KEY = process.env.GOOGLE_API_KEY?.trim();
const SERVICE_ACCOUNT_KEY_FILE = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE?.trim();
const SERVICE_ACCOUNT_KEY_JSON = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_JSON?.trim();
const OUTPUT_DIR = path.join(__dirname, '..', 'data');

const SHEETS = [
  {
    name: 'Accoda 8+12',
    output: 'Accoda 8+12.csv',
    baseSource: {
      name: 'Elenco Brani (statico)',
      id: process.env.GOOGLE_SHEET_BRANI,
      range: process.env.GOOGLE_SHEET_BRANI_RANGE || 'A:Z',
      gid: process.env.GOOGLE_SHEET_BRANI_GID || '0',
      publicUrl: process.env.GOOGLE_SHEET_BRANI_PUBLIC_URL?.trim()
    },
    mergeSources: [
      {
        name: 'Modulo 8',
        id: process.env.GOOGLE_SHEET_MODULO8 || process.env.GOOGLE_SHEET_BRANI,
        range: process.env.GOOGLE_SHEET_MODULO8_RANGE || "'Risposte del modulo 8'!A:AI",
        gid: process.env.GOOGLE_SHEET_MODULO8_GID || process.env.GOOGLE_SHEET_BRANI_GID || '0',
        publicUrl: process.env.GOOGLE_SHEET_MODULO8_PUBLIC_URL?.trim() || process.env.GOOGLE_SHEET_BRANI_PUBLIC_URL?.trim()
      },
      {
        name: 'Modulo 12',
        id: process.env.GOOGLE_SHEET_MODULO12 || process.env.GOOGLE_SHEET_BRANI,
        range: process.env.GOOGLE_SHEET_MODULO12_RANGE || "'Risposte del modulo 12'!A:AI",
        gid: process.env.GOOGLE_SHEET_MODULO12_GID || process.env.GOOGLE_SHEET_BRANI_GID || '0',
        publicUrl: process.env.GOOGLE_SHEET_MODULO12_PUBLIC_URL?.trim() || process.env.GOOGLE_SHEET_BRANI_PUBLIC_URL?.trim()
      }
    ]
  },
  {
    name: 'Comuni',
    id: process.env.GOOGLE_SHEET_COMUNI,
    range: 'A:Z',
    output: 'comuni_italia.csv',
    gid: process.env.GOOGLE_SHEET_COMUNI_GID || '0',
    publicUrl: process.env.GOOGLE_SHEET_COMUNI_PUBLIC_URL?.trim()
  },
  {
    name: 'DJ/dBase',
    id: process.env.GOOGLE_SHEET_DBASE,
    range: 'A:Z',
    output: 'dbase.csv',
    gid: process.env.GOOGLE_SHEET_DBASE_GID || '0',
    publicUrl: process.env.GOOGLE_SHEET_DBASE_PUBLIC_URL?.trim()
  }
];

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

function escapeCSV(field) {
  if (field === null || field === undefined) return '';
  const str = String(field).trim();
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function valuesToCSV(values) {
  if (!values || values.length === 0) return '';
  return values.map(row => row.map(escapeCSV).join(',')).join('\n');
}

function httpGet(url, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    if (redirectCount > 10) {
      return reject(new Error('Too many redirects'));
    }

    const parsedUrl = new URL(url);
    const lib = parsedUrl.protocol === 'http:' ? http : https;

    const req = lib.get(parsedUrl, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
        const location = res.headers.location;
        if (!location) {
          return reject(new Error(`Redirect without location header: ${res.statusCode}`));
        }
        res.resume();
        return resolve(httpGet(new URL(location, parsedUrl).toString(), redirectCount + 1));
      }

      if (res.statusCode !== 200) {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          reject(new Error(`HTTP ${res.statusCode}: ${data.substring(0, 200)}`));
        });
        return;
      }

      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });

    req.on('error', reject);
  });
}

function buildGoogleRangeCandidates(range) {
  const baseRange = (range || '').trim();
  const candidates = new Set();

  if (!baseRange) {
    candidates.add('A:Z');
    return [...candidates];
  }

  candidates.add(baseRange);

  const sheetMatch = baseRange.match(/^(['"]?[^'"!]+['"]?)!(.+)$/);
  if (sheetMatch) {
    const sheetName = sheetMatch[1].replace(/^['"]|['"]$/g, '');
    const ref = sheetMatch[2].trim();
    candidates.add(`${sheetName}!${ref}`);
    candidates.add(`'${sheetName}'!${ref}`);
  } else {
    candidates.add(baseRange);
    candidates.add('A:Z');
    candidates.add('A1:Z1000');
  }

  return [...candidates];
}

function fetchSheetDataKey(spreadsheetId, range) {
  return new Promise((resolve, reject) => {
    if (!API_KEY) {
      return reject(new Error('GOOGLE_API_KEY mancante'));
    }

    const candidates = buildGoogleRangeCandidates(range);
    let lastError = null;

    const tryCandidate = (index) => {
      if (index >= candidates.length) {
        return reject(lastError || new Error('Nessuna range Google Sheets valida'));
      }

      const candidateRange = candidates[index];
      const encodedRange = encodeURIComponent(candidateRange);
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodedRange}?key=${API_KEY}`;

      https.get(url, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (res.statusCode !== 200) {
              const errorMsg = json.error?.message || `HTTP ${res.statusCode}`;
              lastError = new Error(errorMsg);
              return tryCandidate(index + 1);
            }
            resolve(json.values || []);
          } catch (err) {
            lastError = new Error(`Parse error: ${err.message}`);
            tryCandidate(index + 1);
          }
        });
      }).on('error', (err) => {
        lastError = err;
        tryCandidate(index + 1);
      });
    };

    tryCandidate(0);
  });
}

async function getServiceAccountAuth() {
  let credentials = null;

  if (!google?.auth?.GoogleAuth) {
    throw new Error('googleapis non disponibile');
  }

  if (SERVICE_ACCOUNT_KEY_JSON) {
    try {
      credentials = JSON.parse(SERVICE_ACCOUNT_KEY_JSON);
    } catch (err) {
      throw new Error(`Impossibile leggere GOOGLE_SERVICE_ACCOUNT_KEY_JSON: ${err.message}`);
    }
  }

  if (!credentials && SERVICE_ACCOUNT_KEY_FILE) {
    if (!fs.existsSync(SERVICE_ACCOUNT_KEY_FILE)) {
      throw new Error(`File service account non trovato: ${SERVICE_ACCOUNT_KEY_FILE}`);
    }
    try {
      credentials = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_KEY_FILE, 'utf8'));
    } catch (err) {
      throw new Error(`Impossibile leggere GOOGLE_SERVICE_ACCOUNT_KEY_FILE: ${err.message}`);
    }
  }

  if (!credentials) {
    return null;
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
  });

  return auth;
}

async function fetchSheetDataServiceAccount(spreadsheetId, range) {
  if (!google) {
    throw new Error('googleapis non disponibile');
  }

  const auth = await getServiceAccountAuth();
  if (!auth) {
    throw new Error('Service Account non configurato');
  }

  const client = await auth.getClient();
  const sheets = google.sheets({ version: 'v4', auth: client });

  const candidates = buildGoogleRangeCandidates(range);
  let lastError = null;

  for (const candidateRange of candidates) {
    try {
      const response = await sheets.spreadsheets.values.get({ spreadsheetId, range: candidateRange });
      return response.data.values || [];
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error('Nessuna range Google Sheets valida');
}

async function fetchSheetData(spreadsheetId, range) {
  if (SERVICE_ACCOUNT_KEY_JSON || SERVICE_ACCOUNT_KEY_FILE) {
    try {
      return await fetchSheetDataServiceAccount(spreadsheetId, range);
    } catch (err) {
      console.warn(`⚠️ Service Account fallito: ${err.message}`);
    }
  }

  if (API_KEY) {
    return await fetchSheetDataKey(spreadsheetId, range);
  }

  throw new Error('Nessuna autenticazione Google configurata');
}

function buildCSVExportUrls(spreadsheetId, gid) {
  return [
    `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`,
    `https://docs.google.com/spreadsheets/d/${spreadsheetId}/pub?output=csv&gid=${gid}`,
    `https://docs.google.com/spreadsheets/d/${spreadsheetId}/pub?gid=${gid}&single=true&output=csv`
  ];
}

async function fetchCSVExport(spreadsheetId, gid) {
  const urls = buildCSVExportUrls(spreadsheetId, gid);
  let lastError = null;
  for (const url of urls) {
    try {
      return await httpGet(url);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error('CSV export failed');
}

function normalizeDelimitedTextToCSV(text) {
  if (!text) return '';
  const rows = text.trim().split(/\r?\n/);
  const hasTab = rows.some(line => line.includes('\t'));
  if (!hasTab) {
    return text.trim();
  }

  const values = rows.map(row => row.split('\t'));
  return valuesToCSV(values);
}

async function fetchPublicUrl(textUrl) {
  const csv = await httpGet(textUrl);
  return normalizeDelimitedTextToCSV(csv);
}

function csvToValues(csvText) {
  const lines = String(csvText || '').trim().split(/\r?\n/).filter((line) => line.trim() !== '');
  return lines.map((line) => {
    const values = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      const next = line[i + 1];

      if (ch === '"') {
        if (inQuotes && next === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }

      if (ch === ',' && !inQuotes) {
        values.push(current);
        current = '';
        continue;
      }

      current += ch;
    }

    values.push(current);
    return values;
  });
}

function excelColumnToIndex(columnRef) {
  const clean = String(columnRef || '').trim().toUpperCase().replace(/[^A-Z]/g, '');
  if (!clean) return null;

  let value = 0;
  for (let i = 0; i < clean.length; i += 1) {
    value = value * 26 + (clean.charCodeAt(i) - 64);
  }
  return value;
}

function getRangeColumnLimit(range) {
  const text = String(range || '').trim();
  if (!text) return null;

  const withoutSheet = text.includes('!') ? text.split('!').pop() : text;
  const match = withoutSheet.match(/:([A-Za-z]+)\d*$/);
  if (!match) return null;

  return excelColumnToIndex(match[1]);
}

function trimValuesToRange(values, range) {
  const limit = getRangeColumnLimit(range);
  if (!limit || !Array.isArray(values)) return values;

  return values.map((row) => Array.isArray(row) ? row.slice(0, limit) : row);
}

function normalizeHeaderValue(value) {
  return String(value || '').trim().toLowerCase();
}

function mergeSourceTables(sourceTables) {
  const nonEmptyTables = sourceTables
    .map((table) => ({
      ...table,
      values: Array.isArray(table.values)
        ? table.values.filter((row) => Array.isArray(row) && row.some((cell) => String(cell || '').trim() !== ''))
        : []
    }))
    .filter((table) => table.values.length > 0);

  if (nonEmptyTables.length === 0) {
    return [];
  }

  const headerCandidates = nonEmptyTables.map((table) => table.values[0]);
  const masterHeader = headerCandidates.sort((a, b) => b.length - a.length)[0].map((value) => String(value || '').trim());
  const mergedRows = [masterHeader];

  nonEmptyTables.forEach((table) => {
    const rows = table.values;
    if (rows.length === 0) return;

    const sourceHeader = rows[0].map((value) => String(value || '').trim());
    const headerMap = new Map();
    sourceHeader.forEach((name, index) => {
      const normalized = normalizeHeaderValue(name);
      if (normalized && !headerMap.has(normalized)) {
        headerMap.set(normalized, index);
      }
    });

    const dataRows = rows.slice(1);
    dataRows.forEach((row) => {
      const aligned = masterHeader.map((columnName, columnIndex) => {
        const sourceIndex = headerMap.get(normalizeHeaderValue(columnName));
        if (Number.isInteger(sourceIndex)) {
          return row[sourceIndex] ?? '';
        }
        return row[columnIndex] ?? '';
      });

      const lookup = new Map();
      masterHeader.forEach((name, idx) => {
        lookup.set(normalizeHeaderValue(name), String(aligned[idx] ?? '').trim());
      });

      const normalizedEntries = [...lookup.entries()];
      const hasBusinessValue = normalizedEntries
        .filter(([key]) => !['informazioni cronologiche', 'se vuoi, dimmi il tuo nome', 'se vuoi, scrivi il tuo nome'].includes(key))
        .some(([, value]) => String(value || '').trim().length > 0);

      if (hasBusinessValue) {
        mergedRows.push(aligned);
      }
    });
  });

  return mergedRows;
}

function normalizeLookupValue(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseRichiesteValues(raw) {
  return String(raw || '')
    .split(/[,;|\/\n\r]+/)
    .map((part) => normalizeLookupValue(part))
    .filter((part) => part.length >= 2)
    .filter((part) => !['xxx', 'prova', 'test'].includes(part));
}

function buildRichiesteCounterFromResponses(responseValues) {
  if (!Array.isArray(responseValues) || responseValues.length < 2) {
    return new Map();
  }

  const header = responseValues[0].map((name) => String(name || '').trim());
  const normalizedHeader = header.map((name) => normalizeHeaderValue(name));
  const requestColumnIndexes = normalizedHeader
    .map((name, index) => ({ name, index }))
    .filter((entry) => /^coreo\s/.test(entry.name))
    .map((entry) => entry.index);

  const counter = new Map();
  responseValues.slice(1).forEach((row) => {
    requestColumnIndexes.forEach((index) => {
      const values = parseRichiesteValues(row[index]);
      values.forEach((value) => {
        counter.set(value, (counter.get(value) || 0) + 1);
      });
    });
  });

  return counter;
}

function enrichBaseWithRichieste(baseValues, richiesteCounter) {
  if (!Array.isArray(baseValues) || baseValues.length === 0) {
    return [];
  }

  const header = baseValues[0].map((name) => String(name || '').trim());
  const normalizedHeader = header.map((name) => normalizeHeaderValue(name));

  const idxRichieste = normalizedHeader.findIndex((name) => name === 'richieste');
  const idxCoreografia = normalizedHeader.findIndex((name) => name === 'coreografia');
  const idxBrano = normalizedHeader.findIndex((name) => name === 'brano');
  const idxTitolo = normalizedHeader.findIndex((name) => name === 'titolo');

  if (idxRichieste < 0) {
    return baseValues;
  }

  const output = [header];
  baseValues.slice(1).forEach((row) => {
    const cloned = [...row];
    const keys = [idxCoreografia, idxBrano, idxTitolo]
      .filter((index) => index >= 0)
      .map((index) => normalizeLookupValue(cloned[index]))
      .filter((value) => value.length >= 2);

    let count = 0;
    keys.forEach((key) => {
      count = Math.max(count, Number(richiesteCounter.get(key) || 0));
    });

    cloned[idxRichieste] = count > 0 ? String(count) : '';
    output.push(cloned);
  });

  return output;
}

async function fetchSheetValuesFromSource(source) {
  const sourceId = source?.id;
  const sourceRange = source?.range || 'A:Z';
  const sourceGid = source?.gid || '0';
  const sourcePublicUrl = source?.publicUrl;

  if (!sourceId) {
    throw new Error(`ID mancante per sorgente ${source?.name || 'unknown'}`);
  }

  try {
    const values = await fetchSheetData(sourceId, sourceRange);
    return trimValuesToRange(values, sourceRange);
  } catch (apiError) {
    try {
      const csvContent = await fetchCSVExport(sourceId, sourceGid);
      return trimValuesToRange(csvToValues(csvContent), sourceRange);
    } catch (fallbackError) {
      if (sourcePublicUrl) {
        const csvContent = await fetchPublicUrl(sourcePublicUrl);
        return trimValuesToRange(csvToValues(csvContent), sourceRange);
      }
      throw new Error(`Sorgente ${source?.name || sourceId} non raggiungibile: ${fallbackError.message || apiError.message}`);
    }
  }
}

async function syncSheet(sheet) {
  console.log(`\n📋 Scaricando ${sheet.name}...`);

  try {
    if (Array.isArray(sheet.mergeSources) && sheet.mergeSources.length > 0) {
      const sourceTables = [];

      for (const source of sheet.mergeSources) {
        const values = await fetchSheetValuesFromSource(source);
        sourceTables.push({ source, values });
      }

      const mergedValues = mergeSourceTables(sourceTables);
      if (!mergedValues || mergedValues.length === 0) {
        console.log('   ⚠️  Merge vuoto');
        return { success: false, error: 'Merge vuoto' };
      }

      const outputValues = mergedValues;

      const csv = valuesToCSV(outputValues);
      const filePath = path.join(OUTPUT_DIR, sheet.output);
      fs.writeFileSync(filePath, csv, 'utf8');

      const mergedRows = Math.max(0, outputValues.length - 1);
      console.log(`   ✅ ${sheet.output} (${mergedRows} righe) [Merge Modulo 8+12 A:AI]`);
      return { success: true, rows: mergedRows, file: filePath };
    }

    const values = await fetchSheetData(sheet.id, sheet.range);
    if (!values || values.length === 0) {
      console.log('   ⚠️  Foglio vuoto');
      return { success: false, error: 'Foglio vuoto' };
    }

    const csv = valuesToCSV(values);
    const filePath = path.join(OUTPUT_DIR, sheet.output);
    fs.writeFileSync(filePath, csv, 'utf8');

    console.log(`   ✅ ${sheet.output} (${values.length} righe) [Google Sheets API]`);
    return { success: true, rows: values.length, file: filePath };
  } catch (apiError) {
    console.warn(`   ⚠️ API error: ${apiError.message}. Provo fallback CSV export...`);

    try {
      const csvContent = await fetchCSVExport(sheet.id, sheet.gid);
      const filePath = path.join(OUTPUT_DIR, sheet.output);
      fs.writeFileSync(filePath, csvContent, 'utf8');
      const rows = csvContent.trim().split(/\r?\n/).filter(line => line.trim() !== '').length - 1;
      console.log(`   ✅ ${sheet.output} (${rows} righe) [Export CSV]`);
      return { success: true, rows, file: filePath };
    } catch (fallbackError) {
      if (sheet.publicUrl) {
        try {
          console.warn(`   ⚠️ Fallback da URL pubblico: ${sheet.publicUrl}`);
          const csvContent = await fetchPublicUrl(sheet.publicUrl);
          const filePath = path.join(OUTPUT_DIR, sheet.output);
          fs.writeFileSync(filePath, csvContent, 'utf8');
          const rows = csvContent.trim().split(/\r?\n/).filter(line => line.trim() !== '').length - 1;
          console.log(`   ✅ ${sheet.output} (${rows} righe) [Public URL]`);
          return { success: true, rows, file: filePath };
        } catch (publicError) {
          console.log(`   ❌ Errore public URL: ${publicError.message}`);
          return { success: false, error: publicError.message };
        }
      }

      console.log(`   ❌ Errore fallback CSV: ${fallbackError.message}`);
      return { success: false, error: fallbackError.message };
    }
  }
}

async function syncAll(options = {}) {
  const { exitOnFailure = false, onlySheets = null } = options;
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║     Google Sheets Sync - Download Dati                       ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log(`\n📁 Output: ${OUTPUT_DIR}`);

  const normalizedOnlySheets = Array.isArray(onlySheets)
    ? new Set(onlySheets.map((name) => String(name || '').trim().toLowerCase()).filter(Boolean))
    : null;

  const targetSheets = normalizedOnlySheets
    ? SHEETS.filter((sheet) => normalizedOnlySheets.has(String(sheet.name || '').trim().toLowerCase()))
    : SHEETS;

  let successCount = 0;
  const results = [];

  for (const sheet of targetSheets) {
    const hasMergeSources = Array.isArray(sheet.mergeSources) && sheet.mergeSources.length > 0;
    if (!sheet.id && !hasMergeSources) {
      console.log(`   ❌ ID mancante per sheet ${sheet.name}, salto`);
      results.push({ success: false, error: 'ID mancante', sheet: sheet.name });
      continue;
    }

    const result = await syncSheet(sheet);
    results.push({ sheet: sheet.name, ...result });
    if (result.success) successCount++;
  }

  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log(`║ ✅ Completato: ${successCount}/${targetSheets.length} fogli scaricati`);
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  const summary = {
    success: successCount === targetSheets.length,
    successCount,
    totalSheets: targetSheets.length,
    results,
    outputDir: OUTPUT_DIR,
    syncedAt: new Date().toISOString()
  };

  if (exitOnFailure && successCount < targetSheets.length) {
    process.exit(1);
  }

  return summary;
}

module.exports = {
  syncAll,
  syncSheet,
  SHEETS,
  OUTPUT_DIR
};

if (require.main === module) {
  syncAll({ exitOnFailure: true }).catch(err => {
    console.error('❌ Errore fatale:', err.message);
    process.exit(1);
  });
}
