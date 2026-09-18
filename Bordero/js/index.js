/**
 * BORDERÒ - Index Page Logic
 * Logica della pagina principale
 */

document.addEventListener('DOMContentLoaded', async () => {
  logger.info('Index page loaded');

  // Carica versione
  document.getElementById('version').textContent = BORDERO_CONFIG.APP_VERSION;

  // Carica dati e aspetta il completamento
  const brani = await dataLoader.loadBrani();
  logger.info(`Brani caricati: ${brani.length}`);

  // Aggiorna statistiche
  updateStats();

  // Popola preview tabella DOPO che i dati sono caricati
  setTimeout(() => {
    populatePreviewTable();
  }, 500);

  // Event listeners
  setupEventListeners();

  // Aggiorna statistiche quando lo stato dei brani cambia in un'altra scheda/finestre
  window.addEventListener('storage', (event) => {
    if (
      event.key === BORDERO_CONFIG.CACHE_KEY_BRANI ||
      event.key === 'BORDERO_BRANI_DATA' ||
      event.key === BORDERO_CONFIG.CACHE_KEY_CURRENT_SERATA
    ) {
      updateStats();
      populatePreviewTable();
    }
  });

  window.addEventListener('focus', () => {
    updateStats();
    populatePreviewTable();
  });

  window.addEventListener('bordero:stats-updated', (event) => {
    updateStats(event?.detail || null);
    populatePreviewTable();
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      updateStats();
      populatePreviewTable();
    }
  });

  setInterval(() => {
    updateStats();
    populatePreviewTable();
  }, 1000);

  setInterval(() => {
    if (Network.isOnline()) {
      logger.info('Auto-sync triggered');
      dataLoader.loadBrani({ silent: true }).then(() => {
        updateStats();
        populatePreviewTable();
      });
    }
  }, BORDERO_CONFIG.SYNC_INTERVAL_MS);
});

/**
 * Aggiorna le statistiche sulla pagina
 */
function updateStats(statsOverride = null) {
  let sourceBrani = [];

  if (statsOverride && typeof statsOverride === 'object') {
    const total = Number(statsOverride.total ?? 0);
    const completed = Number(statsOverride.completed ?? 0);
    const pending = Number(statsOverride.pending ?? Math.max(total - completed, 0));

    const totalEl = document.getElementById('stat-total');
    const completedEl = document.getElementById('stat-completed');
    const pendingEl = document.getElementById('stat-pending');
    const syncEl = document.getElementById('stat-sync');

    if (totalEl) totalEl.textContent = total;
    if (completedEl) completedEl.textContent = `${completed} (${total > 0 ? Math.round((completed / total) * 100) : 0}%)`;
    if (pendingEl) pendingEl.textContent = pending;
    if (syncEl) syncEl.textContent = dataLoader.getLastSyncFormatted();

    logger.debug('Stats updated from event', { total, completed, pending });
    return;
  }

  const currentSerata = dataLoader.getCurrentSerata();
  const storedBrani = Storage.get(BORDERO_CONFIG.CACHE_KEY_BRANI, []);
  const serataBrani = Array.isArray(currentSerata?.brani) ? currentSerata.brani : [];

  if (serataBrani.length > 0) {
    sourceBrani = serataBrani;
  } else if (Array.isArray(storedBrani) && storedBrani.length > 0) {
    sourceBrani = storedBrani;
  } else {
    sourceBrani = Array.isArray(dataLoader.brani) ? dataLoader.brani : [];
  }

  const total = sourceBrani.length;
  const completed = sourceBrani.filter(brano => String(brano?.flag || '').toUpperCase() === 'X').length;
  const pending = total - completed;

  const totalEl = document.getElementById('stat-total');
  const completedEl = document.getElementById('stat-completed');
  const pendingEl = document.getElementById('stat-pending');
  const syncEl = document.getElementById('stat-sync');

  if (totalEl) totalEl.textContent = total;
  if (completedEl) completedEl.textContent = `${completed} (${total > 0 ? Math.round((completed / total) * 100) : 0}%)`;
  if (pendingEl) pendingEl.textContent = pending;
  if (syncEl) syncEl.textContent = dataLoader.getLastSyncFormatted();

  logger.debug('Stats updated from storage', { total, completed, pending });
}

