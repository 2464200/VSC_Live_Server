/**
 * BORDERÒ - Brani Eseguiti
 * Mostra solo i brani marcati come completati (flag X)
 */

class BraniEseguitiPage {
  constructor() {
    this.brani = [];
    this.executed = [];
    this.serata = {};
    this.init();
  }

  async init() {
    try {
      await dataLoader.initialize();
      this.brani = await dataLoader.loadBrani();
      this.loadData();
      this.render();
      this.setupStorageSync();
      this.setupListeners();
    } catch (error) {
      logger.error('Errore inizializzazione BraniEseguitiPage', error);
      Toast.error('Errore caricamento brani eseguiti: ' + error.message);
    }
  }

  loadData() {
    const currentSerata = dataLoader.getCurrentSerata();
    if (currentSerata) {
      this.serata = currentSerata.metadata;
      this.brani = currentSerata.brani || this.brani;
    }

    this.executed = this.brani.filter(b => b.flag === 'X');
  }

  render() {
    this.updateSerataMeta();
    this.updateStats();
    this.renderExecuted();
  }

  updateSerataMeta() {
    document.getElementById('info-dj').textContent = this.serata.dj || '--';
    document.getElementById('info-data').textContent = this.serata.data || '--';
    document.getElementById('info-luogo').textContent = this.serata.luogo || '--';
    document.getElementById('info-evento').textContent = this.serata.evento || '--';
  }

  updateStats() {
    const total = this.brani.length;
    const executedCount = this.executed.length;
    const percent = total > 0 ? Math.round((executedCount / total) * 100) : 0;

    document.getElementById('stat-total').textContent = total;
    document.getElementById('stat-executed').textContent = executedCount;
    document.getElementById('stat-percent').textContent = `${percent}%`;
  }

  renderExecuted() {
    const tbody = document.getElementById('executed-tbody');
    const empty = document.getElementById('empty-executed');
    const count = document.getElementById('executed-count');

    if (!tbody || !empty || !count) return;

    if (this.executed.length === 0) {
      tbody.innerHTML = '';
      empty.style.display = 'block';
      count.textContent = '0 brani';
      return;
    }

    empty.style.display = 'none';
    count.textContent = `${this.executed.length} brani`;

    tbody.innerHTML = this.executed
      .map((brano, index) => `
        <tr class="executed-row">
          <td class="col-number">${index + 1}</td>
          <td class="col-titolo">${brano.titolo || brano.coreografia || brano.brano || '--'}</td>
          <td class="col-autore">${brano.autore || '--'}</td>
          <td class="col-coreografo">${brano.coreografo || '--'}</td>
          <td class="col-timestamp">${brano.timestamp || '--'}</td>
          <td>
            <label class="action-inline">
              <input type="checkbox" class="checkbox-restore" data-brano-id="${brano.id}" />
              Ripristina disponibilità
            </label>
          </td>
        </tr>
      `)
      .join('');

    tbody.querySelectorAll('.checkbox-restore').forEach((checkbox) => {
      checkbox.addEventListener('change', () => {
        const branoId = checkbox.dataset.branoId;
        this.restoreBrano(branoId);
      });
    });
  }

  restoreBrano(branoId) {
    const brano = this.brani.find(b => String(b.id) === String(branoId));
    if (!brano) return;

    brano.flag = '';
    brano.timestamp = '';

    dataLoader.saveCurrentSerata(this.serata, this.brani);
    // Notifica la pagina Bordero nello stesso tab
    try {
      window.dispatchEvent(new Event('bordero:serata-updated'));
    } catch (e) {
      logger.debug('Impossibile dispatchare evento custom', e);
    }
    Toast.success('Brano ripristinato alla disponibilità');

    if (typeof window !== 'undefined' && window.location.pathname.endsWith('bordero.html')) {
      window.location.reload();
      return;
    }

    this.loadData();
    this.render();
  }

  setupStorageSync() {
    window.addEventListener('storage', (event) => {
      if (!event.key || event.key !== BORDERO_CONFIG.CACHE_KEY_CURRENT_SERATA) return;

      const currentSerata = dataLoader.getCurrentSerata();
      if (!currentSerata || !Array.isArray(currentSerata.brani)) return;

      logger.info('Storage event: aggiornamento serata corrente rilevato (brani eseguiti)');
      this.loadData();
      this.render();
      Toast.info('Stato eseguiti aggiornato dalla sessione');
    });
  }

  setupListeners() {
    document.getElementById('btn-back')?.addEventListener('click', () => {
      window.location.href = 'http://localhost:5500/eventi/eventi.html';
    });

    document.getElementById('btn-bordero')?.addEventListener('click', () => {
      window.location.href = 'bordero.html';
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.braniEseguitiPage = new BraniEseguitiPage();
});

logger.info('✓ BraniEseguiti.js caricato');
