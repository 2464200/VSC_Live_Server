(() => {
  /**
   * Costruisce un URL valido per la navigazione del modulo Eventi
   * mantenendo host, porta, protocollo e percorso correnti.
   */
  function buildEventiPageUrl(page) {
    const rawTarget = String(page || 'eventi.html').trim();
    if (!rawTarget) return 'eventi.html';

    const isFileProtocol = window.location.protocol === 'file:';

    // Se la destinazione è un percorso assoluto (es. /Bordero/pages/bordero.html)
    if (rawTarget.startsWith('/')) {
      if (isFileProtocol) {
        if (rawTarget.toLowerCase().startsWith('/bordero/')) {
          return '../../' + rawTarget.replace(/^\/+/, '');
        }
        return rawTarget.replace(/^\/+/, '');
      }
      return `${window.location.origin}${rawTarget}`;
    }

    // Modalità file:// -> navigazione relativa diretta
    if (isFileProtocol) {
      return rawTarget;
    }

    // Modalità http / https
    const origin = window.location.origin || `${window.location.protocol}//${window.location.host}`;
    const pathname = window.location.pathname || '';

    let basePath = '/eventi/';
    if (pathname.includes('/Eventi/public/')) {
      basePath = '/Eventi/public/';
    } else if (pathname.includes('/public/')) {
      const idx = pathname.indexOf('/public/');
      basePath = pathname.substring(0, idx + 8);
    } else if (pathname.startsWith('/eventi/')) {
      basePath = '/eventi/';
    }

    const cleanPage = rawTarget.replace(/^\/+/, '');
    return `${origin}${basePath}${cleanPage}`;
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
