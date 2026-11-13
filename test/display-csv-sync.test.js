const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { parse } = require('csv-parse/sync');
const {
  createDisplayCsvHandler,
  createDisplayCsvSync,
  DisplayCsvValidationError,
  serializeDisplayCsv,
} = require('../Bordero/server/display-csv-sync');

const sampleRows = [{
  id: '008',
  coreografia: 'DANCE, "A"',
  brano: 'Song title',
  autore: 'Author',
  coreografo: 'Choreographer',
  executed: true,
}];

test('display CSV keeps the classic six-column layout and escapes data fields', () => {
  const csv = serializeDisplayCsv(sampleRows, new Date('2026-03-07T12:00:00Z'));
  const rows = parse(csv, { bom: true });

  assert.equal(rows.length, 4);
  assert.equal(rows[0][0], 'DISPLAY: COREOGRAFIE RICHIESTE');
  assert.match(rows[1][0], /^Data: 07\/03\/2026\s+\|\s+Origine: borderò$/);
  assert.deepEqual(rows[2], ['?', 'ID', 'Coreografia', 'Brano', 'Autore', 'Coreografo']);
  assert.deepEqual(rows[3], ['X', '008', 'DANCE, "A"', 'Song title', 'Author', 'Choreographer']);
  assert.equal(rows[3].length, 6);
});

test('display CSV writes the root and public copies once and skips identical cycles', () => {
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bordero-display-csv-'));
  const paths = [path.join(outputDir, 'display.csv'), path.join(outputDir, 'public', 'display.csv')];

  try {
    const sync = createDisplayCsvSync({ outputPaths: paths });
    const first = sync(sampleRows, new Date('2026-03-07T12:00:00Z'));
    const second = sync(sampleRows, new Date('2026-03-07T12:00:00Z'));

    assert.deepEqual(first, { changed: true, rows: 1 });
    assert.deepEqual(second, { changed: false, rows: 1 });
    assert.equal(fs.readFileSync(paths[0], 'utf8'), fs.readFileSync(paths[1], 'utf8'));
    assert.match(fs.readFileSync(paths[0], 'utf8'), /DANCE, ""A""/);
  } finally {
    fs.rmSync(outputDir, { recursive: true, force: true });
  }
});

test('failed display publication preserves all previously valid copies', () => {
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bordero-display-failure-'));
  const paths = [path.join(outputDir, 'display.csv'), path.join(outputDir, 'public', 'display.csv')];
  const previous = ['previous root display', 'previous public display'];

  try {
    fs.mkdirSync(path.dirname(paths[1]), { recursive: true });
    paths.forEach((filePath, index) => fs.writeFileSync(filePath, previous[index], 'utf8'));
    const sync = createDisplayCsvSync({
      outputPaths: paths,
      writeFiles: () => { throw new Error('temporary disk error'); },
    });

    assert.throws(() => sync(sampleRows), /temporary disk error/);
    paths.forEach((filePath, index) => {
      assert.equal(fs.readFileSync(filePath, 'utf8'), previous[index]);
    });
  } finally {
    fs.rmSync(outputDir, { recursive: true, force: true });
  }
});

test('display CSV endpoint accepts loopback only and reports invalid data', () => {
  let calls = 0;
  const handler = createDisplayCsvHandler((rows) => {
    serializeDisplayCsv(rows);
    calls += 1;
    return { changed: true, rows: rows.length };
  }, { error() {} });
  const createResponse = () => ({
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  });

  const remoteResponse = createResponse();
  handler({ socket: { remoteAddress: '192.0.2.1' }, body: { rows: sampleRows } }, remoteResponse);
  assert.equal(remoteResponse.statusCode, 403);
  assert.equal(calls, 0);

  const localResponse = createResponse();
  handler({ socket: { remoteAddress: '::ffff:127.0.0.1' }, body: { rows: sampleRows } }, localResponse);
  assert.equal(localResponse.statusCode, 200);
  assert.equal(localResponse.body.ok, true);

  const invalidResponse = createResponse();
  handler({ socket: { remoteAddress: '127.0.0.1' }, body: { rows: [] } }, invalidResponse);
  assert.equal(invalidResponse.statusCode, 400);
  assert.ok(invalidResponse.body.error);
  assert.throws(() => serializeDisplayCsv([]), DisplayCsvValidationError);
});
