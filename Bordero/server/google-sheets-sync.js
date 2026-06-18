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
 * Sincronizza un foglio
 */
async function syncSheet(sheet) {
  try {
    console.log(`\n📋 Scaricando ${sheet.name}...`);
    
    const values = await fetchSheetData(sheet.id, sheet.range);

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

  if (successCount < SHEETS.length) {
    process.exit(1);
  }
}

// Avvia sync
syncAll().catch((err) => {
  console.error('❌ Errore fatale:', err.message);
  process.exit(1);
});
