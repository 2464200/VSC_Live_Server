#!/usr/bin/env node
/** Create validated local CSV snapshots of every tab in the Registro Google Sheet. */
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { parse } = require('csv-parse/sync');
const dotenv = require('dotenv');
const { GoogleAuth } = require('google-auth-library');

const ROOT = path.resolve(__dirname, '..');
const CONFIG_PATHS = [path.join(ROOT, 'Bordero', 'config', '.env'), path.join(ROOT, '.env')];
const OUTPUT_DIR = path.join(ROOT, 'Registro');
const MANIFEST = '.registro-sync-manifest.json';
const TASK_NAME = 'Aggiorna CSV Registro da Google Sheets';
const localEnvironment = {};
for (const configPath of CONFIG_PATHS) {
  if (fs.existsSync(configPath)) Object.assign(localEnvironment, dotenv.parse(fs.readFileSync(configPath)));
}
Object.assign(localEnvironment, process.env);
const SHEET_ID = localEnvironment.REGISTRO_GOOGLE_SHEET_ID || '1SNiw3qc6bZ76duNSxIzxZ2GKHKO8XUpIcl_jZbXs5wY';
const API_URL = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}`;
if (localEnvironment.GOOGLE_APPLICATION_CREDENTIALS) {
  const configuredPath = localEnvironment.GOOGLE_APPLICATION_CREDENTIALS;
  process.env.GOOGLE_APPLICATION_CREDENTIALS = path.isAbsolute(configuredPath) ? configuredPath : path.resolve(ROOT, configuredPath);
}
const apiKey = localEnvironment.GOOGLE_API_KEY || localEnvironment.GOOGLE_SHEETS_API_KEY;

function columnName(number) {
  let result = '';
  while (number > 0) { number -= 1; result = String.fromCharCode(65 + number % 26) + result; number = Math.floor(number / 26); }
  return result || 'A';
}
function safeFilename(sheetName, usedNames = new Set()) {
  let stem = String(sheetName).replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/[ .]+$/g, '');
  if (!stem) stem = 'Scheda';
  if (/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(stem)) stem = `_${stem}`;
  let candidate = `${stem}.csv`, suffix = 2;
  while (usedNames.has(candidate.toLocaleLowerCase('en-US'))) candidate = `${stem}__${suffix++}.csv`;
  usedNames.add(candidate.toLocaleLowerCase('en-US'));
  return candidate;
}
function csvCell(value) {
  const text = value == null ? '' : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
function valuesToCsv(values) {
  if (!values.length) return '\uFEFF';
  const width = Math.max(...values.map((row) => row.length));
  return `\uFEFF${values.map((row) => {
    const normalized = row.map((value) => value == null ? '' : String(value));
    while (normalized.length < width) normalized.push('');
    return normalized.map(csvCell).join(',');
  }).join('\r\n')}\r\n`;
}
function hasDataRows(values) {
  return Array.isArray(values) && values.slice(1).some((row) => Array.isArray(row) && row.some((cell) => String(cell ?? '').trim() !== ''));
}
function parseCsv(text) {
  return parse(String(text).replace(/^\uFEFF/, ''), { bom: true, skip_empty_lines: false, relax_column_count: true });
}
function normalizedHeader(value) { return String(value ?? '').trim().normalize('NFKC').toLocaleLowerCase('it-IT'); }
function checkValues(values, sheetTitle) {
  if (!Array.isArray(values) || !values.every(Array.isArray)) throw new Error(`Formato incompatibile nella scheda «${sheetTitle}»: attesa una matrice di celle.`);
  if (!values.length) throw new Error(`Risposta incompatibile nella scheda «${sheetTitle}»: mancano le intestazioni.`);
  if (values.some((row) => row.some((cell) => cell !== null && cell !== undefined && !['string', 'number', 'boolean'].includes(typeof cell)))) {
    throw new Error(`Formato cella incompatibile nella scheda «${sheetTitle}».`);
  }
  const header = values[0].map((value) => String(value ?? '').trim());
  if (!header.some(Boolean)) throw new Error(`Intestazioni mancanti nella scheda «${sheetTitle}».`);
  const seen = new Set(), duplicates = [];
  for (const cell of header) {
    if (!cell) continue;
    const key = normalizedHeader(cell);
    if (seen.has(key)) duplicates.push(cell);
    seen.add(key);
  }
  if (duplicates.length) throw new Error(`Intestazioni duplicate nella scheda «${sheetTitle}»: ${[...new Set(duplicates)].join(', ')}.`);
  if (values.slice(1).some((row) => row.length > header.length)) throw new Error(`Righe con più colonne delle intestazioni nella scheda «${sheetTitle}».`);
  return header;
}
function compareHeaders(expected, actual, filename) {
  const normExpected = expected.map(normalizedHeader), normActual = actual.map(normalizedHeader);
  const missing = expected.filter((name, i) => name.trim() && !normActual.includes(normExpected[i]));
  const added = actual.filter((name, i) => name.trim() && !normExpected.includes(normActual[i]));
  const reordered = !missing.length && !added.length && normExpected.join('\u001f') !== normActual.join('\u001f');
  const differences = [];
  if (missing.length) differences.push(`${filename} — intestazioni attese assenti: ${missing.map((x) => `«${x}»`).join(', ')}.`);
  if (added.length) differences.push(`${filename} — nuove intestazioni: ${added.map((x) => `«${x}»`).join(', ')}.`);
  if (reordered) differences.push(`${filename} — ordine delle intestazioni cambiato.`);
  return differences;
}
function reliableKey(headers, rows) {
  const candidates = ['id', 'uuid', 'record id', 'record_id', 'id registrazione', 'timestamp'];
  const index = headers.findIndex((h) => candidates.includes(normalizedHeader(h)));
  if (index < 0) return null;
  const map = new Map();
  for (const row of rows) {
    const key = String(row[index] ?? '').trim();
    if (!key || map.has(key)) return null;
    map.set(key, row);
  }
  return { index, map };
}
function compareRows(oldRows, newRows, headers) {
  const old = reliableKey(headers, oldRows), current = reliableKey(headers, newRows);
  if (!old || !current) return { comparable: false };
  let added = 0, removed = 0, changed = 0;
  for (const [key, row] of current.map) {
    if (!old.map.has(key)) added++;
    else if (JSON.stringify(row) !== JSON.stringify(old.map.get(key))) changed++;
  }
  for (const key of old.map.keys()) if (!current.map.has(key)) removed++;
  return { comparable: true, added, removed, changed };
}

async function getApiAuth() {
  const credentialPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (credentialPath) {
    if (!fs.existsSync(credentialPath)) throw new Error('Il file credenziali Google configurato non è disponibile.');
    try { const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'] }); const client = await auth.getClient(); return { headers: await client.getRequestHeaders() }; }
    catch { throw new Error('Autenticazione Google non riuscita con il service account configurato.'); }
  }
  if (apiKey && apiKey !== 'YOUR_API_KEY_HERE') return { apiKey };
  throw new Error('Credenziali Google mancanti: configura GOOGLE_API_KEY in Bordero/config/.env oppure GOOGLE_APPLICATION_CREDENTIALS nel file .env.');
}
async function getJson(url, auth, description, fetchImpl = fetch) {
  const requestUrl = new URL(url);
  if (auth.apiKey) requestUrl.searchParams.set('key', auth.apiKey);
  let response;
  try { response = await fetchImpl(requestUrl, { headers: auth.headers, signal: AbortSignal.timeout(45000) }); }
  catch { throw new Error(`Connessione a Google Sheets non riuscita durante ${description}.`); }
  if (!response.ok) throw new Error(`Google Sheets ha negato ${description} (HTTP ${response.status}).`);
  let payload;
  try { payload = await response.json(); }
  catch { throw new Error(`Risposta Google Sheets non JSON durante ${description} (possibile pagina di accesso).`); }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload) || payload.error) throw new Error(`Risposta Google Sheets incompatibile durante ${description} (possibile errore API o pagina di accesso).`);
  return payload;
}
async function listSheets(auth) {
  const fields = 'sheets(properties(title,index,gridProperties(rowCount,columnCount)))';
  const workbook = await getJson(`${API_URL}?${new URLSearchParams({ fields })}`, auth, 'la lettura dell’elenco delle schede');
  if (!Array.isArray(workbook.sheets)) throw new Error('Risposta incompatibile: Google Sheets non ha restituito l’elenco delle schede.');
  const sheets = workbook.sheets.map((item) => item?.properties || {}).sort((a, b) => (a.index || 0) - (b.index || 0));
  if (!sheets.length || sheets.some((sheet) => !sheet.title)) throw new Error('Google Sheets non ha restituito schede valide.');
  return sheets;
}
function rangeForSheet(sheet) {
  const title = String(sheet.title).replace(/'/g, "''"), grid = sheet.gridProperties || {};
  return `'${title}'!A1:${columnName(Math.max(1, Number(grid.columnCount) || 26))}${Math.max(1, Number(grid.rowCount) || 1000)}`;
}
async function fetchSheetValues(sheet, auth) {
  const range = encodeURIComponent(rangeForSheet(sheet));
  const result = await getJson(`${API_URL}/values/${range}?${new URLSearchParams({ valueRenderOption: 'FORMATTED_VALUE' })}`, auth, `la scheda ${JSON.stringify(sheet.title)}`);
  if (Array.isArray(result.values)) return result.values;
  // Sheets omits values for a valid empty range; its range metadata distinguishes that from a login/error payload.
  if (typeof result.range === 'string' && result.spreadsheetId) return [];
  throw new Error(`Risposta incompatibile per la scheda «${sheet.title}»: campo values assente.`);
}
function previousManifest(outputDir) {
  try { const manifest = JSON.parse(fs.readFileSync(path.join(outputDir, MANIFEST), 'utf8')); return Array.isArray(manifest.files) ? manifest.files.filter((name) => path.basename(name) === name && name.toLowerCase().endsWith('.csv')) : []; }
  catch { return []; }
}
function validateCsvFile(filename, contents) {
  let rows;
  try { rows = parseCsv(contents); } catch { throw new Error(`Il CSV temporaneo ${filename} non è leggibile.`); }
  if (!rows.length) throw new Error(`Il CSV temporaneo ${filename} è privo di intestazioni.`);
  checkValues(rows, filename);
  return rows;
}
function writeFile(filePath, contents) { fs.writeFileSync(filePath, contents); }

// Publish all snapshots as one transaction, retaining every replaced/deleted file for rollback.
function publishTransaction(outputDir, stage, files, manifestContents, oldFiles, dependencies) {
  const rename = dependencies.renameSync || fs.renameSync;
  const remove = dependencies.rmSync || fs.rmSync;
  const backup = path.join(stage, 'backup'); fs.mkdirSync(backup);
  const destinations = [...new Set([...oldFiles, ...files.keys(), MANIFEST])]
    .filter((name) => name === MANIFEST || (path.basename(name) === name && name.toLowerCase().endsWith('.csv')));
  const backedUp = [], installed = [];
  try {
    for (const name of destinations) {
      const target = path.join(outputDir, name);
      if (fs.existsSync(target)) { rename(target, path.join(backup, name)); backedUp.push(name); }
    }
    for (const [name] of files) { rename(path.join(stage, name), path.join(outputDir, name)); installed.push(name); }
    rename(path.join(stage, MANIFEST), path.join(outputDir, MANIFEST)); installed.push(MANIFEST);
  } catch (cause) {
    const rollbackErrors = [];
    for (const name of installed.reverse()) {
      try { remove(path.join(outputDir, name), { force: true }); } catch (error) { rollbackErrors.push(`${name}: ${error.message}`); }
    }
    for (const name of backedUp.reverse()) {
      try { rename(path.join(backup, name), path.join(outputDir, name)); } catch (error) { rollbackErrors.push(`${name}: ${error.message}`); }
    }
    const error = new Error(`Pubblicazione CSV interrotta: ${cause.message}${rollbackErrors.length ? `; ripristino incompleto (${rollbackErrors.join('; ')}), backup conservato in ${backup}` : '; CSV precedenti ripristinati.'}`);
    error.cause = cause; error.rollbackErrors = rollbackErrors; error.backupPath = path.relative(ROOT, backup);
    throw error;
  }
}
function acquireLock(outputDir) {
  const lockPath = path.join(outputDir, '.registro-sync.lock');
  try { const fd = fs.openSync(lockPath, 'wx'); fs.writeFileSync(fd, JSON.stringify({ pid: process.pid, created: new Date().toISOString() })); return () => { try { fs.closeSync(fd); } catch {} try { fs.unlinkSync(lockPath); } catch {} }; }
  catch (error) { if (error.code === 'EEXIST') throw new Error('Un’altra esecuzione sta già aggiornando i CSV del Registro (lock attivo).'); throw error; }
}

async function syncRegistro(dependencies = {}) {
  const outputDir = dependencies.outputDir || OUTPUT_DIR;
  fs.mkdirSync(outputDir, { recursive: true });
  const unlock = (dependencies.acquireLock || acquireLock)(outputDir);
  try {
    const resolveAuth = dependencies.getApiAuth || getApiAuth, resolveSheets = dependencies.listSheets || listSheets, resolveValues = dependencies.fetchSheetValues || fetchSheetValues;
    const oldFiles = previousManifest(outputDir), auth = await resolveAuth(), sheets = await resolveSheets(auth);
    if (!Array.isArray(sheets) || !sheets.length) throw new Error('Google Sheets non ha restituito schede valide.');
    const usedNames = new Set(), files = new Map(), differences = [], rowChanges = [];
    for (const sheet of sheets) {
      if (!sheet?.title) throw new Error('Google Sheets ha restituito una scheda senza nome.');
      const filename = safeFilename(sheet.title, usedNames), values = await resolveValues(sheet, auth);
      if (!Array.isArray(values) || !values.every(Array.isArray)) throw new Error(`Formato incompatibile nella scheda «${sheet.title}»: attesa una matrice di celle.`);
      const target = path.join(outputDir, filename);
      if (!values.length) {
        if (oldFiles.includes(filename) && fs.existsSync(target)) {
          files.set(filename, { contents: fs.readFileSync(target), rowCount: null, preserved: true });
          continue;
        }
        throw new Error(`La scheda «${sheet.title}» non restituisce le intestazioni e non esiste uno snapshot CSV precedente.`);
      }
      const header = checkValues(values, sheet.title);
      if (fs.existsSync(target)) {
        const localRows = validateCsvFile(filename, fs.readFileSync(target));
        differences.push(...compareHeaders(localRows[0], header, filename));
        if (localRows.length > 1 && values.length > 1) {
          const counts = compareRows(localRows.slice(1), values.slice(1), localRows[0]);
          if (counts.comparable && (counts.added || counts.removed || counts.changed)) rowChanges.push({ filename, ...counts });
        }
      }
      if (!hasDataRows(values)) {
        if (oldFiles.includes(filename) && fs.existsSync(target)) {
          // Una scheda priva di righe può essere legittima o una risposta incompleta: conserva lo snapshot valido.
          files.set(filename, { contents: fs.readFileSync(target), rowCount: null, preserved: true });
        } else files.set(filename, { contents: valuesToCsv(values), rowCount: 0 });
      } else files.set(filename, { contents: valuesToCsv(values), rowCount: values.length - 1 });
    }
    if (differences.length) {
      const error = new Error('La struttura delle intestazioni Google non coincide con i CSV locali.');
      error.diagnostics = { status: 'confirmed', explainsFailure: true, differences, rowChanges };
      throw error;
    }
    const staging = fs.mkdtempSync(path.join(outputDir, '.registro-sync-'));
    let retainStaging = false;
    try {
      const stageWrite = dependencies.writeFileSync || writeFile;
      for (const [filename, file] of files) {
        stageWrite(path.join(staging, filename), file.contents);
        validateCsvFile(filename, fs.readFileSync(path.join(staging, filename)));
      }
      const manifest = `${JSON.stringify({ source: SHEET_ID, files: [...files.keys()].sort() }, null, 2)}\n`;
      stageWrite(path.join(staging, MANIFEST), manifest);
      JSON.parse(fs.readFileSync(path.join(staging, MANIFEST), 'utf8'));
      try { (dependencies.publishTransaction || publishTransaction)(outputDir, staging, files, manifest, oldFiles, dependencies); }
      catch (error) { retainStaging = Boolean(error.rollbackErrors?.length); throw error; }
    } finally { if (!retainStaging) fs.rmSync(staging, { recursive: true, force: true }); }
    console.log(`Registro aggiornato: ${files.size} CSV da Google Sheets.`);
    for (const [filename, file] of files) console.log(`  ${filename}: ${file.preserved ? 'snapshot precedente mantenuto' : `${file.rowCount} righe`}`);
    return { success: true, source: SHEET_ID, files: [...files].map(([filename, file]) => ({ filename, rows: file.rowCount })), fileCount: files.size, totalRows: [...files.values()].reduce((total, file) => total + (file.rowCount || 0), 0), rowChanges };
  } finally { unlock(); }
}

async function diagnoseFailure(error, dependencies = {}) {
  const outputDir = dependencies.outputDir || OUTPUT_DIR, localFiles = previousManifest(outputDir);
  const availability = localFiles.length > 0 && localFiles.every((name) => {
    try { validateCsvFile(name, fs.readFileSync(path.join(outputDir, name))); return true; } catch { return false; }
  });
  if (error.diagnostics) return { ...error.diagnostics, previousCsvAvailable: availability };
  const differences = [], rowChanges = [], partial = [];
  try {
    const auth = await (dependencies.getApiAuth || getApiAuth)();
    const sheets = await (dependencies.listSheets || listSheets)(auth);
    const usedNames = new Set();
    for (const sheet of sheets) {
      const filename = safeFilename(sheet.title, usedNames);
      if (!fs.existsSync(path.join(outputDir, filename))) { partial.push(`${filename} — CSV locale assente; confronto intestazioni non disponibile.`); continue; }
      const values = await (dependencies.fetchSheetValues || fetchSheetValues)(sheet, auth);
      const header = checkValues(values, sheet.title), localRows = validateCsvFile(filename, fs.readFileSync(path.join(outputDir, filename)));
      differences.push(...compareHeaders(localRows[0], header, filename));
      if (localRows.length > 1 && values.length > 1) {
        const counts = compareRows(localRows.slice(1), values.slice(1), localRows[0]);
        if (counts.comparable && (counts.added || counts.removed || counts.changed)) rowChanges.push({ filename, ...counts });
        else if (!counts.comparable) partial.push(`${filename} — righe non confrontabili per chiave affidabile.`);
      }
    }
    const confirmed = differences.length > 0;
    return { status: confirmed ? 'confirmed' : (partial.length ? 'partial' : 'no-differences'), explainsFailure: confirmed, differences, rowChanges, partial, previousCsvAvailable: availability };
  } catch (diagnosticError) {
    const hasPartialData = differences.length > 0 || rowChanges.length > 0;
    partial.push(`${hasPartialData ? 'Confronto parziale, poi interrotto' : 'Confronto impossibile'}: ${safeCause(diagnosticError)}`);
    return { status: hasPartialData ? 'partial' : 'impossible', explainsFailure: false, differences, rowChanges, partial, previousCsvAvailable: availability };
  }
}
function safeCause(error) {
  return String(error?.message || 'Errore non specificato.')
    .replace(/(?:[A-Za-z]:\\|\\\\)[^\s'";,)]+/g, '[percorso locale]')
    .replace(/(?:^|\s)\/(?:[^\s/]+\/)+[^\s]*/g, ' [percorso locale]')
    .replace(/([?&](?:key|access_token|token|auth)=)[^&\s]+/gi, '$1[redatto]');
}
async function handleFailure(error) {
  const diagnostics = await diagnoseFailure(error);
  const reportDir = path.join(ROOT, 'logs'); fs.mkdirSync(reportDir, { recursive: true });
  const reportPath = path.join(reportDir, `registro-sync-diagnosis-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  const report = { task: TASK_NAME, cause: safeCause(error), diagnostics: { ...diagnostics, partial: (diagnostics.partial || []).map((item) => safeCause({ message: item })) }, previousCsvAvailable: diagnostics.previousCsvAvailable ?? false, dependentTasks: [], note: 'Non esistono task VS Code con dependsOn verso questo task; la supervisione dei servizi è indipendente.' };
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  console.error(`[${TASK_NAME}] Fallito: ${report.cause}`);
  console.error(`Diagnosi: ${diagnostics.status}; CSV precedenti utilizzabili: ${report.previousCsvAvailable ? 'sì' : 'no'}.`);
  for (const line of [...(diagnostics.differences || []), ...(report.diagnostics.partial || [])]) console.error(`- ${line}`);
  for (const change of diagnostics.rowChanges || []) console.error(`- ${change.filename}: variazioni record (nuovi ${change.added}, modificati ${change.changed}, rimossi ${change.removed}); nessun valore personale registrato.`);
  console.error(`Dettaglio: ${reportPath}`);
  if (process.platform !== 'win32' || process.env.CI || !(process.env.TERM_PROGRAM === 'vscode' || process.env.VSCODE_PID || process.env.VSCODE_IPC_HOOK_CLI)) return 'abort';
  const dialog = path.join(__dirname, 'registro-sync-failure-dialog.ps1');
  const result = spawnSync('powershell.exe', ['-NoProfile', '-STA', '-ExecutionPolicy', 'Bypass', '-File', dialog, '-ReportPath', reportPath], { encoding: 'utf8', windowsHide: true });
  if (result.error || result.status !== 0) return 'abort';
  return 'continue';
}

if (require.main === module) {
  syncRegistro().catch(async (error) => {
    // Continua lascia i CSV precedenti al loro posto; l'aggiornamento resta comunque un errore.
    const choice = await handleFailure(error);
    if (choice === 'continue') console.error('Scelta: continua con i CSV precedenti disponibili. Il task resta fallito; non ci sono passaggi dipendenti da avviare.');
    else console.error('Scelta: interrompi aggiornamento.');
    process.exitCode = 1;
  });
}

module.exports = { safeFilename, valuesToCsv, hasDataRows, checkValues, compareHeaders, compareRows, diagnoseFailure, syncRegistro, publishTransaction, acquireLock, getJson };
