(function (global) {
  const videoOnlyTitles = new Set([
    'audio video tester',
    'video promo monster 2023',
  ]);
  const videoOnlyIds = new Set(['596', '597']);

  function normalizeVideoOnlyTitle(value) {
    return String(value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .replace(/\s+/g, ' ')
      .toLowerCase();
  }

  function isVideoOnlyBrano(branoOrTitle) {
    if (branoOrTitle && typeof branoOrTitle === 'object') {
      const id = String(branoOrTitle.id ?? '').trim();
      if (/^\d+$/.test(id) && videoOnlyIds.has(id.replace(/^0+(?=\d)/, ''))) {
        return true;
      }
    }

    const title = branoOrTitle && typeof branoOrTitle === 'object'
      ? branoOrTitle.titolo || branoOrTitle.coreografia || branoOrTitle.brano || branoOrTitle.title || ''
      : branoOrTitle;

    return videoOnlyTitles.has(normalizeVideoOnlyTitle(title));
  }

  global.isVideoOnlyBrano = isVideoOnlyBrano;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { isVideoOnlyBrano, normalizeVideoOnlyTitle };
  }
})(typeof window !== 'undefined' ? window : globalThis);