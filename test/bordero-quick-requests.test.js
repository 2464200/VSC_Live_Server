const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const clientSource = fs.readFileSync(
  path.join(__dirname, '..', 'Bordero', 'js', 'firebase-cloud-client.js'),
  'utf8'
);

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function createHarness(initialState, { nullInitialReads = 0, etagConflicts = 0, networkErrors = 0 } = {}) {
  let state = clone(initialState);
  const events = [];
  let readCount = 0;
  let etagVersion = 1;
  let conflictsRemaining = etagConflicts;
  let networkErrorsRemaining = networkErrors;
  const window = {
    location: {
      pathname: '/',
      hostname: 'localhost',
      port: '5500',
      search: ''
    },
    addEventListener() {},
    dispatchEvent(event) { events.push(event); }
  };
  const document = {
    readyState: 'complete',
    querySelector() { return null; },
    getElementById() { return null; }
  };
  const context = {
    window,
    document,
    BORDERO_CONFIG: {
      FIREBASE_REALTIME_DB_URL: 'https://test.example.invalid',
      FIREBASE_PROJECT_ID: 'test-project',
      FIREBASE_WEB_CONFIG_URL: 'https://test.example.invalid/config'
    },
    CustomEvent: class CustomEvent {
      constructor(type, options = {}) {
        this.type = type;
        this.detail = options.detail;
      }
    },
    console,
    Date,
    fetch: async (_url, options = {}) => {
      if (!options.method || options.method === 'GET') {
        if (networkErrorsRemaining > 0) {
          networkErrorsRemaining -= 1;
          throw new TypeError('Failed to fetch');
        }
        readCount += 1;
        const snapshotState = readCount <= nullInitialReads ? null : clone(state);
        const etag = `"${etagVersion}"`;
        return {
          ok: true,
          status: 200,
          headers: { get: (name) => name.toLowerCase() === 'etag' ? etag : null },
          async json() { return clone(snapshotState); }
        };
      }

      assert.equal(options.method, 'PUT');
      if (conflictsRemaining > 0) {
        conflictsRemaining -= 1;
        state = { ...state, nextCoreo: 'Concurrent NEXT update' };
        etagVersion += 1;
        return { ok: false, status: 412 };
      }
      if (options.headers['if-match'] !== `"${etagVersion}"`) {
        return { ok: false, status: 412 };
      }
      state = JSON.parse(options.body);
      etagVersion += 1;
      return {
        ok: true,
        status: 200,
        async json() { return clone(state); }
      };
    },
    Promise,
    Set,
    String,
    Number,
    Object,
    Array,
    JSON,
    Math,
    encodeURIComponent,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval
  };

  vm.runInNewContext(clientSource, context, { filename: 'firebase-cloud-client.js' });
  const client = window.firebaseCloudClient;
  client.authReady = Promise.resolve();
  client.publisherAuth = { currentUser: { email: 'lucafaby@gmail.com', getIdToken: async () => 'test-token' } };
  client.publisherDatabase = {
    ref() {
      return {
        async transaction(update) {
          state = update(clone(state));
          return { committed: true, snapshot: { val: () => clone(state) } };
        }
      };
    }
  };

  return {
    client,
    events,
    getState: () => clone(state),
    getReadCount: () => readCount,
    setState(value) { state = clone(value); }
  };
}

function createState() {
  return {
    updatedAt: new Date().toISOString(),
    serata: { dj: 'DJ Test', data: '2026-11-10' },
    brani: [
      { id: '101', titolo: 'Coreografia Libera', flag: '', richieste: '' },
      { id: '102', titolo: 'Coreografia Eseguita', flag: 'X', timestamp: '10/11/2026' },
      { id: '103', titolo: 'Coreografia Online', flag: '', richieste: '' }
    ],
    catalogBrani: [
      { id: '101', titolo: 'Coreografia Libera', richieste: '' },
      { id: '102', titolo: 'Coreografia Eseguita', richieste: '' },
      { id: '103', titolo: 'Coreografia Online', richieste: '2' }
    ]
  };
}

