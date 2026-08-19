const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeWindowsPath, getWindowsDriveRoots, getParentWindowsPath } = require('../electron/path-picker');

test('normalizeWindowsPath trims whitespace and removes trailing separators', () => {
  assert.equal(normalizeWindowsPath('  C:\\Users\\Luca\\  '), 'C:\\Users\\Luca');
  assert.equal(normalizeWindowsPath('D:/Music/Archive/'), 'D:\\Music\\Archive');
});

test('getWindowsDriveRoots returns a stable set of drive roots', () => {
  const roots = getWindowsDriveRoots(['D:\\', 'C:\\', 'E:\\']);
  assert.deepEqual(roots, ['C:\\', 'D:\\', 'E:\\']);
});

test('getParentWindowsPath moves to the parent folder', () => {
  assert.equal(getParentWindowsPath('C:\\Users\\Luca'), 'C:\\Users');
  assert.equal(getParentWindowsPath('C:\\'), 'C:\\');
});
