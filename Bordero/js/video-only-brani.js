(function (global) {
  const videoOnlyTitles = new Set([
    'audio video tester',
    'video promo monster 2023',
  ]);

  function normalizeVideoOnlyTitle(value) {
    return String(value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .replace(/\s+/g, ' ')
      .toLowerCase();
  }

  function isVideoOnlyBrano(branoOrTitle) {
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