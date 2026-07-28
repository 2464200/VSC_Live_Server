/**
 * BORDERÒ - Elenco Richieste
 * Mostra solo i brani richiesti e permette di gestire lo stato eseguito.
 */

class ElencoRichiestePage {
  constructor() {
    this.brani = [];
    this.requested = [];
    this.serata = {};
    this.init();
  }

  async init() {
    try {
      await dataLoader.initialize();
      await this.refreshFromCurrentData();
      await this.refreshSyncDiagnostic();
      this.render();
      this.setupStorageSync();
      this.setupListeners();
    } catch (error) {
      logger.error('Errore inizializzazione ElencoRichiestePage', error);
      Toast.error('Errore caricamento elenco richieste: ' + error.message);
    }
  }

  async refreshFromCurrentData() {
    // Usa prima la cache aggiornata da Bordero (include eventuale sync Google),
    // poi fallback a loadBrani se la cache non e disponibile.
    const cachedBrani = Storage.get(BORDERO_CONFIG.CACHE_KEY_BRANI, []);
    const latestBrani = Array.isArray(cachedBrani) && cachedBrani.length > 0
      ? dataLoader.normalizeBraniList(cachedBrani)
      : await dataLoader.loadBrani();

    const originalBrani = latestBrani.map((brano, index) => ({
      ...brano,
      originalIndex: index,
    }));

    const currentSerata = dataLoader.getCurrentSerata();
    if (currentSerata) {
      this.serata = currentSerata.metadata;

      if (Array.isArray(currentSerata.brani) && currentSerata.brani.length > 0) {
        const executedMap = new Map(currentSerata.brani.map((b) => [String(b.id), b]));
        this.brani = originalBrani.map((brano) => {
          const saved = executedMap.get(String(brano.id));
          if (saved && String(saved.flag || '').toUpperCase() === 'X') {
            return {
              ...brano,
              flag: 'X',
              timestamp: saved.timestamp || brano.timestamp,
            };
          }
          return brano;
        });
      } else {
        this.brani = originalBrani;
      }
    } else {
      this.brani = originalBrani;
    }

    this.requested = this.brani.filter((b) => !this.isRichiesteZeroValue(b.richieste));
  }

  isRichiesteZeroValue(value) {
    const text = String(value ?? '').trim();
    if (!text || text === '-') return true;

    const normalizedNumeric = text.replace(',', '.');
    if (/^-?\d+(\.\d+)?$/.test(normalizedNumeric)) {
      return Number(normalizedNumeric) === 0;
    }

    return false;
  }

  isExecutedBrano(brano) {
    return String(brano?.flag || '').toUpperCase() === 'X';
  }

  render() {
    this.updateSerataMeta();
    this.updateStats();
    this.renderSyncDiagnostic();
    this.renderRequested();
  }

