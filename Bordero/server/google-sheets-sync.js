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

// Carica variabili di ambiente
const dotenv = require('dotenv');
const envPath = path.join(__dirname, '..', 'config', '.env');

if (!fs.existsSync(envPath)) {
  console.error('❌ File .env non trovato!');
  console.error('   Esegui: node setup-google-api.js');
  process.exit(1);
}

dotenv.config({ path: envPath });

const API_KEY = process.env.GOOGLE_API_KEY;
if (!API_KEY) {
  console.error('❌ GOOGLE_API_KEY non configurata!');
  console.error('   Esegui: node setup-google-api.js');
  process.exit(1);
}

// Configurazione sheets
const SHEETS = [
  {
    name: 'Brani',
    id: process.env.GOOGLE_SHEET_BRANI,
    range: "'Elenco Coreo (statico)'!A:Z",
    output: 'brani.csv'
  },
  {
    name: 'Comuni',
    id: process.env.GOOGLE_SHEET_COMUNI,
    range: 'Sheet1!A:Z',
    output: 'comuni.csv'
  },
  {
    name: 'DJ/dBase',
    id: process.env.GOOGLE_SHEET_DBASE,
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
          resolve(values);
        } catch (e) {
          reject(new Error(`Parse error: ${e.message}`));
        }
      });
    }).on('error', reject);
  });
}

/**
 * Fallback: scarica CSV usando l'export pubblico di Google Sheets
 */
function fetchCSVExport(spreadsheetId, gid, maxRedirects = 5) {
  const urlModule = require('url');
  const httpLib = require('http');

  return new Promise((resolve, reject) => {
    let redirects = 0;

    function getUrl(u) {
      const parsed = urlModule.parse(u);
      const lib = parsed.protocol === 'http:' ? httpLib : https;

      const req = lib.get(u, (res) => {
        // Follow redirects
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          if (redirects >= maxRedirects) {
            reject(new Error('Too many redirects'));
            return;
          }
          redirects++;
          const nextUrl = urlModule.resolve(u, res.headers.location);
          // consume and discard response before following
          res.resume();
          getUrl(nextUrl);
          return;
        }

        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }

        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => resolve(data));
      });

      req.on('error', reject);
    }

    const startUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`;
    getUrl(startUrl);
  });
}

/**
 * Sincronizza un foglio (usa API v4, se bloccata prova export CSV pubblico)
 */
async function syncSheet(sheet) {
  console.log(`\n📋 Scaricando ${sheet.name}...`);

  // Determine gid for fallback export
  let gid = 0;
  if (sheet.output === 'brani.csv') gid = process.env.GOOGLE_SHEET_BRANI_GID || 0;
  if (sheet.output === 'comuni.csv' || sheet.output === 'comuni_italia.csv') gid = process.env.GOOGLE_SHEET_COMUNI_GID || 0;
  if (sheet.output === 'dbase.csv') gid = process.env.GOOGLE_SHEET_DBASE_GID || 0;

  try {
    // Try API first
    const values = await fetchSheetData(sheet.id, sheet.range);

    if (!values || values.length === 0) {
      console.log(`   ⚠️  Foglio vuoto`);
      return { success: false, error: 'Foglio vuoto' };
    }

    const csv = valuesToCSV(values);
    const filePath = path.join(OUTPUT_DIR, sheet.output);
    fs.writeFileSync(filePath, csv, 'utf8');

    console.log(`   ✅ ${sheet.output} (${values.length} righe) [API]`);
    return { success: true, rows: values.length, file: sheet.output };
  } catch (apiError) {
    console.log(`   ⚠️ API error: ${apiError.message}. Provo fallback CSV export...`);

    // If configured to allow public export fallback or always attempt fallback on API error
    try {
      const csvContent = await fetchCSVExport(sheet.id, gid);
      // Convert raw CSV to values array using quick parser (split lines)
      const rows = csvContent.split(/\r?\n/).filter(l => l.trim() !== '');
      const values = rows.map(r => r.split(','));

      const filePath = path.join(OUTPUT_DIR, sheet.output);
      fs.writeFileSync(filePath, csvContent, 'utf8');

      console.log(`   ✅ ${sheet.output} (${rows.length - 1} righe) [Export CSV]`);
      return { success: true, rows: rows.length - 1, file: sheet.output };
    } catch (exportError) {
      console.log(`   ❌ Errore fallback CSV: ${exportError.message}`);
      return { success: false, error: exportError.message };
    }
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

  if (successCount < SHEETS.length) {
    process.exit(1);
  }
}

// Avvia sync
syncAll().catch((err) => {
  console.error('❌ Errore fatale:', err.message);
  process.exit(1);
});
