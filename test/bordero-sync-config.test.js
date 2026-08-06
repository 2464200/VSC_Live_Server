const test = require('node:test');
const assert = require('node:assert/strict');
const { parseBorderoGoogleSyncIntervalMs, shouldScheduleBorderoGoogleSync } = require('../Bordero/server/bordero-sync-config');

test('defaults to the 60s cadence when env is not set', () => {
  assert.equal(parseBorderoGoogleSyncIntervalMs({}), 60000);
  assert.equal(shouldScheduleBorderoGoogleSync({}), true);
});

test('honors explicit positive interval values', () => {
  assert.equal(parseBorderoGoogleSyncIntervalMs({ BORDERO_GOOGLE_SYNC_INTERVAL_MS: '180000' }), 180000);
  assert.equal(shouldScheduleBorderoGoogleSync({ BORDERO_GOOGLE_SYNC_INTERVAL_MS: '180000' }), true);
});

test('treats invalid or zero values as disabled', () => {
  assert.equal(parseBorderoGoogleSyncIntervalMs({ BORDERO_GOOGLE_SYNC_INTERVAL_MS: '0' }), 0);
  assert.equal(parseBorderoGoogleSyncIntervalMs({ BORDERO_GOOGLE_SYNC_INTERVAL_MS: 'abc' }), 0);
  assert.equal(shouldScheduleBorderoGoogleSync({ BORDERO_GOOGLE_SYNC_INTERVAL_MS: '0' }), false);
});