  async refreshSyncDiagnostic() {
    this.syncDiagnostic = null;

    const endpoints = [
      '/api/bordero/sync-google/status',
      'http://localhost:5500/api/bordero/sync-google/status',
      'http://127.0.0.1:5500/api/bordero/sync-google/status',
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint, { cache: 'no-store' });
        if (!response.ok) continue;

        const payload = await response.json().catch(() => ({}));
        const state = payload?.state;
        const results = Array.isArray(state?.lastSummary?.results) ? state.lastSummary.results : [];
        const accoda = results.find((item) => String(item?.sheet || '').toLowerCase() === 'accoda 8+12');
        const diag = accoda?.richiesteDiagnostics;

        if (!diag) continue;

        this.syncDiagnostic = {
          syncedAt: state?.lastSummary?.syncedAt || state?.lastCompletedAt || '',
          totalResponseRows: Number(diag.totalResponseRows || 0),
          skippedTestRows: Number(diag.skippedTestRows || 0),
          effectiveResponseRows: Number(diag.effectiveResponseRows || 0),
        };
        return;
      } catch (error) {
        logger.debug('Sync diagnostic endpoint non disponibile', { endpoint, error: error?.message || error });
      }
    }
  }

  renderSyncDiagnostic() {
    const el = document.getElementById('sync-diagnostic');
    if (!el) return;

    const diag = this.syncDiagnostic;
    if (!diag || !diag.totalResponseRows) {
      el.hidden = true;
      el.textContent = '';
      return;
    }

    const when = diag.syncedAt
      ? `, sync ${DateUtils.formatDate(diag.syncedAt)}`
      : '';

    el.textContent = `Diagnostica richieste: ${diag.totalResponseRows} righe, escluse test ${diag.skippedTestRows}, effettive ${diag.effectiveResponseRows}${when}`;
    el.hidden = false;
  }

  updateSerataMeta() {
    document.getElementById('info-dj').textContent = this.serata.dj || '--';
    document.getElementById('info-data').textContent = this.serata.data || '--';
    document.getElementById('info-luogo').textContent = this.serata.luogo || '--';
    document.getElementById('info-evento').textContent = this.serata.evento || '--';
  }

  updateStats() {
    const totalRequested = this.requested.length;
    const executedRequested = this.requested.filter((b) => this.isExecutedBrano(b)).length;
    const percent = totalRequested > 0 ? Math.round((executedRequested / totalRequested) * 100) : 0;

    document.getElementById('stat-richieste').textContent = totalRequested;
    document.getElementById('stat-executed').textContent = executedRequested;
    document.getElementById('stat-percent').textContent = `${percent}%`;
  }

  renderRequested() {
    const tbody = document.getElementById('richieste-tbody');
    const empty = document.getElementById('empty-richieste');
    const count = document.getElementById('richieste-count');

    if (!tbody || !empty || !count) return;

    if (this.requested.length === 0) {
      tbody.innerHTML = '';
      empty.style.display = 'block';
      count.textContent = '0 brani';
      return;
    }

    empty.style.display = 'none';
    count.textContent = `${this.requested.length} brani`;

    tbody.innerHTML = this.requested
      .map((brano, index) => {
        const isExecuted = this.isExecutedBrano(brano);
        const titolo = brano.titolo || brano.coreografia || brano.brano || '--';
        const statoClass = isExecuted ? 'executed-status' : 'pending-status';
        const statoLabel = isExecuted ? 'Eseguito' : 'Da eseguire';

        return `
          <tr>
            <td class="col-number">${index + 1}</td>
            <td class="col-titolo">${titolo}</td>
            <td class="col-autore">${brano.autore || '--'}</td>
            <td class="col-richieste">${brano.richieste || '--'}</td>
            <td class="col-coreografo">${brano.coreografo || '--'}</td>
            <td class="col-timestamp">${brano.timestamp || '--'}</td>
            <td>
              <label class="action-inline ${statoClass}">
                <input type="checkbox" class="checkbox-executed" data-brano-id="${brano.id}" ${isExecuted ? 'checked' : ''} />
                ${isExecuted ? '✅' : '⬜'} ${statoLabel}
              </label>
            </td>
          </tr>
        `;
      })
      .join('');

    tbody.querySelectorAll('.checkbox-executed').forEach((checkbox) => {
      checkbox.addEventListener('change', () => {
        const branoId = checkbox.dataset.branoId;
        this.toggleExecuted(branoId, checkbox.checked);
      });
    });
  }

  toggleExecuted(branoId, shouldBeExecuted) {
    const brano = this.brani.find((b) => String(b.id) === String(branoId));
    if (!brano) return;

    if (shouldBeExecuted) {
      brano.flag = 'X';
      brano.timestamp = DateUtils.formatDate(new Date());
    } else {
      brano.flag = '';
      brano.timestamp = '';
    }

    dataLoader.saveCurrentSerata(this.serata, this.brani);

    try {
      window.dispatchEvent(new Event('bordero:serata-updated'));
    } catch (e) {
      logger.debug('Impossibile dispatchare evento custom', e);
    }

    Toast.success(shouldBeExecuted ? 'Brano segnato come eseguito' : 'Brano riportato disponibile');

    this.refreshFromCurrentData().then(() => this.render());
  }

  setupStorageSync() {
    window.addEventListener('storage', (event) => {
      if (!event.key) return;
      if (event.key !== BORDERO_CONFIG.CACHE_KEY_CURRENT_SERATA && event.key !== BORDERO_CONFIG.CACHE_KEY_BRANI) return;

      logger.info('Storage event: aggiornamento dati Bordero rilevato (elenco richieste)');
      this.refreshFromCurrentData()
        .then(async () => {
          await this.refreshSyncDiagnostic();
          this.render();
          Toast.info('Elenco richieste aggiornato dalla sessione');
        })
        .catch((error) => {
          logger.error('Errore aggiornamento elenco richieste da storage event', error);
        });
    });
  }

  setupListeners() {
    document.getElementById('btn-bordero')?.addEventListener('click', () => {
      window.location.href = 'bordero.html';
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.elencoRichiestePage = new ElencoRichiestePage();
});

logger.info('✓ ElencoRichieste.js caricato');
