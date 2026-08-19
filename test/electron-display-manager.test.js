const test = require('node:test');
const assert = require('node:assert/strict');
const { pickDisplayTargets, resolveDisplayTargetsForWindows, buildDisplayLayoutConfig } = require('../electron/display-manager');

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

test('buildDisplayLayoutConfig uses the actual monitor size and DPI-aware zoom', () => {
  const display = {
    id: 20,
    isPrimary: false,
    bounds: { x: 2560, y: 0, width: 2560, height: 1440 },
    scaleFactor: 1.25
  };

  const layout = buildDisplayLayoutConfig(display, { width: 1280, height: 720, fullscreen: true });

  assert.equal(layout.width, 2560);
  assert.equal(layout.height, 1440);
  assert.equal(layout.zoomFactor, 0.8);
  assert.equal(layout.scaleFactor, 1.25);
});
