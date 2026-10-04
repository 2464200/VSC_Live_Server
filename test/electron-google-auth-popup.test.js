const test = require('node:test');
const assert = require('node:assert/strict');
const {
  isFirebaseGoogleAuthPopupUrl,
  buildFirebaseGoogleAuthPopupOptions,
  focusFirebaseGoogleAuthPopup
} = require('../electron/google-auth-popup');

test('recognizes Firebase Google popup sign-in handler URLs only', () => {
  assert.equal(
    isFirebaseGoogleAuthPopupUrl('https://my-project.firebaseapp.com/__/auth/handler?authType=signInViaPopup'),
    true
  );
  assert.equal(
    isFirebaseGoogleAuthPopupUrl('https://accounts.google.com/signin?authType=signInViaPopup'),
    true
  );
  assert.equal(isFirebaseGoogleAuthPopupUrl('about:blank'), true);
  assert.equal(
    isFirebaseGoogleAuthPopupUrl('http://localhost/__/auth/handler?authType=signInViaPopup'),
    false
  );
  assert.equal(
    isFirebaseGoogleAuthPopupUrl('https://my-project.firebaseapp.com/__/auth/handler?authType=signInViaRedirect'),
    false
  );
});

test('builds a visible standalone popup', () => {
  const parentWindow = { isDestroyed: () => false };
  const options = buildFirebaseGoogleAuthPopupOptions(
    'https://my-project.firebaseapp.com/__/auth/handler?authType=signInViaPopup',
    parentWindow
  );

  assert.equal(options.parent, undefined);
  assert.equal(options.modal, undefined);
  assert.equal(options.show, true);
  assert.equal(options.alwaysOnTop, true);
  assert.equal(options.width, 520);
  assert.equal(options.height, 700);
});

test('does not attach a popup to a destroyed parent or alter unrelated popups', () => {
  const destroyedParent = { isDestroyed: () => true };
  const options = buildFirebaseGoogleAuthPopupOptions(
    'https://my-project.firebaseapp.com/__/auth/handler?authType=signInViaPopup',
    destroyedParent
  );

  assert.equal(options.parent, undefined);
  assert.equal(options.modal, undefined);
  assert.equal(buildFirebaseGoogleAuthPopupOptions('https://example.com/', destroyedParent), null);
});

test('keeps the OAuth popup above fullscreen Electron windows and focuses it', () => {
  const calls = [];
  const popupWindow = {
    isDestroyed: () => false,
    setAlwaysOnTop: (...args) => calls.push(['alwaysOnTop', ...args]),
    show: () => calls.push(['show']),
    moveTop: () => calls.push(['moveTop']),
    focus: () => calls.push(['focus'])
  };

  assert.equal(focusFirebaseGoogleAuthPopup(popupWindow), true);
  assert.deepEqual(calls, [
    ['alwaysOnTop', true, 'screen-saver'],
    ['show'],
    ['moveTop'],
    ['focus']
  ]);
});

test('does not try to show a destroyed OAuth popup', () => {
  const popupWindow = {
    isDestroyed: () => true,
    setAlwaysOnTop() {
      assert.fail('Destroyed popup should not be modified');
    },
    show() {
      assert.fail('Destroyed popup should not be shown');
    },
    focus() {
      assert.fail('Destroyed popup should not receive focus');
    }
  };

  assert.equal(focusFirebaseGoogleAuthPopup(popupWindow), false);
});
