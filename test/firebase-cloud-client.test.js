const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const repoRoot = path.resolve(__dirname, '..');
const expectedDatabaseUrl = 'https://my-project-1525790600392-default-rtdb.europe-west1.firebasedatabase.app';

test('source and published Bordero clients target the Hosting project Realtime Database', () => {
  const sourceConfig = fs.readFileSync(path.join(repoRoot, 'Bordero/js/config.js'), 'utf8');
  const publishedConfig = fs.readFileSync(path.join(repoRoot, 'public/Bordero/js/config.js'), 'utf8');
  const sourceClient = fs.readFileSync(path.join(repoRoot, 'Bordero/js/firebase-cloud-client.js'), 'utf8');
  const publishedClient = fs.readFileSync(path.join(repoRoot, 'public/Bordero/js/firebase-cloud-client.js'), 'utf8');
  const sourceDataLoader = fs.readFileSync(path.join(repoRoot, 'Bordero/js/data-loader.js'), 'utf8');
  const publishedDataLoader = fs.readFileSync(path.join(repoRoot, 'public/Bordero/js/data-loader.js'), 'utf8');
  const sourceDisplay = fs.readFileSync(path.join(repoRoot, 'Bordero/pages/display.js'), 'utf8');
  const publishedDisplay = fs.readFileSync(path.join(repoRoot, 'public/Bordero/pages/display.js'), 'utf8');
  const sourceRules = fs.readFileSync(path.join(repoRoot, 'Bordero/pages/bordero.js'), 'utf8');
  const publishedRules = fs.readFileSync(path.join(repoRoot, 'public/Bordero/pages/bordero.js'), 'utf8');

  for (const config of [sourceConfig, publishedConfig]) {
    assert.ok(config.includes(`FIREBASE_REALTIME_DB_URL: '${expectedDatabaseUrl}'`));
    assert.ok(config.includes('FIREBASE_WEB_CONFIG_URL:'));
    assert.ok(!config.includes('europe-west1-3c18b-default-rtdb'));
  }
  assert.equal(sourceClient, publishedClient);
  assert.equal(sourceDataLoader, publishedDataLoader);
  assert.equal(sourceDisplay, publishedDisplay);
  assert.equal(sourceRules, publishedRules);
  assert.ok(sourceClient.includes(`|| '${expectedDatabaseUrl}'`));
});

test('Realtime Database rules allow public reads but restrict writes to Luca and Daniele', () => {
  const rules = JSON.parse(fs.readFileSync(path.join(repoRoot, 'database.rules.json'), 'utf8'));
  const stateRules = rules.rules.bordero.display_state;
  const curriculumRules = rules.rules.bordero.dance_curriculum;

  assert.equal(stateRules['.read'], true);
  assert.equal(curriculumRules['.read'], true);
  assert.equal(curriculumRules['.write'], stateRules['.write']);
  assert.equal(stateRules['.write'].includes('auth != null'), true);
  assert.equal(
    stateRules['.write'],
    "auth != null && auth.token.email_verified == true && (auth.token.email == 'lucafaby@gmail.com' || auth.token.email == 'djdaniele1984@gmail.com')",
  );
  for (const email of ['lucafaby@gmail.com', 'djdaniele1984@gmail.com']) {
    assert.ok(stateRules['.write'].includes(email));
  }
  assert.equal(stateRules['.write'].includes('auth.token.email_verified == true'), true);
});

test('Firebase Auth enables Google Sign-In for the local and hosted Bordero domains', () => {
  const firebaseConfig = JSON.parse(fs.readFileSync(path.join(repoRoot, 'firebase.json'), 'utf8'));
  const authHtmlFiles = [
    'Bordero/pages/bordero.html',
    'Bordero/pages/admin.html',
    'Bordero/pages/dj-preselezione.html',
    'Bordero/pages/coreografie-corsi.html',
  ];

  assert.equal(firebaseConfig.auth.providers.googleSignIn.supportEmail, 'lucafaby@gmail.com');
  for (const domain of ['localhost', 'my-project-1525790600392.firebaseapp.com', 'my-project-1525790600392.web.app']) {
    assert.ok(firebaseConfig.auth.authorizedDomains.includes(domain));
  }
  for (const file of authHtmlFiles) {
    const html = fs.readFileSync(path.join(repoRoot, file), 'utf8');
    assert.ok(html.includes('firebase-auth-compat.js'));
    assert.ok(html.includes('firebase-database-compat.js'));
    assert.ok(html.indexOf('firebase-app-compat.js') < html.indexOf('firebase-cloud-client.js'));
  }
});

