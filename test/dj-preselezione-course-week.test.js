const assert = require('node:assert/strict');
const test = require('node:test');
const courseWeek = require('../Bordero/pages/dj-preselezione-course-week.js');

const tracks = [
  { id: '2', titolo: 'Due' },
  { id: '10', titolo: 'Dieci' },
  { id: 'missing', titolo: 'Senza settimana' }
];

function record(branoId, week, season = '2026/2027', extra = {}) {
  return { branoId, week, season, course: 'Centro', level: 'BASE', ...extra };
}

test('associa le settimane solo al ciclo attivo e raccoglie le settimane del brano', () => {
  const enriched = courseWeek.enrichTracks(tracks, [
    record('2', 2),
    record('2', 7, '2025/2026'),
    record('2', 10),
    record('10', 10)
  ], '2026-2027');

  assert.deepEqual(enriched[0].course_weeks, [2, 10]);
  assert.equal(enriched[0].course_week, '2, 10');
  assert.deepEqual(enriched[1].course_weeks, [10]);
  assert.equal(enriched[2].course_week, '');
});

test('legge il programma generale manuale anche se non contiene il corso', () => {
  const [track] = courseWeek.enrichTracks([{ id: '2', titolo: 'Due' }], [
    { branoId: '2', week: 12, level: 'BASE', season: '2026/2027', source: 'manual' }
  ], '2026-2027');

  assert.deepEqual(track.course_weeks, [12]);
  assert.match(track.course_week_details, /programma generale · BASE · settimana 12/);
});

test('non inventa una settimana quando il ciclo è ambiguo o manca il contesto', () => {
  const multipleCycles = courseWeek.enrichTracks(tracks, [
    record('2', 2, '2025/2026'),
    record('2', 10, '2026/2027')
  ]);
  const incompleteContext = courseWeek.enrichTracks(tracks, [
    record('2', 2, '2026/2027', { level: '' })
  ], '2026/2027');

  assert.equal(multipleCycles[0].course_week, '');
  assert.equal(incompleteContext[0].course_week, '');
});

test('ordina numericamente e lascia in fondo i brani senza settimana in entrambi i versi', () => {
  const [two, ten, missing] = courseWeek.enrichTracks(tracks, [
    record('2', 2),
    record('10', 10)
  ], '2026/2027');

  assert.deepEqual([two, ten, missing].sort(courseWeek.compare).map((track) => track.id), ['2', '10', 'missing']);
  assert.deepEqual([two, ten, missing].sort((left, right) => courseWeek.compare(left, right, 'desc')).map((track) => track.id), ['10', '2', 'missing']);
});

test('usa un titolo soltanto quando la coreografia è univoca e ignora le attività di ripasso', () => {
  const unique = courseWeek.enrichTracks([{ id: 'song', titolo: 'Coreo' }], [
    { ...record('', 3), title: 'Coreo' },
    { ...record('song', 8, '2026/2027', { activity: 'Ripasso' }) }
  ], '2026/2027');
  const ambiguous = courseWeek.enrichTracks([
    { id: 'one', titolo: 'Coreo' },
    { id: 'two', titolo: 'Coreo' }
  ], [{ ...record('', 3), title: 'Coreo' }], '2026/2027');

  assert.deepEqual(unique[0].course_weeks, [3]);
  assert.deepEqual(ambiguous.map((track) => track.course_week), ['', '']);
});
