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
  const sourceRules = fs.readFileSync(path.join(repoRoot, 'Bordero/pages/bordero.js'), 'utf8');
  const publishedRules = fs.readFileSync(path.join(repoRoot, 'public/Bordero/pages/bordero.js'), 'utf8');

  for (const config of [sourceConfig, publishedConfig]) {
    assert.ok(config.includes(`FIREBASE_REALTIME_DB_URL: '${expectedDatabaseUrl}'`));
    assert.ok(config.includes('FIREBASE_WEB_CONFIG_URL:'));
    assert.ok(!config.includes('europe-west1-3c18b-default-rtdb'));
  }
  assert.equal(sourceClient, publishedClient);
  assert.equal(sourceRules, publishedRules);
  assert.ok(sourceClient.includes(`|| '${expectedDatabaseUrl}'`));
});

test('Realtime Database rules allow public reads but restrict writes to Luca and Daniele', () => {
  const rules = JSON.parse(fs.readFileSync(path.join(repoRoot, 'database.rules.json'), 'utf8'));
  const stateRules = rules.rules.bordero.display_state;

  assert.equal(stateRules['.read'], true);
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

async function createPublisherClient(email) {
  const writes = [];
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
        set: async (value) => writes.push({ databasePath, value }),
      }),
    }),
  };
  const authFactory = () => auth;
  authFactory.GoogleAuthProvider = class {};
  const stored = new Map();
  const dom = new JSDOM(
    '<header><div class="header-content"></div></header>',
    {
      url: 'http://localhost:5500/Bordero/pages/bordero.html',
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
  await new Promise((resolve) => dom.window.setTimeout(resolve, 0));
  await client.authReady;

  return { dom, client, writes };
}

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
