(function () {
  if (window.machineUiTheme) return;
  const native = window.electronAPI?.uiPreferences;
  const local = ['http:', 'https:'].includes(window.location.protocol)
    && ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname);
  const page = window.location.pathname.toLowerCase();
  // Native window identity takes precedence over paths: several pages belong to both monitors.
  const browserRole = window.name === 'bordero-display-secondary'
    || /\/bordero\/pages\/(display|video-player)\.html$/.test(page)
    || page.startsWith('/led-display/') ? 'secondary' : 'primary';
  let current = { primaryTheme: 'night', windowRole: native ? 'unknown' : browserRole };
  let refreshPending = null;

  function isDedicatedSecondaryPresentation() {
    const query = new URLSearchParams(window.location.search);
    return /\/bordero\/pages\/(display|video-player)\.html$/.test(page)
      || /\/pdf\/viewers\/pdf-viewer\.html$/.test(page)
      || page.startsWith('/led-display/')
      || page.startsWith('/leddisplay/server/static/')
      || (page.endsWith('/userform/pages/servizio.html') && query.get('mode') === 'display')
      || (page.endsWith('/userform/pages/qrcode.html') && query.get('display') === 'secondary');
  }

  function applyMonitorWidth(role) {
    const layoutRole = role === 'primary' || (role === 'secondary' && !isDedicatedSecondaryPresentation())
      ? role : '';
    if (!layoutRole) {
      document.documentElement.removeAttribute('data-monitor-role');
      return;
    }
    if (!document.getElementById('primary-monitor-layout-css')) {
      const link = document.createElement('link');
      link.id = 'primary-monitor-layout-css';
      link.rel = 'stylesheet';
      link.href = '/Bordero/assets/css/primary-monitor-layout.css';
      document.head.appendChild(link);
    }
    document.documentElement.setAttribute('data-monitor-role', layoutRole);
  }

  function apply(preferences) {
    current = {
      primaryTheme: preferences.primaryTheme === 'day' ? 'day' : 'night',
      windowRole: native ? preferences.windowRole : browserRole
    };
    applyMonitorWidth(current.windowRole);
    if (current.windowRole === 'primary' && current.primaryTheme === 'day') {
      if (!document.getElementById('machine-ui-theme-css')) {
        const link = document.createElement('link');
        link.id = 'machine-ui-theme-css';
        link.rel = 'stylesheet';
        link.href = '/Bordero/assets/css/machine-ui-theme.css';
        document.head.appendChild(link);
      }
      document.documentElement.setAttribute('data-primary-theme', 'day');
    } else {
      document.documentElement.removeAttribute('data-primary-theme');
    }
    window.dispatchEvent(new CustomEvent('bordero:primary-theme-changed', { detail: { ...current } }));
    return { ...current };
  }

  async function request(method, primaryTheme) {
    let result;
    if (native) {
      result = await (method === 'POST' ? native.set({ primaryTheme }) : native.get());
    } else {
      if (!local) throw new Error('Impostazione disponibile nell’app locale di questa macchina.');
      const response = await fetch('/api/local-ui/preferences', {
        method, cache: 'no-store',
        ...(method === 'POST' ? {
          headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ primaryTheme })
        } : {})
      });
      result = await response.json();
      if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
    }
    if (!result?.ok) throw new Error(result?.error || 'Impostazione non disponibile.');
    return apply(result);
  }

  function refresh() {
    if (!refreshPending) refreshPending = request('GET').finally(() => { refreshPending = null; });
    return refreshPending;
  }

  window.machineUiTheme = {
    refresh,
    getCurrent: () => ({ ...current }),
    setTheme: (theme) => request('POST', theme)
  };
  native?.onChanged?.(apply);
  if (!native && local) applyMonitorWidth(browserRole);
  if (native || local) {
    const quietlyRefresh = () => refresh().catch(() => {});
    quietlyRefresh();
    window.addEventListener('focus', quietlyRefresh);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) quietlyRefresh();
    });
    // Also picks up settings saved by ADMIN in another browser on this same PC.
    window.setInterval(() => { if (!document.hidden) quietlyRefresh(); }, 5000);
  }
})();
