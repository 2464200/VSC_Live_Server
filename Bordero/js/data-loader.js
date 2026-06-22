/**
 * BORDERO - Data Loader & Sync
 * Gestisce il caricamento dei dati da CSV e sincronizzazione con Excel
 */

class DataLoader {
  constructor() {
    this.brani = [];
    this.lastSync = null;
    this.isSyncing = false;
  }

  /**
   * Normalizza i campi dei brani importati dai CSV/Excel
   */
  normalizeBrani(brani) {
    return brani.map(brano => {
      const normalized = { ...brano };
      if (!normalized.titolo) {
        normalized.titolo = normalized.coreografia || normalized.brano || '';
      }
      if (!normalized.coreografia) {
        normalized.coreografia = normalized.titolo || normalized.brano || '';
      }
      if (!normalized.brano) {
        normalized.brano = normalized.titolo || normalized.coreografia || '';
      }
      return normalized;
    });
  }

  /**
   * Inizializza il data loader con sincronizzazione da Excel
   */
  async initialize() {
    logger.info('DataLoader: Inizializzazione con sync Excel...');

    try {
      // Prima tenta sincronizzazione da Excel
      const excelSynced = await excelSync.syncFromExcel();
      
      if (excelSynced) {
        // Se Excel sync OK, i dati sono in cache
        logger.info('Dati sincronizzati da Excel');
        return;
      } else {
        // Fallback a CSV locale
        logger.info('Fallback a CSV locale');
      }
    } catch (error) {
      logger.error('Errore init data loader', error);
    }
  }

  /**
   * Carica i dati dal CSV (o da cache se offline)
   */
  async loadBrani() {
    logger.info('DataLoader.loadBrani() - Iniziando caricamento dati...');

    // Prova cache Excel prima
    const cachedFromExcel = Storage.get('BORDERO_BRANI_DATA');
    if (cachedFromExcel && cachedFromExcel.length > 0) {
      const normalized = this.normalizeBrani(cachedFromExcel);
      logger.info(`Dati caricati da cache Excel (${normalized.length} brani)`);
      this.brani = normalized;
      return normalized;
    }

    // Poi prova cache generale
    const cached = Storage.get(BORDERO_CONFIG.CACHE_KEY_BRANI);
    if (cached && cached.length > 0) {
      const normalized = this.normalizeBrani(cached);
      logger.info(`Dati caricati da cache CSV (${normalized.length} brani)`);
      this.brani = normalized;
      return normalized;
    }

    // Carica da CSV locale
    try {
      const csvContent = await Network.fetchCSV(BORDERO_CONFIG.CSV_BRANI);
      const parsedBrani = CSVParser.parse(csvContent);
      this.brani = this.normalizeBrani(parsedBrani);
      
      // Salva in cache
      Storage.set(BORDERO_CONFIG.CACHE_KEY_BRANI, this.brani);
      this.lastSync = DateUtils.now();
      Storage.set(BORDERO_CONFIG.CACHE_KEY_SYNC, this.lastSync);

      logger.info(`Caricati ${this.brani.length} brani da CSV`);
      Toast.success(`${this.brani.length} brani caricati`);

      return this.brani;
    } catch (error) {
      logger.error('Errore caricamento CSV', error);
      Toast.error('Errore caricamento dati: ' + error.message);
      
      // Fallback a cache anche in caso di errore
      const fallback = Storage.get(BORDERO_CONFIG.CACHE_KEY_BRANI, []);
      this.brani = this.normalizeBrani(fallback);
      return this.brani;
    }
  }

  /**
   * Carica Comuni da cache Excel o CSV
   */
  parseComuniLombardia(csvContent) {
   const parsed = CSVParser.parse(csvContent);
   if (!parsed || parsed.length === 0) {
     return [];
   }

   const matches = parsed
     .filter(row => {
       const provincia = String(row.denominazione_provincia || row.provincia || row['denominazione provincia'] || '').trim();
       return provincia.toLowerCase().includes('bergamo');
     })
     .map(row => {
       return String(row.denominazione_in_italiano || row.denominazione_in_italiano || row['denominazione in italiano'] || row.nome || row.name || '').trim();
     })
     .filter(name => name.length > 0);

   return [...new Set(matches)];
  }

