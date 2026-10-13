function normalizeDj(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizeState(value) {
  if (value === true || value === 1 || value === 'true' || value === '1' || value === 'eseguito') return 'eseguito';
  if (value === '2' || value === 'prenotato') return 'prenotato';
  return 'disponibile';
}

function resolveDjForState(log, id, state, suppliedDj) {
  if (state === 'disponibile') return null;
  const explicitDj = normalizeDj(suppliedDj);
  if (explicitDj) return explicitDj;
  if (state !== 'eseguito') return null;

  const previousEntry = [...(Array.isArray(log) ? log : [])]
    .reverse()
    .find(entry => String(entry?.id) === String(id));
  if (!['prenotato', 'eseguito'].includes(normalizeState(previousEntry?.stato))) return null;
  return normalizeDj(previousEntry?.dj);
}

module.exports = { normalizeDj, normalizeState, resolveDjForState };
