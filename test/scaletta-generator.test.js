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

function coursePrograms(records, activeSeason = '2026-2027') {
  return { activeSeason, seasons: { [activeSeason]: { id: activeSeason, records } } };
}

const lesson = (branoId, week, level = 'BASE') => ({ branoId, week, level });

test('SCALETTA: un brano del corso precede quelli senza settimana anche oltre i primi cinque candidati', () => {
  const catalog = generator.buildCatalog(Array.from({ length: 8 }, (_, index) => track(`b${index}`, 'BASE', 60)));
  for (const random of [() => 0, () => 0.99]) {
    const result = generator.generateSetlist({
      catalog, counts: counts(1), durationSeconds: 60, attempts: 1, random,
      coursePrograms: coursePrograms([lesson('b7', 42)])
    });
    assert.deepEqual(result.tracks.map((item) => item.id), ['b7']);
    assert.equal('courseWeekPriority' in result.tracks[0], false, 'La priorità interna non cambia il formato esportato.');
  }
});

test('SCALETTA: le settimane proseguono da 52/53 a 1 nell’anno successivo e prevale la lezione più recente', () => {
  const ids = ['none', 'invalid', 'w40', 'w52', 'w53', 'w1', 'w2', 'w10'];
  const catalog = generator.buildCatalog(ids.map((id) => track(id, 'BASE', 60)));
  const result = generator.generateSetlist({
    catalog, counts: counts(1), durationSeconds: ids.length * 60, attempts: 1, random: () => 0,
    coursePrograms: coursePrograms([
      lesson('w40', 40), lesson('w52', 52), lesson('w53', 53),
      lesson('w1', 1), lesson('w2', 2), lesson('w10', 42), lesson('w10', 10),
      lesson('invalid', 0), lesson('invalid', 54), lesson('invalid', 1.5)
    ])
  });
  assert.deepEqual(result.tracks.slice(0, 6).map((item) => item.id), ['w10', 'w2', 'w1', 'w53', 'w52', 'w40']);
  assert.deepEqual(new Set(result.tracks.slice(6).map((item) => item.id)), new Set(['none', 'invalid']));
  const yearWith52Weeks = generator.generateSetlist({
    catalog, counts: counts(1), durationSeconds: 120, attempts: 1, random: () => 0,
    coursePrograms: coursePrograms([lesson('w52', 52), lesson('w1', 1), lesson('w53', 53)], '2025-2026')
  });
  assert.deepEqual(yearWith52Weeks.tracks.map((item) => item.id), ['w1', 'w52']);
});

test('SCALETTA: la settimana vale per il livello della lezione e solo per la stagione attiva', () => {
  const catalog = generator.buildCatalog([
    track('base', 'BASE', 60), track('intermedio', 'INTERMEDIO', 60),
    track('shared', 'AVANZATO 1+2', 60), track('a1', 'AVANZATO 1', 60)
  ]);
  const programs = coursePrograms([lesson('intermedio', 1, 'INTERMEDIO'), lesson('shared', 1, 'AVANZATO 2'), lesson('a1', 42, 'AVANZATO 1')]);
  const base = generator.generateSetlist({ catalog, counts: counts(1), durationSeconds: 60, coursePrograms: programs });
  assert.equal(base.tracks[0].id, 'base', 'La settimana non deve forzare il passaggio a un livello successivo.');
  const advanced = generator.generateSetlist({ catalog, counts: counts(0, 0, 1), durationSeconds: 60, coursePrograms: programs });
  assert.equal(advanced.tracks[0].id, 'a1', 'La settimana di AVANZATO 2 non dà priorità in AVANZATO 1.');
  const archive = coursePrograms([]);
  archive.seasons['2025-2026'] = { records: [lesson('a1', 1, 'AVANZATO 1')] };
  const withoutActiveLessons = generator.generateSetlist({
    catalog, counts: counts(0, 0, 1), durationSeconds: 60, attempts: 1, random: () => 0, coursePrograms: archive
  });
  assert.equal(withoutActiveLessons.tracks[0].id, 'shared');
});

