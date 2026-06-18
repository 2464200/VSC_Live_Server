/**
 * BORDERÒ - Index Page Logic
 * Logica della pagina principale
 */

document.addEventListener('DOMContentLoaded', async () => {
  logger.info('Index page loaded');

  // Carica versione
  document.getElementById('version').textContent = BORDERO_CONFIG.APP_VERSION;

  // Carica dati
  await dataLoader.loadBrani();

  // Aggiorna statistiche
  updateStats();

  // Event listeners
  setupEventListeners();

  // Auto-sync ogni X minuti
  setInterval(() => {
    if (Network.isOnline()) {
      logger.info('Auto-sync triggered');
      dataLoader.loadBrani();
      updateStats();
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
  });

  // Pulsante Pulisci cache
  document.getElementById('btn-clear-cache')?.addEventListener('click', () => {
    if (confirm('⚠️ Sei sicuro di voler cancellare la cache? I dati verranno ricaricati da zero.')) {
      dataLoader.clearCache();
      updateStats();
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
  });

  window.addEventListener('offline', () => {
    logger.warn('Connection lost');
    Toast.warning('⚠️ Sei offline - Usando cache locale');
  });
}

logger.info('✓ Index.js caricato');
