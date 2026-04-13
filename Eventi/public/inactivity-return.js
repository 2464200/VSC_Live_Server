(() => {
  const INACTIVITY_TIMEOUT_MS = 60000;
  let inactivityTimer = null;

  function getTargetUrl() {
    if (window.EventiNavigation && typeof window.EventiNavigation.buildEventiPageUrl === 'function') {
      return window.EventiNavigation.buildEventiPageUrl('eventi.html');
    }

    const protocol = window.location.protocol || 'http:';
    const hostname = window.location.hostname || '127.0.0.1';
    const port = window.location.port;

    if (port && port !== '5500') {
      return `${protocol}//127.0.0.1:5500/eventi/eventi.html`;
    }

    const portPart = port ? `:${port}` : '';
    return `${protocol}//${hostname}${portPart}/eventi/eventi.html`;
  }

  function isMainPage() {
    const currentPath = (window.location.pathname || '').toLowerCase();
    return currentPath.endsWith('/eventi/eventi.html') || currentPath.endsWith('/eventi.html');
  }

  function redirectToMainPage() {
    if (isMainPage()) {
      startInactivityTimer();
      return;
    }
    window.location.href = getTargetUrl();
  }

  function startInactivityTimer() {
    if (inactivityTimer) {
      window.clearTimeout(inactivityTimer);
    }
    inactivityTimer = window.setTimeout(redirectToMainPage, INACTIVITY_TIMEOUT_MS);
  }

  function bindActivityListeners() {
    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'pointerdown', 'input', 'focusin'];
    events.forEach(eventName => {
      window.addEventListener(eventName, startInactivityTimer, { passive: true });
    });
  }

  window.addEventListener('DOMContentLoaded', () => {
    bindActivityListeners();
    startInactivityTimer();
  });
})();
