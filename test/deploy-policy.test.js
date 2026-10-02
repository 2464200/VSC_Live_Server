const test = require('node:test');
const assert = require('node:assert/strict');
const {
  DEPLOY_CONTROL_VERSION,
  filterDeferredPaths,
  isSharedCsvPath,
  LOCAL_ONLY_CSV_PATHS,
  resolveDeployControl,
} = require('../scripts/deploy-policy');

test('enables periodic deploy by default and migrates older local settings', () => {
  assert.deepEqual(resolveDeployControl({}), { intervalEnabled: true, sessionAutoEnabled: false });
  assert.deepEqual(resolveDeployControl({ intervalEnabled: false, sessionAutoEnabled: true }), {
    intervalEnabled: true,
    sessionAutoEnabled: false,
  });
});

test('preserves explicit deploy preferences written by the current version', () => {
  assert.deepEqual(resolveDeployControl({ version: DEPLOY_CONTROL_VERSION, intervalEnabled: false, sessionAutoEnabled: true }), {
    intervalEnabled: false,
    sessionAutoEnabled: true,
  });
});

test('publishes shared Bordero CSV updates while keeping machine-specific CSVs deferred', () => {
  const deferred = filterDeferredPaths([
    'Bordero/data/Accoda 8+12.csv',
    'Bordero/data/brani.csv',
    'Bordero/data/comuni_italia.csv',
    'Bordero/data/music-archive-index.csv',
    'Bordero/data/get-camera-name.csv',
    'Bordero/js/admin.js',
    '*',
  ]);

  assert.deepEqual([...deferred], [
    'Bordero/data/music-archive-index.csv',
    'Bordero/data/get-camera-name.csv',
    'Bordero/js/admin.js',
    '*',
  ]);
  assert.equal(isSharedCsvPath('Bordero\\data\\location.csv'), true);
  assert.equal(isSharedCsvPath('Bordero/data/music-archive-index.csv'), false);
  assert.deepEqual([...LOCAL_ONLY_CSV_PATHS], [
    'Bordero/data/get-camera-name.csv',
    'Bordero/data/music-archive-index.csv',
  ]);
});