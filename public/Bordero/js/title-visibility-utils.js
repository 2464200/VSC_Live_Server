function normalizeTitle(value) {
  const text = String(value ?? '').trim();
  if (!text) return '';

  try {
    return text
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  } catch (error) {
    return text.toLowerCase().replace(/\s+/g, ' ').trim();
  }
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

function partitionBraniByExecutedTitle(brani, options = {}) {
  const isExecuted = typeof options.isExecuted === 'function' ? options.isExecuted : () => false;

  if (!Array.isArray(brani)) {
    return { main: [], bottom: [] };
  }

  const groups = createTitleVisibilityGroups(brani);
  const titlesWithExecutedDuplicate = new Set(
    Array.from(groups.entries())
      .filter(([, matches]) => matches.some((item) => isExecuted(item)))
      .map(([title]) => title)
  );

  const main = [];
  const bottom = [];

  brani.forEach((brano) => {
    const title = normalizeTitle(brano?.titolo || brano?.coreografia || brano?.brano || '');
    if (isExecuted(brano)) {
      bottom.push({ ...brano, displayState: 'executed', isOmonimoBlocked: false });
    } else if (title && titlesWithExecutedDuplicate.has(title)) {
      bottom.push({ ...brano, displayState: 'blocked', isOmonimoBlocked: true });
    } else {
      main.push({ ...brano, displayState: 'available', isOmonimoBlocked: false });
    }
  });

  return { main, bottom };
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

if (typeof window !== 'undefined') {
  window.normalizeTitle = normalizeTitle;
  window.filterBraniByTitleVisibility = filterBraniByTitleVisibility;
  window.partitionBraniByExecutedTitle = partitionBraniByExecutedTitle;
  window.annotateBraniByTitleVisibility = annotateBraniByTitleVisibility;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    filterBraniByTitleVisibility,
    partitionBraniByExecutedTitle,
    annotateBraniByTitleVisibility,
    normalizeTitle,
  };
}
