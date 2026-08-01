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

function filterBraniByTitleVisibility(brani, options = {}) {
  const isExecuted = typeof options.isExecuted === 'function' ? options.isExecuted : () => false;
  const isRequested = typeof options.isRequested === 'function' ? options.isRequested : () => true;

  if (!Array.isArray(brani)) return [];

  const groups = createTitleVisibilityGroups(brani);

  return brani.filter((brano) => {
    const title = normalizeTitle(brano?.titolo || brano?.coreografia || brano?.brano || '');
    if (!title) return true;

    const matches = groups.get(title) || [];
    if (matches.length <= 1) return true;

    if (!isRequested(brano)) return true;

    const executedMatches = matches.filter((item) => isExecuted(item));
    if (executedMatches.length === 0) return true;

    return isExecuted(brano);
  });
}

function annotateBraniByTitleVisibility(brani, options = {}) {
  const isExecuted = typeof options.isExecuted === 'function' ? options.isExecuted : () => false;
  const isRequested = typeof options.isRequested === 'function' ? options.isRequested : () => true;

  if (!Array.isArray(brani)) return [];

  const groups = createTitleVisibilityGroups(brani);

  return brani.map((brano) => {
    const title = normalizeTitle(brano?.titolo || brano?.coreografia || brano?.brano || '');
    if (!title) {
      return { ...brano, displayState: 'available' };
    }

    const matches = groups.get(title) || [];
    if (matches.length <= 1) {
      return { ...brano, displayState: isExecuted(brano) ? 'executed' : 'available' };
    }

    if (!isRequested(brano)) {
      return { ...brano, displayState: 'available' };
    }

    const executedMatches = matches.filter((item) => isExecuted(item));
    if (executedMatches.length === 0) {
      return { ...brano, displayState: 'available' };
    }

    return {
      ...brano,
      displayState: isExecuted(brano) ? 'executed' : 'blocked',
    };
  });
}

module.exports = {
  filterBraniByTitleVisibility,
  annotateBraniByTitleVisibility,
  normalizeTitle,
};
