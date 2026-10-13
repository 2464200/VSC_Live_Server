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
  return {
    getDirectory: ensureDirectory,
    list() {
      return fs.readdirSync(ensureDirectory(), { withFileTypes: true })
        .filter((entry) => entry.isFile() && /\.csv$/i.test(entry.name))
        .map((entry) => ({ name: entry.name, modifiedAt: fs.statSync(filePath(entry.name)).mtime.toISOString() }))
        .sort((a, b) => a.name.localeCompare(b.name, 'it', { numeric: true }));
    },
    read(name) { return readCsvFile(filePath(name)); },
    save(name, content, overwrite = false) { return writeCsvFile(filePath(name), content, overwrite); }
  };
}

module.exports = { createChoreoProgramFileStore, readCsvFile, writeCsvFile, validateCsvName, MAX_CSV_BYTES };
