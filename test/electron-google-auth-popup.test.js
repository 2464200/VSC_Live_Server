const test = require('node:test');
const assert = require('node:assert/strict');
const {
  isFirebaseGoogleAuthPopupUrl,
  buildFirebaseGoogleAuthPopupOptions
} = require('../electron/google-auth-popup');

test('recognizes Firebase Google popup sign-in handler URLs only', () => {
  assert.equal(
    isFirebaseGoogleAuthPopupUrl('https://my-project.firebaseapp.com/__/auth/handler?authType=signInViaPopup'),
    true
  );
  assert.equal(
    isFirebaseGoogleAuthPopupUrl('https://accounts.google.com/signin?authType=signInViaPopup'),
    false
  );
  assert.equal(
    isFirebaseGoogleAuthPopupUrl('http://localhost/__/auth/handler?authType=signInViaPopup'),
    false
  );
  assert.equal(
    isFirebaseGoogleAuthPopupUrl('https://my-project.firebaseapp.com/__/auth/handler?authType=signInViaRedirect'),
    false
  );
});

test('builds a visible modal popup parented to the Bordero Electron window', () => {
  const parentWindow = { isDestroyed: () => false };
  const options = buildFirebaseGoogleAuthPopupOptions(
    'https://my-project.firebaseapp.com/__/auth/handler?authType=signInViaPopup',
    parentWindow
  );

  assert.equal(options.parent, parentWindow);
  assert.equal(options.modal, true);
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
