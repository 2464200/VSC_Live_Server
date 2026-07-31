(function () {
  function getBasePath() {
    const pathname = window.location.pathname || '/';
    const normalized = pathname.replace(/\\/g, '/');
    const withTrailingSlash = normalized.endsWith('/') ? normalized : normalized + '/';
    const parts = withTrailingSlash.split('/').filter(Boolean);

    const knownRoots = ['public', 'Bordero', 'Eventi', 'Prova', 'Playlist-country', 'pdf'];
    const rootIndex = parts.findIndex((segment) => knownRoots.includes(segment));

    if (rootIndex > 0) {
      return '/' + parts.slice(0, rootIndex).join('/') + '/';
    }

    const lastSegment = parts[parts.length - 1] || '';
    const looksLikeFile = /\.[a-z0-9]+$/i.test(lastSegment);
    if (looksLikeFile && parts.length > 1) {
      return '/' + parts.slice(0, -1).join('/') + '/';
    }

    return withTrailingSlash.startsWith('/') ? withTrailingSlash : '/' + withTrailingSlash;
  }

  function splitUrl(url) {
    const hashIndex = url.indexOf('#');
    const hash = hashIndex >= 0 ? url.slice(hashIndex) : '';
    const withoutHash = hashIndex >= 0 ? url.slice(0, hashIndex) : url;
    const queryIndex = withoutHash.indexOf('?');
    const query = queryIndex >= 0 ? withoutHash.slice(queryIndex) : '';
    const path = queryIndex >= 0 ? withoutHash.slice(0, queryIndex) : withoutHash;
    return { path, query, hash };
  }

  const basePath = getBasePath();
  window.__APP_BASE_PATH__ = basePath;

  window.resolveAppUrl = function resolveAppUrl(input) {
    if (typeof input !== 'string' || !input) {
      return input;
    }

    if (/^(?:[a-z]+:)?\/\//i.test(input) || /^(?:mailto|tel|data|javascript):/i.test(input) || input.startsWith('#')) {
      return input;
    }

    const { path, query, hash } = splitUrl(input);
    if (!path) {
      return input;
    }

    if (path.startsWith('/')) {
      const cleanBase = basePath === '/' ? '/' : basePath.replace(/\/+$/, '/') + '';
      const cleanPath = path.replace(/^\/+/, '');
      return cleanBase + cleanPath + query + hash;
    }

    return input;
  };

  function rewriteElementUrls(root) {
    const elements = root.querySelectorAll('[src],[href]');
    elements.forEach((element) => {
      ['src', 'href'].forEach((attr) => {
        const value = element.getAttribute(attr);
        if (!value) {
          return;
        }
        const resolved = window.resolveAppUrl(value);
        if (resolved !== value) {
          element.setAttribute(attr, resolved);
        }
      });
    });
  }

  const originalFetch = window.fetch.bind(window);
  window.fetch = function patchedFetch(input, init) {
    if (typeof input === 'string') {
      return originalFetch(window.resolveAppUrl(input), init);
    }

    if (input instanceof Request) {
      const originalUrl = input.url;
      const resolvedUrl = window.resolveAppUrl(originalUrl);
      if (resolvedUrl !== originalUrl) {
        const request = new Request(resolvedUrl, input);
        return originalFetch(request, init);
      }
    }

    return originalFetch(input, init);
  };

  function apply() {
    rewriteElementUrls(document);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', apply, { once: true });
  } else {
    apply();
  }

  const observer = new MutationObserver(() => apply());
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
