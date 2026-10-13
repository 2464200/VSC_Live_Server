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

function resolveDjAction(log, id, state, suppliedDj, actorDj, permissions = {}) {
  const entries = Array.isArray(log) ? log : [];
  const previousEntry = [...entries].reverse().find(entry => String(entry?.id) === String(id));
  const previousState = normalizeState(previousEntry?.stato);
  const ownerDj = ['prenotato', 'eseguito'].includes(previousState) ? normalizeDj(previousEntry?.dj) : null;
  const actor = normalizeDj(actorDj) || (state !== 'disponibile' ? normalizeDj(suppliedDj) : null);

  if (!actor) return { ok: false, status: 400, error: 'Seleziona il DJ prima di aggiornare il brano' };
  if (state === 'prenotato') return { ok: true, dj: actor, actorDj: actor, ownerDj: actor };

  if (ownerDj && actor !== ownerDj) {
    const allowed = state === 'eseguito'
      ? permissions.allowOtherDjExecute === true
      : state === 'disponibile' && permissions.allowOtherDjCancel === true;
    if (!allowed) {
      const action = state === 'eseguito' ? 'eseguire' : 'annullare';
      return { ok: false, status: 403, error: `Solo ${ownerDj} può ${action} questo brano` };
    }
  }

  return {
    ok: true,
    dj: state === 'disponibile' ? null : (ownerDj || normalizeDj(suppliedDj) || actor),
    actorDj: actor,
    ownerDj: ownerDj || actor
  };
}

module.exports = { normalizeDj, normalizeState, resolveDjForState, resolveDjAction };
