(function() {
  const STATE_ORDER = ['disponibile', 'prenotato', 'eseguito'];
  const TITLE_SORT_OPTIONS = { sensitivity: 'base', numeric: true };

  function normalizeState(stato) {
    if (stato === true || stato === 'true' || stato === 'eseguito') return 'eseguito';
    if (stato === 'prenotato') return 'prenotato';
    if (stato === false || stato === 'false' || stato === 'disponibile') return 'disponibile';
    return 'disponibile';
  }

  function buildLastStateMap(log) {
    const byId = new Map();
    (log || []).forEach(entry => {
      const previous = byId.get(entry.id);
      const current = { ...entry, stato: normalizeState(entry.stato) };
      if (!previous || new Date(entry.timestamp || 0) > new Date(previous.timestamp || 0)) {
        byId.set(entry.id, current);
      }
    });
    return byId;
  }

  function decorateBrani(brani, lastMap) {
    return (brani || []).map(brano => {
      const last = lastMap.get(brano.id) || {};
      return {
        ...brano,
        stato: normalizeState(last.stato),
        timestamp: last.timestamp || null,
        dj: last.dj || null
      };
    });
  }

  function compareTitles(a, b) {
    return (a?.titolo || '').trim().localeCompare((b?.titolo || '').trim(), 'it', TITLE_SORT_OPTIONS);
  }

  function filterBrani(brani, filtro) {
    const data = (brani || []).slice();
    if (filtro === 'spuntati') {
      return data
        .filter(item => item.stato === 'eseguito')
        .sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
    }
    if (filtro === 'non-spuntati') {
      return data
        .filter(item => item.stato === 'disponibile')
        .sort(compareTitles);
    }
    if (filtro === 'prenotati') {
      return data
        .filter(item => item.stato === 'prenotato')
        .sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
    }
    if (filtro === 'disponibili') {
      return data
        .filter(item => item.stato === 'disponibile')
        .sort(compareTitles);
    }
    return data.sort((a, b) => {
      const stateDiff = STATE_ORDER.indexOf(a.stato) - STATE_ORDER.indexOf(b.stato);
      if (stateDiff !== 0) return stateDiff;
      return compareTitles(a, b);
    });
  }

  function summarizeBrani(brani) {
    return (brani || []).reduce((acc, item) => {
      acc.totale += 1;
      acc[item.stato] += 1;
      return acc;
    }, { totale: 0, disponibile: 0, prenotato: 0, eseguito: 0 });
  }

  function getLastUpdateLabel(log) {
    if (!Array.isArray(log) || log.length === 0) return '--';
    const timestamp = log.reduce((max, entry) => {
      const value = new Date(entry.timestamp || 0).getTime();
      return value > max ? value : max;
    }, 0);
    return timestamp ? new Date(timestamp).toLocaleString('it-IT') : '--';
  }

  function searchBrani(brani, query) {
    const normalizedQuery = (query || '').trim().toLowerCase();
    if (!normalizedQuery) return brani;
    return (brani || []).filter(item => {
      const haystack = `${item.titolo || ''} ${item.id || ''} ${item.dj || ''}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }

  function shouldRefresh() {
    return !document.hidden;
  }

  window.EventiState = {
    normalizeState,
    buildLastStateMap,
    decorateBrani,
    filterBrani,
    summarizeBrani,
    getLastUpdateLabel,
    searchBrani,
    shouldRefresh
  };
})();
