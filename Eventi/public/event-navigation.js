(() => {
  const EVENTI_BASE_PATH = '/eventi/';
  const FALLBACK_HOST = '127.0.0.1';
  const INVALID_HOST_PATTERNS = ['vscode-resource', 'vscode-cdn.net'];

  function isUsableHost(hostname) {
    if (!hostname) return false;
    const normalized = hostname.toLowerCase();
    return !INVALID_HOST_PATTERNS.some(pattern => normalized.includes(pattern));
  }

  function getCanonicalHost() {
    return isUsableHost(window.location.hostname) ? window.location.hostname : FALLBACK_HOST;
  }

  function getEventiOrigin() {
    const protocol = window.location.protocol || 'http:';
    const port = window.location.port;

    if (window.location.protocol === 'file:' || (port && port !== '5500')) {
      return `http://${FALLBACK_HOST}:5500`;
    }

    return window.location.origin || `${protocol}//${getCanonicalHost()}${port ? `:${port}` : ''}`;
  }

  function buildEventiPageUrl(page) {
    const safePage = String(page || 'eventi.html').replace(/^\/+/, '');
    return `${getEventiOrigin()}${EVENTI_BASE_PATH}${safePage}`;
  }

  function goEventiPage(page) {
    window.location.href = buildEventiPageUrl(page);
  }

  window.EventiNavigation = {
    buildEventiPageUrl,
    goEventiPage
  };

  window.goEventiPage = goEventiPage;
})();
