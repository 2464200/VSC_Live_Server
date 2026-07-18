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

  resolveDataUrl(relativePath) {
    if (typeof window !== 'undefined' && window.location) {
      return new URL(relativePath, window.location.href).href;
    }
    return relativePath;
  }

  /**
   * Inizializza il data loader con sincronizzazione da Excel
   */
  async initialize(promptForFile = false) {
    logger.info('DataLoader: Inizializzazione con sync Excel...');

    try {
      const excelSynced = await excelSync.syncFromExcel(promptForFile);
      
      if (excelSynced) {
        logger.info('Dati sincronizzati da Excel');
        return;
      }

      logger.info('Fallback a CSV locale senza errori visibili');
    } catch (error) {
      logger.error('Errore init data loader', error);
    }
  }

  normalizeBranoRecord(brano) {
    const normalized = { ...brano };

    const getFirstValue = (...values) => {
      for (const value of values) {
        if (value !== null && value !== undefined) {
          const text = String(value).trim();
          if (text) return text;
        }
      }
      return '';
    };

    normalized.id = getFirstValue(brano.id, brano.ID, brano['ID'], brano['id']);
    normalized.titolo = getFirstValue(
      brano.titolo,
      brano.title,
      brano.coreografia,
      brano['coreografia'],
      brano['Titolo'],
      brano['titolo coreografia'],
      brano['coreografia titolo']
    );
    normalized.brano = getFirstValue(brano.brano, brano.song, brano.canzone, brano['brano']);
    normalized.autore = getFirstValue(brano.autore, brano.author, brano['autore']);
    normalized.genere = getFirstValue(brano.genere, brano['genere']);
    normalized.info_livello = getFirstValue(brano.info_livello, brano['info livello'], brano['info_livello']);
    normalized.info_coreo = getFirstValue(brano.info_coreo, brano['info coreo'], brano['info coreo 1'], brano['info coreo 2']);
    normalized.coreografo = getFirstValue(brano.coreografo, brano['coreografo']);
    normalized.collaboratori = getFirstValue(brano.collaboratori, brano['collaboratori']);
    normalized.flag = getFirstValue(brano.flag, brano['flag']);
    normalized.timestamp = getFirstValue(brano.timestamp, brano['timestamp']);

    return normalized;
  }

  normalizeBraniList(brani) {
    if (!Array.isArray(brani)) return [];
    return brani.map(item => this.normalizeBranoRecord(item));
  }

  normalizeDjRecord(djRecord) {
    if (typeof djRecord === 'string') {
      const nome = djRecord.trim();
      return nome ? { nome, name: nome } : null;
    }

    if (!djRecord || typeof djRecord !== 'object') {
      return null;
    }

    const getFirstValue = (...values) => {
      for (const value of values) {
        if (value !== null && value !== undefined) {
          const text = String(value).trim();
          if (text) return text;
        }
      }
      return '';
    };

    const nome = getFirstValue(
      djRecord.nome,
      djRecord.name,
      djRecord.Nome,
      djRecord['Nome'],
      djRecord['nome'],
      djRecord['DJ'],
      djRecord['dj'],
      djRecord['DJ Name'],
      djRecord['dj name']
    );

    if (!nome) {
      const fallbackValues = Object.values(djRecord)
        .filter(value => typeof value === 'string' || typeof value === 'number')
        .map(value => String(value).trim())
        .filter(value => value && !value.startsWith('http'));
      const fallback = fallbackValues.find(value => value && !/^(x|select|base|intermedio|avanzato|super avanzato|gold|altre coreo|coppi|tre persone|4 persone|two step|halloween|natalizia|stage|contra|sigla chiusura|estate 2021|estate 2022|estate 2023|estate 2024|estate 2025|doppia coreo|tripla coreo)$/i.test(value));
      if (fallback) {
        return { nome: fallback, name: fallback };
      }
      return null;
    }

    return { nome, name: nome };
  }

  normalizeDjList(djList) {
    if (!Array.isArray(djList)) return [];

    const normalized = djList
      .map(item => this.normalizeDjRecord(item))
      .filter(Boolean);

    const unique = [];
    const seen = new Set();
    normalized.forEach(item => {
      const key = item.nome.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(item);
      }
    });

    return unique;
  }

  normalizeComuneRecord(comune) {
    if (typeof comune === 'string') {
      const nome = comune.trim();
      return nome ? { nome, name: nome } : null;
    }

    if (!comune || typeof comune !== 'object') {
      return null;
    }

    const getFirstValue = (...values) => {
      for (const value of values) {
        if (value !== null && value !== undefined) {
          const text = String(value).trim();
          if (text) return text;
        }
      }
      return '';
    };

    const candidateKeys = [
      'nome',
      'name',
      'Nome',
      'denominazione_in_italiano',
      'denominazione',
      'denominazione_italiana',
      'denominazione in italiano',
      'comune',
      'nome_comune',
      'luogo',
      'localita',
      'località',
      'Localita',
      'Comune'
    ];

    let nome = '';
    for (const key of candidateKeys) {
      nome = getFirstValue(comune[key]);
      if (nome) break;
    }

    if (!nome) {
      const fallbackValue = Object.entries(comune)
        .map(([, value]) => String(value ?? '').trim())
        .find(value => value && !/^\d+$/.test(value) && !/^[A-Z]{2}$/.test(value) && value.length > 2);

      nome = fallbackValue || '';
    }

    const regione = getFirstValue(
      comune.regione,
      comune.denominazione_regione,
      comune['denominazione regione'],
      comune['Denominazione regione']
    );

    const citta = getFirstValue(
      comune.citta,
      comune.provincia,
      comune.denominazione_provincia,
      comune['denominazione provincia'],
      comune['Denominazione provincia']
    );

    return nome ? { nome, name: nome, regione, citta, paese: nome } : null;
  }

  normalizeComuniList(comuniList) {
    if (!Array.isArray(comuniList)) return [];

    const normalized = comuniList
      .map(item => this.normalizeComuneRecord(item))
      .filter(Boolean);

    const unique = [];
    const seen = new Set();
    normalized.forEach(item => {
      const key = item.nome.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(item);
      }
    });

    return unique;
  }

  normalizeLocationRecord(locationRecord) {
    if (!locationRecord || typeof locationRecord !== 'object') {
      return null;
    }

    const getFirstValue = (...values) => {
      for (const value of values) {
        if (value !== null && value !== undefined) {
          const text = String(value).trim();
          if (text) return text;
        }
      }
      return '';
    };

    const normalized = {
      nome_evento: getFirstValue(locationRecord.nome_evento, locationRecord.Nome_evento, locationRecord['Nome_evento']),
      localita: getFirstValue(locationRecord.localita, locationRecord.Localita, locationRecord['Località'], locationRecord['Localita'], locationRecord['Località']),
      tipo_struttura: getFirstValue(locationRecord.tipo_struttura, locationRecord.Tipo_Struttura, locationRecord['Tipo_Struttura']),
      struttura_coperta: getFirstValue(locationRecord.struttura_coperta, locationRecord.Struttura_Coperta, locationRecord['Struttura_Coperta']),
      provincia: getFirstValue(locationRecord.provincia, locationRecord.Provincia),
      paese: getFirstValue(locationRecord.paese, locationRecord.Paese),
      indirizzo: getFirstValue(locationRecord.indirizzo, locationRecord.Indirizzo),
      civico: getFirstValue(locationRecord.civico, locationRecord.Civico),
      referente: getFirstValue(locationRecord.referente, locationRecord.Referente),
      cell_referente: getFirstValue(locationRecord.cell_referente, locationRecord.Cell_Referente, locationRecord['Cell_Referente']),
      tipo_pista: getFirstValue(locationRecord.tipo_pista, locationRecord.Tipo_Pista, locationRecord['Tipo_Pista']),
      tipo_prese_corrente: getFirstValue(locationRecord.tipo_prese_corrente, locationRecord.Tipo_Prese_Corrente, locationRecord['Tipo_Prese_Corrente']),
      impianto_audio: getFirstValue(locationRecord.impianto_audio, locationRecord.Impianto_Audio, locationRecord['Impianto_Audio']),
      impianto_luci: getFirstValue(locationRecord.impianto_luci, locationRecord.Impianto_Luci, locationRecord['Impianto_Luci']),
      service: getFirstValue(locationRecord.service, locationRecord.Service),
      palco_dj: getFirstValue(locationRecord.palco_dj, locationRecord.Palco_DJ, locationRecord['Palco_DJ']),
      palco_ballerini: getFirstValue(locationRecord.palco_ballerini, locationRecord.Palco_Ballerini, locationRecord['Palco_Ballerini']),
      parcheggio: getFirstValue(locationRecord.parcheggio, locationRecord.Parcheggio),
      bar_ristoro: getFirstValue(locationRecord.bar_ristoro, locationRecord.Bar_Ristoro, locationRecord['Bar_Ristoro']),
      toilette: getFirstValue(locationRecord.toilette, locationRecord.Toilette),
    };

    if (!normalized.nome_evento && !normalized.localita && !normalized.referente) {
      return null;
    }

    normalized.id = getFirstValue(locationRecord.id, locationRecord.ID, locationRecord.rowIndex);

    return normalized;
  }

  normalizeLocationsList(locationList) {
    if (!Array.isArray(locationList)) return [];

    return locationList
      .map((item, index) => {
        const normalized = this.normalizeLocationRecord(item);
        if (!normalized) return null;
        return {
          id: normalized.id || String(index + 2),
          ...normalized,
        };
      })
      .filter(Boolean);
  }

  normalizeLocationOptionRows(optionRows) {
    if (!Array.isArray(optionRows)) return [];

    return optionRows
      .map((row) => {
        if (!row || typeof row !== 'object') return null;
        const group = String(row.group || row.Group || '').trim();
        const parent = String(row.parent || row.Parent || '').trim();
        const value = String(row.value || row.Value || '').trim();
        if (!group || !value) return null;
        return { group, parent, value };
      })
      .filter(Boolean);
  }

  buildLocationPopupOptions(optionRows) {
    const rows = this.normalizeLocationOptionRows(optionRows);
    const options = {
      yesNo: [],
      tipoPista: [],
      tipoPreseCorrente: [],
      province: [],
      paesiByProvincia: {},
    };

    rows.forEach((row) => {
      switch (row.group) {
        case 'yesNo':
          options.yesNo.push(row.value);
          break;
        case 'tipoPista':
          options.tipoPista.push(row.value);
          break;
        case 'tipoPreseCorrente':
          options.tipoPreseCorrente.push(row.value);
          break;
        case 'province':
          options.province.push(row.value);
          break;
        case 'paese':
          if (!options.paesiByProvincia[row.parent]) {
            options.paesiByProvincia[row.parent] = [];
          }
          options.paesiByProvincia[row.parent].push(row.value);
          break;
      }
    });

    const uniqueSorted = (values) => [...new Set(values.filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, 'it', { sensitivity: 'base' }));

    options.yesNo = uniqueSorted(options.yesNo);
    options.tipoPista = uniqueSorted(options.tipoPista);
    options.tipoPreseCorrente = uniqueSorted(options.tipoPreseCorrente);
    options.province = uniqueSorted(options.province);

    Object.keys(options.paesiByProvincia).forEach((province) => {
      options.paesiByProvincia[province] = uniqueSorted(options.paesiByProvincia[province]);
    });

    return options;
  }

  /**
   * Carica i dati dal CSV (o da cache se offline)
   */
  async loadBrani() {
    logger.info('DataLoader.loadBrani() - Iniziando caricamento dati...');

    const cachedFromExcel = Storage.get('BORDERO_BRANI_DATA');
    const cached = Storage.get(BORDERO_CONFIG.CACHE_KEY_BRANI);

    try {
      const csvContent = await Network.fetchCSV(this.resolveDataUrl(BORDERO_CONFIG.CSV_BRANI));
      this.brani = this.normalizeBraniList(CSVParser.parse(csvContent));

      // Salva in cache
      Storage.set('BORDERO_BRANI_DATA', this.brani);
      Storage.set(BORDERO_CONFIG.CACHE_KEY_BRANI, this.brani);
      this.lastSync = DateUtils.now();
      Storage.set(BORDERO_CONFIG.CACHE_KEY_SYNC, this.lastSync);

      logger.info(`Caricati ${this.brani.length} brani da CSV`);
      Toast.success(`${this.brani.length} brani caricati`);

      return this.brani;
    } catch (error) {
      logger.error('Errore caricamento CSV', error);
      Toast.error('Errore caricamento dati: ' + error.message);

      if (cachedFromExcel && cachedFromExcel.length > 0) {
        logger.warn(`Fallback cache Excel (${cachedFromExcel.length} brani)`);
        this.brani = this.normalizeBraniList(cachedFromExcel);
        return this.brani;
      }

      if (cached && cached.length > 0) {
        logger.warn(`Fallback cache CSV (${cached.length} brani)`);
        this.brani = this.normalizeBraniList(cached);
        return this.brani;
      }

      return [];
    }
  }

  /**
   * Carica Comuni da cache Excel o CSV
   */
  async loadComuni() {
    logger.info('DataLoader.loadComuni()');

    try {
      // Prova cache Excel prima
      const cachedFromExcel = Storage.get('BORDERO_COMUNI_DATA');
      if (cachedFromExcel && cachedFromExcel.length > 0) {
        logger.info(`Comuni caricati da cache Excel (${cachedFromExcel.length})`);
        return this.normalizeComuniList(cachedFromExcel);
      }

      // Fallback a CSV
      const csvContent = await Network.fetchCSV(this.resolveDataUrl(BORDERO_CONFIG.CSV_COMUNI));
      const comuni = this.normalizeComuniList(CSVParser.parse(csvContent));
      
      // Salva in cache
      Storage.set('BORDERO_COMUNI_DATA', comuni);
      logger.info(`Caricati ${comuni.length} comuni da CSV`);
      return comuni;
    } catch (error) {
      logger.error('Errore caricamento Comuni', error);
      return [];
    }
  }

  async loadLocations() {
    logger.info('DataLoader.loadLocations()');

    try {
      const cachedFromExcel = Storage.get('BORDERO_LOCATION_DATA');
      if (cachedFromExcel && cachedFromExcel.length > 0) {
        logger.info(`Location caricate da cache Excel (${cachedFromExcel.length})`);
        return this.normalizeLocationsList(cachedFromExcel);
      }

      const cached = Storage.get(BORDERO_CONFIG.CACHE_KEY_LOCATION);
      if (cached && cached.length > 0) {
        logger.info(`Location caricate da cache locale (${cached.length})`);
        return this.normalizeLocationsList(cached);
      }

      const csvContent = await Network.fetchCSV(this.resolveDataUrl(BORDERO_CONFIG.CSV_LOCATION));
      const locations = this.normalizeLocationsList(CSVParser.parse(csvContent));

      Storage.set('BORDERO_LOCATION_DATA', locations);
      Storage.set(BORDERO_CONFIG.CACHE_KEY_LOCATION, locations);
      logger.info(`Caricate ${locations.length} location da CSV`);
      return locations;
    } catch (error) {
      logger.error('Errore caricamento Location', error);
      return [];
    }
  }

  async loadLocationPopupOptions() {
    logger.info('DataLoader.loadLocationPopupOptions()');

    try {
      const cachedFromExcel = Storage.get('BORDERO_LOCATION_OPTION_ROWS');
      if (cachedFromExcel && cachedFromExcel.length > 0) {
        logger.info(`Opzioni Location caricate da cache Excel (${cachedFromExcel.length})`);
        return this.buildLocationPopupOptions(cachedFromExcel);
      }

      const cached = Storage.get(BORDERO_CONFIG.CACHE_KEY_LOCATION_OPTIONS);
      if (cached && typeof cached === 'object') {
        logger.info('Opzioni Location caricate da cache locale');
        return cached;
      }

      const csvContent = await Network.fetchCSV(this.resolveDataUrl(BORDERO_CONFIG.CSV_LOCATION_OPTIONS));
      const optionRows = this.normalizeLocationOptionRows(CSVParser.parse(csvContent));
      const options = this.buildLocationPopupOptions(optionRows);
      Storage.set('BORDERO_LOCATION_OPTION_ROWS', optionRows);
      Storage.set(BORDERO_CONFIG.CACHE_KEY_LOCATION_OPTIONS, options);
      logger.info(`Caricate ${optionRows.length} righe opzioni Location da CSV`);
      return options;
    } catch (error) {
      logger.error('Errore caricamento opzioni Location', error);
      return {
        yesNo: [],
        tipoPista: [],
        tipoPreseCorrente: [],
        province: [],
        paesiByProvincia: {},
      };
    }
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
        return this.normalizeDjList(cachedFromExcel);
      }

      // Fallback a CSV
      const csvContent = await Network.fetchCSV(this.resolveDataUrl(BORDERO_CONFIG.CSV_DBASE));
      const dj = this.normalizeDjList(this.parseDjFromCsv(csvContent));
      
      // Salva in cache
      Storage.set('BORDERO_DBASE_DATA', dj);
      logger.info(`Caricati ${dj.length} DJ da CSV`);
      return dj;
    } catch (error) {
      logger.error('Errore caricamento DJ', error);
      return [];
    }
  }

  parseDjFromCsv(csvContent) {
    const lines = String(csvContent || '').split(/\r?\n/);
    const dj = [];

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;

      const values = CSVParser.parseCSVLine(line);
      const firstValue = values[0]?.trim();
      if (!firstValue) continue;

      const normalized = firstValue.toLowerCase();
      if (['x', 'select'].includes(normalized)) break;
      if (/^(base|intermedio|avanzato|super avanzato|gold|altre coreo|coppi|3 persone|4 persone|two step|halloween|natalizia|stage|contra|sigla chiusura|estate 2021|estate 2022|estate 2023|estate 2024|estate 2025|doppia coreo|tripla coreo)$/i.test(firstValue)) {
        break;
      }

      if (!dj.some(item => item.toLowerCase() === normalized)) {
        dj.push(firstValue);
      }
    }

    return dj;
  }

  /**
   * Ottieni brani con filtri e ricerca
   */
  getBrani(filters = {}, searchTerm = '') {
    let result = [...this.brani];

    // Applica ricerca full-text
    if (searchTerm) {
      const searchFields = ['titolo', 'autore', 'coreografo', 'collaboratori'];
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
  saveCurrentSerata(serataMetadata, braniWithFlags) {
    const serata = {
      id: DateUtils.now(),
      metadata: serataMetadata,
      brani: braniWithFlags,
      savedAt: new Date().toISOString(),
    };

    Storage.set(BORDERO_CONFIG.CACHE_KEY_CURRENT_SERATA, serata);
    logger.info(`Serata salvata: DJ=${serataMetadata.dj}, Data=${serataMetadata.data}`);
    Toast.success('Serata salvata automaticamente');
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
