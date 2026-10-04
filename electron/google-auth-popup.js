'use strict';

function isFirebaseGoogleAuthPopupUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:'
      && /\/__\/auth\/handler\/?$/.test(url.pathname)
      && /^(?:signIn|link|reauthenticate)ViaPopup$/.test(url.searchParams.get('authType') || '');
  } catch {
    return false;
  }
}

function buildFirebaseGoogleAuthPopupOptions(url, parentWindow) {
  if (!isFirebaseGoogleAuthPopupUrl(url)) {
    return null;
  }

  const options = {
    width: 520,
    height: 700,
    minWidth: 420,
    minHeight: 560,
    center: true,
    show: true,
    alwaysOnTop: true,
    autoHideMenuBar: true,
    title: 'Accedi con Google - Borderò'
  };

  if (parentWindow && !parentWindow.isDestroyed()) {
    options.parent = parentWindow;
    options.modal = true;
  }

  return options;
}

module.exports = {
  isFirebaseGoogleAuthPopupUrl,
  buildFirebaseGoogleAuthPopupOptions
};
