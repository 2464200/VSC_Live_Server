#!/usr/bin/env node
/**
 * Google Sheets API v4 - Download CSV data
 * Usa Google Sheets API v4 (autenticata) per scaricare i dati
 * 
 * Vantaggi:
 * - ✅ Funziona con Google Sheets pubblici
 * - ✅ Nessuna dipendenza da XLSX.js
 * - ✅ Dati sempre aggiornati
 * - ✅ API stabile di Google
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// Carica variabili di ambiente (se presenti)
const dotenv = require('dotenv');
const envPath = path.join(__dirname, '..', 'config', '.env');

if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  console.warn('⚠️  File Bordero/config/.env non trovato: procederò con il fallback pubblico (se disponibile).');
}

const API_KEY = process.env.GOOGLE_API_KEY || null;
if (!API_KEY) {
  console.warn('⚠️  GOOGLE_API_KEY non configurata: verrà usato il fallback pubblico quando possibile.');
}

// Configurazione sheets
const SHEETS = [
  {
    name: 'Brani',
    id: process.env.GOOGLE_SHEET_BRANI,
    gid: process.env.GOOGLE_SHEET_BRANI_GID || '0',
    range: "'Elenco Coreo (statico)'!A:Z",
    output: 'brani.csv'
  },
  {
    name: 'Comuni',
    id: process.env.GOOGLE_SHEET_COMUNI,
    gid: process.env.GOOGLE_SHEET_COMUNI_GID || '0',
    range: 'Sheet1!A:Z',
    output: 'comuni.csv'
  },
  {
    name: 'DJ/dBase',
    id: process.env.GOOGLE_SHEET_DBASE,
    gid: process.env.GOOGLE_SHEET_DBASE_GID || '0',
    range: 'dBase!A:Z',
    output: 'dbase.csv'
  }
];

const OUTPUT_DIR = path.join(__dirname, '..', 'data');

// Assicura che la directory esista
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

/**
 * Escape CSV values
 */
function escapeCSV(field) {
  if (field === null || field === undefined) return '';
  
  const str = String(field).trim();
  
  // Se contiene virgola, virgolette o newline, wrappa in virgolette e escape le internal quotes
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  
  return str;
}

/**
 * Converti Google Sheets values a CSV
 */
function valuesToCSV(values) {
  if (!values || values.length === 0) {
    return '';
  }

  return values
    .map(row => row.map(escapeCSV).join(','))
    .join('\n');
}

/**
 * Fetch data da Google Sheets API
 */
