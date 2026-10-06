const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { JSDOM } = require('jsdom');
const generator = require('../USERFORM/js/scaletta-generator.js');

const root = path.resolve(__dirname, '..');
const csv = fs.readFileSync(path.join(root, 'Bordero/data/brani.csv'), 'utf8');
const counts = (base = 0, intermediate = 0, advanced1 = 0, advanced2 = 0, super12 = 0, super3 = 0, other = 0) => ({
  BASE: base,
  INTERMEDIO: intermediate,
  AVANZATO_1: advanced1,
  AVANZATO_2: advanced2,
  SUPERAVANZATO_1_2: super12,
  SUPERAVANZATO_3: super3,
  ALTRE_COREO: other
});

function track(id, level, duration, artist = 'Artist') {
  return {
    id,
    coreografia: `Coreografia ${id}`,
    brano: `Brano ${id}`,
    autore: artist,
    durata: duration,
    info_livello: level
  };
}

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

test('TEST 1: legge il catalogo reale e genera la proporzione completa senza superare tre ore', () => {
  assert.deepEqual(generator.normalizeLevel('Avanzato1'), ['AVANZATO_1']);
  assert.deepEqual(generator.normalizeLevel('SUPERAVANZATO 1+2'), ['SUPERAVANZATO_1_2']);
  assert.deepEqual(generator.normalizeLevel('SUPER AVANZATO 3'), ['SUPERAVANZATO_3']);
  assert.deepEqual(generator.normalizeLevel('ALTRE COREO'), ['ALTRE_COREO']);
  const catalog = generator.buildCatalog(csv);
  assert.equal(catalog.catalogByLevel.BASE.length, 98);
  assert.equal(catalog.catalogByLevel.INTERMEDIO.length, 64);
  assert.equal(catalog.catalogByLevel.AVANZATO_1.length, 36);
  assert.equal(catalog.catalogByLevel.AVANZATO_2.length, 29);
  assert.equal(catalog.catalogByLevel.SUPERAVANZATO_1_2.length, 43);
  assert.equal(catalog.catalogByLevel.SUPERAVANZATO_3.length, 20);
  assert.equal(catalog.catalogByLevel.ALTRE_COREO.length, 288);

  const result = generator.generateSetlist({
    catalog,
    counts: counts(3, 2, 2, 2, 1, 1, 1),
    durationSeconds: generator.parseEventTime('03:00'),
    random: seededRandom(1),
    attempts: 4
  });
  assert.deepEqual(result.errors, []);
  assert.ok(result.totalDurationSeconds <= 10800);
  assert.equal(result.totalDurationSeconds, result.tracks.reduce((sum, item) => sum + item.durationSeconds, 0));
  assert.equal(new Set(result.tracks.map((item) => item.id)).size, result.tracks.length);
});

test('TEST 2: rispetta i livelli richiesti per una serata di unâ€™ora', () => {
  const result = generator.generateSetlist({
    catalog: generator.buildCatalog(csv),
    counts: counts(1, 1, 1, 1),
    durationSeconds: 3600,
    random: seededRandom(2),
    attempts: 4
  });
  assert.deepEqual(result.errors, []);
  assert.ok(result.totalDurationSeconds <= 3600);
  assert.ok(result.levelCounts.BASE >= 1);
  assert.ok(result.levelCounts.INTERMEDIO >= 1);
  assert.ok(result.levelCounts.AVANZATO_1 >= 1);
  assert.ok(result.levelCounts.AVANZATO_2 >= 1);
});

test('TEST 3: genera solo i livelli avanzati richiesti', () => {
  const result = generator.generateSetlist({
    catalog: generator.buildCatalog(csv),
    counts: counts(0, 0, 3, 2, 1, 1, 1),
    durationSeconds: 7200,
    random: seededRandom(3),
    attempts: 4
  });
  assert.deepEqual(result.errors, []);
  assert.ok(result.totalDurationSeconds <= 7200);
  assert.ok(result.levelCounts.AVANZATO_1 >= 3);
  assert.ok(result.levelCounts.AVANZATO_2 >= 2);
  assert.ok(result.levelCounts.SUPERAVANZATO_1_2 >= 1);
  assert.ok(result.levelCounts.SUPERAVANZATO_3 >= 1);
  assert.ok(result.levelCounts.ALTRE_COREO >= 1);
  assert.equal(result.levelCounts.BASE, 0);
});