function getCloseAppModalElements() {
  return {
    overlay: document.getElementById('close-app-modal'),
    title: document.getElementById('close-app-modal-title'),
    message: document.getElementById('close-app-modal-message'),
    codeWrap: document.getElementById('close-app-modal-code-wrap'),
    codeInput: document.getElementById('close-app-modal-code-input'),
    errorEl: document.getElementById('close-app-modal-error'),
    cancelBtn: document.getElementById('close-app-modal-cancel'),
    confirmBtn: document.getElementById('close-app-modal-confirm'),
  };
}

function askCloseAppConfirmation(djName) {
  return new Promise((resolve) => {
    const els = getCloseAppModalElements();
    if (!els.overlay) return resolve(false);

    els.title.textContent = 'Chiudi Applicazione';
    els.message.textContent = `${djName}, sei sicuro di voler chiudere l'applicazione?`;
    els.codeWrap.hidden = true;
    els.errorEl.hidden = true;
    els.confirmBtn.textContent = 'Si, chiudi';
    els.overlay.hidden = false;

    const cleanup = () => {
      els.overlay.hidden = true;
      els.cancelBtn.removeEventListener('click', onCancel);
      els.confirmBtn.removeEventListener('click', onConfirm);
      document.removeEventListener('keydown', onKeydown);
    };
    const onCancel = () => { cleanup(); resolve(false); };
    const onConfirm = () => { cleanup(); resolve(true); };
    const onKeydown = (event) => {
      if (event.key === 'Escape') onCancel();
      if (event.key === 'Enter') onConfirm();
    };

    els.cancelBtn.addEventListener('click', onCancel);
    els.confirmBtn.addEventListener('click', onConfirm);
    document.addEventListener('keydown', onKeydown);
  });
}

