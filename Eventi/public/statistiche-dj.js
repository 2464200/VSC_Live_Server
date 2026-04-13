const djStatsState = {
  allStats: [],
  visibleStats: [],
  log: [],
  query: '',
  refreshTimer: null
};

function normalizeDjName(name) {
  return (name || '').trim() || 'Senza DJ';
}

function buildDjStats(brani, log) {
  const decorated = EventiState.decorateBrani(brani, EventiState.buildLastStateMap(log));
  const eseguiti = decorated.filter(item => item.stato === 'eseguito');
  const grouped = new Map();

  eseguiti.forEach(item => {
    const djName = normalizeDjName(item.dj);
    if (!grouped.has(djName)) {
      grouped.set(djName, {
        dj: djName,
        count: 0,
        lastTimestamp: null,
        titles: []
      });
    }

    const entry = grouped.get(djName);
    entry.count += 1;
    entry.titles.push({
      titolo: item.titolo || item.id,
      id: item.id,
      timestamp: item.timestamp || null
    });

    if (!entry.lastTimestamp || new Date(item.timestamp || 0) > new Date(entry.lastTimestamp || 0)) {
      entry.lastTimestamp = item.timestamp || null;
    }
  });

  return Array.from(grouped.values())
    .map(entry => ({
      ...entry,
      titles: entry.titles.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0))
    }))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      const timeDiff = new Date(b.lastTimestamp || 0) - new Date(a.lastTimestamp || 0);
      if (timeDiff !== 0) return timeDiff;
      return a.dj.localeCompare(b.dj, 'it');
    });
}

function renderSummaryCards(stats) {
  const container = document.getElementById('summary-cards');
  if (!container) return;

  const totalEseguiti = stats.reduce((sum, item) => sum + item.count, 0);
  const totalDj = stats.length;
  const topDj = stats[0];
  const media = totalDj ? (totalEseguiti / totalDj).toFixed(2) : '0.00';

  container.innerHTML = `
    <div class="summary-card is-primary"><div class="summary-label">DJ Con Eseguiti</div><div class="summary-value">${totalDj}</div></div>
    <div class="summary-card is-success"><div class="summary-label">Brani Eseguiti</div><div class="summary-value">${totalEseguiti}</div></div>
    <div class="summary-card is-accent"><div class="summary-label">Top DJ</div><div class="summary-value">${topDj ? topDj.dj : '--'}</div></div>
    <div class="summary-card"><div class="summary-label">Media Per DJ</div><div class="summary-value">${media}</div></div>
  `;
}

function updateStatusInfo() {
  const badge = document.getElementById('last-update');
  if (badge) {
    badge.textContent = `Ultimo aggiornamento: ${EventiState.getLastUpdateLabel(djStatsState.log)}`;
  }
  renderSummaryCards(djStatsState.allStats);
}

function renderDjStats(stats) {
  const container = document.getElementById('dj-stats-list');
  if (!container) return;

  container.innerHTML = '';

  if (!stats || stats.length === 0) {
    showListaMessage(
      container,
      djStatsState.query
        ? 'Nessun DJ corrisponde alla ricerca corrente.'
        : 'Nessun brano risulta attualmente eseguito da un DJ.'
    );
    return;
  }

  stats.forEach((entry, index) => {
    const row = document.createElement('div');
    row.className = 'dj-stat-row';
    const preview = entry.titles.slice(0, 3)
      .map(item => `${item.titolo} (${item.id})`)
      .join(' • ');

    row.innerHTML = `
      <div class="dj-stat-rank">#${index + 1}</div>
      <div class="dj-stat-main">
        <div class="dj-stat-name">${entry.dj}</div>
        <div class="dj-stat-meta">${entry.count === 1 ? '1 brano eseguito' : `${entry.count} brani eseguiti`}</div>
      </div>
      <div class="dj-stat-count">
        ${entry.count}
        <span class="dj-stat-label">Eseguiti</span>
      </div>
      <div class="dj-stat-last">
        <strong>Ultima esecuzione</strong>
        ${entry.lastTimestamp ? new Date(entry.lastTimestamp).toLocaleString('it-IT') : '--'}
      </div>
      <div class="dj-stat-preview">
        <strong>Brani recenti</strong>
        ${preview || '--'}
      </div>
    `;

    container.appendChild(row);
  });
}

function applySearchAndRender() {
  const query = (djStatsState.query || '').trim().toLowerCase();
  djStatsState.visibleStats = !query
    ? djStatsState.allStats
    : djStatsState.allStats.filter(entry => {
        const titles = entry.titles.map(item => `${item.titolo} ${item.id}`).join(' ');
        const haystack = `${entry.dj} ${titles}`.toLowerCase();
        return haystack.includes(query);
      });

  renderDjStats(djStatsState.visibleStats);
}

async function refreshDjStats() {
  const [brani, log] = await Promise.all([
    fetchJSON(`/brani?ts=${Date.now()}`),
    fetchJSON(`/log?ts=${Date.now()}`)
  ]);

  if (!Array.isArray(brani) || !Array.isArray(log)) {
    throw new Error('Dati API non validi');
  }

  djStatsState.log = log;
  djStatsState.allStats = buildDjStats(brani, log);
  updateStatusInfo();
  applySearchAndRender();
}

function bindSearch() {
  const input = document.getElementById('search-input');
  if (!input) return;
  input.addEventListener('input', () => {
    djStatsState.query = input.value;
    applySearchAndRender();
  });
}

function startPolling() {
  if (djStatsState.refreshTimer) clearInterval(djStatsState.refreshTimer);
  djStatsState.refreshTimer = setInterval(async () => {
    if (!EventiState.shouldRefresh()) return;
    try {
      await refreshDjStats();
    } catch (error) {
      console.error('Errore autorefresh statistiche DJ:', error);
    }
  }, 15000);
}

async function initDjStatsPage() {
  showListaMessage('dj-stats-list', 'Caricamento statistiche DJ...');

  const serverOnline = await checkServerOnline();
  if (!serverOnline) {
    showListaMessage('dj-stats-list', 'Server Eventi non raggiungibile. Verifica che l’applicazione sia servita dall’indirizzo corretto e apri la diagnostica Eventi in rete.', true);
    return;
  }

  try {
    bindSearch();
    await refreshDjStats();
    startPolling();
  } catch (error) {
    console.error('Errore caricamento statistiche DJ:', error);
    showListaMessage('dj-stats-list', `Errore caricamento dati: ${error.message}`, true);
  }
}

window.addEventListener('DOMContentLoaded', initDjStatsPage);
