const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const express = require('express');
const http = require('node:http');
const { createChoreoProgramFileStore, MAX_CSV_BYTES } = require('../Bordero/server/choreo-program-files');
const { createChoreoProgramFileRouter } = require('../Bordero/server/choreo-program-file-routes');
const { registerCourseProgramFileHandlers } = require('../electron/course-program-files');

const csv = 'anno_accademico,livello,settimana,brano_id\r\n2026/2027,BASE,1,001\r\n';
function temporaryDirectory(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bordero-program-files-'));
  assert.equal(path.dirname(root), path.resolve(os.tmpdir()));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

test('program CSV files share one folder, retain UTF-8/IDs and require explicit overwrite', (t) => {
  const root = temporaryDirectory(t);
  const folder = path.join(root, 'VSC_PROGRAMMA');
  const store = createChoreoProgramFileStore(folder);
  assert.equal(store.getDirectory(), folder);
  store.save('programma-coreografie-2026-2027.csv', csv);
  store.save('programma-coreografie-modello.csv', csv);
  const loaded = store.read('programma-coreografie-2026-2027.csv');
  assert.equal(loaded.content, `\uFEFF${csv}`);
  assert.equal(loaded.filePath, path.join(folder, loaded.name));
  assert.equal(store.list().length, 2);
  assert.throws(() => store.save(loaded.name, 'nuovo CSV'), (error) => error.status === 409);
  assert.equal(store.read(loaded.name).content, loaded.content);
  store.save(loaded.name, '\uFEFFnuovo CSV', true);
  assert.equal(store.read(loaded.name).content, '\uFEFFnuovo CSV');
});

test('Google sheet snapshots are versioned in a separate folder and expose stable latest CSVs', (t) => {
  const store = createChoreoProgramFileStore(temporaryDirectory(t));
  const result = store.saveGoogleSheetsSnapshot([
    { key: 'registrazioni', csv: 'Data,Coreografia\n17/11/2026,Alpha' },
    { key: 'insegnanti', csv: 'Insegnante,Password\nAnna,' }
  ], '2026-11-17T10:15:30.123Z');
  assert.equal(result.files.length, 4);
  assert.ok(result.directory.endsWith('google-sheets'));
  assert.equal(store.readGoogleSheetsSnapshot('google-sheet-registrazioni-latest.csv').content,
    '\uFEFFData,Coreografia\n17/11/2026,Alpha');
  assert.equal(store.listGoogleSheetsSnapshots().length, 4);
  assert.equal(store.list().length, 0);
  assert.equal(fs.readFileSync(path.join(result.directory, 'google-sheet-registrazioni-20261117101530123.csv'), 'utf8'),
    '\uFEFFData,Coreografia\n17/11/2026,Alpha');
});

test('program file storage rejects paths outside the folder, non-CSV and oversized contents', (t) => {
  const store = createChoreoProgramFileStore(temporaryDirectory(t));
  for (const name of ['../altro.csv', '..\\altro.csv', 'C:\\altro.csv', 'file.json', 'NUL.csv']) {
    assert.throws(() => store.save(name, csv), /Nome CSV non valido/);
    assert.throws(() => store.read(name), /Nome CSV non valido/);
  }
  assert.throws(() => store.save('grande.csv', 'x'.repeat(MAX_CSV_BYTES)), (error) => error.status === 413);
  assert.equal(store.list().length, 0);
});

test('local browser endpoints save/list/load CSVs and reject cross-origin and foreign-host access', async (t) => {
  const store = createChoreoProgramFileStore(temporaryDirectory(t));
  const app = express();
  app.use(express.json({ limit: '2mb' }));
  app.use('/files', createChoreoProgramFileRouter(store));
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/files`;
  const getStatusWithHeaders = (headers) => new Promise((resolve, reject) => {
    http.get(base, { headers }, (response) => { response.resume(); resolve(response.statusCode); }).on('error', reject);
  });
  const save = (headers = {}, overwrite = false) => fetch(base, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ name: 'programma.csv', content: csv, overwrite })
  });
  assert.equal((await save()).status, 200);
  assert.equal((await save()).status, 409);
  assert.equal((await save({}, true)).status, 200);
  const listing = await (await fetch(base)).json();
  assert.equal(listing.directory, store.getDirectory());
  assert.equal(listing.files[0].name, 'programma.csv');
  assert.equal((await (await fetch(`${base}/programma.csv`)).json()).content, `\uFEFF${csv}`);
  assert.equal((await save({ Origin: 'https://example.com' })).status, 403);
  assert.equal(await getStatusWithHeaders({ Host: 'example.com' }), 403);
  assert.equal(await getStatusWithHeaders({ 'Sec-Fetch-Site': 'cross-site' }), 403);
  assert.equal((await fetch(base, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: csv })).status, 415);
  assert.equal((await fetch(`${base}/${encodeURIComponent('..\\altro.csv')}`)).status, 400);
  const snapshotResponse = await fetch(`${base}/snapshots`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ syncedAt: '2026-11-17T10:15:30.123Z', sheets: [{ key: 'registrazioni', csv }] })
  });
  assert.equal(snapshotResponse.status, 200);
  const snapshots = await snapshotResponse.json();
  assert.equal(snapshots.files.length, 2);
  const latestSnapshot = await fetch(`${base}/snapshots/google-sheet-registrazioni-latest.csv`);
  assert.equal((await latestSnapshot.json()).content, `\uFEFF${csv}`);
});

test('Electron open/save dialogs default to the program folder and accept explicit alternate locations', async (t) => {
  const root = temporaryDirectory(t);
  const store = createChoreoProgramFileStore(path.join(root, 'VSC_PROGRAMMA'));
  const source = store.save('import.csv', csv);
  const handlers = new Map();
  const options = [];
  const target = path.join(root, 'altra-cartella', 'esportazione');
  registerCourseProgramFileHandlers({
    store, ipcMain: { handle: (channel, handler) => handlers.set(channel, handler) },
    BrowserWindow: { fromWebContents: () => null },
    dialog: {
      showOpenDialog: async (value) => { options.push(value); return { filePaths: [source.filePath] }; },
      showSaveDialog: async (value) => { options.push(value); return { filePath: target }; }
    }
  });
  const event = { senderFrame: { url: 'http://localhost:5500/public/Bordero/pages/coreografie-corsi.html' } };
  const opened = await handlers.get('bordero-course-files:open-csv')(event);
  assert.equal(opened.content, `\uFEFF${csv}`);
  assert.equal(options[0].defaultPath, store.getDirectory());
  const saved = await handlers.get('bordero-course-files:save-csv')(event, { name: 'programma.csv', content: csv });
  assert.equal(options[1].defaultPath, path.join(store.getDirectory(), 'programma.csv'));
  assert.ok(options[1].properties.includes('showOverwriteConfirmation'));
  assert.equal(saved.filePath, `${target}.csv`);
  assert.equal(fs.readFileSync(saved.filePath, 'utf8'), `\uFEFF${csv}`);
  const snapshot = await handlers.get('bordero-course-files:save-google-sheets-snapshot')(event, {
    syncedAt: '2026-11-17T10:15:30.123Z', sheets: [{ key: 'registrazioni', csv }]
  });
  assert.equal(snapshot.ok, true);
  assert.equal(snapshot.files.length, 2);
  const snapshotList = await handlers.get('bordero-course-files:list-google-sheets-snapshots')(event);
  assert.equal(snapshotList.files.length, 2);
  const snapshotCsv = await handlers.get('bordero-course-files:read-google-sheets-snapshot')(event, 'google-sheet-registrazioni-latest.csv');
  assert.equal(snapshotCsv.content, `\uFEFF${csv}`);
  const refused = await handlers.get('bordero-course-files:save-csv')({ senderFrame: { url: 'https://example.com/Bordero/pages/coreografie-corsi.html' } }, { name: 'programma.csv', content: csv });
  assert.equal(refused.ok, false);
  assert.equal(options.length, 2);
});

test('canceling Electron dialogs leaves existing CSV files untouched', async (t) => {
  const store = createChoreoProgramFileStore(temporaryDirectory(t));
  store.save('programma.csv', csv);
  const handlers = new Map();
  registerCourseProgramFileHandlers({
    store, ipcMain: { handle: (channel, handler) => handlers.set(channel, handler) },
    BrowserWindow: { fromWebContents: () => null },
    dialog: { showOpenDialog: async () => ({ canceled: true }), showSaveDialog: async () => ({ canceled: true }) }
  });
  const event = { senderFrame: { url: 'http://localhost:5500/Bordero/pages/coreografie-corsi.html' } };
  assert.equal((await handlers.get('bordero-course-files:open-csv')(event)).canceled, true);
  assert.equal((await handlers.get('bordero-course-files:save-csv')(event, { name: 'programma.csv', content: 'sostituzione' })).canceled, true);
  assert.equal(store.read('programma.csv').content, `\uFEFF${csv}`);
});

test('program folder configuration is relative to each project root and supports per-PC overrides', () => {
  const code = fs.readFileSync(path.join(__dirname, '..', 'config', 'config.js'), 'utf8');
  const configDir = path.join(__dirname, '..', 'config');
  const load = (env) => {
    const context = { __dirname: configDir, module: { exports: {} }, console, process: { env },
      require: (name) => name === 'fs' ? { mkdirSync() {} } : require(name) };
    vm.runInNewContext(code, context);
    return context.module.exports.projectConfig;
  };
  const defaults = load({});
  assert.equal(defaults.choreoProgramDir, path.resolve(defaults.projectRoot, '..', 'VSC_PROGRAMMA'));
  assert.equal(load({ VSC_PROGRAMMA_DIR: 'archivio/corsi' }).choreoProgramDir, path.resolve(defaults.projectRoot, 'archivio/corsi'));
  assert.equal(load({ VSC_PROGRAMMA_DIR: path.resolve(os.tmpdir(), 'programma-personale') }).choreoProgramDir, path.resolve(os.tmpdir(), 'programma-personale'));
});
