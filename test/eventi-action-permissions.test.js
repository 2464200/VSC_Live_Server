const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const { createActionPermissionsStore } = require('../Eventi/action-permissions');

test('Eventi DJ action permissions default locked and persist independently', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'eventi-action-permissions-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const store = createActionPermissionsStore(path.join(directory, 'permissions.json'));
  assert.deepEqual(store.read(), { allowOtherDjExecute: false, allowOtherDjCancel: false });
  assert.deepEqual(store.save({ allowOtherDjExecute: true, allowOtherDjCancel: false, ignored: true }), {
    allowOtherDjExecute: true, allowOtherDjCancel: false
  });
  assert.deepEqual(store.read(), { allowOtherDjExecute: true, allowOtherDjCancel: false });
});

test('ADMIN exposes both protected permission controls and initializes them', () => {
  const html = fs.readFileSync('Eventi/public/admin.html', 'utf8');
  const dom = new JSDOM(html);
  assert.ok(dom.window.document.getElementById('allow-other-dj-execute'));
  assert.ok(dom.window.document.getElementById('allow-other-dj-cancel'));
  assert.ok(dom.window.document.getElementById('btn-save-action-permissions'));
  assert.match(html, /verifyPassword\('Modifica permessi sui brani prenotati'\)/);
  assert.match(html, /caricaPermessiAzioniDJ\(\)/);
  dom.window.close();
});