function fetchSheetData(spreadsheetId, range) {
  return new Promise((resolve, reject) => {
    const encodedRange = encodeURIComponent(range);
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodedRange}?key=${API_KEY}`;

    https.get(url, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const json = JSON.parse(data);

          if (res.statusCode !== 200) {
            const errorMsg = json.error?.message || `HTTP ${res.statusCode}`;
            reject(new Error(errorMsg));
            return;
          }

          const values = json.values || [];
          resolve({ values, source: 'API' });
        } catch (e) {
          reject(new Error(`Parse error: ${e.message}`));
        }
      });
    }).on('error', reject);
  });
}

/**
 * Fetch public export (TSV) fallback from Google Sheets (docs export)
 */
function parseTSVData(data) {
  const lines = data.replace(/\r\n/g, '\n').split('\n');
  return lines.map(line => line.split('\t').map(cell => cell === '' ? '' : cell));
}

function parseGvizResponse(data) {
  const trimmed = data.trim();
  if (!trimmed.includes('google.visualization.Query.setResponse')) {
    throw new Error('Not a gviz response');
  }

  const match = trimmed.match(/google\.visualization\.Query\.setResponse\((.*)\);?\s*$/s);
  if (!match || !match[1]) {
    throw new Error('Unable to parse gviz response');
  }

  const json = JSON.parse(match[1]);
  const cols = json.table?.cols || [];
  const rows = json.table?.rows || [];
  const headerRow = cols.map(col => col.label || '');
  const values = [headerRow];

  for (const row of rows) {
    const cells = (row.c || []).map(cell => {
      if (cell === null || cell === undefined) return '';
      return cell.v !== undefined ? String(cell.v) : (cell.f !== undefined ? String(cell.f) : '');
    });
    while (cells.length < headerRow.length) {
      cells.push('');
    }
    values.push(cells);
  }

  return values;
}

function parseSheetExport(data) {
  const trimmed = data.trim();
  if (trimmed.startsWith('/*O_o*/') || trimmed.includes('google.visualization.Query.setResponse')) {
    return parseGvizResponse(data);
  }
  return parseTSVData(data);
}

function fetchSheetDataFallback(spreadsheetId, gid) {
  const startUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=tsv&gid=${gid}`;
  const altUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:tsv&gid=${gid}`;
  const maxRedirects = 5;

  function fetchUrl(url, redirectsLeft) {
    return new Promise((resolve, reject) => {
      https.get(url, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirectsLeft > 0) {
          const next = res.headers.location.startsWith('http') ? res.headers.location : `https://docs.google.com${res.headers.location}`;
          res.resume();
          fetchUrl(next, redirectsLeft - 1).then(resolve).catch(reject);
          return;
        }

        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          resolve({ statusCode: res.statusCode, data, url });
        });
      }).on('error', (err) => {
        reject(err);
      });
    });
  }

  return new Promise(async (resolve, reject) => {
    const urls = [startUrl, altUrl];
    let lastError = null;

    for (const url of urls) {
      try {
        const { statusCode, data } = await fetchUrl(url, maxRedirects);
        if (statusCode !== 200) {
          lastError = new Error(`HTTP ${statusCode} from ${url}`);
          continue;
        }

        try {
          const values = parseSheetExport(data);
          if (!values || values.length === 0) {
            lastError = new Error(`No data parsed from ${url}`);
            continue;
          }
          return resolve({ values, source: `Public export (${url.includes('/gviz/tq') ? 'gviz/tq' : 'export'})` });
        } catch (parseError) {
          lastError = new Error(`Parse failed from ${url}: ${parseError.message}`);
          continue;
        }
      } catch (err) {
        lastError = err;
        continue;
      }
    }

    reject(lastError || new Error('Fallback public export failed'));
  });
}

/**
 * Sincronizza un foglio
 */
async function syncSheet(sheet) {
  try {
    console.log(`\n📋 Scaricando ${sheet.name}...`);
    
    let result;
    try {
      result = await fetchSheetData(sheet.id, sheet.range);
      console.log(`   ✅ Dati caricati da API`);
    } catch (primaryError) {
      console.log(`   ⚠️  API error: ${primaryError.message}`);
      console.log('   Provo fallback esportazione pubblica...');
      try {
        result = await fetchSheetDataFallback(sheet.id, sheet.gid || '0');
        console.log(`   ✅ Fallback pubblico riuscito: ${result.source}`);
      } catch (fallbackError) {
        console.log(`   ❌ Fallback fallito: ${fallbackError.message}`);
        throw primaryError;
      }
    }

    const values = result.values || result;
    if (!values || values.length === 0) {
      console.log(`   ⚠️  Foglio vuoto`);
      return { success: false, error: 'Foglio vuoto' };
    }

    // Converti a CSV
    const csv = valuesToCSV(values);

    // Salva file
    const filePath = path.join(OUTPUT_DIR, sheet.output);
    fs.writeFileSync(filePath, csv, 'utf8');

    console.log(`   ✅ ${sheet.output} (${values.length} righe)`);
    return { success: true, rows: values.length, file: sheet.output };
  } catch (error) {
    console.log(`   ❌ Errore: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Sincronizza tutti i fogli
 */
async function syncAll() {
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║     Google Sheets API v4 - Download Dati                      ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log(`\n📁 Output: ${OUTPUT_DIR}`);

  let successCount = 0;
  const results = [];

  for (const sheet of SHEETS) {
    const result = await syncSheet(sheet);
    results.push(result);
    if (result.success) successCount++;
  }

  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log(`║ ✅ Completato: ${successCount}/${SHEETS.length} fogli scaricati`);
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  console.log(`📁 File generati in: ${OUTPUT_DIR}`);
  for (const result of results.filter(r => r.success && r.file)) {
    console.log(`   - ${result.file}`);
  }

  if (successCount < SHEETS.length) {
    process.exit(1);
  }
}

// Avvia sync
syncAll().catch((err) => {
  console.error('❌ Errore fatale:', err.message);
  process.exit(1);
});
