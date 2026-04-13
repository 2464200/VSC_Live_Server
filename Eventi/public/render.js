const renderState = {
  filtro: null,
  allBrani: [],
  summaryBrani: [],
  visibleBrani: [],
  log: [],
  query: '',
  refreshTimer: null
};

async function salvaStato(id, stato, dj) {
  const response = await eventiFetch('/log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id,
      stato,
      timestamp: new Date().toISOString(),
      dj: dj || null
    })
  });

  if (!response.ok) {
    throw new Error(`Salvataggio stato fallito (${response.status})`);
  }
}

function renderSummaryCards(summary) {
  const container = document.getElementById('summary-cards');
  if (!container) return;
  container.innerHTML = `
    <div class="summary-card is-primary"><div class="summary-label">Totale</div><div class="summary-value">${summary.totale}</div></div>
    <div class="summary-card"><div class="summary-label">Disponibili</div><div class="summary-value">${summary.disponibile}</div></div>
    <div class="summary-card is-accent"><div class="summary-label">Prenotati</div><div class="summary-value">${summary.prenotato}</div></div>
    <div class="summary-card is-success"><div class="summary-label">Eseguiti</div><div class="summary-value">${summary.eseguito}</div></div>
  `;
}

function updateStatusInfo() {
  const badge = document.getElementById('last-update');
  if (badge) {
    badge.textContent = `Ultimo aggiornamento: ${EventiState.getLastUpdateLabel(renderState.log)}`;
  }
  renderSummaryCards(EventiState.summarizeBrani(renderState.summaryBrani));
}

function renderRows(container, brani, opts = {}) {
  container.innerHTML = '';

  if (!brani || brani.length === 0) {
    showListaMessage(container, renderState.query ? 'Nessun risultato per la ricerca corrente.' : 'Nessuna coreografia da visualizzare in questa vista.');
    return;
  }

  brani.forEach((item, index) => {
    const row = document.createElement('div');
    row.className = `riga-brano ${item.stato}`.trim();
    row.dataset.branoId = item.id;

    let checkboxHtml = '';
    if (opts.interactive) {
      if (opts.filtro === 'prenotati') {
        checkboxHtml = `
          <label class="action-inline"><input type="checkbox" class="checkbox-eseguito" /> Eseguito</label>
          <label class="action-inline"><input type="checkbox" class="checkbox-annulla" /> Annulla</label>
        `;
      } else if (opts.filtro === 'spuntati') {
        checkboxHtml = `<label class="action-inline"><input type="checkbox" class="checkbox-annulla" /> Annulla</label>`;
      }
    }

    const djLabel = item.dj ? ` - DJ ${item.dj}` : '';
    const branoLabel = item.brano ? `<span class="brano-meta">Brano: ${item.brano}</span>` : '';

    row.innerHTML = `
      <span class="stato-pill ${item.stato}">${item.stato}</span>
      <span class="titolo">
        <strong><span class="red-number">(${index + 1})</span> ${item.titolo}</strong>
        <span class="muted">ID ${item.id}${item.brano ? ` - brano: ${item.brano}` : ''}${djLabel}</span>
      </span>
      <span class="timestamp">${item.timestamp ? new Date(item.timestamp).toLocaleString('it-IT') : '--'}</span>
      ${checkboxHtml}
    `;

    if (opts.interactive) {
      if (opts.filtro === 'prenotati') {
        const cbEseguito = row.querySelector('.checkbox-eseguito');
        cbEseguito.addEventListener('change', async () => {
          cbEseguito.disabled = true;
          try {
            await salvaStato(item.id, 'eseguito', item.dj);
            await refreshData();
          } catch (error) {
            cbEseguito.disabled = false;
            cbEseguito.checked = false;
            showListaMessage(container, `Errore aggiornamento stato: ${error.message}`, true);
          }
        });

        const cbAnnulla = row.querySelector('.checkbox-annulla');
        cbAnnulla.addEventListener('change', async () => {
          cbAnnulla.disabled = true;
          try {
            await salvaStato(item.id, 'disponibile', item.dj);
            await refreshData();
          } catch (error) {
            cbAnnulla.disabled = false;
            cbAnnulla.checked = false;
            showListaMessage(container, `Errore aggiornamento stato: ${error.message}`, true);
          }
        });
      } else if (opts.filtro === 'spuntati') {
        const cb = row.querySelector('.checkbox-annulla');
        cb.addEventListener('change', async () => {
          cb.disabled = true;
          try {
            await salvaStato(item.id, 'disponibile', item.dj);
            await refreshData();
          } catch (error) {
            cb.disabled = false;
            cb.checked = false;
            showListaMessage(container, `Errore aggiornamento stato: ${error.message}`, true);
          }
        });
      }
    }

    container.appendChild(row);
  });
}

function applySearchAndRender() {
  const container = document.getElementById('lista-render');
  if (!container) return;
  renderState.visibleBrani = EventiState.searchBrani(renderState.allBrani, renderState.query);
  renderRows(container, renderState.visibleBrani, {
    filtro: renderState.filtro,
    interactive: renderState.filtro === 'prenotati' || renderState.filtro === 'spuntati'
  });
}

async function refreshData() {
  const [brani, log] = await Promise.all([
    fetchJSON(`/brani?ts=${Date.now()}`),
    fetchJSON(`/log?ts=${Date.now()}`)
  ]);

  if (!Array.isArray(brani) || !Array.isArray(log)) {
    throw new Error('Dati API non validi');
  }

  renderState.log = log;
  const decorated = EventiState.decorateBrani(brani, EventiState.buildLastStateMap(log));
  renderState.summaryBrani = decorated;
  renderState.allBrani = EventiState.filterBrani(decorated, renderState.filtro);
  updateStatusInfo();
  applySearchAndRender();
}

function bindSearch() {
  const input = document.getElementById('search-input');
  if (!input) return;
  input.addEventListener('input', () => {
    renderState.query = input.value;
    applySearchAndRender();
  });
}

function startPolling() {
  if (renderState.refreshTimer) clearInterval(renderState.refreshTimer);
  renderState.refreshTimer = setInterval(async () => {
    if (!EventiState.shouldRefresh()) return;
    try {
      await refreshData();
    } catch (error) {
      console.error('Errore autorefresh:', error);
    }
  }, 15000);
}

async function renderLista(filtro) {
  renderState.filtro = filtro;
  const serverOnline = await checkServerOnline();
  if (!serverOnline) {
    const container = document.getElementById('lista-render');
    if (container) {
      showListaMessage(container, 'Server Eventi non raggiungibile. Verifica che l’applicazione sia servita dall’indirizzo corretto e apri la diagnostica Eventi in rete.', true);
    }
    return;
  }

  try {
    bindSearch();
    await refreshData();
    startPolling();
  } catch (error) {
    console.error('Errore renderLista:', error);
    const container = document.getElementById('lista-render');
    if (container) {
      showListaMessage(container, `Errore caricamento dati: ${error.message}`, true);
    }
  }
}

window.renderLista = renderLista;
