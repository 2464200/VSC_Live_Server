'use strict';

function isFirebaseGoogleAuthPopupUrl(value) {
  try {
    if (value === 'about:blank') {
      return true;
    }
    const url = new URL(value);
    if (url.protocol !== 'https:') {
      return false;
    }
    if (/^(?:accounts\.google\.com|accounts\.youtube\.com)$/.test(url.hostname)) {
      return true;
    }
    return /\/__\/auth\/handler\/?$/.test(url.pathname)
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

  // Un popup figlio di una finestra fullscreen viene nascosto da Windows: resta indipendente.
  return options;
}

function focusFirebaseGoogleAuthPopup(popupWindow) {
  if (popupWindow.isDestroyed()) {
    return false;
  }

  popupWindow.setAlwaysOnTop(true, 'screen-saver');
  popupWindow.show();
  popupWindow.moveTop();
  popupWindow.focus();
  return true;
}

module.exports = {
  isFirebaseGoogleAuthPopupUrl,
  buildFirebaseGoogleAuthPopupOptions,
  focusFirebaseGoogleAuthPopup
};