async function createPublisherClient(email, url = 'http://localhost:5500/Bordero/pages/bordero.html', options = {}) {
  const writes = [];
  let transactionAttempts = 0;
  let activeTransactions = 0;
  let maxConcurrentTransactions = 0;
  let failuresRemaining = options.failTransactions || 0;
  const user = { email };
  const auth = {
    currentUser: user,
    onAuthStateChanged(callback) {
      callback(user);
    },
    async signOut() {},
    async signInWithPopup() {},
  };
  const app = {
    auth: () => auth,
    database: () => ({
      ref: (databasePath) => ({
        transaction: async (updateState) => {
          transactionAttempts += 1;
          activeTransactions += 1;
          maxConcurrentTransactions = Math.max(maxConcurrentTransactions, activeTransactions);
          try {
            if (options.transactionDelayMs) {
              await new Promise((resolve) => setTimeout(resolve, options.transactionDelayMs));
            }
            if (failuresRemaining > 0) {
              failuresRemaining -= 1;
              throw new Error('temporary write failure');
            }
            const value = updateState(null);
            writes.push({ databasePath, value });
            return { committed: true, snapshot: { val: () => value } };
          } finally {
            activeTransactions -= 1;
          }
        },
      }),
    }),
  };
  const authFactory = () => auth;
  authFactory.GoogleAuthProvider = class {};
  const stored = new Map();
  const fetched = [];
  const dom = new JSDOM(
    '<header><div class="header-content"></div></header><button id="firebase-cloud-auth"></button><span id="firebase-cloud-badge"></span>',
    {
      url,
      runScripts: 'outside-only',
      beforeParse(window) {
        Object.defineProperty(window, 'Storage', {
          configurable: true,
          value: {
            get: (key, fallback = null) => stored.has(key) ? stored.get(key) : fallback,
            set: (key, value) => stored.set(key, value),
            remove: (key) => stored.delete(key),
          },
        });
        window.BORDERO_CONFIG = {
          FIREBASE_PROJECT_ID: 'my-project-1525790600392',
          FIREBASE_REALTIME_DB_URL: expectedDatabaseUrl,
          FIREBASE_WEB_CONFIG_URL: 'https://my-project-1525790600392.firebaseapp.com/__/firebase/init.json',
          CACHE_KEY_CURRENT_SERATA: 'bordero_currentSerata',
          CACHE_KEY_BRANI: 'bordero_brani',
        };
        window.firebase = {
          apps: [app],
          app: () => app,
          initializeApp: () => app,
          auth: authFactory,
          database: () => app.database(),
        };
        window.fetch = async (url) => {
          fetched.push(url);
          if (url === window.BORDERO_CONFIG.FIREBASE_WEB_CONFIG_URL) {
            return {
              ok: true,
              json: async () => ({ projectId: 'my-project-1525790600392' }),
            };
          }
          return { ok: false, status: 404 };
        };
      },
    },
  );

  const clientScript = fs.readFileSync(path.join(repoRoot, 'Bordero/js/firebase-cloud-client.js'), 'utf8');
  dom.window.eval(clientScript);
  const client = dom.window.firebaseCloudClient;
  await client.authReady;
  assert.ok(client.publisherDatabase);
  await new Promise((resolve) => dom.window.setTimeout(resolve, 0));

  return {
    dom,
    client,
    writes,
    fetched,
    get transactionAttempts() { return transactionAttempts; },
    get maxConcurrentTransactions() { return maxConcurrentTransactions; },
  };
}

