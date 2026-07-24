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
    this.scrollDirection = 1; // 1 = down, -1 = up
    this.scrollSpeedPxPerStep = 1;
    this.scrollStepMs = 16;
    this.pauseAtEdgesMs = 1000;
    this.scrollPauseUntil = 0;
    this.scrollLastStepTime = 0;
    this.scrollRunning = true;
    this.clockInterval = null;
    this.nextCoreoInterval = null;
    this.scrollAnimationFrame = null;
    this.executedIds = new Set();
    this.secondaryScreenGuardActive = false;
    this.screenDetails = null;
    this.screenDetailsListenerAttached = false;

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

      this.setupControls();
      this.setupDateTimeClock();
      this.loadNextCoreo();
      this.nextCoreoInterval = setInterval(() => this.loadNextCoreo(), 30000);

      // Deve restare sul monitor secondario (best effort con fallback UX)
      await this.setupSecondaryMonitorGuard();

      // Avvia auto-scroll tabella (giu/su)
      this.startAutoScroll();

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

    if (currentSerata && currentSerata.metadata) {
      this.serata = currentSerata.metadata || this.serata;
    } else {
      this.serata = {
        dj: this.serata.dj || '',
        data: this.serata.data || '',
        luogo: this.serata.luogo || '',
        evento: this.serata.evento || '',
      };
    }

    const brani = this.buildDisplaySourceBrani(currentSerata);
    this.executedIds = this.buildExecutedIdSet(currentSerata, brani);

    if (!Array.isArray(brani) || brani.length === 0) {
      this.showEmptyState();
      return;
    }

    const requestedBrani = this.filterRequestedBrani(brani);
    if (!Array.isArray(requestedBrani) || requestedBrani.length === 0) {
      this.showEmptyState('Nessun brano richiesto da visualizzare');
      return;
    }

    // Aggiorna header
    this.updateHeader(requestedBrani);

    const executedCount = requestedBrani.filter((item) => this.isBranoExecuted(item)).length;
    this.setFooterStatus(`Brani richiesti: ${requestedBrani.length} | Eseguiti: ${executedCount}`);

    // Renderizza tabella
    this.renderTable(requestedBrani);

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
    document.getElementById('header-evento').textContent = this.serata.evento || '--';

    const completed = brani.filter(b => this.isBranoExecuted(b)).length;
    document.getElementById('header-completed').textContent = `${completed}/${brani.length}`;
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

  buildDisplaySourceBrani(currentSerata) {
    const baseBrani = Array.isArray(this.allBrani) ? this.allBrani : [];
    const serataBrani = Array.isArray(currentSerata?.brani) ? currentSerata.brani : [];

    // Base: lista completa da sorgente corrente; dalla serata riporta solo lo stato eseguito.
    const mergedMap = new Map(baseBrani.map((item) => [String(item.id ?? ''), { ...item }]));

    serataBrani.forEach((item) => {
      const id = String(item?.id ?? '');
      if (!id) return;
      if (String(item?.flag || '').toUpperCase() !== 'X') {
        return;
      }

      const base = mergedMap.get(id);
      if (!base) return;

      mergedMap.set(id, {
        ...base,
        flag: 'X',
        timestamp: item?.timestamp || base.timestamp || ''
      });
    });

    return Array.from(mergedMap.values());
  }

  buildExecutedIdSet(currentSerata, sourceBrani) {
    const ids = new Set();
    const fromSerata = Array.isArray(currentSerata?.brani) ? currentSerata.brani : [];

    fromSerata.forEach((brano) => {
      if (String(brano?.flag || '').toUpperCase() === 'X') {
        ids.add(String(brano.id));
      }
    });

    if (ids.size === 0 && Array.isArray(sourceBrani)) {
      sourceBrani.forEach((brano) => {
        if (String(brano?.flag || '').toUpperCase() === 'X') {
          ids.add(String(brano.id));
        }
      });
    }

    return ids;
  }

  filterRequestedBrani(brani) {
    if (!Array.isArray(brani)) return [];
    return brani.filter((brano) => !this.isRichiesteZeroValue(brano?.richieste));
  }

  isBranoExecuted(brano) {
    if (!brano || typeof brano !== 'object') return false;
    const id = String(brano.id ?? '');
    if (id && this.executedIds.has(id)) {
      return true;
    }
    return String(brano.flag || '').toUpperCase() === 'X';
  }

  /**
   * Renderizza tabella
   */
  renderTable(brani) {
    const tbody = document.getElementById('display-tbody');
    const emptyState = document.getElementById('empty-state');
    const tableLive = document.querySelector('.table-live');

    if (!brani || brani.length === 0) {
      tbody.innerHTML = '';
      DOMUtils.show(emptyState);
      if (tableLive) {
        tableLive.scrollTop = 0;
      }
      return;
    }

    DOMUtils.hide(emptyState);

    const previousTop = tableLive ? tableLive.scrollTop : 0;

    // Renderizza tutte le righe (limite 1000 per performance)
    const displayBrani = brani.slice(0, 1000);
    tbody.innerHTML = displayBrani
      .map(brano => this.createBranoRow(brano))
      .join('');

    // Mantiene auto-scroll coerente dopo ogni rerender.
    if (tableLive) {
      const maxScroll = Math.max(0, tableLive.scrollHeight - tableLive.clientHeight);
      if (maxScroll <= 0) {
        tableLive.scrollTop = 0;
        this.scrollDirection = 1;
      } else if (tableLive.scrollTop >= maxScroll) {
        tableLive.scrollTop = Math.min(previousTop, maxScroll);
        if (tableLive.scrollTop >= maxScroll) {
          this.scrollDirection = -1;
        }
      } else {
        tableLive.scrollTop = Math.min(previousTop, maxScroll);
      }
    }

    logger.debug(`Tabella aggiornata: ${displayBrani.length} righe`);
  }

  /**
   * Avvia loop di auto-scroll bidirezionale
   */
  startAutoScroll() {
    if (this.scrollAnimationFrame) {
      cancelAnimationFrame(this.scrollAnimationFrame);
    }

    const tick = (timestamp) => {
      if (this.secondaryScreenGuardActive) {
        this.scrollAnimationFrame = requestAnimationFrame(tick);
        return;
      }

      if (!this.scrollRunning) {
        this.scrollAnimationFrame = requestAnimationFrame(tick);
        return;
      }

      const tableLive = document.querySelector('.table-live');

      if (!tableLive) {
        this.scrollAnimationFrame = requestAnimationFrame(tick);
        return;
      }

      const maxScroll = Math.max(0, tableLive.scrollHeight - tableLive.clientHeight);
      if (maxScroll <= 0) {
        tableLive.scrollTop = 0;
        this.scrollDirection = 1;
        this.scrollLastStepTime = timestamp;
        this.scrollAnimationFrame = requestAnimationFrame(tick);
        return;
      }

      if (timestamp < this.scrollPauseUntil) {
        this.scrollAnimationFrame = requestAnimationFrame(tick);
        return;
      }

      if (!this.scrollLastStepTime) {
        this.scrollLastStepTime = timestamp;
      }

      if (timestamp - this.scrollLastStepTime >= this.scrollStepMs) {
        const nextTop = tableLive.scrollTop + this.scrollDirection * this.scrollSpeedPxPerStep;

        if (nextTop >= maxScroll) {
          tableLive.scrollTop = maxScroll;
          this.scrollDirection = -1;
          this.scrollPauseUntil = timestamp + this.pauseAtEdgesMs;
        } else if (nextTop <= 0) {
          tableLive.scrollTop = 0;
          this.scrollDirection = 1;
          this.scrollPauseUntil = timestamp + this.pauseAtEdgesMs;
        } else {
          tableLive.scrollTop = nextTop;
        }

        this.scrollLastStepTime = timestamp;
      }

      this.scrollAnimationFrame = requestAnimationFrame(tick);
    };

    this.scrollAnimationFrame = requestAnimationFrame(tick);
  }

  /**
   * Crea HTML riga brano
   */
  createBranoRow(brano) {
    const isCompleted = this.isBranoExecuted(brano);
    const completedClass = isCompleted ? 'completed' : '';
    const flagIcon = isCompleted ? '✅' : '';

    return `
      <tr class="brano-row ${completedClass}">
        <td class="col-flag ${completedClass}">${flagIcon}</td>
        <td class="col-id">${brano.id}</td>
        <td class="col-titolo">${brano.titolo || brano.coreografia || '--'}</td>
        <td class="col-autore">${brano.brano || '--'}${brano.autore ? ` / ${brano.autore}` : ''}</td>
        <td class="col-coreografo">${brano.coreografo || '--'}</td>
      </tr>
    `;
  }

  setupControls() {
    const speedInput = document.getElementById('speed');
    const pauseInput = document.getElementById('pause');
    const stopBtn = document.getElementById('stopScroll');
    const resumeBtn = document.getElementById('resumeScroll');
    const fullscreenBtn = document.getElementById('btn-fullscreen');

    const syncFromInputs = () => {
      const speedValue = Number(speedInput?.value ?? 16);
      const pauseValue = Number(pauseInput?.value ?? 1);
      this.scrollStepMs = Number.isFinite(speedValue) ? Math.min(50, Math.max(1, speedValue)) : 16;
      this.pauseAtEdgesMs = Number.isFinite(pauseValue) ? Math.min(20000, Math.max(0, pauseValue * 1000)) : 1000;
    };

    syncFromInputs();

    speedInput?.addEventListener('change', () => {
      syncFromInputs();
      this.scrollLastStepTime = 0;
    });

    pauseInput?.addEventListener('change', () => {
      syncFromInputs();
      this.scrollPauseUntil = 0;
    });

    stopBtn?.addEventListener('click', () => {
      this.scrollRunning = false;
      this.setFooterStatus('Scroll fermato');
    });

    resumeBtn?.addEventListener('click', () => {
      this.scrollRunning = true;
      this.scrollLastStepTime = 0;
      this.setFooterStatus('Scroll attivo');
    });

    fullscreenBtn?.addEventListener('click', () => {
      this.toggleFullscreen();
    });

    document.addEventListener('fullscreenchange', () => {
      this.scrollLastStepTime = 0;
    });
  }

  setFooterStatus(text) {
    const status = document.getElementById('footer-status');
    if (status) {
      status.textContent = text;
    }
  }

  setupDateTimeClock() {
    const update = () => {
      const el = document.getElementById('data-ora');
      if (!el) return;
      const now = new Date();
      const date = now.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const time = now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
      el.textContent = `Data: ${date} - Ore: ${time}`;
    };

    update();
    if (this.clockInterval) clearInterval(this.clockInterval);
    this.clockInterval = setInterval(update, 60000);
  }

  async loadNextCoreo() {
    const target = document.getElementById('next-coreo');
    if (!target) return;

    const candidates = [
      '/NextCoreo.csv',
      `${window.location.origin}/NextCoreo.csv`,
      `${window.location.origin}/public/NextCoreo.csv`
    ];

    for (const baseUrl of candidates) {
      try {
        const response = await fetch(`${baseUrl}?t=${Date.now()}`, { cache: 'no-store' });
        if (!response.ok) continue;
        const text = (await response.text()).replace(/^\uFEFF/, '').trim();
        if (!text) continue;

        const firstRow = text.split(/\r?\n/)[0] || '';
        const cols = firstRow.split(',').map((cell) => String(cell || '').replace(/(^"|"$)/g, '').trim());
        const nextValue = cols[1] || cols[0] || '--';
        target.textContent = nextValue || '--';
        return;
      } catch (error) {
        logger.debug('loadNextCoreo failed for candidate', { baseUrl, message: error?.message || error });
      }
    }

    target.textContent = '--';
  }

  toggleFullscreen() {
    const elem = document.documentElement;

    if (!document.fullscreenElement) {
      if (elem.requestFullscreen) {
        try {
          const p = elem.requestFullscreen();
          if (p && typeof p.catch === 'function') {
            p.catch(() => {});
          }
        } catch (error) {
          logger.debug('requestFullscreen failed', error?.message || error);
        }
      }
      return;
    }

    if (document.exitFullscreen) {
      try {
        const p = document.exitFullscreen();
        if (p && typeof p.catch === 'function') {
          p.catch(() => {});
        }
      } catch (error) {
        logger.debug('exitFullscreen failed', error?.message || error);
      }
    }
  }

  getDisplayPageUrl() {
    return `${window.location.origin}${window.location.pathname}${window.location.search || ''}${window.location.hash || ''}`;
  }

  setSecondaryGuardState(active, message = '') {
    const guard = document.getElementById('secondary-monitor-guard');
    const guardMessage = document.getElementById('secondary-monitor-guard-msg');
    const body = document.body;

    this.secondaryScreenGuardActive = Boolean(active);

    if (!guard || !body) return;

    if (this.secondaryScreenGuardActive) {
      guard.hidden = false;
      body.classList.add('guard-active');
      if (guardMessage && message) {
        guardMessage.textContent = message;
      }
      return;
    }

    guard.hidden = true;
    body.classList.remove('guard-active');
  }

  async openCurrentPageOnSecondaryScreen() {
    const fallbackMessage = 'Apertura automatica non supportata da questo browser. Usa lo script PowerShell di apertura su monitor secondario.';

    if (!this.screenDetails || !Array.isArray(this.screenDetails.screens)) {
      this.setSecondaryGuardState(true, fallbackMessage);
      return;
    }

    const secondary = this.screenDetails.screens.find(screen => !screen.isPrimary);
    if (!secondary) {
      this.setSecondaryGuardState(false);
      return;
    }

    const left = Number(secondary.availLeft ?? secondary.left ?? 0);
    const top = Number(secondary.availTop ?? secondary.top ?? 0);
    const width = Number(secondary.availWidth ?? secondary.width ?? 1280);
    const height = Number(secondary.availHeight ?? secondary.height ?? 720);
    const features = `popup=yes,left=${Math.round(left)},top=${Math.round(top)},width=${Math.round(width)},height=${Math.round(height)}`;

    const popup = window.open(this.getDisplayPageUrl(), 'bordero-display-secondary', features);

    if (popup) {
      try {
        popup.focus();
      } catch (error) {
        logger.debug('Impossibile forzare focus popup', error?.message || error);
      }
      this.setSecondaryGuardState(true, 'Pagina aperta su un nuovo pannello: verifica che sia sul monitor secondario e chiudi questa finestra primaria.');
      return;
    }

    this.setSecondaryGuardState(true, 'Popup bloccato dal browser: consenti l\'apertura popup e riprova, oppure usa lo script PowerShell per il monitor secondario.');
  }

  evaluateSecondaryMonitorPlacement() {
    if (!this.screenDetails || !Array.isArray(this.screenDetails.screens)) {
      this.setSecondaryGuardState(false);
      return;
    }

    const screens = this.screenDetails.screens;
    const hasSecondary = screens.some(screen => !screen.isPrimary);

    if (!hasSecondary) {
      this.setSecondaryGuardState(false);
      return;
    }

    const current = this.screenDetails.currentScreen;
    if (current && current.isPrimary) {
      this.setSecondaryGuardState(true, 'Display rilevato sul monitor principale: per la pubblicazione spostalo sul monitor secondario.');
      return;
    }

    this.setSecondaryGuardState(false);
  }

  async setupSecondaryMonitorGuard() {
    const openButton = document.getElementById('btn-open-on-secondary');
    openButton?.addEventListener('click', () => {
      this.openCurrentPageOnSecondaryScreen();
    });

    if (typeof window.getScreenDetails !== 'function') {
      this.setSecondaryGuardState(true, 'API monitor non disponibile: apri questa pagina tramite script di posizionamento sul monitor secondario.');
      return;
    }

    try {
      this.screenDetails = await window.getScreenDetails();
      this.evaluateSecondaryMonitorPlacement();

      if (!this.screenDetailsListenerAttached) {
        this.screenDetails.addEventListener('currentscreenchange', () => this.evaluateSecondaryMonitorPlacement());
        this.screenDetails.addEventListener('screenschange', () => this.evaluateSecondaryMonitorPlacement());
        this.screenDetailsListenerAttached = true;
      }
    } catch (error) {
      this.setSecondaryGuardState(true, 'Permesso monitor negato: per obbligare il monitor secondario usa il launcher PowerShell dedicato.');
      logger.warn('Monitor API non disponibile o non autorizzata', error?.message || error);
    }
  }

  /**
   * Mostra empty state
   */
  showEmptyState(message = 'Nessun dato da visualizzare') {
    const tbody = document.getElementById('display-tbody');
    const emptyState = document.getElementById('empty-state');
    const emptyMessage = emptyState?.querySelector('p');

    tbody.innerHTML = '';
    DOMUtils.show(emptyState);
    if (emptyMessage) {
      emptyMessage.textContent = message;
    }

    document.getElementById('header-dj').textContent = '--';
    document.getElementById('header-data').textContent = '--';
    document.getElementById('header-luogo').textContent = '--';
    document.getElementById('header-evento').textContent = '--';
    document.getElementById('header-completed').textContent = '0/0';

    logger.debug('Nessuna serata in corso');
  }

  /**
   * Stop monitor
   */
  stop() {
    this.scrollRunning = false;

    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
    if (this.clockInterval) {
      clearInterval(this.clockInterval);
      this.clockInterval = null;
    }
    if (this.nextCoreoInterval) {
      clearInterval(this.nextCoreoInterval);
      this.nextCoreoInterval = null;
    }
    if (this.scrollAnimationFrame) {
      cancelAnimationFrame(this.scrollAnimationFrame);
      this.scrollAnimationFrame = null;
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
