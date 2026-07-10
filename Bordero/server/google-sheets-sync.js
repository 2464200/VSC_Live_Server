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
    name: 'Brani',
    id: process.env.GOOGLE_SHEET_BRANI,
    range: 'A:Z',
    output: 'brani.csv',
    gid: process.env.GOOGLE_SHEET_BRANI_GID || '0',
    publicUrl: process.env.GOOGLE_SHEET_BRANI_PUBLIC_URL?.trim()
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
    const ref = sheetMatch[2].trim();
    candidates.add(ref);
    candidates.add(`'${sheetMatch[1].replace(/^['"]|['"]$/g, '')}'!${ref}`);
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

async function syncSheet(sheet) {
  console.log(`\n📋 Scaricando ${sheet.name}...`);

  try {
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

async function syncAll() {
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║     Google Sheets Sync - Download Dati                       ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log(`\n📁 Output: ${OUTPUT_DIR}`);

  let successCount = 0;
  const results = [];

  for (const sheet of SHEETS) {
    if (!sheet.id) {
      console.log(`   ❌ ID mancante per sheet ${sheet.name}, salto`);
      results.push({ success: false, error: 'ID mancante', sheet: sheet.name });
      continue;
    }

    const result = await syncSheet(sheet);
    results.push({ sheet: sheet.name, ...result });
    if (result.success) successCount++;
  }

  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log(`║ ✅ Completato: ${successCount}/${SHEETS.length} fogli scaricati`);
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  if (successCount < SHEETS.length) {
    process.exit(1);
  }
}

syncAll().catch(err => {
  console.error('❌ Errore fatale:', err.message);
  process.exit(1);
});