test('course page authenticates on local and cloud hosts without publishing or loading evening state', async () => {
  for (const url of [
    'http://localhost:5500/Bordero/pages/coreografie-corsi.html',
    'https://my-project-1525790600392.web.app/Bordero/pages/coreografie-corsi.html'
  ]) {
    const { dom, client, writes, fetched } = await createPublisherClient('lucafaby@gmail.com', url);
    try {
      assert.equal(client.isCoursePage, true);
      assert.equal(fetched.length, 1);
      assert.equal(dom.window.document.getElementById('firebase-cloud-auth').dataset.firebaseAuthBound, 'true');
      assert.match(dom.window.document.getElementById('firebase-cloud-badge').textContent, /lucafaby@gmail.com/);
      dom.window.dispatchEvent(new dom.window.StorageEvent('storage', { key: 'bordero_currentSerata' }));
      assert.equal(client.localPushDebounceTimer, null);
      assert.equal(writes.length, 0);
    } finally {
      dom.window.close();
    }
  }
});

test('authorized Google publisher writes through the authenticated Realtime Database SDK', async () => {
  const { dom, client, writes } = await createPublisherClient('LUCAFABY@gmail.com');

  const state = await client.publishState({
    nextCoreo: 'Coreografia test',
    serata: { dj: 'Test DJ' },
    brani: [{ id: '1' }],
  });

  assert.equal(writes.length, 1);
  assert.equal(writes[0].databasePath, 'bordero/display_state');
  assert.equal(state.source, 'bordero-google-auth');
  assert.equal(state.nextCoreo, 'Coreografia test');
  assert.ok(Number.isFinite(Date.parse(state.updatedAt)));
  dom.window.close();
});

test('unchanged catalog publications are deduplicated and failed writes can retry next cycle', async () => {
  const clientWithNoChanges = await createPublisherClient('lucafaby@gmail.com');
  const state = {
    nextCoreo: 'Coreografia test',
    serata: { dj: 'Test DJ' },
    brani: [{ id: '1' }],
  };
  await clientWithNoChanges.client.publishState(state);
  await clientWithNoChanges.client.publishState(state);
  assert.equal(clientWithNoChanges.writes.length, 1);
  clientWithNoChanges.dom.window.close();

  const retryingClient = await createPublisherClient(
    'lucafaby@gmail.com',
    'http://localhost:5500/Bordero/pages/bordero.html',
    { failTransactions: 1 },
  );
  await assert.rejects(retryingClient.client.publishState(state), /temporary write failure/);
  await retryingClient.client.publishState(state);
  assert.equal(retryingClient.transactionAttempts, 2);
  assert.equal(retryingClient.writes.length, 1);
  retryingClient.dom.window.close();
});

test('a later catalog update event retries a previously failed Firebase publication', async () => {
  const retryingClient = await createPublisherClient(
    'lucafaby@gmail.com',
    'http://localhost:5500/Bordero/pages/bordero.html',
    { failTransactions: 1 },
  );
  const waitForDebounce = () => new Promise((resolve) => retryingClient.dom.window.setTimeout(resolve, 350));

  retryingClient.dom.window.dispatchEvent(new retryingClient.dom.window.Event('bordero:data-updated'));
  await waitForDebounce();
  assert.equal(retryingClient.transactionAttempts, 1);
  assert.equal(retryingClient.writes.length, 0);

  retryingClient.dom.window.dispatchEvent(new retryingClient.dom.window.Event('bordero:data-updated'));
  await waitForDebounce();
  assert.equal(retryingClient.transactionAttempts, 2);
  assert.equal(retryingClient.writes.length, 1);
  retryingClient.dom.window.close();
});

