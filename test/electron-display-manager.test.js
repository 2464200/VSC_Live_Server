const test = require('node:test');
const assert = require('node:assert/strict');
const { pickDisplayTargets, resolveDisplayTargetsForWindows } = require('../electron/display-manager');

test('pickDisplayTargets chooses the primary display and a secondary one', () => {
  const displays = [
    { id: 1, isPrimary: true, bounds: { x: 0, y: 0, width: 1920, height: 1080 } },
    { id: 2, isPrimary: false, bounds: { x: 1920, y: 0, width: 1920, height: 1080 } }
  ];

  const result = pickDisplayTargets(displays);

  assert.equal(result.primary.id, 1);
  assert.equal(result.secondary.id, 2);
});

test('pickDisplayTargets falls back to the primary display when no secondary display exists', () => {
  const displays = [
    { id: 1, isPrimary: true, bounds: { x: 0, y: 0, width: 1920, height: 1080 } }
  ];

  const result = pickDisplayTargets(displays);

  assert.equal(result.primary.id, 1);
  assert.equal(result.secondary.id, 1);
});

test('resolveDisplayTargetsForWindows swaps displays when requested', () => {
  const displays = [
    { id: 10, isPrimary: true, bounds: { x: 0, y: 0, width: 1920, height: 1080 } },
    { id: 20, isPrimary: false, bounds: { x: 1920, y: 0, width: 1920, height: 1080 } }
  ];

  const normal = resolveDisplayTargetsForWindows(displays, { swapPrimarySecondary: false });
  const swapped = resolveDisplayTargetsForWindows(displays, { swapPrimarySecondary: true });

  assert.equal(normal.mainDisplay.id, 10);
  assert.equal(normal.monitorDisplay.id, 20);
  assert.equal(swapped.mainDisplay.id, 20);
  assert.equal(swapped.monitorDisplay.id, 10);
});