test('quick request reservation commits through a conditional Firebase REST write', async () => {
  const harness = createHarness(createState());
  const serataKey = harness.client.getSerataKey(harness.getState().serata);

  const result = await harness.client.reserveQuickRequest({
    branoId: '101',
    title: 'Coreografia Libera',
    serataKey
  });

  assert.equal(result.ok, true);
  assert.equal(Object.keys(harness.getState().quickRequestsBySerata[serataKey]).length, 1);
});

test('quick request reservation retries a temporarily unavailable database read', async () => {
  const harness = createHarness(createState(), { nullInitialReads: 1 });
  const serataKey = harness.client.getSerataKey(harness.getState().serata);

  const result = await harness.client.reserveQuickRequest({
    branoId: '101',
    title: 'Coreografia Libera',
    serataKey
  });

  assert.equal(result.ok, true);
  assert.equal(harness.getReadCount(), 2);
  assert.equal(Object.keys(harness.getState().quickRequestsBySerata[serataKey]).length, 1);
});

test('quick request reservation retries transient network failures', async () => {
  const harness = createHarness(createState(), { networkErrors: 1 });
  const serataKey = harness.client.getSerataKey(harness.getState().serata);

  const result = await harness.client.reserveQuickRequest({
    branoId: '101',
    title: 'Coreografia Libera',
    serataKey
  });

  assert.equal(result.ok, true);
  assert.equal(harness.getReadCount(), 1);
  assert.equal(Object.keys(harness.getState().quickRequestsBySerata[serataKey]).length, 1);
});

test('quick request reservation retries an ETag conflict without overwriting concurrent state', async () => {
  const harness = createHarness(createState(), { etagConflicts: 1 });
  const serataKey = harness.client.getSerataKey(harness.getState().serata);

  const result = await harness.client.reserveQuickRequest({
    branoId: '101',
    title: 'Coreografia Libera',
    serataKey
  });

  assert.equal(result.ok, true);
  assert.equal(harness.getReadCount(), 2);
  assert.equal(harness.getState().nextCoreo, 'Concurrent NEXT update');
  assert.equal(Object.keys(harness.getState().quickRequestsBySerata[serataKey]).length, 1);
});

test('quick request reservations are atomic, unique per song and serata', async () => {
  const harness = createHarness(createState());
  const serataKey = harness.client.getSerataKey(harness.getState().serata);
  const payload = { branoId: '101', title: 'Coreografia Libera', serataKey };

  const results = await Promise.all([
    harness.client.reserveQuickRequest(payload),
    harness.client.reserveQuickRequest(payload)
  ]);

  assert.equal(results.filter((result) => result.ok).length, 1);
  assert.equal(results.filter((result) => !result.ok && result.reason === 'gia-prenotata').length, 1);
  assert.equal(Object.keys(harness.getState().quickRequestsBySerata[serataKey]).length, 1);

  const repeated = await harness.client.reserveQuickRequest(payload);
  assert.equal(repeated.ok, false);
  assert.equal(repeated.reason, 'gia-prenotata');
});

test('quick request removal is atomic, synchronized and idempotent', async () => {
  const harness = createHarness(createState());
  const serataKey = harness.client.getSerataKey(harness.getState().serata);
  const reservation = await harness.client.reserveQuickRequest({
    branoId: '101',
    title: 'Coreografia Libera',
    serataKey
  });
  const stateBeforeRemoval = harness.getState();
  stateBeforeRemoval.quickRequestsBySerata[serataKey]['102'] = {
    id: '102',
    title: 'Coreografia Eseguita',
    source: 'richiesta-veloce',
    createdAt: '2026-11-10T20:00:00.000Z',
    reservationId: 'other-reservation',
    serataKey
  };
  harness.setState(stateBeforeRemoval);
  const braniBeforeRemoval = harness.getState().brani;

  const result = await harness.client.removeQuickRequest({
    branoId: '101',
    serataKey,
    expectedCreatedAt: reservation.request.createdAt,
    expectedReservationId: reservation.request.reservationId
  });
  assert.equal(result.ok, true);
  assert.equal(result.removed, true);
  assert.equal(harness.getState().quickRequestsBySerata?.[serataKey]?.['101'], undefined);
  assert.equal(harness.getState().quickRequestsBySerata[serataKey]['102'].reservationId, 'other-reservation');
  assert.deepEqual(harness.getState().brani, braniBeforeRemoval);
  assert.equal(harness.events.at(-1)?.detail?.quickRequestsBySerata?.[serataKey]?.['101'], undefined);
  assert.equal(harness.events.at(-1)?.detail?.quickRequestsBySerata?.[serataKey]?.['102'].reservationId, 'other-reservation');

  const repeated = await harness.client.removeQuickRequest({ branoId: '101', serataKey });
  assert.equal(repeated.ok, true);
  assert.equal(repeated.removed, false);
});