test('SCALETTA: la priorità settimanale rispetta categorie, tempo e coreografie già scelte', () => {
  const catalog = generator.buildCatalog([
    { ...track('first', 'BASE', 60), info_coreo_1: 'COPPIA', coreografia: 'Uguale' },
    { ...track('duplicate', 'BASE', 60), info_coreo_1: 'COPPIA', coreografia: 'UGUALE' },
    { ...track('other', 'BASE', 60), info_coreo_1: 'COPPIA' },
    { ...track('excluded', 'BASE', 60), info_coreo_1: 'CERCHIO' },
    { ...track('long', 'BASE', 180), info_coreo_1: 'COPPIA' }
  ]);
  const result = generator.generateSetlist({
    catalog, counts: counts(1), durationSeconds: 120, attempts: 1, random: () => 0,
    infoFilter: { mode: 'include', tags: ['COPPIA'] },
    coursePrograms: coursePrograms([lesson('first', 2), lesson('duplicate', 1), lesson('excluded', 10), lesson('long', 11)])
  });
  assert.deepEqual(result.tracks.map((item) => item.id), ['first', 'other']);
});

test('SCALETTA: conserva la casualità a settimana pari e bilancia le ripetizioni dopo il catalogo esaurito', () => {
  const catalog = generator.buildCatalog(['old', 'new', 'none'].map((id) => track(id, 'BASE', 60)));
  const result = generator.generateSetlist({
    catalog, counts: counts(1), durationSeconds: 360, attempts: 1, random: () => 0,
    coursePrograms: coursePrograms([lesson('old', 42), lesson('new', 1)])
  });
  assert.deepEqual(result.tracks.map((item) => item.id), ['new', 'old', 'none', 'new', 'old', 'none']);
  const tiedPrograms = coursePrograms(['old', 'new', 'none'].map((id) => lesson(id, 42)));
  const choices = [0, 0.5, 0.99].map((value) => generator.generateSetlist({
    catalog, counts: counts(1), durationSeconds: 60, attempts: 1, random: () => value, coursePrograms: tiedPrograms
  }).tracks[0].id);
  assert.equal(new Set(choices).size, 3);
});

test('SCALETTA: conserva la preferenza per un artista diverso prima della priorità settimanale', () => {
  const catalog = generator.buildCatalog([
    track('first', 'BASE', 60, 'Artista A'),
    track('same-artist', 'BASE', 60, 'Artista A'),
    track('different-artist', 'BASE', 60, 'Artista B')
  ]);
  const result = generator.generateSetlist({
    catalog, counts: counts(1), durationSeconds: 120, random: () => 0, attempts: 1,
    coursePrograms: coursePrograms([lesson('first', 2), lesson('same-artist', 1)])
  });
  assert.deepEqual(result.tracks.map((item) => item.id), ['first', 'different-artist']);
});

test('SCALETTA: aggiorna le settimane dal programma condiviso anche quando il CSV non cambia', async (t) => {
  const html = fs.readFileSync(path.join(root, 'USERFORM/pages/SCALETTA.html'), 'utf8');
  const dom = new JSDOM(html, { url: 'http://localhost/USERFORM/pages/SCALETTA.html', runScripts: 'outside-only' });
  t.after(() => dom.window.close());
  const { window } = dom;
  let refreshCatalog;
  let programs = coursePrograms([lesson('late', 53), lesson('early', 1)]);
  window.setInterval = (callback) => { refreshCatalog = callback; return 1; };
  window.fetch = async (url) => String(url).includes('brani.csv')
    ? { ok: true, text: async () => 'id,coreografia,brano,autore,durata,info_livello\nlate,Dicembre,Brano 1,Artista,60,BASE\nearly,Gennaio,Brano 2,Artista,60,BASE\n' }
    : { ok: true, json: async () => programs };
  for (const file of ['Bordero/js/choreo-program-store.js', 'USERFORM/js/scaletta-generator.js', 'Bordero/pages/dj-preselezione-file.js', 'USERFORM/js/scaletta-actions.js']) {
    window.eval(fs.readFileSync(path.join(root, file), 'utf8'));
  }
  await new Promise((resolve) => setImmediate(resolve));
  window.document.getElementById('setlist-available-time').value = '00:01';
  window.document.getElementById('setlist-count-base').value = '1';
  window.document.getElementById('btn-generate-setlist').click();
  assert.equal(window.SCALETTA_SETLIST[0].id, 'early');
  programs = coursePrograms([lesson('late', 10), lesson('early', 1)]);
  await refreshCatalog();
  window.document.getElementById('btn-new-setlist').click();
  assert.equal(window.SCALETTA_SETLIST[0].id, 'late');
  assert.equal(JSON.parse(window.localStorage.getItem('bordero_choreoPrograms')).activeSeason, '2026-2027');
});

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
  assert.equal(catalog.catalogByLevel.SUPERAVANZATO_3.length, 21);
  assert.equal(catalog.catalogByLevel.ALTRE_COREO.length, 287);

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

