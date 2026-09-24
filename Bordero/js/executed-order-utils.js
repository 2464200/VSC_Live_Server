function normalizeExecutedTitle(value) {
  const text = String(value ?? '').trim();
  if (!text) return '';

  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' e ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isExecutedTrack(brano) {
  if (!brano || typeof brano !== 'object') return false;
  if (brano.flag === true || brano.eseguito === true || brano.executed === true) return true;

  return [brano.flag, brano.eseguito, brano.executed]
    .some(value => String(value ?? '').trim().toUpperCase() === 'X');
}

function getExecutedTitle(brano) {
  return normalizeExecutedTitle(brano?.titolo || brano?.coreografia || brano?.brano || '');
}

function partitionExecutedAndSimilar(brani) {
  if (!Array.isArray(brani)) {
    return { pending: [], executed: [], similar: [], all: [] };
  }

  const executedTitles = new Set(
    brani
      .filter(isExecutedTrack)
      .map(getExecutedTitle)
      .filter(Boolean)
  );

  const isExecutedOrSimilar = (brano) => isExecutedTrack(brano)
    || (Boolean(getExecutedTitle(brano)) && executedTitles.has(getExecutedTitle(brano)));

  const pending = brani.filter(brano => !isExecutedOrSimilar(brano));
  const executed = brani.filter(brano => isExecutedTrack(brano));
  const similar = brani.filter(brano => !isExecutedTrack(brano) && isExecutedOrSimilar(brano));

  return { pending, executed, similar, all: [...pending, ...executed, ...similar] };
}

if (typeof window !== 'undefined') {
  window.normalizeExecutedTitle = normalizeExecutedTitle;
  window.isExecutedTrack = isExecutedTrack;
  window.getExecutedTitle = getExecutedTitle;
  window.partitionExecutedAndSimilar = partitionExecutedAndSimilar;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    normalizeExecutedTitle,
    isExecutedTrack,
    getExecutedTitle,
    partitionExecutedAndSimilar,
  };
}
