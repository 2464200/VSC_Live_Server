const test = require('node:test');
const assert = require('node:assert/strict');
const archives = require('../Bordero/js/course-archives');

const csv = [
  'record_id,brano_id,titolo,corso,livello,settimana,anno_accademico,insegnante',
  'r-01,001,Alpha,Salsa,BASE,38,2026/2027,Anna',
  'r-02,001,Alpha,Salsa,BASE,38,2026/2027,Anna',
  'r-03,002,Alpha,Bachata,BASE,41,2026/2027,Luisa',
  'r-04,003,Beta,Salsa,BASE,54,2026/2027,Marco'
].join('\n');

test('CSV preview preserves zero-padded IDs, reports repeats, invalid rows and ambiguous titles', () => {
  const result = archives.validateCsv(csv);
  assert.equal(result.valid.length, 2);
  assert.equal(result.valid[0].branoId, '001');
  assert.equal(result.valid[0].sourceId, 'r-01');
  assert.equal(result.rejected.length, 2);
  assert.equal(result.rejected[0].duplicate, true);
  assert.match(result.rejected[1].reason, /settimana non valida/);
  assert.equal(result.ambiguous.length, 2);
});

test('reimported identical records keep deterministic IDs and do not create duplicates', () => {
  const input = 'brano_id,titolo,livello,settimana,anno_accademico\n001,Alpha,BASE,38,2026/2027';
  const first = archives.validateCsv(input).valid[0];
  const second = archives.validateCsv(input).valid[0];
  assert.equal(first.id, second.id);
  assert.equal(archives.validateCsv(`${input}\n001,Alpha,BASE,38,2026/2027`).rejected.length, 1);
});

test('Registro Coreografie headers map course context, preserve the week label and never retain password columns', () => {
  const input = [
    'Data registrazione,Insegnante,Settimana,Sede corso,Livello corso,Tipo attività,Livello coreografia,Coreografia,Password',
    '30/10/2026,Anna Beretta,44 - Lun 26/10 – Dom 01/11/2026,Giovedì — 21:30 — ALZANO LOMBARDO,BASE,Coreografia spiegata,BASE,CHEYENNE,fixture-secret'
  ].join('\n');
  const result = archives.validateCsv(input);
  assert.equal(result.valid.length, 1);
  const [record] = result.valid;
  assert.equal(record.title, 'CHEYENNE');
  assert.equal(record.week, 44);
  assert.equal(record.periodYear, '2026');
  assert.equal(record.course, 'Giovedì — 21:30 — ALZANO LOMBARDO');
  assert.equal(record.level, 'BASE');
  assert.equal(record.choreoLevel, 'BASE');
  assert.equal(record.activity, 'Coreografia spiegata');
  assert.equal(record.registeredAt, '30/10/2026');
  assert.equal(record.season, '2026/2027');
  assert.equal(record.seasonSource, 'derived-september-august');
  assert.equal(JSON.stringify(record).includes('fixture-secret'), false);
  assert.equal(Object.keys(record.raw).some((key) => /password/i.test(key)), false);
});

test('JSON read adapter accepts record arrays while stripping password fields before CSV conversion', () => {
  const json = JSON.stringify({ records: [{ Coreografia: 'Alpha', Settimana: '44 - Lun 26/10 – Dom 01/11/2026', Password: 'fixture-secret' }] });
  const csv = archives.externalPayloadToCsv(json);
  assert.match(csv, /Coreografia/);
  assert.match(csv, /Settimana/);
  assert.equal(csv.includes('Password'), false);
  assert.equal(csv.includes('fixture-secret'), false);
});

test('remote adapter rejects HTML login or spreadsheet pages instead of previewing them as CSV', () => {
  assert.throws(() => archives.externalPayloadToCsv('<!doctype html><html><head><title>Registro</title></head></html>'), /pagina HTML invece dei dati del registro/);
});