test('TEST 4: non sostituisce un livello senza brani con un altro livello', () => {
  const catalog = generator.buildCatalog([track('i1', 'INTERMEDIO', '03:00')]);
  const result = generator.generateSetlist({ catalog, counts: counts(1), durationSeconds: 3600 });
  assert.match(result.errors.join(' '), /Brani BASE insufficienti: richiesti 1, disponibili 0/);
  assert.equal(result.tracks.length, 0);
});

test('TEST 5: segnala la quantita superiore ai brani disponibili', () => {
  const catalog = generator.buildCatalog([track('b1', 'BASE', '03:00'), track('b2', 'BASE', '04:00')]);
  const result = generator.generateSetlist({ catalog, counts: counts(3), durationSeconds: 3600 });
  assert.match(result.errors.join(' '), /Brani BASE insufficienti: richiesti 3, disponibili 2/);
});

test('TEST 6: seleziona una combinazione di durate differenti che raggiunge il limite', () => {
  const catalog = generator.buildCatalog([
    track('v1', 'BASE', 1000),
    track('v2', 'BASE', 700),
    track('v3', 'BASE', 600),
    track('v4', 'BASE', 300)
  ]);
  const result = generator.generateSetlist({ catalog, counts: counts(1), durationSeconds: 1300, random: () => 0, attempts: 4 });
  assert.equal(result.totalDurationSeconds, 1300);
  assert.equal(result.tracks.length, 2);
});

test('TEST 7: esclude durate non valide e avvisa senza interrompere la generazione', () => {
  const catalog = generator.buildCatalog([track('bad', 'BASE', 'x'), track('good', 'BASE', '02:00')]);
  const result = generator.generateSetlist({ catalog, counts: counts(1), durationSeconds: 150 });
  assert.equal(catalog.stats.invalidDurations, 1);
  assert.equal(result.tracks[0].id, 'good');
  assert.ok(result.warnings.some((warning) => warning.includes('durata mancante o non valida')));
});

test('TEST 8: elimina duplicati usando lâ€™ID e impedisce il riuso del brano', () => {
  const catalog = generator.buildCatalog([track('d1', 'BASE', '02:00'), track('d1', 'BASE', '02:00')]);
  const result = generator.generateSetlist({ catalog, counts: counts(1), durationSeconds: 240 });
  assert.equal(catalog.stats.duplicates, 1);
  assert.equal(result.tracks.length, 1);
  assert.equal(result.tracks[0].id, 'd1');
});

test('TEST 9: generazioni successive possono produrre brani differenti', () => {
  const catalog = generator.buildCatalog(Array.from({ length: 12 }, (_, index) => track(`r${index}`, 'BASE', '03:00')));
  const outputs = Array.from({ length: 6 }, (_, index) => generator.generateSetlist({
    catalog,
    counts: counts(1),
    durationSeconds: 720,
    random: seededRandom(index + 10),
    attempts: 1
  }).tracks.map((item) => item.id).join(','));
  assert.ok(new Set(outputs).size > 1);
});

test('TEST 10: tratta i tre cataloghi aggiuntivi come categorie indipendenti', () => {
  const catalog = generator.buildCatalog([
    ...Array.from({ length: 2 }, (_, index) => track(`s${index}`, 'SUPER AVANZATO 1+2', '02:00')),
    ...Array.from({ length: 2 }, (_, index) => track(`t${index}`, 'SUPER AVANZATO 3', '02:00')),
    ...Array.from({ length: 2 }, (_, index) => track(`x${index}`, 'ALTRE COREO', '02:00'))
  ]);
  const result = generator.generateSetlist({ catalog, counts: counts(0, 0, 0, 0, 2, 2, 2), durationSeconds: 7200 });
  assert.deepEqual(result.errors, []);
  assert.equal(result.levelCounts.SUPERAVANZATO_1_2, 2);
  assert.equal(result.levelCounts.SUPERAVANZATO_3, 2);
  assert.equal(result.levelCounts.ALTRE_COREO, 2);

  const shortage = generator.generateSetlist({ catalog, counts: counts(0, 0, 0, 0, 3), durationSeconds: 7200 });
  assert.match(shortage.errors.join(' '), /Brani SUPER AVANZATO 1\+2 insufficienti: richiesti 3, disponibili 2/);
});

