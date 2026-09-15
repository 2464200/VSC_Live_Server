function normalizeTitle(value) {
  return String(value ?? '').trim().toLowerCase();
}

function createTitleVisibilityGroups(brani) {
  const groups = new Map();

  brani.forEach((brano) => {
    const title = normalizeTitle(brano?.titolo || brano?.coreografia || brano?.brano || '');
    if (!title) return;

    if (!groups.has(title)) {
      groups.set(title, []);
    }
    groups.get(title).push(brano);
  });

  return groups;
}

function getHiddenBraniByTitle(brani, options = {}) {
  const isExecuted = typeof options.isExecuted === 'function' ? options.isExecuted : () => false;

  if (!Array.isArray(brani)) return [];

  const groups = createTitleVisibilityGroups(brani);
  return brani.filter((brano) => {
    const title = normalizeTitle(brano?.titolo || brano?.coreografia || brano?.brano || '');
    if (!title) return false;

    const matches = groups.get(title) || [];
    return matches.length > 1
      && matches.some((item) => isExecuted(item))
      && !isExecuted(brano)
      && !brano.next_selected;
  });
}

function filterBraniByTitleVisibility(brani, options = {}) {
  const isExecuted = typeof options.isExecuted === 'function' ? options.isExecuted : () => false;
  const isRequested = typeof options.isRequested === 'function' ? options.isRequested : () => true;

  if (!Array.isArray(brani)) return [];

  const groups = createTitleVisibilityGroups(brani);
  return brani.filter((brano) => {
    const title = normalizeTitle(brano?.titolo || brano?.coreografia || brano?.brano || '');
    if (!title) return true;
    const matches = groups.get(title) || [];
    if (matches.length <= 1 || !isRequested(brano)) return true;
    return matches.filter((item) => isExecuted(item)).length === 0 || isExecuted(brano);
  });
}

function filterBraniByDuplicateTitleVisibility(brani, options = {}) {
  const isExecuted = typeof options.isExecuted === 'function' ? options.isExecuted : () => false;
  if (!Array.isArray(brani)) return [];
  const hiddenIds = new Set(getHiddenBraniByTitle(brani, { isExecuted }).map((brano) => String(brano.id)));
  return brani.filter((brano) => !hiddenIds.has(String(brano.id)));
}

function annotateBraniByTitleVisibility(brani, options = {}) {
  const isExecuted = typeof options.isExecuted === 'function' ? options.isExecuted : () => false;
  const isRequested = typeof options.isRequested === 'function' ? options.isRequested : () => true;
  if (!Array.isArray(brani)) return [];

  const groups = createTitleVisibilityGroups(brani);

  return brani.map((brano) => {
    const title = normalizeTitle(brano?.titolo || brano?.coreografia || brano?.brano || '');
    const matches = groups.get(title) || [];
    const hasExecutedMatch = matches.filter((item) => isExecuted(item)).length > 0;
    return {
      ...brano,
      displayState: isExecuted(brano) ? 'executed' : isRequested(brano) && hasExecutedMatch ? 'blocked' : 'available',
    };
  });
}

if (typeof window !== 'undefined') {
  window.normalizeTitle = normalizeTitle;
  window.getHiddenBraniByTitle = getHiddenBraniByTitle;
  window.filterBraniByDuplicateTitleVisibility = filterBraniByDuplicateTitleVisibility;
  window.filterBraniByTitleVisibility = filterBraniByTitleVisibility;
  window.annotateBraniByTitleVisibility = annotateBraniByTitleVisibility;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    filterBraniByTitleVisibility,
    annotateBraniByTitleVisibility,
    getHiddenBraniByTitle,
    filterBraniByDuplicateTitleVisibility,
    normalizeTitle,
  };
}
