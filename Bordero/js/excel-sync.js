/**
 * BORDERÒ - Excel Sync System
 * Sincronizza dati da Excel all'avvio del progetto
 * 
 * Fogli da sincronizzare:
 * - "Elenco Brani (statico)" → brani.csv
 * - "Comuni Italia" → comuni_italia.csv
 * - "dBase" → dBase.csv
 */

class ExcelSync {
  constructor() {
    this.excelFile = null;
    this.lastSync = null;
    this.initFileDialog();
  }

  /**
   * Inizializza la finestra di dialogo per selezionare il file Excel
   */
  initFileDialog() {
    // Crea hidden input file (una sola volta)
    if (!document.getElementById('excel-file-input')) {
      const input = document.createElement('input');
      input.type = 'file';
      input.id = 'excel-file-input';
      input.accept = '.xlsx,.xls,.xlsm';
      input.style.display = 'none';
      input.addEventListener('change', (e) => this.handleFileSelect(e));
      document.body.appendChild(input);
    }
  }

  /**
   * Mostra finestra di dialogo per selezionare file Excel
   */
  showFileDialog() {
    return new Promise((resolve) => {
      const input = document.getElementById('excel-file-input');
      input.value = ''; // Reset
      input.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
          this.excelFile = file;
          logger.info(`Excel file selezionato: ${file.name}`);
          resolve(true);
        } else {
          resolve(false);
        }
      };
      input.click();
    });
  }

  /**
   * Gestisce la selezione del file
   */
  handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
      this.excelFile = file;
      logger.info(`Excel file caricato: ${file.name}`);
    }
  }

  /**
   * Sincronizza i dati da Excel alle CSV
   */
  async syncFromExcel() {
    logger.info('ExcelSync: Iniziando sincronizzazione da Excel...');

    try {
      // Verifica che XLSX sia disponibile
      if (typeof XLSX === 'undefined') {
        logger.error('XLSX.js non è caricato. Installa la libreria XLSX.');
        Toast.error('❌ Libreria XLSX non disponibile');
        return false;
      }

      // Chiedi al user di selezionare il file se non già selezionato
      if (!this.excelFile) {
        logger.info('Richiedendo selezione file Excel...');
        const selected = await this.showFileDialog();
        if (!selected) {
          logger.warn('Nessun file selezionato. Usando CSV locale.');
          return false;
        }
      }

      // Leggi il file Excel
      const arrayBuffer = await this.excelFile.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });

      logger.info(`Excel aperto: ${workbook.SheetNames.length} fogli trovati`);
      logger.info(`Fogli: ${workbook.SheetNames.join(', ')}`);

      // Sincronizza i tre fogli
      await this.syncBrani(workbook);
      await this.syncComuni(workbook);
      await this.syncDBase(workbook);

      this.lastSync = DateUtils.now();
      Storage.set('BORDERO_LAST_EXCEL_SYNC', this.lastSync);
      logger.info('✓ Sincronizzazione Excel completata');
      Toast.success('✓ Dati sincronizzati da Excel');

      return true;
    } catch (error) {
      logger.error('Errore sincronizzazione Excel', error);
      Toast.warning('⚠️ Sincronizzazione Excel fallita, usando CSV locale');
      return false;
    }
  }

  /**
   * Sincronizza il foglio "Elenco Brani (statico)" → brani.csv
   */
  async syncBrani(workbook) {
    try {
      const sheetName = 'Elenco Brani (statico)';
      if (!workbook.SheetNames.includes(sheetName)) {
        logger.warn(`Foglio "${sheetName}" non trovato in Excel`);
        return;
      }

      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet);

      if (data.length === 0) {
        logger.warn('Nessun dato nel foglio Elenco Brani');
        return;
      }

      // Converti a CSV
      const csv = this.jsonToCSV(data);

      // Salva localmente
      await this.saveCSV('Bordero/data/brani.csv', csv);

      // Salva in cache
      Storage.set('BORDERO_BRANI_DATA', data);

      logger.info(`✓ Sincronizzati ${data.length} brani da Excel`);
    } catch (error) {
      logger.error('Errore sync Brani', error);
    }
  }

  /**
   * Sincronizza il foglio "Comuni Italia" → comuni_italia.csv
   */
  async syncComuni(workbook) {
    try {
      const sheetName = 'Comuni Italia';
      if (!workbook.SheetNames.includes(sheetName)) {
        logger.warn(`Foglio "${sheetName}" non trovato in Excel`);
        return;
      }

      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet);

      if (data.length === 0) {
        logger.warn('Nessun dato nel foglio Comuni Italia');
        return;
      }

      // Converti a CSV
      const csv = this.jsonToCSV(data);

      // Salva localmente
      await this.saveCSV('Bordero/data/comuni_italia.csv', csv);

      // Salva in cache
      Storage.set('BORDERO_COMUNI_DATA', data);

      logger.info(`✓ Sincronizzati ${data.length} comuni da Excel`);
    } catch (error) {
      logger.error('Errore sync Comuni', error);
    }
  }

  /**
   * Sincronizza il foglio "dBase" → dBase.csv
   */
  async syncDBase(workbook) {
    try {
      const sheetName = 'dBase';
      if (!workbook.SheetNames.includes(sheetName)) {
        logger.warn(`Foglio "${sheetName}" non trovato in Excel`);
        return;
      }

      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet);

      if (data.length === 0) {
        logger.warn('Nessun dato nel foglio dBase');
        return;
      }

      // Converti a CSV
      const csv = this.jsonToCSV(data);

      // Salva localmente
      await this.saveCSV('Bordero/data/dBase.csv', csv);

      // Salva in cache
      Storage.set('BORDERO_DBASE_DATA', data);

      logger.info(`✓ Sincronizzati ${data.length} DJ da Excel`);
    } catch (error) {
      logger.error('Errore sync dBase', error);
    }
  }

  /**
   * Converte JSON array a formato CSV
   */
  jsonToCSV(jsonArray) {
    if (jsonArray.length === 0) return '';

    // Header
    const headers = Object.keys(jsonArray[0]);
    const headerLine = headers.map(h => this.escapeCSV(h)).join(',');

    // Dati
    const dataLines = jsonArray.map(row =>
      headers.map(h => this.escapeCSV(row[h] || '')).join(',')
    );

    return [headerLine, ...dataLines].join('\n');
  }

  /**
   * Escape CSV values
   */
  escapeCSV(value) {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  /**
   * Salva CSV (nota: in browser non può scrivere file system)
   * Questa è una placeholder per future integrazioni backend
   */
  async saveCSV(path, content) {
    // TODO: Implementare endpoint Node.js per scrivere file
    // Per ora i dati sono in cache e il frontend li usa da lì
    logger.debug(`Salvataggio CSV (cache): ${path}`);
  }

  /**
   * Ritorna i dati dal cache (se non disponibile via file)
   */
  getCachedBrani() {
    return Storage.get('BORDERO_BRANI_DATA') || [];
  }

  getCachedComuni() {
    return Storage.get('BORDERO_COMUNI_DATA') || [];
  }

  getCachedDBase() {
    return Storage.get('BORDERO_DBASE_DATA') || [];
  }
}

// Singleton instance
const excelSync = new ExcelSync();

logger.info('✓ ExcelSync.js caricato');
