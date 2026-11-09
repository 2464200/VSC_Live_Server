#!/usr/bin/env node
/** Create local CSV snapshots of every tab in the Registro Google Sheet. */

'use strict';

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { GoogleAuth } = require('google-auth-library');

const ROOT = path.resolve(__dirname, '..');
const CONFIG_PATHS = [
  path.join(ROOT, 'Bordero', 'config', '.env'),
  path.join(ROOT, '.env')
];
const OUTPUT_DIR = path.join(ROOT, 'Registro');
const MANIFEST = '.registro-sync-manifest.json';

const localEnvironment = {};
for (const configPath of CONFIG_PATHS) {
  if (!fs.existsSync(configPath)) continue;
  Object.assign(localEnvironment, dotenv.parse(fs.readFileSync(configPath)));
}
Object.assign(localEnvironment, process.env);

const SHEET_ID = localEnvironment.REGISTRO_GOOGLE_SHEET_ID || '1SNiw3qc6bZ76duNSxIzxZ2GKHKO8XUpIcl_jZbXs5wY';
const API_URL = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}`;

if (localEnvironment.GOOGLE_APPLICATION_CREDENTIALS) {
  const configuredPath = localEnvironment.GOOGLE_APPLICATION_CREDENTIALS;
  process.env.GOOGLE_APPLICATION_CREDENTIALS = path.isAbsolute(configuredPath)
    ? configuredPath
    : path.resolve(ROOT, configuredPath);
}
const apiKey = localEnvironment.GOOGLE_API_KEY || localEnvironment.GOOGLE_SHEETS_API_KEY;

function columnName(number) {
  let result = '';
  while (number > 0) {
    number -= 1;
    result = String.fromCharCode(65 + (number % 26)) + result;
    number = Math.floor(number / 26);
  }
  return result || 'A';
}

function safeFilename(sheetName, usedNames) {
  let stem = sheetName.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/[ .]+$/g, '');
  if (!stem) stem = 'Scheda';
  if (/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(stem)) stem = `_${stem}`;

  let candidate = `${stem}.csv`;
  let suffix = 2;
  while (usedNames.has(candidate.toLocaleLowerCase('en-US'))) {
    candidate = `${stem}__${suffix}.csv`;
    suffix += 1;
  }
  usedNames.add(candidate.toLocaleLowerCase('en-US'));
  return candidate;
}

function csvCell(value) {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function valuesToCsv(values) {
  if (!values.length) return '\uFEFF';
  const width = Math.max(...values.map((row) => row.length));
  const lines = values.map((row) => {
    const normalized = row.map((value) => value === null || value === undefined ? '' : String(value));
    while (normalized.length < width) normalized.push('');
    return normalized.map(csvCell).join(',');
  });
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}

async function getApiAuth() {
  const credentialPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (credentialPath) {
    if (!fs.existsSync(credentialPath)) {
      throw new Error('Il file indicato da GOOGLE_APPLICATION_CREDENTIALS non è disponibile.');
    }

    try {
      const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'] });
      const client = await auth.getClient();
      return { headers: await client.getRequestHeaders() };
    } catch {
      throw new Error('Autenticazione Google non riuscita con il service account configurato.');
    }
  }

  if (apiKey && apiKey !== 'YOUR_API_KEY_HERE') return { apiKey };

  throw new Error('Credenziali Google mancanti: configura GOOGLE_API_KEY in Bordero/config/.env oppure GOOGLE_APPLICATION_CREDENTIALS nel file .env.');
}

async function getJson(url, auth, description) {
  const requestUrl = new URL(url);
  if (auth.apiKey) requestUrl.searchParams.set('key', auth.apiKey);

  let response;
  try {
    response = await fetch(requestUrl, {
      headers: auth.headers,
      signal: AbortSignal.timeout(45000)
    });
  } catch {
    throw new Error(`Connessione a Google Sheets non riuscita durante ${description}.`);
  }
  if (!response.ok) {
    let detail = '';
    try {
      detail = (await response.json()).error?.message || '';
    } catch { /* Keep the diagnostic free of response data and credentials. */ }
    throw new Error(`Google Sheets ha negato ${description} (HTTP ${response.status})${detail ? `: ${detail}` : ''}`);
  }
  try {
    return await response.json();
  } catch {
    throw new Error(`Risposta Google Sheets non valida durante ${description}.`);
  }
}

async function listSheets(auth) {
  const fields = 'sheets(properties(title,index,gridProperties(rowCount,columnCount)))';
  const url = `${API_URL}?${new URLSearchParams({ fields })}`;
  const workbook = await getJson(url, auth, 'la lettura dell’elenco delle schede');
  const sheets = (workbook.sheets || []).map((item) => item.properties || {})
    .sort((a, b) => (a.index || 0) - (b.index || 0));
  if (!sheets.length) throw new Error('Google Sheets non ha restituito alcuna scheda.');
  return sheets;
}

function rangeForSheet(sheet) {
  const title = String(sheet.title || '').replace(/'/g, "''");
  const grid = sheet.gridProperties || {};
  const rows = Math.max(1, Number(grid.rowCount) || 1000);
  const columns = Math.max(1, Number(grid.columnCount) || 26);
  return `'${title}'!A1:${columnName(columns)}${rows}`;
}

async function fetchSheetValues(sheet, auth) {
  const range = encodeURIComponent(rangeForSheet(sheet));
  const query = new URLSearchParams({ valueRenderOption: 'FORMATTED_VALUE' });
  const result = await getJson(`${API_URL}/values/${range}?${query}`, auth, `la scheda ${JSON.stringify(sheet.title)}`);
  return result.values || [];
}

function previousManifest(outputDir = OUTPUT_DIR) {
  try {
    return JSON.parse(fs.readFileSync(path.join(outputDir, MANIFEST), 'utf8')).files || [];
  } catch {
    return [];
  }
}

function hasDataRows(values) {
  return Array.isArray(values) && values.slice(1).some((row) =>
    Array.isArray(row) && row.some((cell) => String(cell ?? '').trim() !== '')
  );
}

async function syncRegistro(dependencies = {}) {
  const outputDir = dependencies.outputDir || OUTPUT_DIR;
  const resolveAuth = dependencies.getApiAuth || getApiAuth;
  const resolveSheets = dependencies.listSheets || listSheets;
  const resolveValues = dependencies.fetchSheetValues || fetchSheetValues;
  const auth = await resolveAuth();
  const sheets = await resolveSheets(auth);

  // Download and prepare every tab before replacing the last valid export.
  const usedNames = new Set();
  const files = new Map();
  for (const sheet of sheets) {
    if (!sheet.title) throw new Error('Google Sheets ha restituito una scheda senza nome.');
    const filename = safeFilename(sheet.title, usedNames);
    const values = await resolveValues(sheet, auth);
    if (!hasDataRows(values)) {
      throw new Error(`La scheda "${sheet.title}" non contiene righe dati; sincronizzazione annullata e snapshot precedenti mantenuti.`);
    }
    files.set(filename, { contents: valuesToCsv(values), rowCount: Math.max(0, values.length - 1) });
  }

  const oldFiles = previousManifest(outputDir);
  fs.mkdirSync(outputDir, { recursive: true });
  const staging = fs.mkdtempSync(path.join(outputDir, '.registro-sync-'));
  try {
    for (const [filename, file] of files) {
      fs.writeFileSync(path.join(staging, filename), file.contents, 'utf8');
    }
    fs.writeFileSync(path.join(staging, MANIFEST), `${JSON.stringify({ source: SHEET_ID, files: [...files.keys()].sort() }, null, 2)}\n`, 'utf8');

    for (const filename of files.keys()) {
      fs.renameSync(path.join(staging, filename), path.join(outputDir, filename));
    }
    fs.renameSync(path.join(staging, MANIFEST), path.join(outputDir, MANIFEST));
  } finally {
    fs.rmSync(staging, { recursive: true, force: true });
  }

  for (const filename of oldFiles) {
    if (!files.has(filename) && path.basename(filename) === filename && filename.toLowerCase().endsWith('.csv')) {
      fs.rmSync(path.join(outputDir, filename), { force: true });
    }
  }

  console.log(`Registro aggiornato: ${files.size} CSV da Google Sheets.`);
  for (const [filename, file] of files) {
    console.log(`  ${filename}: ${file.rowCount} righe`);
  }
  return {
    success: true,
    source: SHEET_ID,
    files: [...files].map(([filename, file]) => ({ filename, rows: file.rowCount })),
    fileCount: files.size,
    totalRows: [...files.values()].reduce((total, file) => total + file.rowCount, 0)
  };
}

if (require.main === module) {
  syncRegistro().catch((error) => {
    console.error(`Errore aggiornando Registro da Google Sheets: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { safeFilename, valuesToCsv, hasDataRows, syncRegistro };