function askCloseAppSecretCode() {
  return new Promise((resolve) => {
    const els = getCloseAppModalElements();
    if (!els.overlay) return resolve(null);

    els.title.textContent = 'Codice di Sicurezza';
    els.message.textContent = "Inserisci il codice segreto per confermare la chiusura dell'applicazione:";
    els.codeWrap.hidden = false;
    els.errorEl.hidden = true;
    els.codeInput.value = '';
    els.confirmBtn.textContent = 'Conferma';
    els.overlay.hidden = false;
    setTimeout(() => els.codeInput.focus(), 50);

    const cleanup = () => {
      els.overlay.hidden = true;
      els.cancelBtn.removeEventListener('click', onCancel);
      els.confirmBtn.removeEventListener('click', onConfirm);
      els.codeInput.removeEventListener('keydown', onKeydown);
    };
    const onCancel = () => { cleanup(); resolve(null); };
    const onConfirm = () => { const value = els.codeInput.value; cleanup(); resolve(value); };
    const onKeydown = (event) => {
      if (event.key === 'Escape') onCancel();
      if (event.key === 'Enter') onConfirm();
    };

    els.cancelBtn.addEventListener('click', onCancel);
    els.confirmBtn.addEventListener('click', onConfirm);
    els.codeInput.addEventListener('keydown', onKeydown);
  });
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  // Pulsante Sincronizza
  document.getElementById('btn-sync')?.addEventListener('click', async () => {
    await dataLoader.loadBrani();
    updateStats();
    populatePreviewTable();
  });

  // Pulsante Pulisci cache
  document.getElementById('btn-clear-cache')?.addEventListener('click', () => {
    if (confirm('⚠️ Sei sicuro di voler cancellare la cache? I dati verranno ricaricati da zero.')) {
      dataLoader.clearCache();
      updateStats();
      populatePreviewTable();
      Toast.warning('Cache cancellata. Ricarica la pagina.');
    }
  });

  // Pulsante Export
  document.getElementById('btn-export')?.addEventListener('click', () => {
    dataLoader.exportToCSV();
  });

  document.getElementById('btn-close-app')?.addEventListener('click', async () => {
    const djName = (dataLoader.getCurrentSerata()?.metadata?.dj || '').trim() || 'DJ';
    if (!await askCloseAppConfirmation(djName)) return;

    const enteredCode = await askCloseAppSecretCode();
    if (enteredCode === null) return;
    if (String(enteredCode).trim() !== String(BORDERO_CONFIG.APP_CLOSE_SECRET_CODE)) {
      Toast.error('Codice non corretto. Chiusura annullata.');
      return;
    }

    try {
      const currentSerata = dataLoader.getCurrentSerata();
      const serataBrani = Array.isArray(currentSerata?.brani) ? currentSerata.brani : [];
      const braniToSave = serataBrani.length > 0
        ? serataBrani
        : Storage.get(BORDERO_CONFIG.CACHE_KEY_BRANI, []);
      if (Array.isArray(braniToSave) && braniToSave.length > 0) {
        dataLoader.archiveCurrentSerata(currentSerata?.metadata || {}, braniToSave);
      }
    } catch (error) {
      logger.error('Errore durante il salvataggio finale della serata', error);
    }

    if (!window.electronAPI?.app?.shutdown) {
      Toast.warning("Chiusura completa disponibile solo nell'app Electron. Dati salvati.");
      return;
    }

    Toast.info('Chiusura applicazione in corso: arresto server e salvataggio dati...');
    try {
      await window.electronAPI.app.shutdown();
    } catch (error) {
      logger.error("Errore durante la chiusura dell'applicazione", error);
      Toast.error('Errore durante la chiusura: ' + (error?.message || error));
    }
  });

  // Pulsante Apri Excel Bordero (versione piu recente)
  document.getElementById('btn-open-latest-excel')?.addEventListener('click', async () => {
    try {
      const response = await fetch('/api/bordero/open-latest-excel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result?.success) {
        const message = result?.error || 'Impossibile aprire il file Excel';
        Toast.error(`Errore apertura Excel: ${message}`);
        return;
      }

      Toast.success(`Excel aperto: ${result.fileName || 'file selezionato'}`);
      logger.info('Latest Bordero Excel opened', result);
    } catch (error) {
      logger.error('Errore apertura latest Excel Bordero', error);
      Toast.error(`Errore apertura Excel: ${error?.message || error}`);
    }
  });

  // Monitora status online/offline
  window.addEventListener('online', () => {
    logger.info('Back online!');
    Toast.info('✓ Sei online - Sincronizzazione...');
    dataLoader.loadBrani();
    updateStats();
    populatePreviewTable();
  });

  window.addEventListener('offline', () => {
    logger.warn('Connection lost');
    Toast.warning('⚠️ Sei offline - Usando cache locale');
  });
}

/**
 * Popola la tabella preview della home page
 */
function populatePreviewTable() {
  const tbody = document.getElementById('brani-preview-tbody');
  if (!tbody) {
    logger.warn('Preview tbody element not found');
    return;
  }

  const brani = dataLoader.brani;
  console.log('DEBUG: populatePreviewTable called', { braniCount: brani?.length, brani });
  
  if (!brani || brani.length === 0) {
    logger.warn('No brani to display');
    tbody.innerHTML = '<tr><td colspan="6" class="text-center">Nessun brano caricato</td></tr>';
    return;
  }

  // Mostra i primi 10 brani
  const previewBrani = brani.slice(0, 10);
  console.log('DEBUG: previewBrani', previewBrani);
  
  tbody.innerHTML = previewBrani.map(brano => `
    <tr>
      <td>${brano.id || ''}</td>
      <td>${brano.titolo || ''}</td>
      <td>${brano.autore || ''}</td>
      <td>${brano.genere || ''}</td>
      <td>${brano.info_livello || ''}</td>
      <td>${brano.coreografo || ''}</td>
    </tr>
  `).join('');

  logger.info(`Preview table populated with ${previewBrani.length} rows`);
}

logger.info('✓ Index.js caricato');
