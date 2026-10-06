const assert = require('node:assert/strict');
const test = require('node:test');
const playlistFile = require('../Bordero/pages/dj-preselezione-file.js');

function sampleTracks() {
  return [
    { id: '001', level: 'BASE', levelLabel: 'BASE', coreografia: 'Line Dance One', brano: 'Country Song', autore: 'The Artist', durationLabel: '03:37', durationSeconds: 217 },
    { id: '008', level: 'AVANZATO_2', levelLabel: 'AVANZATO 2', coreografia: 'Advanced Dance', brano: 'Another Song', autore: 'Another Artist', durationLabel: '04:02', durationSeconds: 242 }
  ];
}

test('genera JSON PreSelezione con nome DJ_DATA_EVENTO e campi Borderò', () => {
  const payload = playlistFile.createPayload({
    dj: 'Luca Rossi', data: '2026-10-06', evento: 'Country Night', tracks: sampleTracks(), totalDurationSeconds: 459
  });
  assert.equal(payload.fileName, 'Luca_Rossi_2026-10-06_Country_Night.json');
  assert.equal(payload.format, playlistFile.FORMAT);
  assert.equal(payload.totalDurationSeconds, 459);
  assert.deepEqual(payload.tracks.map((track) => track.branoId), ['001', '008']);
  assert.equal(payload.tracks[0].brano.info_livello, 'BASE');
  assert.equal(payload.tracks[0].brano.durata, '03:37');
  assert.equal(payload.tracks[1].position, 2);
});

test('importa nel formato playlist esistente e conserva ordine e ID', () => {
  const payload = playlistFile.createPayload({
    dj: 'DJ', data: '2026-10-06', evento: 'Serata', tracks: sampleTracks(), totalDurationSeconds: 459
  });
  const imported = playlistFile.parseImport(JSON.stringify(payload));
  assert.equal(imported.name, 'DJ_2026-10-06_Serata');
  assert.deepEqual(imported.tracks.map((track) => track.id), ['001', '008']);
  assert.deepEqual(imported.tracks.map((track) => track.branoId), ['001', '008']);
  assert.equal(imported.tracks[0].deck, 1);
  assert.equal(imported.tracks[0].brano.coreografia, 'Line Dance One');
  assert.equal(imported.skipped, 0);
});

test('ignora ID mancanti e duplicati nell’importazione', () => {
  const imported = playlistFile.parseImport({
    format: playlistFile.FORMAT,
    version: playlistFile.VERSION,
    name: 'Playlist',
    tracks: [
      { id: '1', brano: { id: '1', coreografia: 'Uno' } },
      { id: '1', brano: { id: '1', coreografia: 'Duplicato' } },
      { brano: { coreografia: 'Senza ID' } }
    ]
  });
  assert.equal(imported.tracks.length, 1);
  assert.equal(imported.skipped, 2);
});

test('rifiuta JSON malformati, formati sconosciuti e playlist vuote', () => {
  assert.throws(() => playlistFile.parseImport('{'), /JSON valido/);
  assert.throws(() => playlistFile.parseImport({ tracks: [] }), /Formato file non riconosciuto/);
  assert.throws(() => playlistFile.parseImport({ format: playlistFile.FORMAT, version: playlistFile.VERSION, tracks: [] }), /non contiene brani/);
});

test('richiede DJ, data ed evento e rifiuta ID duplicati in esportazione', () => {
  assert.throws(() => playlistFile.buildFileName({ dj: 'DJ', data: '2026-10-06', evento: '' }), /Inserire DJ/);
  assert.throws(() => playlistFile.createPayload({
    dj: 'DJ', data: '2026-10-06', evento: 'Serata',
    tracks: [{ ...sampleTracks()[0], id: 'same' }, { ...sampleTracks()[1], id: 'same' }]
  }), /ID brano duplicato/);
});

test('normalizza le vecchie etichette SUPER 1 e 2 nella categoria reale 1+2', () => {
  const imported = playlistFile.parseImport({
    format: playlistFile.FORMAT,
    version: playlistFile.VERSION,
    name: 'Scaletta legacy',
    tracks: [
      { id: 's1', brano: { id: 's1', info_livello: 'SUPER AVANZATO 1' } },
      { id: 's2', brano: { id: 's2', info_livello: 'SUPER AVANZATO 2' } },
      { id: 's3', brano: { id: 's3', info_livello: 'SUPER AVANZATO 3' } },
      { id: 'other', brano: { id: 'other', info_livello: 'ALTRE COREO' } }
    ]
  });
  assert.deepEqual(imported.tracks.map((track) => track.brano.info_livello), [
    'SUPER AVANZATO 1+2', 'SUPER AVANZATO 1+2', 'SUPER AVANZATO 3', 'ALTRE COREO'
  ]);
});