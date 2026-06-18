/**
 * BORDERO - Configurazione Globale
 * Contiene tutte le impostazioni, costanti, e API endpoints
 */

const BORDERO_CONFIG = {
  // ========== APPLICAZIONE ==========
  APP_NAME: 'BORDERÒ DJ Manager',
  APP_VERSION: '1.0.0',
  APP_AUTHOR: 'Copilot',
  
  // ========== DATI & STORAGE ==========
  CSV_BRANI: './data/brani.csv',
  CACHE_KEY_BRANI: 'bordero_brani',
  CACHE_KEY_FILTERS: 'bordero_filters',
  CACHE_KEY_SYNC: 'bordero_lastSync',
  CACHE_KEY_FLAGGED: 'bordero_flagged',
  CACHE_KEY_PREFS: 'bordero_userPrefs',
  CACHE_KEY_CURRENT_SERATA: 'bordero_currentSerata',      // Serata in corso (brani + metadata)
  CACHE_KEY_SERATA_HISTORY: 'bordero_serataHistory',      // Array of completed serata
  CACHE_KEY_SERATA_ARCHIVE_DIR: 'C:\\VSC_SIAE\\Storico Serate\\', // Directory archivio
  SYNC_INTERVAL_MS: 5 * 60 * 1000, // 5 minuti
  
  // ========== GOOGLE SHEETS API ==========
  GOOGLE_SHEETS_API_KEY: 'YOUR_API_KEY_HERE', // Da configurare
  GOOGLE_SHEETS_ID: 'YOUR_SHEET_ID_HERE',     // Da configurare
  GOOGLE_SHEETS_RANGE: 'Elenco Brani!A1:Z1000',
  
  // ========== TABELLA & DISPLAY ==========
  ITEMS_PER_PAGE: 50,
  HEADER_STICKY: true,
  ALTERNATING_ROWS: true,
  HIGHLIGHT_FLAG_COLOR: '#ffff00',  // Giallo
  
  // ========== COLONNE TABELLA ==========
  TABLE_COLUMNS: [
    { id: 'flag', label: 'Flag', width: '50px', sortable: false },
    { id: 'id', label: 'ID', width: '60px', sortable: true },
    { id: 'titolo', label: 'Titolo', width: '200px', sortable: true },
    { id: 'autore', label: 'Autore', width: '150px', sortable: true },
    { id: 'genere', label: 'Genere', width: '100px', sortable: true },
    { id: 'info_livello', label: 'Info Livello', width: '120px', sortable: true },
    { id: 'info_coreo', label: 'Info Coreo', width: '150px', sortable: true },
    { id: 'coreografo', label: 'Coreografo', width: '150px', sortable: true },
    { id: 'collaboratori', label: 'Collaboratori', width: '200px', sortable: true },
  ],

  // ========== COLONNE SIAE EXPORT ==========
  SIAE_COLUMNS: [
    { id: 'titolo', label: 'Titolo' },
    { id: 'autore', label: 'Autore' },
    { id: 'compositore', label: 'Compositore' },
    { id: 'performer', label: 'Performer' },
    { id: 'durata', label: 'Durata' },
  ],
  
  // ========== LIVELLI DIFFICOLTÀ ==========
  LIVELLI: [
    'BASE',
    'INTERMEDIO',
    'AVANZATO',
    'SUPER AVANZATO',
  ],
  
  // ========== CATEGORIE COREOGRAFIA ==========
  CATEGORIE: [
    'COREOGRAFIA',
    'SUPER AVANZATO 1-2',
    'SUPER AVANZATO 2',
    'AVANZATO 1-2',
    'AVANZATO 2',
    'AVANZATO 1',
    'AVANZATO 2',
    'INTERMEDICO',
    'ALTRI COREO',
  ],
  
  // ========== COLORI ==========
  COLORS: {
    primary_orange: '#ff7f00',
    primary_hover: '#ff9933',
    bg_dark: '#1a1a1a',
    bg_light: '#f5f5f5',
    text_light: '#ffffff',
    text_dark: '#333333',
    flag_yellow: '#ffff00',
    flag_orange: '#ff8800',
    success_green: '#28a745',
    danger_red: '#dc3545',
    warning_orange: '#ff7f00',
  },
  
  // ========== FILTRI RAPIDI (Pulsanti colati) ==========
  QUICK_FILTERS: [
    { id: 'coreografia', label: 'COREOGRAFIA', color: 'blue', icon: '🎭' },
    { id: 'genere', label: 'GENERE', color: 'green', icon: '🎵' },
    { id: 'altro', label: 'ALTRO', color: 'yellow', icon: '⭐' },
    { id: 'livello', label: 'LIVELLO', color: 'orange', icon: '📊' },
  ],
  
  // ========== VIDEO ==========
  VIDEO_PLAYER_ENABLED: true,
  VIDEO_FULLSCREEN: true,
  VIDEO_AUTOPLAY: false,
  
  // ========== MONITOR SECONDARIO ==========
  DISPLAY_WINDOW_WIDTH: 1920,
  DISPLAY_WINDOW_HEIGHT: 1080,
  DISPLAY_REFRESH_MS: 1000, // Aggiorna ogni 1 secondo
  
  // ========== DEVELOPER ==========
  DEBUG_MODE: true,
  LOG_LEVEL: 'INFO', // DEBUG, INFO, WARN, ERROR
  MOCK_DATA: false, // Se true, usa dati mock invece di CSV reali
};

/**
 * Utility per logging
 */
const logger = {
  debug: (msg, data) => BORDERO_CONFIG.DEBUG_MODE && console.log(`[DEBUG] ${msg}`, data || ''),
  info: (msg, data) => console.log(`[INFO] ${msg}`, data || ''),
  warn: (msg, data) => console.warn(`[WARN] ${msg}`, data || ''),
  error: (msg, data) => console.error(`[ERROR] ${msg}`, data || ''),
};

// Log configurazione al caricamento
logger.info(`🎭 ${BORDERO_CONFIG.APP_NAME} v${BORDERO_CONFIG.APP_VERSION} caricato`);
