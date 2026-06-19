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

  // Auto-sync ogni X minuti
  setInterval(() => {
    if (Network.isOnline()) {
      logger.info('Auto-sync triggered');
      dataLoader.loadBrani().then(() => {
        updateStats();
        populatePreviewTable();
      });
    }
  }, BORDERO_CONFIG.SYNC_INTERVAL_MS);
});

/**
 * Aggiorna le statistiche sulla pagina
 */
function updateStats() {
  const stats = dataLoader.getStats();

  const totalEl = document.getElementById('stat-total');
  const completedEl = document.getElementById('stat-completed');
  const pendingEl = document.getElementById('stat-pending');
  const syncEl = document.getElementById('stat-sync');

  if (totalEl) totalEl.textContent = stats.total;
  if (completedEl) completedEl.textContent = `${stats.completed} (${stats.percentuale}%)`;
  if (pendingEl) pendingEl.textContent = stats.pending;
  if (syncEl) syncEl.textContent = dataLoader.getLastSyncFormatted();

  logger.debug('Stats updated', stats);
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
