function normalizeTextForMatch(value = '') {
  let text = String(value || '').trim();
  if (!text) return '';

  try {
    text = text.normalize('NFD').replace(/\p{Diacritic}/gu, '');
  } catch (_) {
    text = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  return text
    .toLowerCase()
    .replace(/&/g, ' e ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenizeTextForMatch(normalizedText = '') {
  return String(normalizedText || '')
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
}

function extractNumericPrefix(name = '') {
  const match = String(name || '').match(/^(\d{3})[\s_-]+/);
  return match ? match[1] : '';
}

function getBranoMatchProfile(brano = {}) {
  const idDigits = String(brano?.id || '').replace(/\D+/g, '');
  const idPrefix = idDigits ? idDigits.padStart(3, '0') : '';

  const rawNames = [
    brano?.titolo,
    brano?.coreografia,
    brano?.brano,
    brano?.song,
    brano?.canzone
  ].map((value) => String(value || '').trim()).filter(Boolean);

  const normalizedNames = [...new Set(rawNames
    .map((value) => normalizeTextForMatch(value))
    .filter((value) => value.length >= 3))];

  const tokenSet = new Set();
  normalizedNames.forEach((name) => {
    tokenizeTextForMatch(name).forEach((token) => tokenSet.add(token));
  });

  return {
    idPrefix,
    normalizedNames,
    tokens: [...tokenSet]
  };
}

function scoreMusicCandidate(profile, candidate) {
  let score = 0;

  const filePrefix = extractNumericPrefix(candidate.baseName || '');
  if (profile.idPrefix && filePrefix && profile.idPrefix === filePrefix) {
    score += 1000;
  }

  if (profile.normalizedNames.includes(candidate.normalizedName)) {
    score += 450;
  }

  const includesName = profile.normalizedNames.some((name) =>
    candidate.normalizedName.includes(name) || name.includes(candidate.normalizedName)
  );
  if (includesName) {
    score += 130;
  }

  if (profile.tokens.length > 0 && candidate.tokens.length > 0) {
    const shared = candidate.tokens.filter((token) => profile.tokens.includes(token)).length;
    const ratio = shared / Math.max(profile.tokens.length, candidate.tokens.length);
    score += Math.round(ratio * 120);
  }

  return score;
}

function resolveMusicArchiveMatch(profile, candidates, options = {}) {
  const minScore = Number(options.minScore ?? 160);
  const ambiguityGap = Number(options.ambiguityGap ?? 70);

  const scored = (Array.isArray(candidates) ? candidates : [])
    .map((candidate) => ({
      ...candidate,
      score: scoreMusicCandidate(profile, candidate)
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0 || scored[0].score < minScore) {
    return { status: 'not_found', match: null, candidates: [] };
  }

  const top = scored[0];
  const second = scored[1];
  const ambiguous = Boolean(second) && (top.score - second.score) < ambiguityGap;

  return {
    status: ambiguous ? 'ambiguous' : 'exact',
    match: ambiguous ? null : top,
    candidates: scored.slice(0, 7)
  };
}

module.exports = {
  normalizeTextForMatch,
  tokenizeTextForMatch,
  extractNumericPrefix,
  getBranoMatchProfile,
  scoreMusicCandidate,
  resolveMusicArchiveMatch
};