test('SCALETTA: carica il CSV, mostra tutti i livelli, salva il risultato e pulisce i dati', async () => {
  const html = fs.readFileSync(path.join(root, 'USERFORM/pages/SCALETTA.html'), 'utf8');
  const dom = new JSDOM(html, {
    url: 'http://localhost/USERFORM/pages/SCALETTA.html',
    runScripts: 'outside-only'
  });
  const { window } = dom;
  let savedPayload = null;
  window.fetch = async (url, options = {}) => {
    if (String(url).includes('brani.csv')) {
      return {
        ok: true,
        status: 200,
        text: async () => csv
      };
    }
    assert.equal(url, '/api/dj-preselezione/files');
    assert.equal(options.method, 'POST');
    savedPayload = JSON.parse(options.body);
    return {
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        folder: 'VSC_PRESELEZIONE',
        fileName: 'Luca_Rossi_2026-10-06_Country_Night.json',
        trackCount: savedPayload.tracks.length
      })
    };
  };

  window.eval(fs.readFileSync(path.join(root, 'USERFORM/js/scaletta-generator.js'), 'utf8'));
  window.eval(fs.readFileSync(path.join(root, 'Bordero/pages/dj-preselezione-file.js'), 'utf8'));
  window.eval(fs.readFileSync(path.join(root, 'USERFORM/js/scaletta-actions.js'), 'utf8'));
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(window.document.getElementById('btn-generate-setlist').disabled, false);
  for (const id of [
    'setlist-count-base',
    'setlist-count-intermedio',
    'setlist-count-avanzato-1',
    'setlist-count-avanzato-2',
    'setlist-count-super-12',
    'setlist-count-super-3',
    'setlist-count-altre-coreo'
  ]) {
    window.document.getElementById(id).value = '1';
  }
  window.document.getElementById('setlist-available-time').value = '03:00';
  window.document.getElementById('btn-generate-setlist').click();
  assert.ok(window.SCALETTA_SETLIST.length > 0);
  assert.equal(window.document.querySelectorAll('#setlist-table-body tr').length, window.SCALETTA_SETLIST.length);
  assert.equal(window.document.querySelectorAll('.setlist-level-item').length, 7);
  assert.deepEqual(Array.from(window.document.querySelectorAll('.setlist-level-item dt'), (item) => item.textContent), [
    'BASE', 'INTERMEDIO', 'AVANZATO 1', 'AVANZATO 2', 'SUPER AVANZATO 1+2', 'SUPER AVANZATO 3', 'ALTRE COREO'
  ]);
  assert.ok(window.SCALETTA_SETLIST.every((item) => item.level));
  assert.equal(window.document.getElementById('summary-track-count').textContent, String(window.SCALETTA_SETLIST.length));
  window.document.getElementById('setlist-dj-name').value = 'Luca Rossi';
  window.document.getElementById('setlist-event-date').value = '2026-10-06';
  window.document.getElementById('setlist-event-name').value = 'Country Night';
  window.document.getElementById('setlist-dj-name').dispatchEvent(new window.Event('input'));
  window.document.getElementById('setlist-event-date').dispatchEvent(new window.Event('input'));
  window.document.getElementById('setlist-event-name').dispatchEvent(new window.Event('input'));
  assert.equal(window.document.getElementById('setlist-file-name-preview').textContent, 'Luca_Rossi_2026-10-06_Country_Night.json');
  window.document.getElementById('btn-save-setlist').click();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(savedPayload.dj, 'Luca Rossi');
  assert.equal(savedPayload.evento, 'Country Night');
  assert.ok(savedPayload.tracks.length > 0);
  assert.match(window.document.getElementById('scaletta-status').textContent, /VSC_PRESELEZIONE\/Luca_Rossi_2026-10-06_Country_Night\.json/);

  window.document.getElementById('btn-clear-setlist').click();
  assert.equal(window.SCALETTA_SETLIST.length, 0);
  assert.equal(window.document.getElementById('summary-track-count').textContent, '0');
  window.close();
});