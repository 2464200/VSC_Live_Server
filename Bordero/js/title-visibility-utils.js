function isExecutedFlag(value) {
  if (typeof value === 'boolean') return value;
  const text = String(value ?? '').trim().toUpperCase();
  return text === 'X' || text === 'TRUE';
}

function normalizeTitle(value) {
  const text = String(value ?? '').trim();
  if (!text) return '';

  if (typeof normalizeExecutedTitle === 'function') {
    return normalizeExecutedTitle(text);
  }

  try {
    return text
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .replace(/&/g, ' e ')
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  } catch (error) {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
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

  const resolveExecuted = (brano) =>
    isExecuted(brano)
    || isExecutedFlag(brano?.flag)
    || isExecutedFlag(brano?.eseguito)
    || isExecutedFlag(brano?.executed);

  const groups = createTitleVisibilityGroups(brani);

  return brani.filter((brano) => {
    const title = normalizeTitle(brano?.titolo || brano?.coreografia || brano?.brano || '');
    if (!title) return true;

    const matches = groups.get(title) || [];
    if (matches.length <= 1) return true;

    if (!isRequested(brano)) return true;

    const executedMatches = matches.filter((item) => resolveExecuted(item));
    if (executedMatches.length === 0) return true;

    return resolveExecuted(brano);
  });
}

function partitionBraniByExecutedTitle(brani, options = {}) {
  const isExecuted = typeof options.isExecuted === 'function' ? options.isExecuted : () => false;

  if (!Array.isArray(brani)) {
    return { main: [], bottom: [], executed: [], omonimi: [] };
  }

  const resolveExecuted = (brano) =>
    isExecuted(brano)
    || isExecutedFlag(brano?.flag)
    || isExecutedFlag(brano?.eseguito)
    || isExecutedFlag(brano?.executed);

  const groups = createTitleVisibilityGroups(brani);
  const titlesWithExecutedDuplicate = new Set(
    Array.from(groups.entries())
      .filter(([, matches]) => matches.some((item) => resolveExecuted(item)))
      .map(([title]) => title)
  );

  const main = [];
  const executed = [];
  const omonimi = [];

  brani.forEach((brano) => {
    const title = normalizeTitle(brano?.titolo || brano?.coreografia || brano?.brano || '');
    if (resolveExecuted(brano)) {
      executed.push({ ...brano, displayState: 'executed', isOmonimoBlocked: false });
    } else if (title && titlesWithExecutedDuplicate.has(title)) {
      omonimi.push({ ...brano, displayState: 'blocked', isOmonimoBlocked: true });
    } else {
      main.push({ ...brano, displayState: 'available', isOmonimoBlocked: false });
    }
  });

  const sortById = (list) =>
    [...list].sort((a, b) => {
      const numA = Number(String(a?.id ?? '').replace(/\D+/g, '')) || 0;
      const numB = Number(String(b?.id ?? '').replace(/\D+/g, '')) || 0;
      if (numA !== numB) return numA - numB;
      return String(a?.id ?? '').localeCompare(String(b?.id ?? ''));
    });

  const executedSorted = sortById(executed);
  const omonimiSorted = sortById(omonimi);

  return {
    main,
    executed: executedSorted,
    omonimi: omonimiSorted,
    bottom: [...executedSorted, ...omonimiSorted],
  };
}

function annotateBraniByTitleVisibility(brani, options = {}) {
  const isExecuted = typeof options.isExecuted === 'function' ? options.isExecuted : () => false;
  const isRequested = typeof options.isRequested === 'function' ? options.isRequested : () => true;

  if (!Array.isArray(brani)) return [];

  const resolveExecuted = (brano) =>
    isExecuted(brano)
    || isExecutedFlag(brano?.flag)
    || isExecutedFlag(brano?.eseguito)
    || isExecutedFlag(brano?.executed);

  const groups = createTitleVisibilityGroups(brani);

  return brani.map((brano) => {
    const title = normalizeTitle(brano?.titolo || brano?.coreografia || brano?.brano || '');
    if (!title) {
      return { ...brano, displayState: 'available' };
    }

    const matches = groups.get(title) || [];
    if (matches.length <= 1) {
      return { ...brano, displayState: resolveExecuted(brano) ? 'executed' : 'available' };
    }

    if (!isRequested(brano)) {
      return { ...brano, displayState: 'available' };
    }

    const executedMatches = matches.filter((item) => resolveExecuted(item));
    if (executedMatches.length === 0) {
      return { ...brano, displayState: 'available' };
    }

    return {
      ...brano,
      displayState: resolveExecuted(brano) ? 'executed' : 'blocked',
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
