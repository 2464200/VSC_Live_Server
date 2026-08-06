function parseBorderoGoogleSyncIntervalMs(env = process.env, fallback = 60000) {
  const raw = String(env?.BORDERO_GOOGLE_SYNC_INTERVAL_MS ?? '').trim();
  if (!raw) return fallback;

  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return 0;
  return value;
}

function shouldScheduleBorderoGoogleSync(env = process.env, fallback = 60000) {
  return parseBorderoGoogleSyncIntervalMs(env, fallback) > 0;
}

module.exports = {
  parseBorderoGoogleSyncIntervalMs,
  shouldScheduleBorderoGoogleSync
};