test('quick request removal retries ETag conflicts without losing concurrent Bordero changes', async () => {
  const harness = createHarness(createState(), { etagConflicts: 1 });
  const serataKey = harness.client.getSerataKey(harness.getState().serata);
  const reservation = await harness.client.reserveQuickRequest({
    branoId: '101',
    title: 'Coreografia Libera',
    serataKey
  });

  const result = await harness.client.removeQuickRequest({
    branoId: '101',
    serataKey,
    expectedCreatedAt: reservation.request.createdAt,
    expectedReservationId: reservation.request.reservationId
  });
  assert.equal(result.ok, true);
  assert.equal(result.removed, true);
  assert.equal(harness.getState().nextCoreo, 'Concurrent NEXT update');
  assert.equal(harness.getState().quickRequestsBySerata?.[serataKey]?.['101'], undefined);
});

test('quick request removal does not delete a newer reservation for the same song', async () => {
  const harness = createHarness(createState());
  const serataKey = harness.client.getSerataKey(harness.getState().serata);
  const reservation = await harness.client.reserveQuickRequest({
    branoId: '101',
    title: 'Coreografia Libera',
    serataKey
  });
  const state = harness.getState();
  state.quickRequestsBySerata[serataKey]['101'] = {
    ...reservation.request,
    createdAt: new Date(Date.now() + 1000).toISOString(),
    reservationId: 'newer-reservation'
  };
  harness.setState(state);

  const result = await harness.client.removeQuickRequest({
    branoId: '101',
    serataKey,
    expectedCreatedAt: reservation.request.createdAt,
    expectedReservationId: reservation.request.reservationId
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'richiesta-modificata');
  assert.equal(harness.getState().quickRequestsBySerata[serataKey]['101'].reservationId, 'newer-reservation');
});

test('quick request reservation rejects executed, online-requested and stale songs', async () => {
  const harness = createHarness(createState());
  const serataKey = harness.client.getSerataKey(harness.getState().serata);

  assert.equal((await harness.client.reserveQuickRequest({
    branoId: '102', title: 'Coreografia Eseguita', serataKey
  })).reason, 'gia-eseguita');
  assert.equal((await harness.client.reserveQuickRequest({
    branoId: '103', title: 'Coreografia Online', serataKey
  })).reason, 'gia-prenotata');

  const staleState = harness.getState();
  staleState.updatedAt = new Date(Date.now() - 49 * 60 * 60 * 1000).toISOString();
  harness.setState(staleState);
  assert.equal((await harness.client.reserveQuickRequest({
    branoId: '101', title: 'Coreografia Libera', serataKey
  })).reason, 'stato-non-aggiornato');
});

test('Bordero state publication preserves quick requests committed concurrently', async () => {
  const initialState = createState();
  const harness = createHarness(initialState);
  const serataKey = harness.client.getSerataKey(initialState.serata);
  const request = await harness.client.reserveQuickRequest({
    branoId: '101',
    title: 'Coreografia Libera',
    serataKey
  });
  assert.equal(request.ok, true);

  const published = await harness.client.publishState({
    serata: initialState.serata,
    brani: initialState.brani,
    catalogBrani: initialState.catalogBrani
  });

  assert.equal(published.quickRequestsBySerata[serataKey]['101'].source, 'richiesta-veloce');
});
