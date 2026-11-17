const fs = require('node:fs');
const path = require('node:path');

const MAX_CSV_BYTES = 2 * 1024 * 1024;
function fileError(message, status = 400) {
  return Object.assign(new Error(message), { status });
}

function validateCsvName(name) {
  if (typeof name !== 'string' || !name || name !== name.trim() || !/\.csv$/i.test(name)
    || /[<>:"/\\|?*\x00-\x1f]/.test(name) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])\./i.test(name)) {
    throw fileError('Nome CSV non valido.');
  }
  return name;
}

function readCsvFile(filePath) {
  validateCsvName(path.basename(filePath));
  const stat = fs.lstatSync(filePath);
  if (!stat.isFile() || stat.isSymbolicLink()) throw fileError('Seleziona un file CSV regolare.');
  if (stat.size > MAX_CSV_BYTES) throw fileError('Il CSV supera il limite di 2 MB.', 413);
  return { name: path.basename(filePath), filePath, content: fs.readFileSync(filePath, 'utf8') };
}

function writeCsvFile(filePath, content, overwrite = false) {
  validateCsvName(path.basename(filePath));
  if (typeof content !== 'string') throw fileError('Contenuto CSV non valido.');
  const text = content.startsWith('\uFEFF') ? content : `\uFEFF${content}`;
  if (Buffer.byteLength(text, 'utf8') > MAX_CSV_BYTES) throw fileError('Il CSV supera il limite di 2 MB.', 413);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  if (fs.existsSync(filePath)) {
    const stat = fs.lstatSync(filePath);
    if (!stat.isFile() || stat.isSymbolicLink()) throw fileError('La destinazione non è un file CSV regolare.');
  }
  try {
    fs.writeFileSync(filePath, text, { encoding: 'utf8', flag: overwrite ? 'w' : 'wx' });
  } catch (error) {
    if (error.code === 'EEXIST') throw fileError('Il CSV esiste già. Conferma la sostituzione.', 409);
    throw error;
  }
  return { name: path.basename(filePath), filePath };
}

function createChoreoProgramFileStore(directory) {
  const root = path.resolve(directory);
  const ensureDirectory = () => { fs.mkdirSync(root, { recursive: true }); return root; };
  const filePath = (name) => path.join(ensureDirectory(), validateCsvName(name));
  const googleSheetsDirectory = () => {
    const directoryPath = path.join(ensureDirectory(), 'google-sheets');
    fs.mkdirSync(directoryPath, { recursive: true });
    return directoryPath;
  };
  const saveGoogleSheetsSnapshot = (sheets, syncedAt = new Date().toISOString()) => {
    if (!Array.isArray(sheets) || !sheets.length || sheets.length > 20) throw fileError('El gruppo di fogli Google non è valido.');
    const stamp = String(syncedAt).replace(/\D/g, '').slice(0, 17) || String(Date.now());
    const prepared = sheets.map((sheet) => {
      if (!sheet || !/^[a-z0-9-]{1,60}$/.test(sheet.key || '') || typeof sheet.csv !== 'string') throw fileError('Dati CSV del foglio non validi.');
      const text = sheet.csv.startsWith('\uFEFF') ? sheet.csv : `\uFEFF${sheet.csv}`;
      if (Buffer.byteLength(text, 'utf8') > MAX_CSV_BYTES) throw fileError(`Il foglio ${sheet.key} supera il limite di 2 MB.`, 413);
      return { key: sheet.key, text };
    });
    const directoryPath = googleSheetsDirectory();
    const files = [];
    for (const sheet of prepared) {
      const archive = `google-sheet-${sheet.key}-${stamp}.csv`;
      writeCsvFile(path.join(directoryPath, archive), sheet.text, false);
      files.push(archive);
    }
    for (const sheet of prepared) {
      const latest = `google-sheet-${sheet.key}-latest.csv`;
      writeCsvFile(path.join(directoryPath, latest), sheet.text, true);
      files.push(latest);
    }
    return { directory: directoryPath, files };
  };
  return {
    getDirectory: ensureDirectory,
    getGoogleSheetsDirectory: googleSheetsDirectory,
    listGoogleSheetsSnapshots() {
      return fs.readdirSync(googleSheetsDirectory(), { withFileTypes: true })
        .filter((entry) => entry.isFile() && /^google-sheet-[a-z0-9-]+\.csv$/i.test(entry.name))
        .map((entry) => ({ name: entry.name, modifiedAt: fs.statSync(path.join(googleSheetsDirectory(), entry.name)).mtime.toISOString() }))
        .sort((a, b) => a.name.localeCompare(b.name, 'it', { numeric: true }));
    },
    readGoogleSheetsSnapshot(name) {
      validateCsvName(name);
      if (!/^google-sheet-[a-z0-9-]+\.csv$/i.test(name)) throw fileError('Nome snapshot non valido.');
      const file = readCsvFile(path.join(googleSheetsDirectory(), name));
      return { ...file, modifiedAt: fs.statSync(file.filePath).mtime.toISOString() };
    },
    list() {
      return fs.readdirSync(ensureDirectory(), { withFileTypes: true })
        .filter((entry) => entry.isFile() && /\.csv$/i.test(entry.name))
        .map((entry) => ({ name: entry.name, modifiedAt: fs.statSync(filePath(entry.name)).mtime.toISOString() }))
        .sort((a, b) => a.name.localeCompare(b.name, 'it', { numeric: true }));
    },
    read(name) { return readCsvFile(filePath(name)); },
    save(name, content, overwrite = false) { return writeCsvFile(filePath(name), content, overwrite); },
    saveGoogleSheetsSnapshot
  };
}

module.exports = { createChoreoProgramFileStore, readCsvFile, writeCsvFile, validateCsvName, MAX_CSV_BYTES };
