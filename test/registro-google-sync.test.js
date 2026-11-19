const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { hasDataRows, syncRegistro, diagnoseFailure, acquireLock, getJson } = require('../scripts/sync-registro-sheets');

test('Registro import preserves an empty tab snapshot while syncing populated tabs', async () => {
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'registro-google-sync-'));
  const previousFileName = 'Vuoto.csv';
  const previousContents = 'timestamp,value\nlast valid snapshot,keep\n';
  fs.writeFileSync(path.join(outputDir, previousFileName), previousContents);
  fs.writeFileSync(
    path.join(outputDir, '.registro-sync-manifest.json'),
    JSON.stringify({ files: [previousFileName] })
  );

  try {
    const result = await syncRegistro({
        outputDir,
        getApiAuth: async () => ({}),
        listSheets: async () => [{ title: 'Registrazioni' }, { title: 'Vuoto' }],
        fetchSheetValues: async (sheet) => sheet.title === 'Registrazioni'
          ? [['timestamp', 'value'], ['new row', 'new value']]
          : [['timestamp', 'value']]
      });

    assert.equal(result.success, true);
    assert.equal(result.fileCount, 2);
    assert.equal(fs.readFileSync(path.join(outputDir, previousFileName), 'utf8'), previousContents);
    assert.match(fs.readFileSync(path.join(outputDir, 'Registrazioni.csv'), 'utf8'), /new row,new value/);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(outputDir, '.registro-sync-manifest.json'), 'utf8')).files, ['Registrazioni.csv', 'Vuoto.csv']);
  } finally {
    fs.rmSync(outputDir, { recursive: true, force: true });
  }
});

test('Registro row validation requires at least one populated data row', () => {
  assert.equal(hasDataRows([]), false);
  assert.equal(hasDataRows([['header']]), false);
  assert.equal(hasDataRows([['header'], ['', '  ']]), false);
  assert.equal(hasDataRows([['header'], ['', 'value']]), true);
});

test('Registro import exports all Google tabs and returns a sync summary', async () => {
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'registro-google-sync-'));

  try {
    const result = await syncRegistro({
      outputDir,
      getApiAuth: async () => ({}),
      listSheets: async () => [
        { title: 'Registrazioni' },
        { title: 'Insegnanti' }
      ],
      fetchSheetValues: async (sheet) => [
        ['header'],
        [`${sheet.title} row`]
      ]
    });

    assert.equal(result.success, true);
    assert.equal(result.fileCount, 2);
    assert.equal(result.totalRows, 2);
    assert.deepEqual(result.files.map((file) => file.filename), ['Registrazioni.csv', 'Insegnanti.csv']);
    assert.equal(fs.readFileSync(path.join(outputDir, 'Registrazioni.csv'), 'utf8').includes('Registrazioni row'), true);
    assert.equal(fs.readFileSync(path.join(outputDir, 'Insegnanti.csv'), 'utf8').includes('Insegnanti row'), true);
  } finally {
    fs.rmSync(outputDir, { recursive: true, force: true });
  }
});

test('renamed required header fails before publishing and diagnostic identifies the mismatch', async () => {
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'registro-google-sync-'));
  const old = '\uFEFFID,Data lezione\r\n1,ieri\r\n';
  fs.writeFileSync(path.join(outputDir, 'Registro.csv'), old);
  fs.writeFileSync(path.join(outputDir, '.registro-sync-manifest.json'), JSON.stringify({ files: ['Registro.csv'] }));
  try {
    await assert.rejects(syncRegistro({ outputDir, getApiAuth: async () => ({}), listSheets: async () => [{ title: 'Registro' }], fetchSheetValues: async () => [['ID', 'Data corso'], ['1', 'oggi']] }), /intestazioni/);
    assert.equal(fs.readFileSync(path.join(outputDir, 'Registro.csv'), 'utf8'), old);
    const result = await diagnoseFailure(Object.assign(new Error('header mismatch'), { diagnostics: { status: 'confirmed', explainsFailure: true, differences: ['Registro.csv — intestazioni attese assenti: «Data lezione».'] } }), { outputDir });
    assert.equal(result.status, 'confirmed');
    assert.equal(result.previousCsvAvailable, true);
    assert.match(result.differences[0], /Data lezione/);
  } finally { fs.rmSync(outputDir, { recursive: true, force: true }); }
});

test('normal record additions are counted by stable key and do not fail schema validation', async () => {
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'registro-google-sync-'));
  fs.writeFileSync(path.join(outputDir, 'Registro.csv'), '\uFEFFRecord ID,Nome\r\na,Uno\r\nb,Due\r\n');
  fs.writeFileSync(path.join(outputDir, '.registro-sync-manifest.json'), JSON.stringify({ files: ['Registro.csv'] }));
  try {
    const result = await syncRegistro({ outputDir, getApiAuth: async () => ({}), listSheets: async () => [{ title: 'Registro' }], fetchSheetValues: async () => [['Record ID', 'Nome'], ['a', 'Uno modificato'], ['c', 'Tre']] });
    assert.deepEqual(result.rowChanges, [{ filename: 'Registro.csv', comparable: true, added: 1, removed: 1, changed: 1 }]);
  } finally { fs.rmSync(outputDir, { recursive: true, force: true }); }
});