  async loadComuni() {
   logger.info('DataLoader.loadComuni()');

   try {
     // Prova cache Excel prima
     const cachedFromExcel = Storage.get('BORDERO_COMUNI_DATA');
     if (cachedFromExcel && cachedFromExcel.length > 0) {
       logger.info(`Comuni caricati da cache Excel (${cachedFromExcel.length})`);
       return cachedFromExcel;
     }

     // Carica CSV Lombardia e filtra per provincia Bergamo
     const csvContent = await Network.fetchCSV(BORDERO_CONFIG.CSV_COMUNI_LOMBARDIA);
     const comuniNames = this.parseComuniLombardia(csvContent);
     const comuni = comuniNames.map(name => ({ nome: name, name }));

     // Salva in cache
     Storage.set('BORDERO_COMUNI_DATA', comuni);
     logger.info(`Caricati ${comuni.length} comuni da CSV Lombardia`);
     return comuni;
   } catch (error) {
     logger.error('Errore caricamento Comuni', error);
     return [];
   }
  }
 
  /**
   * Estrae i nomi DJ da dBase.csv.
   * Supporta sia CSV con intestazione sia CSV senza header.
   */
  parseDJNamesFromCsv(csvContent) {
    const lines = csvContent
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line.length > 0);

    if (lines.length === 0) {
      return [];
    }

    // Prima prova a interpretare il CSV come oggetti con header
    try {
      const parsed = CSVParser.parse(csvContent);
      if (parsed.length > 0) {
        const firstRow = parsed[0];
        const hasHeader = Object.keys(firstRow).some(key => /^(nome|name|dj|deejay)$/i.test(key));
        if (hasHeader) {
          return parsed.map(row => row.nome || row.name || row.dj || row.deejay || Object.values(row)[0] || '').filter(Boolean);
        }
      }
    } catch (e) {
      logger.warn('parseDJNamesFromCsv: impossibile usare header', e.message);
    }

