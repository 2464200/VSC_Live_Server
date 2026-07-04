/**
 * BORDERÒ - Prossimo Brano Display Logic
 * Monitor che mostra il prossimo brano da suonare
 */

class NextCoreoDisplay {
  constructor() {
    this.allBrani = [];
    this.nextBrano = null;
    this.serata = {
      dj: '',
      data: '',
      luogo: '',
      evento: '',
    };
    this.startTime = null;
    this.timerInterval = null;

    this.init();
  }

  async init() {
    logger.info('NextCoreoDisplay initializing...');

    try {
      // Carica dati
      this.allBrani = await dataLoader.loadBrani();

      // Setup event listeners
      this.setupEventListeners();

      // Auto-refresh ogni 1 secondo (sincronizzazione con bordero.html)
      this.timerInterval = setInterval(() => this.refresh(), 1000);

      // Refresh iniziale
      this.refresh();

      logger.info('✓ NextCoreoDisplay inizializzato');
    } catch (error) {
      logger.error('Errore inizializzazione', error);
    }
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    document.getElementById('btn-refresh').addEventListener('click', () => this.refresh());
    document.getElementById('btn-fullscreen').addEventListener('click', () => this.toggleFullscreen());
    document.getElementById('btn-back').addEventListener('click', () => window.location.href = 'bordero.html');
  }

  /**
   * Refresh display - carica dati da storage e aggiorna UI
   */
  refresh() {
    // Carica dati attuali dalla serata in corso
    const currentSerata = dataLoader.getCurrentSerata();
    if (!currentSerata) {
      this.showEmptyState();
      return;
    }

    // Aggiorna metadata
    this.serata = currentSerata.metadata || this.serata;
    const braniWithFlags = currentSerata.brani || this.allBrani;

    // Aggiorna header
    this.updateHeader(braniWithFlags);

    // Trova il prossimo brano (primo senza flag X)
    const nextBrano = braniWithFlags.find(b => b.flag !== 'X');
    
    if (!nextBrano) {
      this.showEmptyState('Serata terminata!', 'Tutti i brani sono stati eseguiti');
      return;
    }

    // Aggiorna display
    this.displayBrano(nextBrano, braniWithFlags);

    // Aggiorna statistiche
    this.updateStats(braniWithFlags);
  }

  /**
   * Aggiorna header serata info
   */
  updateHeader(brani) {
    document.getElementById('header-dj').textContent = this.serata.dj || '--';
    document.getElementById('header-data').textContent = this.serata.data || '--';
    document.getElementById('header-luogo').textContent = this.serata.luogo || '--';

    const completed = brani.filter(b => b.flag === 'X').length;
    document.getElementById('header-completed').textContent = `${completed}/${brani.length}`;
  }

  /**
   * Visualizza un brano
   */
  displayBrano(brano, allBrani) {
    const card = document.getElementById('next-brano-card');
    const emptyState = document.getElementById('empty-state');

    if (!brano) {
      card.style.display = 'none';
      DOMUtils.show(emptyState);
      return;
    }

    // Nascondi empty state
    card.style.display = 'flex';
    DOMUtils.hide(emptyState);

    // Numero ordine (quale è questo brano nella lista?)
    const branoIndex = allBrani.findIndex(b => b.id === brano.id);
    document.getElementById('brano-numero').textContent = `#${branoIndex + 1}`;

    // Titolo
    document.getElementById('brano-titolo').textContent = brano.titolo || 'Titolo non disponibile';

    // Autore
    document.getElementById('brano-autore').textContent = brano.autore || 'Autore sconosciuto';

    // Info grid
    document.getElementById('brano-coreografo').textContent = brano.coreografo || '--';
    document.getElementById('brano-genere').textContent = brano.genere || '--';
    document.getElementById('brano-livello').textContent = brano.info_livello || '--';
    document.getElementById('brano-categoria').textContent = brano.info_coreo || '--';

    // Collaboratori
    document.getElementById('brano-collaboratori').textContent = brano.collaboratori || 'Nessuno';

    logger.debug(`Brano visualizzato: ${brano.titolo}`);
  }

  /**
   * Mostra empty state
   */
  showEmptyState(title = 'Nessun brano da suonare', subtitle = 'Seleziona un brano dalla tabella principale') {
    const emptyState = document.getElementById('empty-state');
    const card = document.getElementById('next-brano-card');

    card.style.display = 'none';
    DOMUtils.show(emptyState);

    emptyState.innerHTML = `
      <div class="empty-content">
        <div class="empty-icon">🎭</div>
        <p class="empty-text">${title}</p>
        <p class="empty-subtext">${subtitle}</p>
      </div>
    `;
  }

  /**
   * Aggiorna statistiche
   */
  updateStats(brani) {
    const total = brani.length;
    const completed = brani.filter(b => b.flag === 'X').length;
    const pending = total - completed;
    const percentuale = total > 0 ? Math.round((completed / total) * 100) : 0;

    document.getElementById('stat-total').textContent = total;
    document.getElementById('stat-completed').textContent = completed;
    document.getElementById('stat-pending').textContent = pending;
    document.getElementById('stat-percent').textContent = `${percentuale}%`;

    this.updateTimer();
  }

  /**
   * Aggiorna timer
   */
  updateTimer() {
    if (!this.startTime) {
      this.startTime = Date.now();
    }

    const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
    const ore = Math.floor(elapsed / 3600);
    const minuti = Math.floor((elapsed % 3600) / 60);
    const secondi = elapsed % 60;

    document.getElementById('stat-ore').textContent = String(ore).padStart(2, '0');
    document.getElementById('stat-minuti').textContent = String(minuti).padStart(2, '0');
    document.getElementById('stat-secondi').textContent = String(secondi).padStart(2, '0');
  }

  /**
   * Toggle fullscreen
   */
  toggleFullscreen() {
    const container = document.querySelector('.next-coreo-container');
    
    if (!document.fullscreenElement) {
      container.requestFullscreen().catch(err => {
        logger.warn(`Errore fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen().catch(err => {
        logger.warn(`Errore exit fullscreen: ${err.message}`);
      });
    }

    // Restart timer on fullscreen change
    this.startTime = Date.now();
  }
}

// Inizializza quando DOM è pronto
document.addEventListener('DOMContentLoaded', () => {
  window.nextCoreoDisplay = new NextCoreoDisplay();
});

logger.info('✓ NextCoreo.js caricato');