test('external snapshot comparison reports additions, removals and changed stable source IDs', () => {
  const previous = [
    { id: 'source-1', sourceId: '1', branoId: '001', title: 'Alpha', week: 38 },
    { id: 'source-2', sourceId: '2', branoId: '002', title: 'Beta', week: 41 }
  ];
  const incoming = [
    { id: 'source-1', sourceId: '1', branoId: '001', title: 'Alpha', week: 39 },
    { id: 'source-3', sourceId: '3', branoId: '003', title: 'Gamma', week: 45 }
  ];
  const delta = archives.compareExternalSnapshot(previous, incoming);
  assert.deepEqual(delta.added, ['source-3']);
  assert.deepEqual(delta.removed, ['source-2']);
  assert.deepEqual(delta.changed, ['source-1']);
});

test('academic season derivation handles a week crossing December and January', () => {
  const result = archives.validateCsv([
    'Settimana,Sede corso,Livello corso,Coreografia',
    '1 - Lun 29/12 – Dom 04/01/2026,Salsa,BASE,Winter Dance'
  ].join('\n'));
  assert.equal(result.valid[0].week, 1);
  assert.equal(result.valid[0].season, '2025/2026');
});

test('merge leaves both source arrays untouched and refuses missing-context and conflicting matches', () => {
  const manual = [{ id: 'm1', branoId: '001', title: 'Alpha', week: 38, level: 'BASE', course: 'Salsa', season: '2026/2027', source: 'manual' }];
  const external = [{ id: 'e1', branoId: '001', title: 'Alpha', week: 38, level: 'BASE', course: 'Salsa', season: '2026/2027', source: 'external' }];
  const manualCopy = structuredClone(manual); const externalCopy = structuredClone(external);
  const merged = archives.merge(manual, external);
  assert.equal(merged.ok, true);
  assert.equal(merged.records.length, 1);
  assert.deepEqual(merged.records[0].provenance, ['manual', 'external']);
  assert.deepEqual(manual, manualCopy); assert.deepEqual(external, externalCopy);
  const ambiguous = archives.merge(manual, [{ ...external[0], season: '' }]);
  assert.equal(ambiguous.ok, false);
  const conflicting = archives.merge(manual, [{ ...external[0], instructor: 'Different' }]);
  assert.equal(conflicting.ok, false);
});

test('title-only external suggestions are reported as ambiguous and cannot be auto-merged', () => {
  const manual = [{ id: 'm1', branoId: '001', title: 'Café Country', week: 44, level: 'BASE', course: 'Salsa', season: '2026/2027', source: 'manual' }];
  const external = [{ id: 'e1', branoId: '', title: 'Cafe Country', week: 44, level: 'BASE', course: 'Salsa', season: '2026/2027', source: 'external' }];
  const rows = archives.compare(manual, external);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].status, 'ambiguous');
  assert.match(rows[0].reason, /richiede conferma/);
  assert.equal(archives.merge(manual, external).ok, false);
});

test('field-level merge requires an explicit choice and preserves source values and provenance', () => {
  const manual = [{ id: 'm1', source: 'manual', branoId: '001', title: 'Alpha', week: 38, level: 'BASE', course: '', season: '2026/2027', instructor: '', raw: { note: 'manual' } }];
  const external = [{ id: 'e1', source: 'external', branoId: '001', title: 'Alpha', week: 38, level: 'BASE', course: 'Giovedì · ALZANO', season: '2026/2027', instructor: 'Anna', raw: { activity: 'ripasso' } }];
  const comparison = archives.compare(manual, external);
  assert.equal(comparison.length, 1);
  assert.equal(comparison[0].status, 'ambiguous');
  assert.equal(archives.merge(manual, external).ok, false);
  const fields = Object.fromEntries(comparison[0].differences.map((field) => [field, field === 'instructor' ? 'external' : 'external']));
  const resolution = { [comparison[0].key]: { mode: 'fields', fields, custom: {} } };
  const result = archives.merge(manual, external, null, resolution);
  assert.equal(result.ok, true);
  assert.equal(result.records.length, 1);
  assert.equal(result.records[0].course, 'Giovedì · ALZANO');
  assert.equal(result.records[0].instructor, 'Anna');
  assert.deepEqual(result.records[0].provenance, ['manual', 'external']);
  assert.deepEqual(result.records[0].rawSources, { manual: { note: 'manual' }, external: { activity: 'ripasso' } });
  assert.deepEqual(result.picks[comparison[0].key], resolution[comparison[0].key]);
});

