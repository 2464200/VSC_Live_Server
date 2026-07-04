/**
 * BORDERÒ - Excel File Manager
 * Gestisce la selezione e caricamento del file Excel
 * Mostra dialogo all'utente per scegliere il file
 */

class ExcelFileManager {
  constructor() {
    this.fileInput = null;
    this.currentFile = null;
    this.init();
  }

  /**
   * Inizializza il file manager
   */
  init() {
    logger.info('ExcelFileManager: Inizializzazione...');
    
    // Verifica che XLSX sia caricato
    if (typeof XLSX === 'undefined') {
      logger.warn('⚠️ XLSX.js non caricato. Caricamento in corso...');
      this.loadXLSX();
    } else {
      logger.info('✓ XLSX.js disponibile');
    }
  }

  /**
   * Carica XLSX.js da CDN se non disponibile
   */
  loadXLSX() {
    return new Promise((resolve) => {
      if (typeof XLSX !== 'undefined') {
        resolve(true);
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.min.js';
      script.onload = () => {
        logger.info('✓ XLSX.js caricato da CDN');
        resolve(true);
      };
      script.onerror = () => {
        logger.error('❌ Errore caricamento XLSX.js da CDN');
        Toast.error('❌ Impossibile caricare XLSX.js');
        resolve(false);
      };
      document.head.appendChild(script);
    });
  }

  /**
   * Mostra dialogo per selezionare file Excel
   * @returns {Promise<File|null>}
   */
  showSelectDialog() {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.xlsx,.xls,.xlsm';
      
      input.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
          logger.info(`📁 File selezionato: ${file.name} (${this.formatFileSize(file.size)})`);
          this.currentFile = file;
          resolve(file);
        } else {
          logger.warn('Nessun file selezionato');
          resolve(null);
        }
      };
      
      input.onerror = () => {
        logger.error('Errore dialogo file');
        resolve(null);
      };
      
      input.click();
    });
  }

  /**
   * Formatta la dimensione del file in KB/MB
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Legge il file Excel e ritorna il workbook
   * @param {File} file - File Excel
   * @returns {Promise<Object>} Workbook XLSX
   */
  async readExcelFile(file) {
    logger.info(`ExcelFileManager: Lettura file ${file.name}...`);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      
      logger.info(`✓ Excel aperto: ${file.name}`);
      logger.info(`  Fogli trovati: ${workbook.SheetNames.length}`);
      logger.info(`  Nomi fogli: ${workbook.SheetNames.join(', ')}`);
      
      return workbook;
    } catch (error) {
      logger.error('Errore lettura file Excel', error);
      Toast.error('❌ Errore lettura file Excel');
      return null;
    }
  }

  /**
   * Verifica che il file contenga i fogli richiesti
   */
  validateWorkbook(workbook, requiredSheets = []) {
    const missing = requiredSheets.filter(sheet => 
      !workbook.SheetNames.includes(sheet)
    );

    if (missing.length > 0) {
      logger.warn(`⚠️ Fogli mancanti nel file Excel: ${missing.join(', ')}`);
      Toast.warning(`⚠️ Fogli mancanti: ${missing.join(', ')}`);
      return false;
    }

    return true;
  }
}

// Singleton instance
const excelFileManager = new ExcelFileManager();

logger.info('✓ ExcelFileManager.js caricato');
