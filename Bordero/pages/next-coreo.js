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

      // Forza apertura a schermo intero all'avvio
      this.requestFullscreenOnLoad();

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

    window.addEventListener('storage', (event) => {
      if (!event.key || event.key !== 'bordero_next_coreo_selection') return;
      this.refresh();
    });

    window.addEventListener('bordero:next-coreo-updated', () => {
      this.refresh();
    });

    window.addEventListener('bordero:serata-updated', () => {
      this.refresh();
    });

    document.addEventListener('fullscreenchange', () => {
      if (!document.fullscreenElement) {
        this.requestFullscreenOnLoad();
      }
    });
  }

  /**
   * Refresh display - carica dati da storage e aggiorna UI
   */
  async refresh() {
    const currentSerata = dataLoader.getCurrentSerata?.() || null;

    // Aggiorna metadata usando gli stessi valori di Borderò e delle altre pagine
    this.serata = this.getSerataMetadata(currentSerata);
    const braniWithFlags = Array.isArray(currentSerata?.brani)
      ? currentSerata.brani
      : (Array.isArray(this.allBrani) ? this.allBrani : []);

    if (!currentSerata && !this.serata.dj && !this.serata.data && !this.serata.luogo && braniWithFlags.length === 0) {
      this.showEmptyState();
      return;
    }

    // Aggiorna header e statistiche subito, prima del controllo async del videoclip
    this.updateHeader(braniWithFlags);
    this.updateStats(braniWithFlags);

    const selection = Storage.get('bordero_next_coreo_selection', null);
    let nextBrano = null;

    if (selection && selection.id) {
      nextBrano = braniWithFlags.find(b => String(b.id) === String(selection.id))
        || this.allBrani.find(b => String(b.id) === String(selection.id));
    }

    if (!nextBrano) {
      nextBrano = braniWithFlags.find(b => String(b.flag || '').toUpperCase() !== 'X');
    }

    if (!nextBrano) {
      this.showEmptyState('Serata terminata!', 'Tutti i brani sono stati eseguiti');
      return;
    }

    const hasVideo = await this.hasVideoForBrano(nextBrano);

    // Aggiorna display
    this.displayBrano(nextBrano, braniWithFlags, hasVideo);
  }

  getSerataMetadata(currentSerata = null) {
    const storedMeta = Storage.get('bordero_serata_meta', null);
    const currentMeta = currentSerata?.metadata || {};
    const tableManagerMeta = window.tableManager?.serata || {};

    const fallbackMeta = storedMeta && typeof storedMeta === 'object'
      ? storedMeta
      : {};

    return {
      dj: currentMeta.dj || tableManagerMeta.dj || fallbackMeta.dj || Storage.get('bordero_selected_dj', ''),
      data: currentMeta.data || tableManagerMeta.data || fallbackMeta.data || Storage.get('bordero_serata_data', ''),
      luogo: currentMeta.luogo || tableManagerMeta.luogo || fallbackMeta.luogo || Storage.get('bordero_selected_luogo', ''),
      evento: currentMeta.evento || tableManagerMeta.evento || fallbackMeta.evento || Storage.get('bordero_serata_evento', ''),
    };
  }

  isBranoExecuted(brano) {
    return Boolean(brano && (
      brano.flag === 'X' ||
      brano.flag === 'x' ||
      brano.eseguito === true ||
      brano.eseguito === 'X' ||
      brano.eseguito === 'x' ||
      brano.executed === true ||
      brano.executed === 'X' ||
      brano.executed === 'x'
    ));
  }

  /**
   * Aggiorna header serata info
   */
  updateHeader(brani) {
    document.getElementById('header-dj').textContent = this.serata.dj || '--';
    document.getElementById('header-data').textContent = this.serata.data || '--';
    document.getElementById('header-luogo').textContent = this.serata.luogo || '--';
    document.getElementById('header-evento').textContent = this.serata.evento || '--';

    const completed = brani.filter((b) => this.isBranoExecuted(b)).length;
    document.getElementById('header-completed').textContent = `${completed}/${brani.length}`;
  }

  /**
   * Visualizza un brano
   */
  displayBrano(brano, allBrani, hasVideo = false) {
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
    const branoIndex = allBrani.findIndex(b => String(b.id) === String(brano.id));
    document.getElementById('brano-numero').textContent = branoIndex >= 0 ? `#${branoIndex + 1}` : '--';

    // Titolo
    document.getElementById('brano-titolo').textContent = brano.titolo || 'Titolo non disponibile';

    // Autore
    document.getElementById('brano-autore').textContent = brano.autore || 'Autore sconosciuto';

    // Info grid
    document.getElementById('brano-coreografo').textContent = brano.coreografo || '--';
    document.getElementById('brano-livello').textContent = brano.info_livello || '--';
    document.getElementById('brano-info-coreo-1').textContent = brano.info_coreo_1 || brano.info_coreo || '--';
    document.getElementById('brano-info-coreo-2').textContent = brano.info_coreo_2 || '--';

    const videoBox = document.getElementById('brano-video-box');
    if (videoBox) {
      videoBox.style.display = hasVideo ? 'flex' : 'none';
    }
    document.getElementById('brano-video-status').textContent = hasVideo ? '🎬' : '--';

    // Collaboratori
    document.getElementById('brano-collaboratori').textContent = brano.collaboratori || 'Nessuno';

    logger.debug(`Brano visualizzato: ${brano.titolo}`);
  }

  async hasVideoForBrano(brano) {
    if (!brano?.id) return false;

    const existingMap = window.tableManager?.videoClipAvailableMap;
    if (existingMap && existingMap.has(String(brano.id))) {
      return true;
    }

    const candidates = [
      window.location.origin + '/api/videoclip/list',
      'http://localhost:5500/api/videoclip/list',
      'http://127.0.0.1:5500/api/videoclip/list',
      '/api/videoclip/list'
    ];

    for (const url of candidates) {
      try {
        const response = await fetch(url, { cache: 'no-store' });
        if (!response.ok) continue;

        const payload = await response.json().catch(() => ({}));
        const files = Array.isArray(payload.files)
          ? payload.files.map((entry) => String(entry || '').trim()).filter(Boolean)
          : [];

        if (!files.length) continue;

        const normalizedBrano = [brano.titolo, brano.coreografia, brano.brano, brano.autore]
          .map((value) => this.normalizeForMatch(value))
          .filter(Boolean);

        const idToken = String(brano.id || '').replace(/\D+/g, '');

        const match = files.some((fileName) => {
          const normalizedFile = this.normalizeForMatch(fileName);
          const idMatch = Boolean(idToken && normalizedFile.includes(idToken));
          const titleMatch = normalizedBrano.some((token) => normalizedFile.includes(token));
          return idMatch || titleMatch;
        });

        if (match) return true;
      } catch (error) {
        logger.debug('Errore controllo videoclip per brano', error);
      }
    }

    return false;
  }

  normalizeForMatch(value) {
    let text = String(value || '').trim();
    if (!text) return '';

    try {
      text = text.normalize('NFD').replace(/\p{Diacritic}/gu, '');
    } catch (error) {
      text = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    }

    return text
      .toLowerCase()
      .replace(/&/g, ' e ')
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
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
    const completed = brani.filter((b) => this.isBranoExecuted(b)).length;
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

  requestFullscreenOnLoad() {
    const container = document.querySelector('.next-coreo-container');
    if (!container || document.fullscreenElement) return;

    container.requestFullscreen().catch((err) => {
      logger.warn(`Errore fullscreen automatico: ${err.message}`);
    });
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
