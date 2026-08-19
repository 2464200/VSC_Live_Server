const path = require('path');

function normalizeWindowsPath(value = '') {
  const trimmed = String(value || '').trim();
  if (!trimmed) {
    return '';
  }

  const sanitized = trimmed.replace(/^"|"$/g, '');
  if (!sanitized) {
    return '';
  }

  const withBackslashes = sanitized.replace(/[\/]+/g, '\\');
  if (/^[A-Za-z]:\\?$/.test(withBackslashes)) {
    return `${withBackslashes[0].toUpperCase()}:\\`;
  }

  const normalized = withBackslashes.replace(/[\\]+$/, '');
  return normalized.replace(/\//g, '\\') || '';
}

function getWindowsDriveRoots(paths = []) {
  const roots = new Set();
  for (const candidate of Array.isArray(paths) ? paths : []) {
    const normalized = normalizeWindowsPath(candidate);
    if (!normalized) {
      continue;
    }

    const driveMatch = normalized.match(/^([A-Za-z]:)/);
    if (driveMatch) {
      roots.add(`${driveMatch[1]}\\`);
    }
  }

  return Array.from(roots).sort((left, right) => left.localeCompare(right));
}

function getParentWindowsPath(currentPath = '') {
  const normalized = normalizeWindowsPath(currentPath);
  if (!normalized) {
    return '';
  }

  if (/^[A-Za-z]:\\$/.test(normalized)) {
    return normalized;
  }

  const parsed = path.win32.parse(normalized);
  if (parsed.dir && parsed.dir !== parsed.root) {
    return parsed.dir;
  }

  const driveMatch = normalized.match(/^([A-Za-z]:)/);
  if (driveMatch) {
    return `${driveMatch[1]}\\`;
  }

  return '';
}

module.exports = {
  normalizeWindowsPath,
  getWindowsDriveRoots,
  getParentWindowsPath
};