test('SCALETTA: mantiene l’ordine dei livelli in ogni ciclo', () => {
  const catalog = generator.buildCatalog([
    ...Array.from({ length: 10 }, (_, index) => track(`b${index}`, 'BASE', 60)),
    ...Array.from({ length: 10 }, (_, index) => track(`i${index}`, 'INTERMEDIO', 60)),
    ...Array.from({ length: 10 }, (_, index) => track(`a1-${index}`, 'AVANZATO 1', 60)),
    ...Array.from({ length: 10 }, (_, index) => track(`a2-${index}`, 'AVANZATO 2', 60))
  ]);
  const result = generator.generateSetlist({
    catalog,
    counts: counts(2, 1, 1, 1),
    durationSeconds: 1500,
    random: seededRandom(42),
    attempts: 1
  });

  assert.deepEqual(result.errors, []);
  assert.equal(result.tracks.length, 25);
  const expectedCycle = ['BASE', 'BASE', 'INTERMEDIO', 'AVANZATO_1', 'AVANZATO_2'];
  assert.deepEqual(
    result.tracks.map((item) => item.level),
    Array.from({ length: 5 }, () => expectedCycle).flat()
  );
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

test('TEST 4: passa al livello successivo quando il livello richiesto non ha brani compatibili', () => {
  const catalog = generator.buildCatalog([track('i1', 'INTERMEDIO', '03:00')]);
  const result = generator.generateSetlist({ catalog, counts: counts(1), durationSeconds: 180 });
  assert.deepEqual(result.errors, []);
  assert.equal(result.tracks.length, 1);
  assert.equal(result.tracks[0].level, 'INTERMEDIO');
  assert.ok(result.warnings.some((warning) => warning.includes('BASE -> INTERMEDIO')));
});

test('TEST 5: usa i brani disponibili e avvisa se la quota resta incompleta', () => {
  const catalog = generator.buildCatalog([track('b1', 'BASE', 60), track('b2', 'BASE', 70)]);
  const result = generator.generateSetlist({ catalog, counts: counts(3), durationSeconds: 130 });
  assert.deepEqual(result.errors, []);
  assert.equal(result.tracks.length, 2);
  assert.ok(result.warnings.some((warning) => warning.includes('BASE: 2/3')));
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
  const result = generator.generateSetlist({ catalog, counts: counts(1), durationSeconds: 150 });
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
  const result = generator.generateSetlist({ catalog, counts: counts(0, 0, 0, 0, 2, 2, 2), durationSeconds: 720 });
  assert.deepEqual(result.errors, []);
  assert.equal(result.levelCounts.SUPERAVANZATO_1_2, 2);
  assert.equal(result.levelCounts.SUPERAVANZATO_3, 2);
  assert.equal(result.levelCounts.ALTRE_COREO, 2);

  const shortage = generator.generateSetlist({ catalog, counts: counts(0, 0, 0, 0, 3), durationSeconds: 360 });
  assert.deepEqual(shortage.errors, []);
  assert.deepEqual(shortage.tracks.map((item) => item.level), ['SUPERAVANZATO_1_2', 'SUPERAVANZATO_1_2', 'SUPERAVANZATO_3']);
  assert.ok(shortage.warnings.some((warning) => warning.includes('SUPER AVANZATO 1+2 -> SUPER AVANZATO 3')));
});

test('TEST 10b: nessun duplicato finche esistono brani non ancora usati', () => {
  const catalog = generator.buildCatalog(Array.from({ length: 5 }, (_, index) => track(`n${index}`, 'BASE', '03:00')));
  const result = generator.generateSetlist({ catalog, counts: counts(1), durationSeconds: 960 });
  const ids = result.tracks.map((item) => item.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(ids.length, 5);
});

test('TEST 10c: a catalogo esaurito ripete brani solo per riempire il tempo', () => {
  const catalog = generator.buildCatalog([track('e1', 'BASE', '03:00'), track('e2', 'BASE', '03:00'), track('e3', 'INTERMEDIO', '03:00')]);
  const result = generator.generateSetlist({ catalog, counts: counts(1), durationSeconds: 1800 });
  const ids = result.tracks.map((item) => item.id);
  assert.ok(ids.length > 2);
  assert.ok(['e1', 'e2'].every((id) => ids.includes(id)));
  assert.ok(result.warnings.some((warning) => warning.includes('ripetuti')));
});

test('SCALETTA: evita coreografie gia selezionate e segnala le ripetizioni inevitabili', () => {
  const catalog = generator.buildCatalog([
    { ...track('same-1', 'BASE', 60), coreografia: 'La stessa' },
    { ...track('same-2', 'BASE', 60), coreografia: 'la STESSA' },
    { ...track('different', 'BASE', 60), coreografia: 'Un altra' }
  ]);
  const result = generator.generateSetlist({
    catalog,
    counts: counts(1),
    durationSeconds: 120,
    random: () => 0,
    attempts: 1
  });

  assert.equal(new Set(result.tracks.map((item) => item.coreografia.toUpperCase())).size, result.tracks.length);
  assert.equal(result.warnings.some((warning) => warning.includes('Coreografie ripetute')), false);

  const onlyOneChoreography = generator.buildCatalog([
    { ...track('only-1', 'BASE', 60), coreografia: 'La stessa' },
    { ...track('only-2', 'BASE', 60), coreografia: 'LA STESSA' }
  ]);
  const repeated = generator.generateSetlist({
    catalog: onlyOneChoreography,
    counts: counts(1),
    durationSeconds: 120,
    random: () => 0,
    attempts: 1
  });
  assert.equal(repeated.tracks.length, 2);
  assert.ok(repeated.warnings.some((warning) => warning.includes('Coreografie ripetute: 1')));
});

test('SCALETTA: include o esclude i tag informativi selezionati', () => {
  const catalog = generator.buildCatalog([
    { ...track('tag-couple', 'BASE', 60), 'info coreo 1': 'COPPIA', 'info coreo 2': 'NATALIZIA' },
    { ...track('tag-circle', 'BASE', 60), 'info coreo 1': 'CERCHIO', 'info coreo 2': '' },
    { ...track('tag-none', 'BASE', 60), 'info coreo 1': '', 'info coreo 2': '' }
  ]);

  assert.deepEqual(catalog.infoOptions, ['CERCHIO', 'COPPIA', 'NATALIZIA']);
  const included = generator.filterCatalogByInfo(catalog, { mode: 'include', tags: ['COPPIA', 'NATALIZIA'] });
  assert.deepEqual(included.tracks.map((item) => item.id), ['tag-couple']);
  const includedNone = generator.filterCatalogByInfo(catalog, { mode: 'include', tags: [] });
  assert.deepEqual(includedNone.tracks, []);
  const excluded = generator.filterCatalogByInfo(catalog, { mode: 'exclude', tags: ['CERCHIO'] });
  assert.deepEqual(excluded.tracks.map((item) => item.id), ['tag-couple', 'tag-none']);
  const excludedNone = generator.filterCatalogByInfo(catalog, { mode: 'exclude', tags: [] });
  assert.deepEqual(excludedNone.tracks.map((item) => item.id), ['tag-couple', 'tag-circle', 'tag-none']);

  const fallbackCatalog = generator.buildCatalog([
    { ...track('fallback-intermedio', 'INTERMEDIO', 60), 'info coreo 1': 'COPPIA' },
    { ...track('fallback-advanced', 'AVANZATO 1', 60), 'info coreo 1': 'COPPIA' },
    { ...track('filtered-out', 'BASE', 60), 'info coreo 1': 'HALLOWEEN' }
  ]);
  const fallback = generator.generateSetlist({
    catalog: fallbackCatalog,
    counts: counts(2),
    durationSeconds: 120,
    infoFilter: { mode: 'include', tags: ['COPPIA'] },
    random: () => 0,
    attempts: 1
  });
  assert.deepEqual(fallback.errors, []);
  assert.deepEqual(fallback.tracks.map((item) => item.id), ['fallback-intermedio', 'fallback-advanced']);
  assert.deepEqual(fallback.tracks.map((item) => item.level), ['INTERMEDIO', 'AVANZATO_1']);
  assert.ok(fallback.tracks.every((item) => item.infoTags.includes('COPPIA')));
});

test('SCALETTA: carica il CSV, mostra tutti i livelli, salva il risultato e pulisce i dati', async () => {
  const html = fs.readFileSync(path.join(root, 'USERFORM/pages/SCALETTA.html'), 'utf8');
  const dom = new JSDOM(html, {
    url: 'http://localhost/USERFORM/pages/SCALETTA.html',
    runScripts: 'outside-only'
  });
  const { window } = dom;
  let savedPayload = null;
  let csvForFetch = csv;
  let refreshCatalogCallback = null;
  window.setInterval = (callback) => {
    refreshCatalogCallback = callback;
    return 1;
  };
  window.fetch = async (url, options = {}) => {
    if (String(url).includes('brani.csv')) {
      return {
        ok: true,
        status: 200,
        text: async () => csvForFetch
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
  const catalogInfoOptions = generator.buildCatalog(csv).infoOptions;
  const infoCheckboxes = [...window.document.querySelectorAll('#setlist-info-options input[type="checkbox"]')];
  assert.deepEqual(infoCheckboxes.map((input) => input.value), catalogInfoOptions);
  const selectedTag = catalogInfoOptions[0];
  const selectedCheckbox = infoCheckboxes.find((input) => input.value === selectedTag);
  const selectedTrack = generator.buildCatalog(csv).tracks.find((item) => item.infoTags.includes(selectedTag));
  const inputByLevel = {
    BASE: 'setlist-count-base',
    INTERMEDIO: 'setlist-count-intermedio',
    AVANZATO_1: 'setlist-count-avanzato-1',
    AVANZATO_2: 'setlist-count-avanzato-2',
    SUPERAVANZATO_1_2: 'setlist-count-super-12',
    SUPERAVANZATO_3: 'setlist-count-super-3',
    ALTRE_COREO: 'setlist-count-altre-coreo'
  };
  Object.values(inputByLevel).forEach((id) => { window.document.getElementById(id).value = '0'; });
  window.document.getElementById(inputByLevel[selectedTrack.levels[0]]).value = '1';
  window.document.getElementById('setlist-available-time').value = '03:00';
  const includeMode = window.document.querySelector('input[name="setlist-info-filter-mode"][value="include"]');
  includeMode.checked = true;
  includeMode.dispatchEvent(new window.Event('change'));
  window.document.getElementById('btn-generate-setlist').click();
  assert.equal(window.SCALETTA_SETLIST.length, 0);
  assert.equal(window.document.getElementById('scaletta-status').dataset.kind, 'warning');
  assert.match(window.document.getElementById('scaletta-status').textContent, /attivare almeno una categoria/);
  const allModeAfterWarning = window.document.querySelector('input[name="setlist-info-filter-mode"][value="all"]');
  allModeAfterWarning.checked = true;
  allModeAfterWarning.dispatchEvent(new window.Event('change'));
  assert.equal(window.document.getElementById('scaletta-status').textContent, '');
  includeMode.checked = true;
  includeMode.dispatchEvent(new window.Event('change'));

  selectedCheckbox.checked = true;
  selectedCheckbox.dispatchEvent(new window.Event('change'));
  window.document.getElementById('btn-generate-setlist').click();
  assert.ok(window.SCALETTA_SETLIST.length > 0);
  assert.ok(window.SCALETTA_SETLIST.every((item) => item.infoTags.includes(selectedTag)));
  assert.deepEqual(JSON.parse(window.localStorage.getItem('userform_scaletta_state')).infoFilter, {
    mode: 'include',
    tags: [selectedTag]
  });

  const allMode = window.document.querySelector('input[name="setlist-info-filter-mode"][value="all"]');
  allMode.checked = true;
  allMode.dispatchEvent(new window.Event('change'));
  selectedCheckbox.checked = false;
  selectedCheckbox.dispatchEvent(new window.Event('change'));
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

  const refreshedRows = generator.parseCsv(csv);
  const selectedTagRow = refreshedRows.find((row) => row.id === selectedTrack.id);
  assert.ok(selectedTagRow);
  selectedTagRow.info_google_nuova = 'CATEGORIA GOOGLE NUOVA';
  const quoteCsv = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const serializeRows = (rows) => {
    const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
    return [headers, ...rows.map((row) => headers.map((header) => row[header] ?? ''))]
      .map((row) => row.map(quoteCsv).join(','))
      .join('\n');
  };
  const includeModeBeforeRefresh = window.document.querySelector('input[name="setlist-info-filter-mode"][value="include"]');
  includeModeBeforeRefresh.checked = true;
  includeModeBeforeRefresh.dispatchEvent(new window.Event('change'));
  const selectedBeforeRefresh = [...window.document.querySelectorAll('#setlist-info-options input[type="checkbox"]')]
    .find((input) => input.value === selectedTag);
  selectedBeforeRefresh.checked = true;
  selectedBeforeRefresh.dispatchEvent(new window.Event('change'));

  csvForFetch = serializeRows(refreshedRows);
  assert.equal(typeof refreshCatalogCallback, 'function');
  await refreshCatalogCallback();
  const optionsAfterAddition = [...window.document.querySelectorAll('#setlist-info-options input[type="checkbox"]')];
  assert.equal(window.document.querySelector('input[name="setlist-info-filter-mode"][value="include"]').checked, true);
  assert.equal(optionsAfterAddition.find((input) => input.value === selectedTag)?.checked, true);
  assert.equal(optionsAfterAddition.find((input) => input.value === 'CATEGORIA GOOGLE NUOVA')?.checked, false);
  assert.deepEqual(JSON.parse(window.localStorage.getItem('userform_scaletta_state')).infoFilter, {
    mode: 'include',
    tags: [selectedTag]
  });

  refreshedRows.forEach((row) => {
    Object.keys(row).forEach((field) => {
      if (field.startsWith('info_') && row[field] === selectedTag) row[field] = '';
    });
  });
  csvForFetch = serializeRows(refreshedRows);
  await refreshCatalogCallback();
  const optionsAfterRemoval = [...window.document.querySelectorAll('#setlist-info-options input[type="checkbox"]')];
  assert.equal(optionsAfterRemoval.some((input) => input.value === selectedTag), false);
  assert.equal(window.document.querySelector('input[name="setlist-info-filter-mode"][value="include"]').checked, true);
  assert.deepEqual(JSON.parse(window.localStorage.getItem('userform_scaletta_state')).infoFilter, {
    mode: 'include',
    tags: []
  });

  csvForFetch = csv;
  await refreshCatalogCallback();
  assert.equal([...window.document.querySelectorAll('#setlist-info-options input[type="checkbox"]')]
    .some((input) => input.value === 'CATEGORIA GOOGLE NUOVA'), false);
  window.close();
});
