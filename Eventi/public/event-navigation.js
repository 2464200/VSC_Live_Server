(() => {
  const EVENTI_BASE_PATH = '/eventi/';
  const FALLBACK_HOST = 'localhost';
  const INVALID_HOST_PATTERNS = ['vscode-resource', 'vscode-cdn.net'];

  if (window.location.protocol !== 'file:' && window.location.hostname === '127.0.0.1') {
    const targetPort = window.location.port || '5500';
    const targetUrl = `${window.location.protocol}//${FALLBACK_HOST}:${targetPort}${window.location.pathname}${window.location.search || ''}${window.location.hash || ''}`;
    console.warn('Host 127.0.0.1 rilevato: redirect automatico a localhost ->', targetUrl);
    window.location.replace(targetUrl);
    return;
  }

  function isUsableHost(hostname) {
    if (!hostname) return false;
    const normalized = hostname.toLowerCase();
    return !INVALID_HOST_PATTERNS.some(pattern => normalized.includes(pattern));
  }

  function getCanonicalHost() {
    const host = (window.location.hostname || '').toLowerCase();
    if (host === '127.0.0.1') {
      return FALLBACK_HOST;
    }
    return isUsableHost(window.location.hostname) ? window.location.hostname : FALLBACK_HOST;
  }

  function getEventiOrigin() {
    const protocol = window.location.protocol || 'http:';
    const port = window.location.port;
    const canonicalHost = getCanonicalHost();

    if (window.location.protocol === 'file:' || (port && port !== '5500')) {
      return `http://${FALLBACK_HOST}:5500`;
    }

    const canonicalPort = port ? `:${port}` : '';
    return `${protocol}//${canonicalHost}${canonicalPort}`;
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
