const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

test('print headings align with data and empty rows for every optional/event column combination', {
  timeout: 90000,
  skip: process.platform !== 'win32' && !process.env.DISPLAY && !process.env.WAYLAND_DISPLAY
    ? 'Electron layout checks need a graphical session' : false
}, () => {
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  const result = spawnSync(require('electron'), [path.resolve(__dirname, '../scripts/check-print-layout.cjs')], {
    cwd: path.resolve(__dirname, '..'), env, windowsHide: true, encoding: 'utf8', timeout: 85000
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const report = JSON.parse(result.stdout.trim().split(/\r?\n/).at(-1));
  assert.equal(report.configurations, 192);
  assert.equal(report.failures, 0);
});
