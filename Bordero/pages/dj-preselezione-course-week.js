(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.DjPreselectionCourseWeek = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const clean = (value) => String(value ?? '').trim();
  const normalizeSeason = (value) => clean(value)
    .replace(/\s/g, '')
    .replace(/[–—]/g, '-')
    .replace(/\//g, '-');
  const normalizeTitle = (value) => clean(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('it');
  const normalizeActivity = (value) => clean(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleLowerCase('it');
  const isTeachingActivity = (record) => !['ripasso', 'nessuna coreografia inserita']
    .includes(normalizeActivity(record.activity));

  function resolveSeason(records, activeSeason) {
    const active = normalizeSeason(activeSeason);
    if (active) return active;
    const seasons = [...new Set(records.map((record) => normalizeSeason(record.season)).filter(Boolean))];
    return seasons.length === 1 ? seasons[0] : '';
  }

  function enrichTracks(tracks, records, activeSeason) {
    const sourceRecords = Array.isArray(records) ? records.filter(isTeachingActivity) : [];
    const season = resolveSeason(sourceRecords, activeSeason);
    const titleCounts = new Map();
    tracks.forEach((track) => {
      const title = normalizeTitle(track.titolo || track.coreografia || track.brano);
      if (title) titleCounts.set(title, (titleCounts.get(title) || 0) + 1);
    });

    return tracks.map((track) => {
      const id = clean(track.id);
      const title = normalizeTitle(track.titolo || track.coreografia || track.brano);
      const idMatches = sourceRecords.filter((record) => clean(record.branoId) === id && id);
      const titleMatches = !idMatches.length && title && titleCounts.get(title) === 1
        ? sourceRecords.filter((record) => !clean(record.branoId) && normalizeTitle(record.title) === title)
        : [];
      const matches = idMatches.length ? idMatches : titleMatches;
      const possibleContext = matches.filter((record) => {
        const recordSeason = normalizeSeason(record.season);
        return !recordSeason || recordSeason === season;
      });
      const missingContext = possibleContext.some((record) =>
        !normalizeSeason(record.season) || !clean(record.level)
        || (record.source !== 'manual' && !clean(record.course)));
      const weeks = season && !missingContext
        ? [...new Set(matches
          .filter((record) => normalizeSeason(record.season) === season && clean(record.level)
            && (record.source === 'manual' || clean(record.course)))
          .map((record) => Number(record.week))
          .filter((week) => Number.isInteger(week) && week >= 1 && week <= 53))]
          .sort((left, right) => left - right)
        : [];

      return {
        ...track,
        course_weeks: weeks,
        course_week: weeks.join(', '),
        course_week_sort: weeks[0] ?? null,
        course_week_details: weeks.length
          ? `${season}: ${matches
            .filter((record) => normalizeSeason(record.season) === season && weeks.includes(Number(record.week)))
            .map((record) => `${record.course || 'programma generale'} · ${record.level} · settimana ${record.week}`)
            .join('; ')}`
          : ''
      };
    });
  }

  function compare(left, right, direction = 'asc') {
    const leftWeek = Number(left.course_week_sort);
    const rightWeek = Number(right.course_week_sort);
    const leftHasWeek = Number.isInteger(leftWeek) && leftWeek >= 1;
    const rightHasWeek = Number.isInteger(rightWeek) && rightWeek >= 1;
    if (!leftHasWeek || !rightHasWeek) {
      if (leftHasWeek === rightHasWeek) return 0;
      return leftHasWeek ? -1 : 1;
    }
    const result = leftWeek - rightWeek;
    return direction === 'desc' ? -result : result;
  }

  return { enrichTracks, compare, normalizeSeason };
});
