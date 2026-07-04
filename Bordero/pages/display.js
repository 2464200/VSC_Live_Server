/**
 * BORDERÒ - Display Monitor Secondario Logic
 * Monitor secondario che mostra tabella live (read-only)
 */

class DisplayMonitor {
  constructor() {
    this.allBrani = [];
    this.serata = {
      dj: '',
      data: '',
      luogo: '',
      evento: '',
    };
    this.lastRefresh = null;
    this.refreshInterval = null;

    this.init();
  }

  async init() {
    logger.info('DisplayMonitor initializing...');

    try {
      // Carica dati
      this.allBrani = await dataLoader.loadBrani();

      // Auto-refresh ogni 1 secondo
      this.refreshInterval = setInterval(() => this.refresh(), 1000);

      // Refresh iniziale
      this.refresh();

      logger.info('✓ DisplayMonitor inizializzato');
    } catch (error) {
      logger.error('Errore inizializzazione', error);
    }
  }

  /**
   * Refresh - aggiorna tabella da storage
   */
  refresh() {
    const currentSerata = dataLoader.getCurrentSerata();
    
    if (!currentSerata) {
      this.showEmptyState();
      return;
    }

    // Aggiorna metadata
    this.serata = currentSerata.metadata || this.serata;
    const brani = currentSerata.brani || this.allBrani;

    // Aggiorna header
    this.updateHeader(brani);

    // Renderizza tabella
    this.renderTable(brani);

    // Update timestamp
    this.lastRefresh = new Date();
    document.getElementById('footer-timestamp').textContent = 
      `Ultimo aggiornamento: ${DateUtils.formatTime(this.lastRefresh)}`;
  }

  /**
   * Aggiorna header
   */
  updateHeader(brani) {
    document.getElementById('header-dj').textContent = this.serata.dj || '--';
    document.getElementById('header-data').textContent = this.serata.data || '--';
    document.getElementById('header-luogo').textContent = this.serata.luogo || '--';

    const completed = brani.filter(b => b.flag === 'X').length;
    document.getElementById('header-completed').textContent = `${completed}/${brani.length}`;
  }

  /**
   * Renderizza tabella
   */
  renderTable(brani) {
    const tbody = document.getElementById('display-tbody');
    const emptyState = document.getElementById('empty-state');

    if (!brani || brani.length === 0) {
      tbody.innerHTML = '';
      DOMUtils.show(emptyState);
      return;
    }

    DOMUtils.hide(emptyState);

    // Renderizza tutte le righe (limite 1000 per performance)
    const displayBrani = brani.slice(0, 1000);
    tbody.innerHTML = displayBrani
      .map(brano => this.createBranoRow(brano))
      .join('');

    logger.debug(`Tabella aggiornata: ${displayBrani.length} righe`);
  }

  /**
   * Crea HTML riga brano
   */
  createBranoRow(brano) {
    const isCompleted = brano.flag === 'X';
    const completedClass = isCompleted ? 'completed' : '';
    const flagIcon = isCompleted ? '✅' : '';

    return `
      <tr class="brano-row ${completedClass}">
        <td class="col-flag">${flagIcon}</td>
        <td class="col-id">${brano.id}</td>
        <td class="col-titolo">${brano.titolo || '--'}</td>
        <td class="col-autore">${brano.autore || '--'}</td>
        <td class="col-coreografo">${brano.coreografo || '--'}</td>
        <td class="col-genere">${brano.genere || '--'}</td>
        <td class="col-livello">${brano.info_livello || '--'}</td>
      </tr>
    `;
  }

  /**
   * Mostra empty state
   */
  showEmptyState() {
    const tbody = document.getElementById('display-tbody');
    const emptyState = document.getElementById('empty-state');

    tbody.innerHTML = '';
    DOMUtils.show(emptyState);

    document.getElementById('header-dj').textContent = '--';
    document.getElementById('header-data').textContent = '--';
    document.getElementById('header-luogo').textContent = '--';
    document.getElementById('header-completed').textContent = '0/0';

    logger.debug('Nessuna serata in corso');
  }

  /**
   * Stop monitor
   */
  stop() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
  }
}

// Inizializza quando DOM è pronto
document.addEventListener('DOMContentLoaded', () => {
  window.displayMonitor = new DisplayMonitor();
});

// Cleanup al chiudere pagina
window.addEventListener('beforeunload', () => {
  if (window.displayMonitor) {
    window.displayMonitor.stop();
  }
});

logger.info('✓ Display.js caricato');
