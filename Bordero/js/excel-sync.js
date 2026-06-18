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
    this.waitForXLSX();
  }

  /**
   * Aspetta che XLSX sia disponibile (max 10 secondi)
   */
  async waitForXLSX() {
    return new Promise((resolve) => {
      let attempts = 0;
      const maxAttempts = 100; // 10 secondi (100ms x 100)
      
      const checkXLSX = setInterval(() => {
        if (typeof XLSX !== 'undefined') {
          clearInterval(checkXLSX);
          logger.info('✅ XLSX.js disponibile');
          resolve(true);
        }
        
        attempts++;
        if (attempts >= maxAttempts) {
          clearInterval(checkXLSX);
          logger.warn('⚠️ XLSX.js non caricato dopo 10 secondi');
          resolve(false);
        }
      }, 100);
    });
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
      // Aspetta che XLSX sia disponibile
      const xlsxReady = await this.waitForXLSX();
      if (!xlsxReady) {
        logger.error('❌ XLSX.js non è caricato. Controlla la connessione CDN.');
        Toast.error('❌ Libreria XLSX non disponibile');
        return false;
      }

      // Verifica che XLSX sia effettivamente disponibile
      if (typeof XLSX === 'undefined') {
        logger.error('❌ XLSX non trovato dopo attesa');
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
   * ROBUSTA: Se foglio non trovato, usa il PRIMO foglio per i brani
   */
  async syncBrani(workbook) {
    try {
      let sheetName = 'Elenco Brani (statico)';
      logger.info(`📖 Cercando foglio: "${sheetName}"`);
      logger.info(`📋 Fogli disponibili: ${workbook.SheetNames.join(', ')}`);
      
      // Se foglio esatto non trovato, cerca alternative o usa il primo
      if (!workbook.SheetNames.includes(sheetName)) {
        logger.warn(`⚠️ Foglio "${sheetName}" NON trovato`);
        
        // Prova varianti comuni
        const alternatives = [
          'Elenco Brani',
          'ELENCO BRANI',
          'Brani',
          'BRANI',
          'Songs',
          'Sheet1'
        ];
        
        const found = alternatives.find(alt => workbook.SheetNames.includes(alt));
        if (found) {
          sheetName = found;
          logger.info(`✅ Trovato foglio alternativo: "${sheetName}"`);
        } else {
          // Se nulla trovato, usa il PRIMO foglio
          sheetName = workbook.SheetNames[0];
          logger.warn(`📌 Nessun foglio Brani trovato. Usando primo: "${sheetName}"`);
        }
      }

      const worksheet = workbook.Sheets[sheetName];
      if (!worksheet) {
        logger.error(`❌ Worksheet NULL per foglio "${sheetName}"`);
        Toast.error(`❌ Errore accesso foglio "${sheetName}"`);
        return false;
      }

      // Leggi i dati con opzioni robuste
      let data = XLSX.utils.sheet_to_json(worksheet, {
        defval: '',
        blankrows: false,
        raw: false
      });

      logger.info(`📊 Dati letti dal foglio: ${data.length} righe`);

      // Se prima riga è tutta vuota, rimuovila
      if (data.length > 0 && Object.values(data[0]).every(v => !v || v === '')) {
        logger.warn('⚠️ Prima riga vuota, rimuovendo...');
        data = data.slice(1);
      }

      if (data.length === 0) {
        logger.warn('⚠️ Nessun dato nel foglio Elenco Brani');
        Toast.warning('⚠️ Il foglio non contiene dati');
        return false;
      }

      // Log primo elemento
      logger.info(`📝 Primo brano: ${JSON.stringify(data[0])}`);

      // Salva in cache
      Storage.set('BORDERO_BRANI_DATA', data);
      logger.info(`✅ Sincronizzati ${data.length} brani in cache localStorage`);
      
      // Sincronizza su disco via server Node.js
      await this.syncToDisk('brani', data);
      
      Toast.success(`✅ ${data.length} brani sincronizzati su disco`);

      return true;
    } catch (error) {
      logger.error('❌ Errore sync Brani', error);
      logger.error('   Stack:', error.stack);
      Toast.error(`❌ Errore sincronizzazione Brani: ${error.message}`);
      return false;
    }
  }

  /**
   * Sincronizza il foglio "Comuni Italia" → comuni_italia.csv
   * ROBUSTA: Se foglio non trovato, usa il SECONDO foglio o alternativa
   */
  async syncComuni(workbook) {
    try {
      let sheetName = 'Comuni Italia';
      logger.info(`📖 Cercando foglio: "${sheetName}"`);
      
      if (!workbook.SheetNames.includes(sheetName)) {
        logger.warn(`⚠️ Foglio "${sheetName}" NON trovato`);
        
        // Prova varianti comuni
        const alternatives = [
          'Comuni',
          'COMUNI',
          'Italia',
          'Locations',
          'Sheet2'
        ];
        
        const found = alternatives.find(alt => workbook.SheetNames.includes(alt));
        if (found) {
          sheetName = found;
          logger.info(`✅ Trovato foglio alternativo: "${sheetName}"`);
        } else {
          // Se nulla, usa il SECONDO foglio (se esiste)
          sheetName = workbook.SheetNames[1] || workbook.SheetNames[0];
          logger.warn(`📌 Usando foglio: "${sheetName}"`);
        }
      }

      const worksheet = workbook.Sheets[sheetName];
      if (!worksheet) {
        logger.error(`❌ Worksheet NULL per foglio "${sheetName}"`);
        return false;
      }

      let data = XLSX.utils.sheet_to_json(worksheet, {
        defval: '',
        blankrows: false,
        raw: false
      });

      logger.info(`📊 Dati letti dal foglio: ${data.length} righe`);

      // Se prima riga vuota, rimuovi
      if (data.length > 0 && Object.values(data[0]).every(v => !v || v === '')) {
        data = data.slice(1);
      }

      if (data.length === 0) {
        logger.warn('⚠️ Nessun dato nel foglio Comuni Italia');
        Toast.warning('⚠️ Il foglio non contiene dati');
        return false;
      }

      logger.info(`📝 Primo comune: ${JSON.stringify(data[0])}`);

      // Salva in cache
      Storage.set('BORDERO_COMUNI_DATA', data);
      logger.info(`✅ Sincronizzati ${data.length} comuni in cache localStorage`);
      
      // Sincronizza su disco via server Node.js
      await this.syncToDisk('comuni', data);
      
      Toast.success(`✅ ${data.length} comuni sincronizzati su disco`);

      return true;
    } catch (error) {
      logger.error('❌ Errore sync Comuni', error);
      Toast.error(`❌ Errore sincronizzazione Comuni: ${error.message}`);
      return false;
    }
  }

  /**
   * Sincronizza il foglio "dBase" → dBase.csv
   * ROBUSTA: Se foglio non trovato, usa il TERZO foglio o alternativa
   */
  async syncDBase(workbook) {
    try {
      let sheetName = 'dBase';
      logger.info(`📖 Cercando foglio: "${sheetName}"`);
      
      if (!workbook.SheetNames.includes(sheetName)) {
        logger.warn(`⚠️ Foglio "${sheetName}" NON trovato`);
        
        // Prova varianti comuni
        const alternatives = [
          'Database',
          'DATABASE',
          'DJ',
          'DJs',
          'Performers',
          'Sheet3'
        ];
        
        const found = alternatives.find(alt => workbook.SheetNames.includes(alt));
        if (found) {
          sheetName = found;
          logger.info(`✅ Trovato foglio alternativo: "${sheetName}"`);
        } else {
          // Se nulla, usa il TERZO foglio (se esiste)
          sheetName = workbook.SheetNames[2] || workbook.SheetNames[0];
          logger.warn(`📌 Usando foglio: "${sheetName}"`);
        }
      }

      const worksheet = workbook.Sheets[sheetName];
      if (!worksheet) {
        logger.error(`❌ Worksheet NULL per foglio "${sheetName}"`);
        return false;
      }

      let data = XLSX.utils.sheet_to_json(worksheet, {
        defval: '',
        blankrows: false,
        raw: false
      });

      logger.info(`📊 Dati letti dal foglio: ${data.length} righe`);

      // Se prima riga vuota, rimuovi
      if (data.length > 0 && Object.values(data[0]).every(v => !v || v === '')) {
        data = data.slice(1);
      }

      if (data.length === 0) {
        logger.warn('⚠️ Nessun dato nel foglio dBase');
        Toast.warning('⚠️ Il foglio non contiene dati');
        return false;
      }

      logger.info(`📝 Primo DJ: ${JSON.stringify(data[0])}`);

      // Salva in cache
      Storage.set('BORDERO_DBASE_DATA', data);
      logger.info(`✅ Sincronizzati ${data.length} DJ in cache localStorage`);
      
      // Sincronizza su disco via server Node.js
      await this.syncToDisk('dbase', data);
      
      Toast.success(`✅ ${data.length} DJ sincronizzati su disco`);

      return true;
    } catch (error) {
      logger.error('❌ Errore sync dBase', error);
      Toast.error(`❌ Errore sincronizzazione dBase: ${error.message}`);
      return false;
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
   * Sincronizza i dati su disco via API Node.js
   */
  async syncToDisk(dataType, data) {
    try {
      const SYNC_SERVER = 'http://localhost:5501';
      const endpoint = `${SYNC_SERVER}/api/sync/${dataType}`;

      logger.info(`🌐 POST a ${endpoint}`);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();
      logger.info(`✅ Server risposta: ${result.message}`);
      logger.info(`📁 File salvato: ${result.file}`);

    } catch (error) {
      logger.warn(`⚠️ Non è possibile sincronizzare su disco. Server Node.js su :5501 non disponibile.`);
      logger.warn(`   Dati rimangono in cache localStorage.`);
      logger.warn(`   Avvia il sync-server: node Bordero/server/sync-server.js`);
    }
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
