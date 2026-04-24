(() => {
  if (window.location.protocol === 'file:') return;

  const canonicalHost = window.location.hostname || 'localhost';
  const currentPath = window.location.pathname || '';
  const protocol = window.location.protocol || 'http:';
  const currentPort = window.location.port ? `:${window.location.port}` : '';
  const currentOrigin = `${protocol}//${canonicalHost}${currentPort}`;
  const legacyPrefix = '/Eventi/public/';

  if (currentPath.startsWith(legacyPrefix)) {
    const page = currentPath.substring(legacyPrefix.length);
    const target = `${currentOrigin}/eventi/${page}${window.location.search || ''}${window.location.hash || ''}`;
    console.log('Redirect verso percorso canonico Eventi:', target);
    window.location.replace(target);
  }
})();

const EVENTI_API_CANDIDATES = (() => {
  const protocol = window.location.protocol === 'file:' ? 'http:' : window.location.protocol || 'http:';
  const host = window.location.hostname || 'localhost';
  const currentPort = window.location.port || '';
  const currentOrigin = window.location.protocol === 'file:' ? null : `${protocol}//${host}${currentPort ? `:${currentPort}` : ''}`;
  const bases = [];

  function pushBase(base) {
    if (base && !bases.includes(base)) {
      bases.push(base);
    }
  }

  const canonicalPort = '5500';
  const isCurrentOriginCanonical = currentPort === canonicalPort;

  // Prefer the current origin only when it already uses the canonical project port.
  if (currentOrigin && isCurrentOriginCanonical) {
    pushBase(`${currentOrigin}/eventi/api`);
  }

  if (window.location.protocol !== 'file:' && !currentPort) {
    pushBase(`${protocol}//${host}/eventi/api`);
  }

  pushBase(`${protocol}//${host}:5500/eventi/api`);
  if (host !== 'localhost') {
    pushBase(`${protocol}//localhost:5500/eventi/api`);
  }
  if (host !== '127.0.0.1') {
    pushBase(`${protocol}//127.0.0.1:5500/eventi/api`);
  }

  return bases;
})();

let resolvedEventiApiBase = null;

function buildApiUrl(base, path) {
  return `${base}${path}`;
}

async function resolveEventiApiBase() {
  if (resolvedEventiApiBase) {
    return resolvedEventiApiBase;
  }

  for (const base of EVENTI_API_CANDIDATES) {
    try {
      const res = await fetch(buildApiUrl(base, `/ping?ts=${Date.now()}`), {
        method: 'GET',
        cache: 'no-store'
      });
      if (res.ok) {
        resolvedEventiApiBase = base;
        console.log('Eventi API base risolta:', base);
        return resolvedEventiApiBase;
      }
    } catch (err) {
      console.warn('Eventi API non raggiungibile su', base, err.message);
    }
  }

  resolvedEventiApiBase = EVENTI_API_CANDIDATES[0];
  return resolvedEventiApiBase;
}

async function apiUrl(path) {
  const base = await resolveEventiApiBase();
  return buildApiUrl(base, path);
}

async function tryEventiRequest(path, options = {}) {
  const candidates = resolvedEventiApiBase
    ? [resolvedEventiApiBase, ...EVENTI_API_CANDIDATES.filter(base => base !== resolvedEventiApiBase)]
    : EVENTI_API_CANDIDATES.slice();

  let lastError = null;

  for (const base of candidates) {
    const url = buildApiUrl(base, path);
    try {
      const response = await fetch(url, {
        cache: 'no-store',
        ...options
      });

      if (response.ok) {
        resolvedEventiApiBase = base;
        return { response, url };
      }

      lastError = new Error(`HTTP ${response.status} per ${url}`);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error('Eventi API non raggiungibile');
}

async function fetchJSON(pathOrUrl) {
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
    const res = await fetch(pathOrUrl, { cache: 'no-store' });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status} per ${pathOrUrl}${text ? ': ' + text : ''}`);
    }
    return res.json();
  }

  const { response, url } = await tryEventiRequest(pathOrUrl);
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`HTTP ${response.status} per ${url}${text ? ': ' + text : ''}`);
  }
  return response.json();
}

async function eventiFetch(path, options = {}) {
  const { response } = await tryEventiRequest(path, options);
  return response;
}

async function checkServerOnline() {
  try {
    const { response } = await tryEventiRequest('/ping');
    return response.ok;
  } catch (err) {
    return false;
  }
}

function showListaMessage(containerOrId, message, isError = false) {
  let container = containerOrId;

  if (typeof containerOrId === 'string') {
    container = document.getElementById(containerOrId);
  }

  if (!container) {
    console.warn('Container non trovato per showListaMessage:', containerOrId, message);
    return;
  }

  container.innerHTML = `<div class="lista-empty ${isError ? 'error' : ''}">${message}</div>`;
  console.log('Lista message:', message, 'isError:', isError);
}