test('comparison surfaces course and week mismatches instead of treating them as equal', () => {
  const manual = [{ branoId: '001', title: 'Alpha', week: 38, level: 'BASE', season: '2026/2027', course: 'Salsa' }];
  const external = [{ branoId: '001', title: 'Alpha', week: 41, level: 'BASE', season: '2026/2027', course: 'Bachata' }];
  const rows = archives.compare(manual, external);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].status, 'different');
  assert.deepEqual(new Set(rows[0].differences), new Set(['course', 'week']));
  assert.equal(archives.merge(manual, external).ok, false);
});

test('external acquisition is isolated, active choice is separate, and invalid input preserves prior data', () => {
  const storage = new Map();
  const original = { storage: global.localStorage, window: global.window, CustomEvent: global.CustomEvent };
  global.localStorage = { getItem: (key) => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) };
  global.window = { dispatchEvent() {} };
  global.CustomEvent = class { constructor(type, options) { this.type = type; this.detail = options?.detail; } };
  try {
    const parsed = archives.validateCsv('brano_id,titolo,livello,settimana,anno_accademico\n001,Alpha,BASE,38,2026/2027');
    archives.persistExternal({ ...parsed, origin: 'test isolato' });
    assert.equal(archives.getActive(), 'external');
    const saved = archives.read().external;
    assert.equal(saved.records.length, 1);
    assert.throws(() => archives.persistExternal({ valid: [], total: 0 }), /Nessun record valido/);
    assert.deepEqual(archives.read().external, saved);
    archives.setActive('external');
    assert.equal(archives.getActive(), 'external');
    archives.setActive('manual');
    assert.equal(archives.getActive(), 'manual');
    assert.equal(archives.read().unified, null);
    const manualSeason = { id: '2026-2027', label: '2026/2027', records: [{ id: 'm1', branoId: '001', week: 38 }] };
    archives.backupManualSeason(manualSeason);
    manualSeason.records[0].week = 41;
    assert.equal(archives.read().manualBackups[0].season.records[0].week, 38);
  } finally {
    if (original.storage === undefined) delete global.localStorage; else global.localStorage = original.storage;
    if (original.window === undefined) delete global.window; else global.window = original.window;
    if (original.CustomEvent === undefined) delete global.CustomEvent; else global.CustomEvent = original.CustomEvent;
  }
});

test('one-time activation migration selects an already imported Google archive over the stale manual default', () => {
  const storage = new Map();
  const original = { storage: global.localStorage, window: global.window, CustomEvent: global.CustomEvent };
  global.localStorage = { getItem: (key) => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) };
  global.window = { dispatchEvent() {} };
  global.CustomEvent = class { constructor(type, options) { this.type = type; this.detail = options?.detail; } };
  try {
    storage.set('bordero_course_archives_v1', JSON.stringify({ external: { origin: 'Endpoint Apps Script', records: [{ id: 'imported' }] } }));
    storage.set('bordero_course_archive_active_v1', 'manual');
    assert.equal(archives.getActive(), 'external');
    archives.setActive('manual');
    assert.equal(archives.getActive(), 'manual');
  } finally {
    if (original.storage === undefined) delete global.localStorage; else global.localStorage = original.storage;
    if (original.window === undefined) delete global.window; else global.window = original.window;
    if (original.CustomEvent === undefined) delete global.CustomEvent; else global.CustomEvent = original.CustomEvent;
  }
});