    // Fallback: prendi le prime tre righe e usa la prima colonna non vuota
    return lines.map(line => {
      const cols = CSVParser.parseCSVLine(line);
      return cols.find(col => col && col.trim().length > 0)?.trim() || '';
    }).filter(Boolean);
  }

  /**
   * Carica DJ da cache Excel o CSV
   */
  async loadDJ() {
    logger.info('DataLoader.loadDJ()');
 
    try {
      // Prova cache Excel prima
      const cachedFromExcel = Storage.get('BORDERO_DBASE_DATA');
      if (cachedFromExcel && cachedFromExcel.length > 0) {
        logger.info(`DJ caricati da cache Excel (${cachedFromExcel.length})`);
        return cachedFromExcel;
      }
 
      // Carica CSV locale
      const csvContent = await Network.fetchCSV(BORDERO_CONFIG.CSV_DBASE);
      const names = this.parseDJNamesFromCsv(csvContent)
        .slice(0, 3)
        .map(name => ({ nome: name, name }));
       
      // Salva in cache
      Storage.set('BORDERO_DBASE_DATA', names);
      logger.info(`Caricati ${names.length} DJ da CSV`);
      return names;
    } catch (error) {
      logger.error('Errore caricamento DJ', error);
      return [];
    }
  }

  /**
   * Ottieni brani con filtri e ricerca
   */
  getBrani(filters = {}, searchTerm = '') {
    let result = [...this.brani];

    // Applica ricerca full-text
    if (searchTerm) {
      const searchFields = ['titolo', 'brano', 'coreografia', 'autore', 'coreografo', 'collaboratori'];
      result = ObjectUtils.searchMultiField(result, searchTerm, searchFields);
    }

    // Applica filtri
    Object.keys(filters).forEach(field => {
      const value = filters[field];
      if (value && value.length > 0) {
        if (Array.isArray(value)) {
          result = result.filter(b => 
            value.includes(String(b[field]).toLowerCase())
          );
        } else {
          result = result.filter(b =>
            String(b[field]).toLowerCase().includes(String(value).toLowerCase())
          );
        }
      }
    });

    return result;
  }

  /**
   * Ordina brani
   */
  sortBrani(brani, sortField = 'id', sortOrder = 'asc') {
    const ascending = sortOrder.toLowerCase() === 'asc';
    return ObjectUtils.sortByField(brani, sortField, ascending);
  }

  /**
   * Ottieni brano per ID
   */
  getBranoById(id) {
    return this.brani.find(b => String(b.id) === String(id));
  }

  /**
   * Aggiungi/Modifica brano
   */
  saveBrano(brano) {
    const existing = this.brani.findIndex(b => String(b.id) === String(brano.id));
    
    if (existing >= 0) {
      this.brani[existing] = { ...this.brani[existing], ...brano };
      logger.info(`Brano ${brano.id} modificato`);
    } else {
      this.brani.push(brano);
      logger.info(`Brano ${brano.id} aggiunto`);
    }

    Storage.set(BORDERO_CONFIG.CACHE_KEY_BRANI, this.brani);
    Toast.success('Brano salvato');
  }

  /**
   * Elimina brano
   */
  deleteBrano(id) {
    const index = this.brani.findIndex(b => String(b.id) === String(id));
    if (index >= 0) {
      const brano = this.brani[index];
      this.brani.splice(index, 1);
      Storage.set(BORDERO_CONFIG.CACHE_KEY_BRANI, this.brani);
      logger.info(`Brano ${id} eliminato`);
      Toast.success(`Brano "${brano.titolo}" eliminato`);
    }
  }

  /**
   * Marca brano come completato (flag X)
   */
  markAsCompleted(id) {
    const brano = this.getBranoById(id);
    if (brano) {
      brano.flag = 'X';
      Storage.set(BORDERO_CONFIG.CACHE_KEY_BRANI, this.brani);
      
      // Salva flag in array separato
      const flagged = Storage.get(BORDERO_CONFIG.CACHE_KEY_FLAGGED, []);
      if (!flagged.includes(id)) {
        flagged.push(id);
        Storage.set(BORDERO_CONFIG.CACHE_KEY_FLAGGED, flagged);
      }
      
      logger.info(`Brano ${id} marcato come completato`);
    }
  }

  /**
   * Deseleziona flag
   */
  unmarkCompleted(id) {
    const brano = this.getBranoById(id);
    if (brano) {
      brano.flag = '';
      Storage.set(BORDERO_CONFIG.CACHE_KEY_BRANI, this.brani);
      
      const flagged = Storage.get(BORDERO_CONFIG.CACHE_KEY_FLAGGED, []);
      const index = flagged.indexOf(id);
      if (index >= 0) {
        flagged.splice(index, 1);
        Storage.set(BORDERO_CONFIG.CACHE_KEY_FLAGGED, flagged);
      }
      
      logger.info(`Brano ${id} deselezionato`);
    }
  }

  /**
   * Ottieni statistiche
   */
  getStats() {
    const total = this.brani.length;
    const completed = this.brani.filter(b => b.flag === 'X').length;
    const pending = total - completed;

    return {
      total,
      completed,
      pending,
      percentuale: total > 0 ? Math.round((completed / total) * 100) : 0,
      lastSync: this.lastSync || Storage.get(BORDERO_CONFIG.CACHE_KEY_SYNC),
    };
  }

  /**
   * Esporta dati a CSV
   */
  exportToCSV(brani = null) {
    const data = brani || this.brani;
    if (data.length === 0) {
      Toast.error('Nessun dato da esportare');
      return;
    }

    const headers = Object.keys(data[0]);
    let csv = headers.join(',') + '\n';

    data.forEach(item => {
      const values = headers.map(h => {
        const value = item[h] || '';
        return typeof value === 'string' && value.includes(',') 
          ? `"${value}"` 
          : value;
      });
      csv += values.join(',') + '\n';
    });

    // Scarica file
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bordero_export_${DateUtils.now().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    logger.info(`Esportati ${data.length} brani`);
    Toast.success(`Esportati ${data.length} brani`);
  }

  /**
   * Pulisci cache
   */
  clearCache() {
    Storage.remove(BORDERO_CONFIG.CACHE_KEY_BRANI);
    Storage.remove(BORDERO_CONFIG.CACHE_KEY_FILTERS);
    Storage.remove(BORDERO_CONFIG.CACHE_KEY_SYNC);
    Storage.remove(BORDERO_CONFIG.CACHE_KEY_FLAGGED);
    this.brani = [];
    logger.info('Cache eliminata');
    Toast.success('Cache eliminata');
  }

  /**
   * Ottieni ultimo tempo di sincronizzazione formattato
   */
  getLastSyncFormatted() {
    const lastSync = this.lastSync || Storage.get(BORDERO_CONFIG.CACHE_KEY_SYNC);
    if (!lastSync) return 'Mai';
    return DateUtils.formatDate(lastSync);
  }

  /**
   * SERATA MANAGEMENT
   * Salva lo stato della serata corrente (brani + metadata)
   */
  saveCurrentSerata(serataMetadata, braniWithFlags, options = {}) {
    const { silent = false } = options;

    const serata = {
      id: DateUtils.now(),
      metadata: serataMetadata,
      brani: braniWithFlags,
      savedAt: new Date().toISOString(),
    };

    Storage.set(BORDERO_CONFIG.CACHE_KEY_CURRENT_SERATA, serata);
    logger.info(`Serata salvata: DJ=${serataMetadata.dj}, Data=${serataMetadata.data}`);
    if (!silent) {
      Toast.success('Serata salvata automaticamente');
    }
    return serata;
  }

  /**
   * Recupera la serata corrente
   */
  getCurrentSerata() {
    return Storage.get(BORDERO_CONFIG.CACHE_KEY_CURRENT_SERATA, null);
  }

  /**
   * Archivia la serata corrente (completa) nella cronologia
   */
  archiveCurrentSerata(serataMetadata, braniWithFlags) {
    const serata = this.saveCurrentSerata(serataMetadata, braniWithFlags);
    
    // Aggiungi alla cronologia
    const history = Storage.get(BORDERO_CONFIG.CACHE_KEY_SERATA_HISTORY, []);
    history.push(serata);
    Storage.set(BORDERO_CONFIG.CACHE_KEY_SERATA_HISTORY, history);

    logger.info(`Serata archiviata (totale: ${history.length})`);
    Toast.success(`Serata archiviata (${braniWithFlags.filter(b => b.flag === 'X').length} brani eseguiti)`);
    
    return serata;
  }

  /**
   * Ottieni cronologia serate (solo metadata per performance)
   */
  getSerataHistory(limit = 50) {
    const history = Storage.get(BORDERO_CONFIG.CACHE_KEY_SERATA_HISTORY, []);
    return history.slice(-limit).reverse(); // Ultimi N, in ordine decrescente
  }

  /**
   * Ripristina una serata dalla cronologia (per vista/modifica)
   */
  restoreSerata(serataId) {
    const history = Storage.get(BORDERO_CONFIG.CACHE_KEY_SERATA_HISTORY, []);
    const serata = history.find(s => s.id === serataId);
    if (serata) {
      Storage.set(BORDERO_CONFIG.CACHE_KEY_CURRENT_SERATA, serata);
      logger.info(`Serata ripristinata: ${serataId}`);
      Toast.success('Serata ripristinata');
      return serata;
    }
    logger.warn(`Serata non trovata: ${serataId}`);
    return null;
  }
}

// Istanza globale
const dataLoader = new DataLoader();

logger.info('DataLoader.js caricato');