test('concurrent state changes are serialized into non-overlapping Firebase writes', async () => {
  const publisher = await createPublisherClient(
    'lucafaby@gmail.com',
    'http://localhost:5500/Bordero/pages/bordero.html',
    { transactionDelayMs: 20 },
  );

  await Promise.all([
    publisher.client.publishState({ nextCoreo: 'Prima coreografia' }),
    publisher.client.publishState({ nextCoreo: 'Seconda coreografia' }),
  ]);

  assert.equal(publisher.writes.length, 2);
  assert.equal(publisher.maxConcurrentTransactions, 1);
  publisher.dom.window.close();
});

test('unauthorized Google accounts cannot invoke cloud writes', async () => {
  const { dom, client, writes } = await createPublisherClient('unauthorized@example.com');

  await assert.rejects(client.publishState({ nextCoreo: 'Do not publish' }), /Google autorizzati/i);
  assert.equal(writes.length, 0);
  dom.window.close();
});

async function createCloudClient({
  status,
  data,
  url = 'https://my-project-1525790600392.web.app/Bordero/pages/display.html',
}) {
  const stored = new Map([['bordero_currentSerata', { savedAt: new Date().toISOString(), brani: [{ id: 'stale' }] }]]);
  const removedKeys = [];
  let displayRefreshes = 0;
  let fetchCalls = 0;
  const dom = new JSDOM(
    '<header><div class="display-title-row"><span id="next-coreo">Old value</span></div></header>',
    {
      url,
      runScripts: 'outside-only',
      beforeParse(window) {
        Object.defineProperty(window, 'Storage', {
          configurable: true,
          value: {
            get: (key, fallback = null) => stored.has(key) ? stored.get(key) : fallback,
            set: (key, value) => stored.set(key, value),
            remove: (key) => {
              removedKeys.push(key);
              stored.delete(key);
            },
          },
        });
        window.BORDERO_CONFIG = {
          FIREBASE_REALTIME_DB_URL: expectedDatabaseUrl,
          CACHE_KEY_CURRENT_SERATA: 'bordero_currentSerata',
          CACHE_KEY_BRANI: 'bordero_brani',
        };
        window.displayMonitor = {
          refresh: () => { displayRefreshes += 1; },
          syncDataSnapshot() {},
        };
        window.fetch = () => {
          fetchCalls += 1;
          if (fetchCalls === 1) return new Promise(() => {});
          return Promise.resolve({
            ok: status >= 200 && status < 300,
            status,
            json: async () => data,
          });
        };
        window.EventSource = class {
          addEventListener() {}
          close() {}
        };
        window.setInterval = () => 1;
      },
    },
  );

  const clientScript = fs.readFileSync(path.join(repoRoot, 'public/Bordero/js/firebase-cloud-client.js'), 'utf8');
  dom.window.eval(clientScript);
  await dom.window.firebaseCloudClient.fetchCloudStateDirect();

  return {
    dom,
    stored,
    removedKeys,
    displayRefreshes,
    client: dom.window.firebaseCloudClient,
  };
}

test('custom Firebase Hosting domains are detected as cloud displays', async () => {
  const result = await createCloudClient({
    status: 404,
    data: null,
    url: 'https://bordero.example.com/Bordero/pages/display.html',
  });

  assert.equal(result.client.isCloudHost, true);
  result.dom.window.close();
});

test('missing cloud state clears a cached serata so the Display does not show stale rows', async () => {
  const result = await createCloudClient({ status: 404, data: { error: 'not found' } });

  assert.equal(result.stored.has('bordero_currentSerata'), false);
  assert.deepEqual(result.removedKeys, ['bordero_currentSerata']);
  assert.equal(result.dom.window.document.getElementById('next-coreo').textContent, '--');
  assert.equal(result.displayRefreshes, 1);
  assert.equal(result.client.hasFreshCloudState, false);
  result.dom.window.close();
});

test('permission errors preserve cached state and mark the cloud unavailable', async () => {
  const result = await createCloudClient({ status: 403, data: { error: 'denied' } });

  assert.equal(result.stored.has('bordero_currentSerata'), true);
  assert.deepEqual(result.removedKeys, []);
  assert.equal(result.client.isConnected, false);
  result.dom.window.close();
});
