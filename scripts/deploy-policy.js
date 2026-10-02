const SHARED_CSV_PATH = /^Bordero\/data\/.*\.csv$/i;
const LOCAL_ONLY_CSV_PATHS = new Set([
  'Bordero/data/get-camera-name.csv',
  'Bordero/data/music-archive-index.csv',
]);
const DEPLOY_CONTROL_VERSION = 2;

function normalizeRepoPath(value) {
  return String(value || '').replace(/\\/g, '/');
}

function isSharedCsvPath(value) {
  const repoPath = normalizeRepoPath(value);
  return SHARED_CSV_PATH.test(repoPath) && !LOCAL_ONLY_CSV_PATHS.has(repoPath);
}

function filterDeferredPaths(paths) {
  return new Set([...paths].filter((item) => !isSharedCsvPath(item)));
}

function resolveDeployControl(savedControl = {}) {
  const hasSavedPreference = Number(savedControl.version) >= DEPLOY_CONTROL_VERSION;
  return {
    intervalEnabled: hasSavedPreference && typeof savedControl.intervalEnabled === 'boolean'
      ? savedControl.intervalEnabled
      : true,
    sessionAutoEnabled: hasSavedPreference && Boolean(savedControl.sessionAutoEnabled),
  };
}

module.exports = {
  DEPLOY_CONTROL_VERSION,
  filterDeferredPaths,
  isSharedCsvPath,
  LOCAL_ONLY_CSV_PATHS,
  resolveDeployControl,
};