test('Google access error reports comparison impossible without exposing remote data', async () => {
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'registro-google-sync-'));
  try {
    const error = new Error('access denied');
    const diagnostics = await diagnoseFailure(error, { outputDir, getApiAuth: async () => { throw new Error('access denied'); } });
    assert.equal(diagnostics.status, 'impossible');
    assert.equal(diagnostics.previousCsvAvailable, false);
    assert.match(diagnostics.partial.join(' '), /impossibile/);
  } finally { fs.rmSync(outputDir, { recursive: true, force: true }); }
});

test('interrupted publication restores every prior CSV and manifest', async () => {
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'registro-google-sync-'));
  const oldCsv = '\uFEFFID,Valore\r\n1,vecchio\r\n', oldManifest = JSON.stringify({ files: ['Registro.csv'] });
  fs.writeFileSync(path.join(outputDir, 'Registro.csv'), oldCsv);
  fs.writeFileSync(path.join(outputDir, '.registro-sync-manifest.json'), oldManifest);
  let failed = false;
  const renameSync = (from, to) => {
    if (!failed && from.includes('.registro-sync-') && to === path.join(outputDir, 'Registro.csv')) { failed = true; throw new Error('simulated disk error'); }
    fs.renameSync(from, to);
  };
  try {
    await assert.rejects(syncRegistro({ outputDir, renameSync, getApiAuth: async () => ({}), listSheets: async () => [{ title: 'Registro' }], fetchSheetValues: async () => [['ID', 'Valore'], ['1', 'nuovo']] }), /CSV precedenti ripristinati/);
    assert.equal(fs.readFileSync(path.join(outputDir, 'Registro.csv'), 'utf8'), oldCsv);
    assert.equal(fs.readFileSync(path.join(outputDir, '.registro-sync-manifest.json'), 'utf8'), oldManifest);
  } finally { fs.rmSync(outputDir, { recursive: true, force: true }); }
});

test('staging write error leaves all prior CSVs intact', async () => {
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'registro-google-sync-'));
  const first = '\uFEFFID,Valore\r\n1,vecchio1\r\n', second = '\uFEFFID,Valore\r\n2,vecchio2\r\n';
  fs.writeFileSync(path.join(outputDir, 'Uno.csv'), first);
  fs.writeFileSync(path.join(outputDir, 'Due.csv'), second);
  fs.writeFileSync(path.join(outputDir, '.registro-sync-manifest.json'), JSON.stringify({ files: ['Uno.csv', 'Due.csv'] }));
  const writeFileSync = (filePath, contents) => {
    if (filePath.endsWith('Due.csv') && filePath.includes('.registro-sync-')) throw new Error('simulated disk full');
    fs.writeFileSync(filePath, contents);
  };
  try {
    await assert.rejects(syncRegistro({ outputDir, writeFileSync, getApiAuth: async () => ({}), listSheets: async () => [{ title: 'Uno' }, { title: 'Due' }], fetchSheetValues: async (sheet) => [['ID', 'Valore'], ['1', `nuovo-${sheet.title}`]] }), /simulated disk full/);
    assert.equal(fs.readFileSync(path.join(outputDir, 'Uno.csv'), 'utf8'), first);
    assert.equal(fs.readFileSync(path.join(outputDir, 'Due.csv'), 'utf8'), second);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(outputDir, '.registro-sync-manifest.json'), 'utf8')).files, ['Uno.csv', 'Due.csv']);
  } finally { fs.rmSync(outputDir, { recursive: true, force: true }); }
});

test('HTTP 200 login/error payloads are rejected as incompatible', async () => {
  const response = (payload) => ({ ok: true, json: async () => payload });
  await assert.rejects(getJson('https://example.test', {}, 'test', async () => response({ error: { message: 'private detail' } })), /incompatibile/);
  await assert.rejects(getJson('https://example.test', {}, 'test', async () => ({ ok: true, json: async () => { throw new SyntaxError('html'); } })), /non JSON/);
});

test('concurrent sync attempts are blocked by an exclusive lock', () => {
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'registro-google-sync-'));
  try {
    const unlock = acquireLock(outputDir);
    assert.throws(() => acquireLock(outputDir), /già aggiornando/);
    unlock();
    const unlockAgain = acquireLock(outputDir);
    unlockAgain();
  } finally { fs.rmSync(outputDir, { recursive: true, force: true }); }
});

test('Windows failure dialog maps both buttons, close, and unavailable CSVs to task choices', { skip: process.platform !== 'win32' }, () => {
  const { spawnSync } = require('node:child_process');
  const helper = path.resolve(__dirname, '../scripts/registro-sync-failure-dialog.ps1');
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'registro-dialog-'));
  const reportPath = path.join(tempDir, 'report.json');
  const run = (choice, available) => {
    fs.writeFileSync(reportPath, JSON.stringify({ task: 'test', cause: 'test', diagnostics: { status: 'impossible', differences: [], partial: [] }, previousCsvAvailable: available, note: '' }));
    return spawnSync('powershell.exe', ['-NoProfile', '-STA', '-ExecutionPolicy', 'Bypass', '-File', helper, '-ReportPath', reportPath, '-SelfTestChoice', choice], { encoding: 'utf8' }).status;
  };
  try {
    assert.equal(run('Continue', true), 0);
    assert.equal(run('Abort', true), 1);
    assert.equal(run('Close', true), 1);
    assert.equal(run('Continue', false), 1);
  } finally { fs.rmSync(tempDir, { recursive: true, force: true }); }
});
