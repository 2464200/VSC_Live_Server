/**
 * BORDERÒ - Tabella Principale Logic
 * Core functionality per la gestione brani, filtri, sort, marking
 */

class BorderoTableManager {
  constructor() {
    this.allBrani = [];
    this.filteredBrani = [];
    this.displayedBrani = [];
    this.currentSort = null;
    this.currentSortDirection = 'asc';
    this.lastHeaderSortField = null;
    this.keepExecutedAtBottom = false;
    this.currentFilters = {};
    this.currentSearch = '';
    this.searchMode = 'general';
    this.searchMode = 'general';
    this.currentPage = 1;
    this.itemsPerPage = BORDERO_CONFIG.ITEMS_PER_PAGE;
    this.lastActionTime = null;
    this.serataMetaStorageKey = 'bordero_serata_meta';
    this.locationData = [];
    this.activeFilterPicker = null;
    this.filterButtonClickTimers = new Map();
    this.sortButtonClickTimers = new Map();
    this.headerSortClickTimers = new Map();
    this.moveExecutedBottomClickTimer = null;
    this.searchButtonsResizeScheduled = false;
    this.webcamSignalPollTimer = null;
    this.webcamSignalWarningReason = '';
    this.videoClipFiles = [];
    this.videoClipCatalog = [];
    this.videoClipAvailableMap = new Map();
    this.autoRefreshIntervalMs = 60 * 1000;
    this.autoRefreshTimer = null;
    this.autoRefreshInProgress = false;
    this.displayScrollCommandStorageKey = BORDERO_CONFIG?.DISPLAY_SCROLL_COMMAND_STORAGE_KEY || 'BORDERO_DISPLAY_SCROLL_COMMAND';
    this.deselectionConfirmState = null;
    this.nextCoreoBroadcastChannel = typeof BroadcastChannel !== 'undefined'
      ? new BroadcastChannel('bordero-next-coreo')
      : null;
    this.coexistingFilterFields = new Set([
      'richieste',
      'info_livello',
      'info_coreo_1',
      'info_coreo_2',
      'coreografo',
      'collaboratori',
      'videoclip'
    ]);

    // Serata info
    this.serata = {
      dj: '',
      data: new Date().toISOString().split('T')[0],
      luogo: 'Bergamo',
      evento: '',
      regione: 'Lombardia',
      citta: 'Bergamo',
      paese: '',
    };

    this.init();
  }

  isCoexistingFilterField(field) {
    return this.coexistingFilterFields.has(String(field || '').trim());
  }

  async init() {
    logger.info('BorderoTableManager initializing...');

    try {
      // Prima sincronizza da Excel solo se il file Excel è già stato selezionato, altrimenti usa il CSV locale
      await dataLoader.initialize(false);

      // Poi carica dati, mantenendo l’ordine originale e lo stato dei brani eseguiti
      const allBrani = await dataLoader.loadBrani();
      const originalBrani = allBrani.map((brano, index) => ({
        ...brano,
        originalIndex: index,
      }));

      const currentSerata = dataLoader.getCurrentSerata();
      if (currentSerata && Array.isArray(currentSerata.brani) && currentSerata.brani.length > 0) {
        const executedMap = new Map(currentSerata.brani.map(b => [String(b.id), b]));
        this.allBrani = originalBrani.map((brano) => {
          const saved = executedMap.get(String(brano.id));
          if (saved && String(saved.flag).toUpperCase() === 'X') {
            return {
              ...brano,
              flag: 'X',
              timestamp: saved.timestamp || brano.timestamp,
            };
          }
          return brano;
        });
        this.reorderBraniByOriginalIndex();
      } else {
        this.allBrani = originalBrani;
      }

      await this.refreshVideoClipAvailability();
      this.applyVideoClipAvailabilityToBrani();

      this.filteredBrani = [...this.allBrani];
      this.restoreNextCoreoSelection();

      // Nessun sort di default: preserva l'ordine naturale con eseguiti in fondo.
      this.currentSort = null;
      this.currentSortDirection = 'asc';
      this.lastHeaderSortField = null;

      // Setup UI
      this.setupEventListeners();
      this.setupSerataMeta();
      this.setupDataRefreshListeners();
      this.setupAutoRefresh();
      this.setupStorageSync();
      this.updateSearchPlaceholder();
      this.equalizeSearchActionButtons();
      this.setupWebcamSignalBox();
      this.renderTable();

      logger.info(`✓ Inizializzato con ${this.allBrani.length} brani`);
      Toast.success(`Caricati ${this.allBrani.length} brani`);
    } catch (error) {
      logger.error('Errore inizializzazione', error);
      Toast.error('Errore caricamento tabella: ' + error.message);
    }
  }

  restoreNextCoreoSelection() {
    const stored = Storage.get('bordero_next_coreo_selection', null);
    if (!stored || typeof stored !== 'object') return;

    const targetId = String(stored.id || '').trim();
    if (!targetId) return;

    this.allBrani.forEach((item) => {
      item.next_selected = String(item.id) === targetId;
    });
    this.filteredBrani.forEach((item) => {
      item.next_selected = String(item.id) === targetId;
    });
  }

  getStoredSerataMeta() {
    const stored = Storage.get(this.serataMetaStorageKey, null);
    if (stored && typeof stored === 'object') {
      return {
        dj: stored.dj || '',
        data: stored.data || '',
        luogo: stored.luogo || '',
        evento: stored.evento || '',
        regione: stored.regione || '',
        citta: stored.citta || '',
        paese: stored.paese || '',
      };
    }

    return {
      dj: Storage.get('bordero_selected_dj', ''),
      data: Storage.get('bordero_serata_data', ''),
      luogo: Storage.get('bordero_selected_luogo', ''),
      evento: Storage.get('bordero_serata_evento', ''),
      regione: Storage.get('bordero_selected_regione', ''),
      citta: Storage.get('bordero_selected_citta', ''),
      paese: Storage.get('bordero_selected_paese', ''),
    };
  }

  getLocationDisplayValue() {
    if (this.serata.paese) return this.serata.paese;
    if (this.serata.citta) return this.serata.citta;
    if (this.serata.regione) return this.serata.regione;
    return 'Bergamo';
  }

  persistSerataMeta() {
    this.serata.luogo = this.getLocationDisplayValue();
    Storage.set(this.serataMetaStorageKey, { ...this.serata });

    if (this.serata.dj) {
      Storage.set('bordero_selected_dj', this.serata.dj);
    } else {
      Storage.remove('bordero_selected_dj');
    }

    if (this.serata.data) {
      Storage.set('bordero_serata_data', this.serata.data);
    } else {
      Storage.remove('bordero_serata_data');
    }

    if (this.serata.regione) {
      Storage.set('bordero_selected_regione', this.serata.regione);
    } else {
      Storage.remove('bordero_selected_regione');
    }

    if (this.serata.citta) {
      Storage.set('bordero_selected_citta', this.serata.citta);
    } else {
      Storage.remove('bordero_selected_citta');
    }

    if (this.serata.paese) {
      Storage.set('bordero_selected_paese', this.serata.paese);
    } else {
      Storage.remove('bordero_selected_paese');
    }

    if (this.serata.luogo) {
      Storage.set('bordero_selected_luogo', this.serata.luogo);
    } else {
      Storage.remove('bordero_selected_luogo');
    }

    if (this.serata.evento) {
      Storage.set('bordero_serata_evento', this.serata.evento);
    } else {
      Storage.remove('bordero_serata_evento');
    }

    if (Array.isArray(this.allBrani) && this.allBrani.length > 0) {
      dataLoader.saveCurrentSerata(this.serata, this.allBrani);
    }
  }

  clearPersistedSerataMeta() {
    Storage.remove(this.serataMetaStorageKey);
    Storage.remove('bordero_selected_dj');
    Storage.remove('bordero_selected_luogo');
    Storage.remove('bordero_selected_regione');
    Storage.remove('bordero_selected_citta');
    Storage.remove('bordero_selected_paese');
    Storage.remove('bordero_serata_data');
    Storage.remove('bordero_serata_evento');
  }

  resetSerataMetaFields() {
    this.serata = {
      dj: '',
      data: new Date().toISOString().split('T')[0],
      luogo: 'Bergamo',
      evento: '',
      regione: 'Lombardia',
      citta: 'Bergamo',
      paese: '',
    };

    const dataInput = document.getElementById('data-serata');
    if (dataInput) {
      dataInput.value = this.serata.data;
    }

    const eventoInput = document.getElementById('evento-text');
    if (eventoInput) {
      eventoInput.value = '';
    }

    const djSelect = document.getElementById('dj-select');
    if (djSelect) {
      djSelect.value = '';
    }

    const locationButton = document.getElementById('luogo-picker-button');
    if (locationButton) {
      locationButton.textContent = 'Bergamo';
    }

    const regionSelect = document.getElementById('luogo-regione-select');
    if (regionSelect) {
      regionSelect.value = '';
      regionSelect.disabled = false;
    }

    const citySelect = document.getElementById('luogo-citta-select');
    if (citySelect) {
      citySelect.innerHTML = '<option value="">-- Seleziona Città --</option>';
      citySelect.disabled = true;
    }

    const countrySelect = document.getElementById('luogo-paese-select');
    if (countrySelect) {
      countrySelect.innerHTML = '<option value="">-- Seleziona Paese --</option>';
      countrySelect.disabled = true;
    }

    this.clearPersistedSerataMeta();
  }

  /**
   * Setup serata metadata (D2:D5)
   */
  setupSerataMeta() {
    const storedMeta = this.getStoredSerataMeta();
    this.serata = {
      dj: storedMeta.dj || '',
      data: storedMeta.data || new Date().toISOString().split('T')[0],
      luogo: storedMeta.luogo || this.getLocationDisplayValue(),
      evento: storedMeta.evento || '',
      regione: storedMeta.regione || 'Lombardia',
      citta: storedMeta.citta || 'Bergamo',
      paese: storedMeta.paese || '',
    };

    const dataInput = document.getElementById('data-serata');
    if (dataInput) {
      dataInput.value = this.serata.data;
    }

    // DJ dropdown da dBase
    this.populateDJSelect();

    // Data
    dataInput?.addEventListener('change', (e) => {
      this.serata.data = e.target.value;
      this.persistSerataMeta();
      logger.debug('Data serata:', this.serata.data);
    });

    // Luogo: scelta a cascata
    this.setupLocationPicker();

    const eventoInput = document.getElementById('evento-text');
    if (eventoInput) {
      eventoInput.value = this.serata.evento || '';
    }

    // Evento libero
    document.getElementById('evento-text')?.addEventListener('input', (e) => {
      this.serata.evento = e.target.value;
      this.persistSerataMeta();
      logger.debug('Evento:', this.serata.evento);
    });

    document.getElementById('luogo-picker-button')?.addEventListener('click', () => this.openLocationPicker());
    document.getElementById('luogo-picker-close')?.addEventListener('click', () => this.closeLocationPicker());
    document.getElementById('luogo-picker-modal')?.addEventListener('click', (e) => {
      if (e.target.id === 'luogo-picker-modal') {
        this.closeLocationPicker();
      }
    });

    document.getElementById('luogo-regione-select')?.addEventListener('change', (e) => {
      this.updateLocationSelection('regione', e.target.value);
    });

    document.getElementById('luogo-citta-select')?.addEventListener('change', (e) => {
      this.updateLocationSelection('citta', e.target.value);
    });

    document.getElementById('luogo-paese-select')?.addEventListener('change', (e) => {
      this.updateLocationSelection('paese', e.target.value);
    });

    document.getElementById('luogo-picker-confirm')?.addEventListener('click', () => {
      const fallbackLocation = this.serata.paese || this.serata.citta || this.serata.regione || 'Bergamo';
      this.serata.paese = fallbackLocation;

      const confirmButton = document.getElementById('luogo-picker-confirm');
      if (confirmButton) {
        confirmButton.classList.add('confirmed');
      }
      this.persistSerataMeta();
      this.updateLocationPickerSelection();
      this.closeLocationPicker();

      window.setTimeout(() => {
        this.closeLocationPicker();
        const modal = document.getElementById('luogo-picker-modal');
        if (modal) {
          modal.hidden = true;
          modal.style.display = 'none';
        }
      }, 200);
    });

    window.setTimeout(() => {
      this.closeLocationPicker();
    }, 0);
    this.updateLocationPickerSelection();
  }

  /**
   * Popola il select dei DJ
   */
  async populateDJSelect() {
    const djSelect = document.getElementById('dj-select');
    
    try {
      const dj = await dataLoader.loadDJ();
      djSelect.innerHTML = '<option value="">-- Seleziona DJ --</option>';
      
      dj.forEach(item => {
        const nome = item.nome || item.name || '';
        if (!nome) return;

        const option = document.createElement('option');
        option.value = nome;
        option.textContent = nome;
        djSelect.appendChild(option);
      });

      const savedDj = this.serata.dj || '';
      if (savedDj) {
        djSelect.value = savedDj;
      }

      if (!djSelect.dataset.boundChange) {
        djSelect.addEventListener('change', (e) => {
          const value = e.target.value.trim();
          this.serata.dj = value;
          this.persistSerataMeta();
          logger.debug('DJ selezionato:', this.serata.dj);
        });
        djSelect.dataset.boundChange = 'true';
      }

      logger.debug(`DJ select popolato con ${dj.length} opzioni`);
    } catch (error) {
      logger.error('Errore popolo DJ', error);
    }
  }

  async setupLocationPicker() {
    const regionSelect = document.getElementById('luogo-regione-select');
    const citySelect = document.getElementById('luogo-citta-select');
    const countrySelect = document.getElementById('luogo-paese-select');

    if (!regionSelect || !citySelect || !countrySelect) return;

    try {
      const comuni = await dataLoader.loadComuni();
      this.locationData = Array.isArray(comuni) ? comuni : [];

      const regions = [...new Set(this.locationData.map(item => item.regione).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b, 'it'));

      regionSelect.innerHTML = '<option value="">-- Seleziona Regione --</option>' + regions.map(region => `<option value="${region}">${region}</option>`).join('');

      if (this.serata.regione) {
        regionSelect.value = this.serata.regione;
      } else {
        regionSelect.value = 'Lombardia';
        this.serata.regione = 'Lombardia';
      }

      this.renderLocationCascades();
      this.updateLocationPickerSelection();
      logger.debug(`Location picker popolato con ${this.locationData.length} comuni`);
    } catch (error) {
      logger.error('Errore popolo location picker', error);
    }
  }

  renderLocationCascades() {
    const regionSelect = document.getElementById('luogo-regione-select');
    const citySelect = document.getElementById('luogo-citta-select');
    const countrySelect = document.getElementById('luogo-paese-select');

    if (!regionSelect || !citySelect || !countrySelect) return;

    const availableRegions = [...new Set(this.locationData.map(item => item.regione).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, 'it'));

    const fallbackRegion = availableRegions.includes('Lombardia') ? 'Lombardia' : (availableRegions[0] || '');
    const selectedRegion = (this.serata.regione && availableRegions.includes(this.serata.regione))
      ? this.serata.regione
      : fallbackRegion;

    this.serata.regione = selectedRegion;
    regionSelect.innerHTML = '<option value="">-- Seleziona Regione --</option>' + availableRegions.map(region => `<option value="${region}">${region}</option>`).join('');
    regionSelect.value = selectedRegion || '';

    const cityOptions = [...new Set(this.locationData
      .filter(item => !selectedRegion || item.regione === selectedRegion)
      .map(item => item.citta)
      .filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, 'it'));

    const fallbackCity = cityOptions.includes('Bergamo') ? 'Bergamo' : (cityOptions[0] || '');
    const selectedCity = (this.serata.citta && cityOptions.includes(this.serata.citta))
      ? this.serata.citta
      : fallbackCity;

    citySelect.innerHTML = '<option value="">-- Seleziona Città --</option>' + cityOptions.map(city => `<option value="${city}">${city}</option>`).join('');
    citySelect.disabled = !selectedRegion;
    citySelect.value = selectedCity || '';
    this.serata.citta = selectedCity || '';

    const countryOptions = [...new Set(this.locationData
      .filter(item => (!selectedRegion || item.regione === selectedRegion) && (!selectedCity || item.citta === selectedCity))
      .map(item => item.nome)
      .filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, 'it'));

    const fallbackCountry = countryOptions[0] || '';
    const selectedCountry = (this.serata.paese && countryOptions.includes(this.serata.paese))
      ? this.serata.paese
      : fallbackCountry;

    countrySelect.innerHTML = '<option value="">-- Seleziona Paese --</option>' + countryOptions.map(paese => `<option value="${paese}">${paese}</option>`).join('');
    countrySelect.disabled = !selectedCity;
    countrySelect.value = selectedCountry || '';
    this.serata.paese = selectedCountry || '';

    this.updateLocationPickerSelection();
  }

  updateLocationSelection(field, value) {
    const trimmedValue = String(value || '').trim();
    const confirmButton = document.getElementById('luogo-picker-confirm');

    if (confirmButton) {
      confirmButton.classList.remove('confirmed');
    }

    if (field === 'regione') {
      this.serata.regione = trimmedValue;
      this.serata.citta = '';
      this.serata.paese = '';
    } else if (field === 'citta') {
      this.serata.citta = trimmedValue;
      this.serata.paese = '';
    } else if (field === 'paese') {
      this.serata.paese = trimmedValue;
    }

    this.persistSerataMeta();
    this.renderLocationCascades();
    this.updateLocationPickerSelection();

    if (field === 'paese') {
      this.updateLocationPickerSelection();
    }
  }

  updateLocationPickerSelection() {
    const button = document.getElementById('luogo-picker-button');
    const locationText = this.getLocationDisplayValue();

    if (button) {
      button.textContent = locationText;
    }
  }

  openLocationPicker() {
    const modal = document.getElementById('luogo-picker-modal');
    const button = document.getElementById('luogo-picker-button');
    const confirmButton = document.getElementById('luogo-picker-confirm');
    if (modal) {
      modal.hidden = false;
      modal.style.display = 'flex';
      modal.setAttribute('aria-hidden', 'false');
    }
    if (button) {
      button.setAttribute('aria-expanded', 'true');
    }
    if (confirmButton) {
      confirmButton.classList.remove('confirmed');
    }

    this.renderLocationCascades();
    this.setupLocationPicker().catch(() => {});
  }

  closeLocationPicker() {
    const modal = document.getElementById('luogo-picker-modal');
    const button = document.getElementById('luogo-picker-button');
    if (modal) {
      modal.hidden = true;
      modal.style.display = 'none';
      modal.setAttribute('aria-hidden', 'true');
    }
    if (button) {
      button.setAttribute('aria-expanded', 'false');
    }
  }

  setupDataRefreshListeners() {
    window.removeEventListener('bordero:data-updated', this.handleDataRefreshBound);
    this.handleDataRefreshBound = () => {
      this.refreshFromCurrentData({ silent: true });
    };
    window.addEventListener('bordero:data-updated', this.handleDataRefreshBound);

    window.removeEventListener('storage', this.handleStorageRefreshBound);
    this.handleStorageRefreshBound = (event) => {
      if (event.key && event.key.startsWith('BORDERO_')) {
        this.refreshFromCurrentData({ silent: true });
      }
    };
    window.addEventListener('storage', this.handleStorageRefreshBound);
  }

  setupAutoRefresh() {
    if (this.autoRefreshTimer) {
      clearInterval(this.autoRefreshTimer);
      this.autoRefreshTimer = null;
    }

    this.autoRefreshTimer = setInterval(() => {
      this.refreshFromCurrentData({ silent: true, source: 'timer' });
    }, this.autoRefreshIntervalMs);

    window.addEventListener('pagehide', () => {
      if (this.autoRefreshTimer) {
        clearInterval(this.autoRefreshTimer);
        this.autoRefreshTimer = null;
      }
    }, { once: true });
  }

  async refreshFromCurrentData(options = {}) {
    const { silent = true, source = 'runtime' } = options;

    if (this.autoRefreshInProgress) {
      logger.debug('Refresh dati saltato: aggiornamento già in corso', { source });
      return;
    }

    this.autoRefreshInProgress = true;

    try {
      const allBrani = await dataLoader.loadBrani({ silent });
      const originalBrani = allBrani.map((brano, index) => ({
        ...brano,
        originalIndex: index,
      }));

      const currentSerata = dataLoader.getCurrentSerata();
      if (currentSerata && Array.isArray(currentSerata.brani) && currentSerata.brani.length > 0) {
        const executedMap = new Map(currentSerata.brani.map(b => [String(b.id), b]));
        this.allBrani = originalBrani.map((brano) => {
          const saved = executedMap.get(String(brano.id));
          if (saved && String(saved.flag).toUpperCase() === 'X') {
            return {
              ...brano,
              flag: 'X',
              timestamp: saved.timestamp || brano.timestamp,
            };
          }
          return brano;
        });
        this.reorderBraniByOriginalIndex();
      } else {
        this.allBrani = originalBrani;
      }

      await this.refreshVideoClipAvailability();
      this.applyVideoClipAvailabilityToBrani();

      this.filteredBrani = [...this.allBrani];
      this.currentPage = 1;
      await this.populateDJSelect();
      await this.setupLocationPicker();
      this.renderTable();
      logger.info('✓ Dati aggiornati dopo sincronizzazione', { source });
    } catch (error) {
      logger.error('Errore aggiornamento dati dopo sincronizzazione', error);
    } finally {
      this.autoRefreshInProgress = false;
    }
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    this.setupFilterValuePicker();
    this.setupDeselectionConfirmModal();

    // Sort buttons (esclusivi)
    this.bindSortButton('btn-sort-id', 'id', 'ID');
    this.bindSortButton('btn-sort-coreografo', 'coreografo', 'COREOGRAFO');
    this.bindSortButton('btn-sort-autore', 'autore', 'AUTORE');
    this.bindSortButton('btn-sort-richieste', 'richieste', 'RICHIESTE');
    this.setupColumnHeaderSorting();
    this.bindMoveExecutedBottomButton('btn-move-executed-bottom', 'SPOSTA IN FONDO GLI ESEGUITI');
    document.getElementById('btn-view-executed')?.addEventListener('click', () => {
      window.location.href = 'brani-eseguiti.html';
    });
    document.getElementById('btn-view-richieste')?.addEventListener('click', () => {
      window.location.href = 'elenco-richieste.html';
    });

    // Filter buttons
    this.bindFilterPopupButton('btn-filter-coreografia', 'info_livello', 'LIVELLO');
    this.bindFilterPopupButton('btn-filter-livello', 'coreografo', 'COREOGRAFO');
    this.bindFilterPopupButton('btn-filter-altro', 'autore', 'AUTORE');
    this.bindFilterPopupButton('btn-filter-richieste', 'richieste', 'RICHIESTE');

    // Search
    document.getElementById('search-box')?.addEventListener('input', (e) => {
      this.currentSearch = e.target.value;
      this.applyFilters();
    });

    document.getElementById('btn-search-general')?.addEventListener('click', () => {
      this.searchMode = 'general';
      this.updateSearchButtons();
      this.updateSearchPlaceholder();
      this.applyFilters();
    });

    document.getElementById('btn-search-title')?.addEventListener('click', () => {
      this.searchMode = 'title';
      this.updateSearchButtons();
      this.updateSearchPlaceholder();
      this.applyFilters();
    });

    document.getElementById('btn-search-id')?.addEventListener('click', () => {
      this.searchMode = 'id';
      this.updateSearchButtons();
      this.updateSearchPlaceholder();
      this.applyFilters();
    });

    window.addEventListener('resize', () => {
      this.scheduleSearchButtonsResize();
    });

    // Reset filters
    document.getElementById('btn-reset-filters')?.addEventListener('click', () => {
      this.resetFilters();
    });
    document.getElementById('btn-reset-filters-empty')?.addEventListener('click', () => {
      this.resetFilters();
    });
    document.getElementById('btn-reset-filters-stats')?.addEventListener('click', () => {
      this.resetFilters({ sortById: true });
    });

    // Azioni
    document.getElementById('btn-userform')?.addEventListener('click', () => this.showUserForm());
    document.getElementById('btn-export')?.addEventListener('click', () => this.exportSerataToSIAE());
    document.getElementById('btn-sync-richieste-google')?.addEventListener('click', () => this.syncRichiesteFromGoogle());
    document.getElementById('btn-print')?.addEventListener('click', () => window.print());
    document.getElementById('btn-finish-serata')?.addEventListener('click', () => this.finishSerata());
    document.getElementById('btn-stop-rolling-remote')?.addEventListener('click', () => this.sendDisplayRollingCommand('stop'));
    document.getElementById('btn-resume-rolling-remote')?.addEventListener('click', () => this.sendDisplayRollingCommand('resume'));

    // Pagination
    document.getElementById('btn-first-page')?.addEventListener('click', () => this.firstPage());
    document.getElementById('btn-prev-page')?.addEventListener('click', () => this.prevPage());
    document.getElementById('btn-next-page')?.addEventListener('click', () => this.nextPage());
    document.getElementById('btn-last-page')?.addEventListener('click', () => this.lastPage());
  }

  scheduleSearchButtonsResize() {
    if (this.searchButtonsResizeScheduled) {
      return;
    }

    this.searchButtonsResizeScheduled = true;
    window.requestAnimationFrame(() => {
      this.searchButtonsResizeScheduled = false;
      this.equalizeSearchActionButtons();
    });
  }

  equalizeSearchActionButtons() {
    const buttons = [
      document.getElementById('btn-search-general'),
      document.getElementById('btn-search-title'),
      document.getElementById('btn-search-id')
    ].filter(Boolean);

    if (!buttons.length) return;

    buttons.forEach((btn) => {
      btn.style.width = 'auto';
    });

    const maxWidth = Math.max(...buttons.map((btn) => btn.getBoundingClientRect().width));
    const targetWidth = `${Math.ceil(maxWidth)}px`;

    buttons.forEach((btn) => {
      btn.style.width = targetWidth;
    });
  }

  setWebcamSignal(state, text, warningReason = '') {
    const webcamSignalNode = document.getElementById('webcam-signal-05');
    const webcamSignalTextNode = document.getElementById('webcam-signal-text-05');

    if (webcamSignalNode) {
      webcamSignalNode.dataset.state = state;
      webcamSignalNode.setAttribute('aria-label', `Spia stato webcam secondaria: ${text}`);
      if (warningReason) {
        webcamSignalNode.title = warningReason;
      } else {
        webcamSignalNode.removeAttribute('title');
      }
    }

    if (webcamSignalTextNode) {
      webcamSignalTextNode.textContent = text;
    }

    this.webcamSignalWarningReason = warningReason;
  }

  refreshWebcamSignal({ warningReason = this.webcamSignalWarningReason, vlcRunning = false } = {}) {
    if (warningReason) {
      this.setWebcamSignal('warning', 'Anomalia', warningReason);
      return;
    }

    if (vlcRunning) {
      this.setWebcamSignal('live', 'Live monitor 2');
      return;
    }

    this.setWebcamSignal('idle', 'Riposo');
  }

  async refreshSecondaryPlayerSignalState() {
    try {
      const response = await fetch('/api/userform/pagina05/electron/player/state', {
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' }
      });

      const out = await response.json().catch(() => ({}));
      if (!response.ok || out?.ok === false || out?.success === false) {
        throw new Error(out?.error || `HTTP ${response.status}`);
      }

      const playerState = out?.playerState || {};
      if (playerState.active) {
        this.refreshWebcamSignal({ warningReason: '', vlcRunning: playerState.mode === 'webcam-live' });
      } else {
        this.refreshWebcamSignal({ warningReason: '', vlcRunning: false });
      }
    } catch (error) {
      this.refreshWebcamSignal({
        warningReason: error?.message || 'Player Electron non raggiungibile',
        vlcRunning: false
      });
    }
  }

  setupWebcamSignalBox() {
    if (!document.getElementById('webcam-signal-05')) {
      return;
    }

    this.refreshWebcamSignal({ warningReason: '', vlcRunning: false });
    this.refreshSecondaryPlayerSignalState().catch(() => null);

    if (this.webcamSignalPollTimer) {
      clearInterval(this.webcamSignalPollTimer);
    }

    this.webcamSignalPollTimer = setInterval(() => {
      this.refreshSecondaryPlayerSignalState().catch(() => null);
    }, 2000);

    window.addEventListener('pagehide', () => {
      if (this.webcamSignalPollTimer) {
        clearInterval(this.webcamSignalPollTimer);
        this.webcamSignalPollTimer = null;
      }
    }, { once: true });
  }

  sendDisplayRollingCommand(action) {
    const normalized = String(action || '').trim().toLowerCase();
    if (normalized !== 'stop' && normalized !== 'resume') {
      return;
    }

    const payload = {
      action: normalized,
      ts: Date.now(),
      source: 'bordero-main'
    };

    localStorage.setItem(this.displayScrollCommandStorageKey, JSON.stringify(payload));

    if (normalized === 'stop') {
      Toast.warning('Comando inviato: FERMA ROLLING (monitor secondario)');
    } else {
      Toast.success('Comando inviato: RIPRENDI ROLLING (monitor secondario)');
    }
  }

  setupFilterValuePicker() {
    const modal = document.getElementById('filter-picker-modal');
    const closeBtn = document.getElementById('filter-picker-close');
    const searchInput = document.getElementById('filter-picker-search');

    closeBtn?.addEventListener('click', () => this.closeFilterValuePicker());
    modal?.addEventListener('click', (event) => {
      if (event.target === modal) {
        this.closeFilterValuePicker();
      }
    });

    searchInput?.addEventListener('input', () => {
      this.renderFilterValueOptions();
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && this.activeFilterPicker) {
        this.closeFilterValuePicker();
      }
    });
  }

  bindFilterPopupButton(buttonId, field, label) {
    const button = document.getElementById(buttonId);
    if (!button) return;

    button.addEventListener('click', () => {
      if (this.isCoexistingFilterField(field) && this.currentFilters[field]) {
        this.clearSingleColumnFilter(field, label);
        return;
      }

      const existingTimer = this.filterButtonClickTimers.get(buttonId);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      const timer = setTimeout(() => {
        this.filterButtonClickTimers.delete(buttonId);
        this.openFilterValuePicker(field, buttonId, label);
      }, 220);

      this.filterButtonClickTimers.set(buttonId, timer);
    });

    button.addEventListener('dblclick', (event) => {
      event.preventDefault();

      const existingTimer = this.filterButtonClickTimers.get(buttonId);
      if (existingTimer) {
        clearTimeout(existingTimer);
        this.filterButtonClickTimers.delete(buttonId);
      }

      this.clearSingleColumnFilter(field, label);
    });
  }

  bindSortButton(buttonId, field, label) {
    const button = document.getElementById(buttonId);
    if (!button) return;

    button.addEventListener('click', () => {
      const existingTimer = this.sortButtonClickTimers.get(buttonId);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      const timer = setTimeout(() => {
        this.sortButtonClickTimers.delete(buttonId);
        this.sortBy(field);
      }, 220);

      this.sortButtonClickTimers.set(buttonId, timer);
    });

    button.addEventListener('dblclick', (event) => {
      event.preventDefault();

      const existingTimer = this.sortButtonClickTimers.get(buttonId);
      if (existingTimer) {
        clearTimeout(existingTimer);
        this.sortButtonClickTimers.delete(buttonId);
      }

      this.resetSingleSort(field, label);
    });
  }

  bindMoveExecutedBottomButton(buttonId, label) {
    const button = document.getElementById(buttonId);
    if (!button) return;

    button.addEventListener('click', () => {
      if (this.moveExecutedBottomClickTimer) {
        clearTimeout(this.moveExecutedBottomClickTimer);
      }

      this.moveExecutedBottomClickTimer = setTimeout(() => {
        this.moveExecutedBottomClickTimer = null;
        this.moveExecutedToBottom();
      }, 220);
    });

    button.addEventListener('dblclick', (event) => {
      event.preventDefault();

      if (this.moveExecutedBottomClickTimer) {
        clearTimeout(this.moveExecutedBottomClickTimer);
        this.moveExecutedBottomClickTimer = null;
      }

      this.resetMoveExecutedToBottom(label);
    });
  }

  resetSingleSort(field, label = field) {
    if (this.currentSort !== field) {
      Toast.info(`Sort ${label} non attivo`);
      return;
    }

    this.currentSort = null;
    this.currentSortDirection = 'asc';
    this.lastHeaderSortField = null;

    const natural = [...this.allBrani].sort((a, b) => (Number(a.originalIndex) || 0) - (Number(b.originalIndex) || 0));
    if (this.keepExecutedAtBottom) {
      const pending = natural.filter(item => !this.isExecutedBrano(item));
      const executed = natural.filter(item => this.isExecutedBrano(item));
      this.allBrani = [...pending, ...executed];
    } else {
      this.allBrani = natural;
    }

    this.updateSortButtons();
    this.updateColumnHeaderSortState();
    this.applyFilters();
    Toast.info(`Sort ${label} resettato`);
  }

  clearSingleColumnFilter(field, label = field) {
    delete this.currentFilters[field];

    if (this.activeFilterPicker && this.activeFilterPicker.field === field) {
      this.closeFilterValuePicker();
    }

    this.currentPage = 1;
    this.updateFilterButtons();
    this.applyFilters();
    Toast.info(`Filtro ${label} resettato`);
  }

  getUniqueFieldValues(field) {
    if (field === 'richieste') {
      const numericValues = this.allBrani
        .map((item) => String(item?.[field] ?? '').trim())
        .filter((value) => value.length > 0)
        .map((value) => value.replace(',', '.'))
        .filter((value) => /^-?\d+(\.\d+)?$/.test(value))
        .map((value) => Number(value));

      return [...new Set(numericValues)]
        .sort((a, b) => a - b)
        .map((value) => String(value));
    }

    const values = this.allBrani
      .map(item => String(item?.[field] ?? '').trim())
      .filter(value => value.length > 0);

    return [...new Set(values)].sort((a, b) => a.localeCompare(b, 'it', { sensitivity: 'base' }));
  }

  normalizeExactFilterValue(value) {
    return String(value ?? '')
      .trim()
      .replace(/\s+/g, ' ')
      .toLowerCase();
  }

  openFilterValuePicker(field, buttonId, label) {
    const modal = document.getElementById('filter-picker-modal');
    const titleEl = document.getElementById('filter-picker-title');
    const searchInput = document.getElementById('filter-picker-search');
    if (!modal || !titleEl) return;

    this.activeFilterPicker = { field, buttonId, label, values: this.getUniqueFieldValues(field) };
    titleEl.textContent = `Seleziona ${label}`;
    if (searchInput) {
      searchInput.value = '';
    }

    this.renderFilterValueOptions();
    modal.hidden = false;
    searchInput?.focus();
  }

  closeFilterValuePicker() {
    const modal = document.getElementById('filter-picker-modal');
    if (modal) {
      modal.hidden = true;
    }
    this.activeFilterPicker = null;
  }

  renderFilterValueOptions() {
    const optionsEl = document.getElementById('filter-picker-options');
    const searchInput = document.getElementById('filter-picker-search');
    if (!optionsEl || !this.activeFilterPicker) return;

    const query = String(searchInput?.value || '').trim().toLowerCase();
    const values = this.activeFilterPicker.values.filter(value => !query || value.toLowerCase().includes(query));
    this.activeFilterPicker.filteredValues = values;

    const clearButton = '<button type="button" class="filter-picker-option is-clear" data-filter-index="-1">TUTTI (nessun filtro)</button>';
    const richiesteSpecialButtons = this.activeFilterPicker.field === 'richieste'
      ? [
            '<button type="button" class="filter-picker-option" data-filter-special="richieste-zero">NON RICHIESTE</button>',
            '<button type="button" class="filter-picker-option" data-filter-special="richieste-nonzero">RICHIESTE</button>'
        ].join('')
      : '';
    const valueButtons = values.map((value, index) => {
      const safe = this.escapeHtml(value);
      return `<button type="button" class="filter-picker-option" data-filter-index="${index}">${safe}</button>`;
    }).join('');

    optionsEl.innerHTML = clearButton + richiesteSpecialButtons + valueButtons;

    optionsEl.querySelectorAll('.filter-picker-option').forEach(button => {
      button.addEventListener('click', () => {
        const special = button.getAttribute('data-filter-special');
        if (special) {
          this.applySpecialFilterFromPicker(special);
          return;
        }

        const idx = Number(button.getAttribute('data-filter-index'));
        this.applyValueFilterFromPicker(idx);
      });
    });
  }

  applySpecialFilterFromPicker(specialKey) {
    if (!this.activeFilterPicker) return;

    const { field } = this.activeFilterPicker;
    if (field !== 'richieste') return;

    if (specialKey === 'richieste-zero') {
      this.currentFilters[field] = { mode: 'richiesteZero' };
    } else if (specialKey === 'richieste-nonzero') {
      this.currentFilters[field] = { mode: 'richiesteNonZero' };
    }

    this.currentPage = 1;
    this.updateFilterButtons();
    this.applyFilters();
    this.closeFilterValuePicker();
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

  applyValueFilterFromPicker(selectedIndex) {
    if (!this.activeFilterPicker) return;

    const { field } = this.activeFilterPicker;
    const values = Array.isArray(this.activeFilterPicker.filteredValues)
      ? this.activeFilterPicker.filteredValues
      : this.activeFilterPicker.values;

    if (!Number.isInteger(selectedIndex) || selectedIndex < 0) {
      delete this.currentFilters[field];
    } else {
      const value = values[selectedIndex];
      if (!value) {
        delete this.currentFilters[field];
      } else {
        this.currentFilters[field] = { mode: 'exactValue', value };
      }
    }

    this.currentPage = 1;
    this.updateFilterButtons();
    this.applyFilters();
    this.closeFilterValuePicker();
  }

  setupColumnHeaderSorting() {
    const headers = document.querySelectorAll('#brani-table thead th[data-col]');
    headers.forEach((header) => {
      const field = header.dataset.col;
      if (!field) return;
      const isFilterOnly = header.dataset.filterOnly === 'true';

      header.classList.add('sortable-col-header');
      header.setAttribute('role', 'button');
      header.setAttribute('tabindex', '0');
      if (isFilterOnly) {
        header.setAttribute('aria-label', `Filtra per ${field} valorizzato`);
      } else {
        header.setAttribute('aria-label', `Ordina per ${field} in ordine crescente`);
      }

      header.addEventListener('click', () => {
        const existingTimer = this.headerSortClickTimers.get(field);
        if (existingTimer) {
          clearTimeout(existingTimer);
        }

        const timer = setTimeout(() => {
          this.headerSortClickTimers.delete(field);
          this.clearColumnFiltersExcept(field);

          if (isFilterOnly) {
            this.togglePresenceFilter(field);
            this.updateColumnHeaderSortState();
            return;
          }

          this.clearVideoClipPresenceFilterOnOtherHeader(field);
          this.sortByFromHeader(field);
        }, 220);

        this.headerSortClickTimers.set(field, timer);
      });

      if (!isFilterOnly) {
        header.addEventListener('dblclick', (event) => {
          event.preventDefault();

          const existingTimer = this.headerSortClickTimers.get(field);
          if (existingTimer) {
            clearTimeout(existingTimer);
            this.headerSortClickTimers.delete(field);
          }

          this.resetSingleSort(field, header.textContent?.trim() || field);
        });
      }

      header.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          this.clearColumnFiltersExcept(field);
          if (isFilterOnly) {
            this.togglePresenceFilter(field);
            this.updateColumnHeaderSortState();
            return;
          }
          this.clearVideoClipPresenceFilterOnOtherHeader(field);
          this.sortByFromHeader(field);
        }
      });
    });

    this.updateColumnHeaderSortState();
  }

  sortByFromHeader(field) {
    // Primo click su una nuova colonna: sempre crescente.
    if (this.lastHeaderSortField !== field) {
      this.sortBy(field, true);
      this.lastHeaderSortField = field;
      return;
    }

    // Click successivi sulla stessa colonna: alterna crescente/decrescente.
    this.sortBy(field);
  }

  setupStorageSync() {
    window.addEventListener('storage', (event) => {
      if (!event.key || event.key !== BORDERO_CONFIG.CACHE_KEY_CURRENT_SERATA) return;

      const currentSerata = dataLoader.getCurrentSerata();
      if (!currentSerata || !Array.isArray(currentSerata.brani)) return;

      logger.info('Storage event: aggiornamento serata corrente rilevato');
      this.mergeCurrentSerata(currentSerata.brani);
    });

    // Anche listener per evento custom (aggiorna nello stesso tab)
    window.addEventListener('bordero:serata-updated', () => {
      const currentSerata = dataLoader.getCurrentSerata();
      if (!currentSerata || !Array.isArray(currentSerata.brani)) return;
      logger.info('Custom event: aggiornamento serata corrente rilevato');
      this.mergeCurrentSerata(currentSerata.brani);
    });

    const refreshFromSerata = () => {
      const currentSerata = dataLoader.getCurrentSerata();
      if (!currentSerata || !Array.isArray(currentSerata.brani)) return;
      this.mergeCurrentSerata(currentSerata.brani);
    };

    window.addEventListener('focus', refreshFromSerata);
    window.addEventListener('pageshow', refreshFromSerata);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        refreshFromSerata();
      }
    });
  }

  mergeCurrentSerata(updatedBrani) {
    const updatedMap = new Map(updatedBrani.map(brano => [String(brano.id), brano]));
    let changed = false;

    this.allBrani = this.allBrani.map((brano) => {
      const updated = updatedMap.get(String(brano.id));
      if (!updated) return brano;

      const updatedFlag = String(updated.flag || '').toUpperCase() === 'X' ? 'X' : '';
      const updatedTimestamp = updated.timestamp || '';

      if (updatedFlag !== String(brano.flag || '').toUpperCase() || updatedTimestamp !== (brano.timestamp || '')) {
        changed = true;
        return {
          ...brano,
          flag: updatedFlag,
          timestamp: updatedTimestamp,
        };
      }
      return brano;
    });

    if (!changed) return;

    this.reorderBraniByOriginalIndex();
    this.applyFilters();
    this.lastActionTime = new Date();
    this.updateLastActionTime();
    Toast.info('Stato Borderò sincronizzato');
  }

  reorderBraniByOriginalIndex() {
    const available = this.allBrani
      .filter(b => String(b.flag || '').toUpperCase() !== 'X')
      .sort((a, b) => (Number(a.originalIndex) || 0) - (Number(b.originalIndex) || 0));

    const completed = this.allBrani.filter(b => String(b.flag || '').toUpperCase() === 'X');

    this.allBrani = [...available, ...completed];
    // If a sort is active, re-apply it so reorder doesn't wipe user sorting
    if (this.currentSort) {
      const ascending = this.currentSortDirection !== 'desc';
      try {
        this.allBrani = this.sortCollection(this.allBrani, this.currentSort, ascending);
        // keep filtered list in sync when appropriate
        if (Array.isArray(this.filteredBrani) && this.filteredBrani.length > 0) {
          this.filteredBrani = this.sortCollection(this.filteredBrani, this.currentSort, ascending);
        }
      } catch (e) {
        logger.debug('Unable to reapply sort after reorder', e);
      }
    }
  }

  isExecutedBrano(brano) {
    return String(brano?.flag || '').toUpperCase() === 'X';
  }

  sortCollection(collection, field, ascending) {
    if (!Array.isArray(collection)) return [];

    const activeId = this.getActiveNextSelectionId();
    const prioritized = this.applyNextSelectionPriority(collection);
    const selectedItem = activeId
      ? prioritized.find(item => String(item.id) === String(activeId))
      : null;
    const remainingItems = activeId
      ? prioritized.filter(item => String(item.id) !== String(activeId))
      : prioritized;

    if (!this.keepExecutedAtBottom) {
      return selectedItem
        ? [selectedItem, ...ObjectUtils.sortByField(remainingItems, field, ascending)]
        : ObjectUtils.sortByField(prioritized, field, ascending);
    }

    const pending = remainingItems.filter(item => !this.isExecutedBrano(item));
    const executed = remainingItems.filter(item => this.isExecutedBrano(item));

    const pendingSorted = ObjectUtils.sortByField(pending, field, ascending);
    const executedSorted = ObjectUtils.sortByField(executed, field, ascending);

    return selectedItem
      ? [selectedItem, ...pendingSorted, ...executedSorted]
      : [...pendingSorted, ...executedSorted];
  }

  /**
   * Sort per colonna (esclusivo - resetta altri sort)
   */
  sortBy(field, forceAscending = false) {
    logger.info(`Sorting by ${field}`);

    if (forceAscending) {
      this.currentSort = field;
      this.currentSortDirection = 'asc';
    } else if (this.currentSort === field) {
      this.currentSortDirection = this.currentSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.currentSort = field;
      this.currentSortDirection = 'asc';
    }

    const ascending = this.currentSortDirection === 'asc';
    this.allBrani = this.sortCollection(this.allBrani, field, ascending);
    this.filteredBrani = this.sortCollection(this.filteredBrani, field, ascending);

    // Resetta pagina
    this.currentPage = 1;

    // Update UI
    this.updateSortButtons();
    this.updateColumnHeaderSortState();
    this.renderTable();

    Toast.info(`Ordinato per ${field} (${ascending ? 'crescente' : 'decrescente'})`);
  }

  moveExecutedToBottom() {
    logger.info('Spostando i brani eseguiti in fondo alla lista...');

    const executed = this.allBrani.filter(b => String(b.flag || '').toUpperCase() === 'X');
    const pending = this.allBrani.filter(b => String(b.flag || '').toUpperCase() !== 'X');

    this.allBrani = [...pending, ...executed];
    this.keepExecutedAtBottom = true;
    this.updateExecutedBottomModeBadge();
    this.currentSort = null;
    this.currentSortDirection = 'asc';
    this.lastHeaderSortField = null;
    this.currentPage = 1;

    Storage.set(BORDERO_CONFIG.CACHE_KEY_BRANI, this.allBrani);
    this.autoSaveSerata();
    this.updateSortButtons();
    this.updateColumnHeaderSortState();
    this.applyFilters();

    logger.info('Brani eseguiti spostati in fondo');
    Toast.info('Brani eseguiti spostati in fondo');
  }

  resetMoveExecutedToBottom(label = 'SPOSTA IN FONDO GLI ESEGUITI') {
    if (!this.keepExecutedAtBottom) {
      Toast.info(`Comando ${label} non attivo`);
      return;
    }

    this.keepExecutedAtBottom = false;
    this.currentSort = null;
    this.currentSortDirection = 'asc';
    this.lastHeaderSortField = null;
    this.allBrani = [...this.allBrani].sort((a, b) => (Number(a.originalIndex) || 0) - (Number(b.originalIndex) || 0));
    this.currentPage = 1;

    Storage.set(BORDERO_CONFIG.CACHE_KEY_BRANI, this.allBrani);
    this.autoSaveSerata();
    this.updateExecutedBottomModeBadge();
    this.updateSortButtons();
    this.updateColumnHeaderSortState();
    this.applyFilters();

    logger.info('Comando sposta eseguiti in fondo resettato');
    Toast.info(`Comando ${label} resettato`);
  }

  /**
   * Toggle filtro presenza dati su un campo o su più campi
   */
  togglePresenceFilter(fieldOrFields, buttonId) {
    const key = Array.isArray(fieldOrFields) ? fieldOrFields.join('|') : fieldOrFields;
    const current = this.currentFilters[key];

    if (current && current.mode === 'hasValue') {
      delete this.currentFilters[key];
    } else {
      this.currentFilters[key] = { mode: 'hasValue', fields: Array.isArray(fieldOrFields) ? fieldOrFields : [fieldOrFields] };
    }

    this.applyFilters();
    this.updateFilterButtons();
    if (buttonId) {
      const btn = document.getElementById(buttonId);
      btn?.classList.toggle('active', Boolean(this.currentFilters[key]));
    }
  }

  /**
   * Applica tutti i filtri
   */
  applyFilters() {
    logger.debug('Applicando filtri...');

    // Start con tutti i brani
    this.filteredBrani = [...this.allBrani];

    this.filteredBrani = filterBraniByTitleVisibility(this.filteredBrani, {
      isExecuted: (brano) => this.isExecutedBrano(brano),
      isRequested: (brano) => !this.isRichiesteZeroValue(brano?.richieste),
    });

    // Applica filtri
    Object.entries(this.currentFilters).forEach(([key, config]) => {
      if (!config || typeof config !== 'object') return;

      if (config.mode === 'hasValue') {
        const fields = config.fields || [key];
        this.filteredBrani = this.filteredBrani.filter(item =>
          fields.some(field => String(item[field] ?? '').trim() !== '')
        );
      } else if (config.mode === 'richiesteZero') {
        this.filteredBrani = this.filteredBrani.filter(item => this.isRichiesteZeroValue(item.richieste));
      } else if (config.mode === 'richiesteNonZero') {
        this.filteredBrani = this.filteredBrani.filter(item => !this.isRichiesteZeroValue(item.richieste));
      } else if (config.mode === 'exactValue') {
        const expected = this.normalizeExactFilterValue(config.value);
        this.filteredBrani = this.filteredBrani.filter(item =>
          this.normalizeExactFilterValue(item[key]) === expected
        );
      } else {
        const value = config.value ?? '';
        this.filteredBrani = ObjectUtils.filterByField(this.filteredBrani, key, value);
      }
    });

    // Applica ricerca
    if (this.currentSearch) {
      // Include `id` in the general search fields per request
      let searchFields = ['id', 'titolo', 'autore', 'richieste', 'coreografo', 'collaboratori', 'genere', 'next_coreo', 'info_livello', 'info_coreo_1', 'info_coreo_2'];

      if (this.searchMode === 'title') {
        searchFields = ['titolo'];
      } else if (this.searchMode === 'id') {
        searchFields = ['id'];
      }

      this.filteredBrani = ObjectUtils.searchMultiField(this.filteredBrani, this.currentSearch, searchFields);
    }

    this.filteredBrani = this.applyNextSelectionPriority(this.filteredBrani);

    // Re-applica sort
    if (this.currentSort) {
      const ascending = this.currentSortDirection !== 'desc';
      this.filteredBrani = this.sortCollection(this.filteredBrani, this.currentSort, ascending);
    }

    // Reset pagina
    this.currentPage = 1;

    // Render
    this.renderTable();

    // Update stats
    this.updateStats();
  }

  /**
   * Reset tutti i filtri
   */
  resetFilters(options = {}) {
    const { sortById = false, silent = false } = options;

    logger.info('Resettando filtri...');

    // Reset globale: azzera tutti i filtri di tutte le colonne.
    this.currentFilters = {};
    this.currentSearch = '';
    this.searchMode = 'general';
    this.currentSort = sortById ? 'id' : null;
    this.currentSortDirection = 'asc';
    this.lastHeaderSortField = sortById ? 'id' : null;
    this.currentPage = 1;

    if (this.activeFilterPicker) {
      this.closeFilterValuePicker();
    }

    this.filterButtonClickTimers.forEach((timer) => clearTimeout(timer));
    this.filterButtonClickTimers.clear();
    this.sortButtonClickTimers.forEach((timer) => clearTimeout(timer));
    this.sortButtonClickTimers.clear();
    this.headerSortClickTimers.forEach((timer) => clearTimeout(timer));
    this.headerSortClickTimers.clear();

    // Reset UI
    const searchBox = document.getElementById('search-box');
    if (searchBox) searchBox.value = '';
    this.updateSortButtons();
    this.updateColumnHeaderSortState();
    this.updateFilterButtons();
    this.updateSearchButtons();
    this.updateSearchPlaceholder();

    // Rebuild list senza filtri
    this.applyFilters();

    if (!silent) {
      Toast.info(sortById ? 'Filtri resettati e ordinamento ID crescente applicato' : 'Filtri resettati');
    }
  }

  clearVideoClipPresenceFilterOnOtherHeader(clickedField) {
    if (clickedField === 'videoclip') return;

    const current = this.currentFilters.videoclip;
    if (!current || current.mode !== 'hasValue') return;

    delete this.currentFilters.videoclip;
  }

  clearColumnFiltersExcept(selectedField) {
    const columnFields = Array.from(document.querySelectorAll('#brani-table thead th[data-col]'))
      .map((header) => header.dataset.col)
      .filter(Boolean);

    columnFields.forEach((field) => {
      if (field !== selectedField) {
        // Questi filtri devono poter coesistere e rimanere attivi finché non vengono rimossi esplicitamente.
        if (this.isCoexistingFilterField(field)) {
          return;
        }
        delete this.currentFilters[field];
      }
    });
  }

  /**
   * Renderizza la tabella
   */
  renderTable() {
    const tbody = document.getElementById('brani-tbody');
    const emptyState = document.getElementById('empty-state');

    if (this.filteredBrani.length === 0) {
      tbody.innerHTML = '';
      DOMUtils.show(emptyState);
      this.updateStats();
      return;
    }

    DOMUtils.hide(emptyState);

    // Pagina corrente
    const start = (this.currentPage - 1) * this.itemsPerPage;
    const end = start + this.itemsPerPage;
    this.displayedBrani = this.filteredBrani.slice(start, end);

    // Renderizza righe
    tbody.innerHTML = this.displayedBrani
      .map(brano => this.createBranoRow(brano))
      .join('');

    // Event listeners per click righe
    tbody.querySelectorAll('.brani-row').forEach(row => {
      row.addEventListener('click', async (e) => {
        const branoId = row.dataset.branoId;
        const brano = this.allBrani.find(b => String(b.id) === String(branoId));
        const clickedFlagCell = Boolean(e.target.closest('.col-flag'));
        const clickedVideoIcon = Boolean(e.target.closest('.videoclip-open'));
        const clickedNextCell = Boolean(e.target.closest('.col-next-coreo'));
        const activeNextSelectionId = this.getActiveNextSelectionId();

        if (clickedVideoIcon) {
          return;
        }

        if (clickedNextCell) {
          e.stopPropagation();
            if (brano && String(brano.flag || '').toUpperCase() === 'X') {
              Toast.warning('Questo brano non puo essere selezionato in NEXT perche e gia stato eseguito.');
              return;
            }

            if (brano && brano.next_selected) {
              const confirmed = await this.showDeselectionConfirm({
                title: 'Conferma deselezione NEXT',
                message: `Stai per rimuovere la scelta NEXT da ${this.escapeHtml(brano.titolo || brano.coreografia || brano.brano || brano.id || 'questo brano')}.`,
                confirmLabel: 'Deseleziona NEXT'
              });

              if (!confirmed) {
                return;
              }
            }
          this.toggleNextCoreoSelection(branoId);
          return;
        }

        if (clickedFlagCell) {
          if (!brano || !brano.next_selected) {
            Toast.warning('Per impostare FLAG devi prima selezionare lo stesso brano in NEXT.');
            return;
          }

          if (activeNextSelectionId && String(branoId) !== String(activeNextSelectionId)) {
            return;
          }

          if (brano && String(brano.flag || '').toUpperCase() === 'X') {
            const confirmed = await this.showDeselectionConfirm({
              title: 'Conferma deselezione FLAG',
              message: `Stai per riportare disponibile ${this.escapeHtml(brano.titolo || brano.coreografia || brano.brano || brano.id || 'questo brano')}.`,
              confirmLabel: 'Riporta disponibile'
            });

            if (!confirmed) {
              return;
            }

            this.markAsAvailable(branoId);
            return;
          }

          if (!brano || String(brano.flag || '').toUpperCase() === 'X') {
            return;
          }

          this.markAsCompleted(branoId);
          return;
        }

        return;
      });
    });

    tbody.querySelectorAll('.videoclip-open').forEach((button) => {
      button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (button.disabled || button.classList.contains('is-disabled')) {
          return;
        }
        const branoId = button.dataset.branoId;
        if (!branoId) return;
        window.location.href = `videoclip.html?branoId=${encodeURIComponent(String(branoId))}`;
      });
    });

    this.updatePagination();
    this.updateStats();
  }

  getActiveNextSelectionId() {
    const activeBrano = this.allBrani.find((item) => Boolean(item.next_selected));
    return activeBrano ? String(activeBrano.id) : null;
  }

  applyNextSelectionPriority(collection) {
    if (!Array.isArray(collection)) return [];

    const activeId = this.getActiveNextSelectionId();
    if (!activeId) return collection;

    const activeBrano = collection.find((item) => String(item.id) === String(activeId));
    if (!activeBrano) return collection;

    const remaining = collection.filter((item) => String(item.id) !== String(activeId));
    return [activeBrano, ...remaining];
  }

  reorderSelectedNextToTop() {
    this.allBrani = this.applyNextSelectionPriority(this.allBrani);

    if (Array.isArray(this.filteredBrani)) {
      this.filteredBrani = this.applyNextSelectionPriority(this.filteredBrani);
    }
  }

  reapplyCurrentOrdering() {
    if (!this.currentSort) {
      this.allBrani = this.applyNextSelectionPriority([...this.allBrani].sort((a, b) => (Number(a.originalIndex) || 0) - (Number(b.originalIndex) || 0)));
      this.filteredBrani = this.applyNextSelectionPriority([...this.filteredBrani].sort((a, b) => (Number(a.originalIndex) || 0) - (Number(b.originalIndex) || 0)));
      return;
    }

    const ascending = this.currentSortDirection !== 'desc';
    this.allBrani = this.sortCollection(this.allBrani, this.currentSort, ascending);
    this.filteredBrani = this.sortCollection(this.filteredBrani, this.currentSort, ascending);
  }

  toggleNextCoreoSelection(branoId) {
    const brano = this.allBrani.find((item) => String(item.id) === String(branoId));
    if (!brano) return;

    if (String(brano.flag || '').toUpperCase() === 'X') {
      Toast.warning('NEXT non consentito: il brano e gia stato eseguito.');
      return;
    }

    const isAlreadySelected = Boolean(brano.next_selected);
    const value = brano.next_coreo || brano.nextCoreo || brano['next coreo'] || brano.titolo || brano.coreografia || brano.brano || '';

    this.allBrani.forEach((item) => {
      item.next_selected = false;
    });

    if (!isAlreadySelected) {
      brano.next_selected = true;
      const title = brano.titolo || brano.coreografia || brano.brano || '';
      this.reorderSelectedNextToTop();
      const payload = {
        id: String(brano.id),
        title: title || value || '',
        nextValue: value,
        timestamp: Date.now(),
      };
      Storage.set('bordero_next_coreo_selection', payload);
      this.nextCoreoBroadcastChannel?.postMessage({ type: 'update', payload });
      window.dispatchEvent(new Event('bordero:next-coreo-updated'));
      Toast.success(`NEXT selezionato: ${title || brano.id}`);
    } else {
      Storage.remove('bordero_next_coreo_selection');
      this.nextCoreoBroadcastChannel?.postMessage({ type: 'clear' });
      window.dispatchEvent(new Event('bordero:next-coreo-updated'));
      Toast.info('Selezione NEXT rimossa');
    }

    this.reapplyCurrentOrdering();
    this.renderTable();
  }

  /**
   * Crea HTML riga brano
   */
  createBranoRow(brano) {
    const isCompleted = this.isExecutedBrano(brano);
    const completedClass = isCompleted ? 'completed' : '';
    const flagIcon = isCompleted ? '✅' : '';
    const timestamp = brano.timestamp || '';
    const richiesteHighlightClass = !isCompleted && !this.isRichiesteZeroValue(brano.richieste)
      ? ' richieste-nonzero'
      : '';
    const videoButtonDisabledClass = isCompleted ? ' is-disabled' : '';
    const videoButtonDisabledAttr = isCompleted ? ' disabled aria-disabled="true" tabindex="-1"' : '';
    const videoButtonTitle = isCompleted ? 'Brano eseguito: VideoClip non disponibile' : 'Apri VideoClip';
    const videoClipMarker = brano.videoclip
      ? `<button type="button" class="videoclip-open${videoButtonDisabledClass}" data-brano-id="${brano.id}" aria-label="Apri VideoClip per ${String(brano.titolo || brano.id || 'brano')}" title="${videoButtonTitle}"${videoButtonDisabledAttr}>🎬</button>`
      : '-';
    const nextCellValue = brano.next_coreo || brano.nextCoreo || brano['next coreo'] || '';
    const nextSelectionMarker = brano.next_selected ? '<span class="next-choice-icon" aria-label="Scelta NEXT effettuata">✓</span>' : '';

    return `
      <tr class="brani-row ${completedClass}" data-brano-id="${brano.id}">
        <td class="col-flag">
          <span class="flag-icon">${flagIcon}</span>
        </td>
        <td class="col-next-coreo">${brano.next_selected ? nextSelectionMarker : nextCellValue}</td>
        <td class="col-id">${brano.id}</td>
        <td class="col-timestamp">${timestamp}</td>
        <td class="col-titolo">${brano.titolo || brano.coreografia || brano.brano || '-'}</td>
        <td class="col-autore">${brano.autore}</td>
        <td class="col-richieste${richiesteHighlightClass}">${brano.richieste || '-'}</td>
        <td class="col-livello">${brano.info_livello || '-'}</td>
        <td class="col-coreo-1">${brano.info_coreo_1 || brano.info_coreo || '-'}</td>
        <td class="col-coreo-2">${brano.info_coreo_2 || '-'}</td>
        <td class="col-coreografo">${brano.coreografo || '-'}</td>
        <td class="col-collaboratori">${brano.collaboratori || '-'}</td>
        <td class="col-videoclip">${videoClipMarker}</td>
      </tr>
    `;
  }

  async refreshVideoClipAvailability() {
    this.videoClipFiles = [];
    this.videoClipCatalog = [];
    this.videoClipAvailableMap = new Map();

    const attempts = [
      window.location.origin + '/api/videoclip/list',
      'http://localhost:5500/api/videoclip/list',
      'http://127.0.0.1:5500/api/videoclip/list',
      '/api/videoclip/list'
    ];

    for (const url of attempts) {
      try {
        const resp = await fetch(url, { cache: 'no-store' });
        if (!resp.ok) continue;
        const json = await resp.json();
        if (json && Array.isArray(json.files) && json.files.length > 0) {
          this.videoClipFiles = json.files
            .map(f => String(f || '').trim())
            .filter(Boolean);
          logger.info('Videoclip list ottenuta da', url, this.videoClipFiles.length);
          break;
        }
      } catch (err) {
        logger.debug('Video list fetch failed for', url, err.message || err);
      }
    }

    const basenames = this.videoClipFiles.map((f) => {
      const idx = f.lastIndexOf('.');
      return idx > 0 ? f.slice(0, idx) : f;
    });

    this.videoClipCatalog = this.videoClipFiles.map((fullName, index) => {
      const baseName = basenames[index] || fullName;
      const parsed = this.parseVideoFileReference(baseName);
      const normalizedName = this.normalizeForMatch(parsed.name || baseName);
      return {
        fullName,
        baseName,
        prefix: parsed.prefix || '',
        name: parsed.name || baseName,
        normalizedName,
        tokens: this.tokenizeForMatch(normalizedName)
      };
    });

    this.allBrani.forEach((brano) => {
      const matched = this.findMatchingVideoFile(brano);
      if (matched) this.videoClipAvailableMap.set(String(brano.id), matched);
    });
  }

  applyVideoClipAvailabilityToBrani() {
    const markerFor = (brano) => this.videoClipAvailableMap.has(String(brano?.id ?? '')) ? '🎬' : '';

    this.allBrani = this.allBrani.map((brano) => ({
      ...brano,
      videoclip: markerFor(brano)
    }));

    this.filteredBrani = this.filteredBrani.map((brano) => ({
      ...brano,
      videoclip: markerFor(brano)
    }));
  }

  parseVideoFileReference(fileName) {
    const rawName = String(fileName || '').trim();
    if (!rawName) return { prefix: '', name: '' };

    const withoutExtension = rawName.replace(/\.[^.]+$/, '');
    const match = withoutExtension.match(/^(\d{3})[\s_-]+(.+)$/);

    if (match) {
      return {
        prefix: match[1],
        name: match[2].trim()
      };
    }

    return {
      prefix: '',
      name: withoutExtension
    };
  }

  normalizeForMatch(value) {
    let text = String(value || '').trim();
    if (!text) return '';

    try {
      text = text.normalize('NFD').replace(/\p{Diacritic}/gu, '');
    } catch (e) {
      text = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    }

    return text
      .toLowerCase()
      .replace(/&/g, ' e ')
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  tokenizeForMatch(normalizedText) {
    return String(normalizedText || '')
      .split(' ')
      .map(token => token.trim())
      .filter(token => token.length >= 2);
  }

  buildBranoMatchProfile(brano) {
    const idDigits = String(brano?.id ?? '').replace(/\D+/g, '');
    const idPrefix = idDigits ? idDigits.padStart(3, '0') : '';

    const rawNames = [
      brano?.coreografia,
      brano?.titolo,
      brano?.brano,
      brano?.song,
      brano?.canzone
    ].map(value => String(value || '').trim()).filter(Boolean);

    const normalizedNames = [...new Set(rawNames
      .map(name => this.normalizeForMatch(name))
      .filter(name => name.length >= 3))];

    const tokenSet = new Set();
    normalizedNames.forEach(name => {
      this.tokenizeForMatch(name).forEach(token => tokenSet.add(token));
    });

    return {
      idPrefix,
      normalizedNames,
      tokens: [...tokenSet]
    };
  }

  scoreVideoCandidate(profile, candidate) {
    let score = 0;

    const hasPrefix = Boolean(profile.idPrefix);
    if (hasPrefix && candidate.prefix === profile.idPrefix) {
      score += 1000;
    }

    if (profile.normalizedNames.includes(candidate.normalizedName)) {
      score += 450;
    }

    const includesName = profile.normalizedNames.some(name =>
      candidate.normalizedName.includes(name) || name.includes(candidate.normalizedName)
    );
    if (includesName) {
      score += 120;
    }

    if (profile.tokens.length > 0 && candidate.tokens.length > 0) {
      const shared = candidate.tokens.filter(token => profile.tokens.includes(token)).length;
      const ratio = shared / Math.max(profile.tokens.length, candidate.tokens.length);
      score += Math.round(ratio * 100);
    }

    return score;
  }

  findMatchingVideoFile(brano) {
    if (!Array.isArray(this.videoClipCatalog) || this.videoClipCatalog.length === 0) return null;

    const profile = this.buildBranoMatchProfile(brano);
    const hasNames = profile.normalizedNames.length > 0;

    let pool = this.videoClipCatalog;
    if (profile.idPrefix) {
      const byPrefix = this.videoClipCatalog.filter(item => item.prefix === profile.idPrefix);
      if (byPrefix.length > 0) {
        pool = byPrefix;
      }
    }

    const scored = pool
      .map(item => ({ item, score: this.scoreVideoCandidate(profile, item) }))
      .sort((a, b) => b.score - a.score);

    if (scored.length === 0 || scored[0].score <= 0) {
      return null;
    }

    const best = scored[0];
    const second = scored[1];

    if (profile.idPrefix && pool.length > 1 && hasNames) {
      const ambiguous = second && (best.score - second.score) < 80;
      if (ambiguous) {
        logger.warn('Match ambiguo: prefisso ID duplicato senza differenza significativa', {
          branoId: brano?.id,
          best: best.item.fullName,
          second: second.item.fullName,
          bestScore: best.score,
          secondScore: second.score
        });
        return null;
      }
    }

    if (!profile.idPrefix) {
      const exactNameMatches = scored.filter(entry => profile.normalizedNames.includes(entry.item.normalizedName));
      if (exactNameMatches.length === 1) {
        return exactNameMatches[0].item.fullName;
      }

      if (exactNameMatches.length > 1) {
        logger.warn('Match ambiguo: titolo coincide con più file senza prefisso ID', {
          branoId: brano?.id,
          matches: exactNameMatches.map(entry => entry.item.fullName)
        });
        return null;
      }

      if (best.score < 260) {
        return null;
      }
    }

    return best.item.fullName;
  }

  /**
   * Marca brano come completato (X) e fa scivolare al fondo
   */
  markAsCompleted(branoId) {
    const brano = this.allBrani.find(b => String(b.id) === String(branoId));
    if (!brano) return;

    if (!brano.next_selected) {
      Toast.warning('FLAG non consentito: seleziona prima questo brano in NEXT.');
      return;
    }

    const wasNextSelected = Boolean(brano.next_selected);

    if (wasNextSelected) {
      this.allBrani.forEach((item) => {
        item.next_selected = false;
      });
      Storage.remove('bordero_next_coreo_selection');
      this.nextCoreoBroadcastChannel?.postMessage({ type: 'clear' });
      window.dispatchEvent(new Event('bordero:next-coreo-updated'));
    }

    // Marca flag X
    brano.flag = 'X';
    // Aggiungi timestamp automatico
    brano.timestamp = DateUtils.formatDate(new Date());

    // Move to bottom preserving completed order
    const index = this.allBrani.indexOf(brano);
    if (index > -1) {
      this.allBrani.splice(index, 1);
      this.allBrani.push(brano);
    }

    this.reorderBraniByOriginalIndex();

    // Salva in storage
    Storage.set(BORDERO_CONFIG.CACHE_KEY_BRANI, this.allBrani);

    // Auto-save serata
    this.autoSaveSerata();

    // Update last action
    this.lastActionTime = new Date();
    this.updateLastActionTime();

    logger.info(`Brano ${branoId} marcato come completato`);
    Toast.success(`✓ "${brano.titolo}" completato`);

    // Re-render mantenendo filtri
    this.applyFilters();
  }

  /**
   * Ripristina brano disponibile annullando la flag X
   */
  markAsAvailable(branoId) {
    const brano = this.allBrani.find(b => String(b.id) === String(branoId));
    if (!brano) return;

    if (String(brano.flag || '').toUpperCase() !== 'X') {
      return;
    }

    brano.flag = '';
    brano.timestamp = '';

    this.reorderBraniByOriginalIndex();
    Storage.set(BORDERO_CONFIG.CACHE_KEY_BRANI, this.allBrani);
    this.autoSaveSerata();

    this.lastActionTime = new Date();
    this.updateLastActionTime();

    logger.info(`Brano ${branoId} ripristinato come disponibile`);
    Toast.info(`✓ "${brano.titolo}" riportato disponibile`);

    this.applyFilters();
  }

  /**
   * Update buttons stato
   */
  updateSortButtons() {
    const buttons = ['btn-sort-id', 'btn-sort-coreografo', 'btn-sort-autore', 'btn-sort-richieste'];
    buttons.forEach(btnId => {
      const btn = document.getElementById(btnId);
      const fieldName = btnId.replace('btn-sort-', '');
      if (btn) {
        if (this.currentSort === fieldName) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      }
    });
  }

  updateColumnHeaderSortState() {
    const headers = document.querySelectorAll('#brani-table thead th[data-col]');
    const headerFields = Array.from(headers)
      .map((header) => header.dataset.col)
      .filter(Boolean);

    const activeColumnFilterField = headerFields.find((field) => {
      const cfg = this.currentFilters[field];
      return Boolean(cfg && (cfg.mode === 'hasValue' || cfg.mode === 'exactValue'));
    }) || null;

    const activeField = this.currentSort || activeColumnFilterField;

    headers.forEach((header) => {
      const field = header.dataset.col || '';
      const isFilterOnly = header.dataset.filterOnly === 'true';
      const isActiveField = Boolean(activeField && activeField === field);
      const isSortActive = isActiveField;
      const isFilterActive = isActiveField && isFilterOnly;
      header.classList.toggle('active-sort', isSortActive);
      header.classList.toggle('active-filter', isFilterActive);
      header.setAttribute('aria-pressed', (isSortActive || isFilterActive) ? 'true' : 'false');
    });
  }

  updateFilterButtons() {
    const buttons = [
      { id: 'btn-filter-coreografia', key: 'info_livello' },
      { id: 'btn-filter-next', key: 'next_coreo' },
      { id: 'btn-filter-livello', key: 'coreografo' },
      { id: 'btn-filter-altro', key: 'autore' },
      { id: 'btn-filter-richieste', key: 'richieste' },
    ];

    buttons.forEach(({ id, key }) => {
      const btn = document.getElementById(id);
      if (btn) {
        const isActive = Boolean(this.currentFilters[key]);
        btn.classList.toggle('active', isActive);
      }
    });
  }

  updateSearchButtons() {
    const buttons = [
      { id: 'btn-search-general', mode: 'general' },
      { id: 'btn-search-title', mode: 'title' },
      { id: 'btn-search-id', mode: 'id' },
    ];

    buttons.forEach(({ id, mode }) => {
      const btn = document.getElementById(id);
      if (btn) {
        btn.classList.toggle('active', this.searchMode === mode);
      }
    });
    // Update the visible list of fields used by the current search mode
    this.updateSearchFieldsUI();
  }

  updateSearchPlaceholder() {
    const searchBox = document.getElementById('search-box');
    const searchLabel = document.querySelector('.search-group .search-label');
    if (!searchBox && !searchLabel) return;

    const labels = {
      general: 'RICERCA GENERALE',
      title: 'RICERCA PER TITOLO',
      id: 'RICERCA PER ID'
    };

    const placeholders = {
      general: '🔍 Cerca ID, titolo, autore, richieste, next, genere, livello, info coreo 1, info coreo 2 o coreografo...',
      title: '🔍 Cerca per titolo...',
      id: '🔍 Cerca per ID...'
    };

    if (searchLabel) {
      searchLabel.textContent = labels[this.searchMode] || labels.general;
    }

    if (searchBox) {
      searchBox.placeholder = placeholders[this.searchMode] || placeholders.general;
    }
  }

  updateSearchFieldsUI() {
    const container = document.getElementById('search-fields-info');
    if (!container) return;

    const mapping = {
      id: 'ID',
      titolo: 'Titolo',
      autore: 'Autore',
      richieste: 'Richieste',
      coreografo: 'Coreografo',
      collaboratori: 'Collaboratori',
      genere: 'Genere',
      next_coreo: 'Next',
      info_livello: 'Livello',
      info_coreo_1: 'Info Coreo 1',
      info_coreo_2: 'Info Coreo 2',
      compositore: 'Compositore',
      durata: 'Durata'
    };

    let fields = [];
    if (this.searchMode === 'title') {
      fields = ['titolo'];
    } else if (this.searchMode === 'id') {
      fields = ['id'];
    } else {
      fields = ['id', 'titolo', 'autore', 'richieste', 'coreografo', 'collaboratori', 'genere', 'next_coreo', 'info_livello', 'info_coreo_1', 'info_coreo_2'];
    }

    const readable = fields.map(f => mapping[f] || f).join(', ');
    container.textContent = `Campi cercati: ${readable}`;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = String(text ?? '');
    return div.innerHTML;
  }

  async syncRichiesteFromGoogle() {
    const button = document.getElementById('btn-sync-richieste-google');
    const initialText = button?.textContent || '🔄 SYNC RICHIESTE GOOGLE';

    try {
      if (button) {
        button.disabled = true;
        button.textContent = '⏳ SYNC IN CORSO...';
      }

      const response = await fetch('/api/bordero/sync-google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store'
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || payload?.summary?.error || 'Sincronizzazione Google non riuscita');
      }

      await this.refreshFromCurrentData({ silent: true, source: 'manual-google-sync' });

      const sheetResult = Array.isArray(payload?.summary?.results)
        ? payload.summary.results.find((item) => String(item?.sheet || '').toLowerCase() === 'accoda 8+12')
        : null;
      const syncedRows = Number(sheetResult?.rows || 0);
      const syncedMessage = syncedRows > 0
        ? `✓ Sync completato: ${syncedRows} righe aggiornate da Google`
        : '✓ Sync Google completato';
      Toast.success(syncedMessage);
    } catch (error) {
      logger.error('Errore sync richieste Google', error);
      Toast.error(`Errore sync richieste: ${error.message || error}`);
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = initialText;
      }
    }
  }

  /**
   * Pagination
   */
  updatePagination() {
    const totalPages = Math.ceil(this.filteredBrani.length / this.itemsPerPage);
    const info = document.getElementById('pagination-info');
    if (info) {
      info.textContent = `Pagina ${this.currentPage} di ${totalPages}`;
    }

    const totalPagesSafe = Math.max(totalPages, 1);

    // Disable buttons
    document.getElementById('btn-first-page').disabled = this.currentPage === 1 || totalPages <= 1;
    document.getElementById('btn-prev-page').disabled = this.currentPage === 1 || totalPages <= 1;
    document.getElementById('btn-next-page').disabled = this.currentPage === totalPagesSafe || totalPages <= 1;
    document.getElementById('btn-last-page').disabled = this.currentPage === totalPagesSafe || totalPages <= 1;
  }

  goToPage(pageNumber) {
    const totalPages = Math.ceil(this.filteredBrani.length / this.itemsPerPage);
    if (totalPages <= 0) return;

    const targetPage = Math.min(Math.max(1, pageNumber), totalPages);
    if (targetPage === this.currentPage) return;

    this.currentPage = targetPage;
    this.renderTable();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  firstPage() {
    this.goToPage(1);
  }

  prevPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.renderTable();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  nextPage() {
    const totalPages = Math.ceil(this.filteredBrani.length / this.itemsPerPage);
    if (this.currentPage < totalPages) {
      this.currentPage++;
      this.renderTable();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  lastPage() {
    const totalPages = Math.ceil(this.filteredBrani.length / this.itemsPerPage);
    this.goToPage(totalPages);
  }

  /**
   * Statistiche live
   */
  updateStats() {
    const total = this.allBrani.length;
    const requested = this.getUniqueRequestedBrani(this.allBrani);
    const completed = this.allBrani.filter(b => String(b.flag).toUpperCase() === 'X').length;
    const pending = total - completed;

    document.getElementById('stat-total').textContent = total;
    document.getElementById('stat-requested').textContent = requested.length;
    document.getElementById('stat-completed').textContent = `${completed} (${total > 0 ? Math.round((completed / total) * 100) : 0}%)`;
    document.getElementById('stat-pending').textContent = pending;
    this.updateRichiesteAlertState();
    this.updateExecutedBottomModeBadge();

    window.dispatchEvent(new CustomEvent('bordero:stats-updated', {
      detail: { total, requested: requested.length, completed, pending }
    }));
  }

  updateRichiesteAlertState() {
    const richiesteButton = document.getElementById('btn-filter-richieste');
    if (!richiesteButton) return;

    const withNonZeroRichieste = this.getUniqueRequestedBrani(this.allBrani);
    const hasPendingWithRichieste = withNonZeroRichieste.some((brano) => !this.isExecutedBrano(brano));

    richiesteButton.classList.toggle('btn-richieste-alert', hasPendingWithRichieste);
  }

  getUniqueRequestedBrani(collection = []) {
    const uniqueById = new Map();

    collection.forEach((brano) => {
      if (!brano || this.isRichiesteZeroValue(brano.richieste)) return;
      const key = String(brano.id ?? '').trim();
      if (!key || uniqueById.has(key)) return;
      uniqueById.set(key, brano);
    });

    return [...uniqueById.values()];
  }

  updateExecutedBottomModeBadge() {
    const modeEl = document.getElementById('stat-executed-bottom-mode');
    if (!modeEl) return;

    const isOn = Boolean(this.keepExecutedAtBottom);
    modeEl.textContent = isOn ? 'ON' : 'OFF';
    modeEl.classList.toggle('mode-on', isOn);
    modeEl.classList.toggle('mode-off', !isOn);
  }

  updateLastActionTime() {
    const el = document.getElementById('stat-last-action');
    if (el && this.lastActionTime) {
      el.textContent = DateUtils.formatTime(this.lastActionTime);
    }
  }

  /**
   * Export serata a CSV SIAE (solo brani eseguiti)
   * Replica la macro VBA: salva UTF-8 in C:\VSC_SIAE e scarica il file generato.
   */
  async exportSerataToSIAE() {
    const completed = this.allBrani.filter(b => String(b.flag || '').toUpperCase() === 'X');

    if (completed.length === 0) {
      Toast.warning('Nessun brano eseguito da esportare');
      return;
    }

    try {
      const exportCandidates = [
        'http://localhost:5500/api/bordero/export-siae',
        'http://127.0.0.1:5500/api/bordero/export-siae',
        window.location.origin.replace(/:\d+$/, '') + ':5500/api/bordero/export-siae',
        window.location.origin + '/api/bordero/export-siae',
        '/api/bordero/export-siae',
      ];

      let result = null;
      let lastError = null;
      let apiOrigin = '';

      for (const endpoint of exportCandidates) {
        try {
          const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              brani: completed,
              evento: this.serata?.evento || ''
            }),
          });

          const candidateResult = await response.json().catch(() => ({}));
          if (!response.ok || !candidateResult.ok) {
            throw new Error(candidateResult.error || `Errore HTTP ${response.status}`);
          }

          result = candidateResult;
          apiOrigin = new URL(endpoint, window.location.origin).origin;
          break;
        } catch (candidateError) {
          lastError = candidateError;
        }
      }

      if (!result) {
        throw lastError || new Error('Errore durante la generazione del file SIAE');
      }

      if (result.downloadUrl) {
        const link = document.createElement('a');
        link.href = new URL(result.downloadUrl, apiOrigin || window.location.origin).href;
        link.download = result.fileName || '';
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }

      logger.info(`Esportati ${result.count || completed.length} brani in formato SIAE`, result);
      Toast.success(`✓ File SIAE generato in C:\\VSC_SIAE\\: ${result.fileName}`);
    } catch (error) {
      logger.error('Errore export SIAE Bordero', error);
      Toast.error(error.message || 'Errore durante export SIAE');
    }
  }

  /**
   * Salva automaticamente la serata ogni volta che viene marcato un brano
   */
  autoSaveSerata() {
    const serataData = {
      dj: this.serata.dj,
      data: this.serata.data,
      luogo: this.serata.luogo,
      evento: this.serata.evento,
    };
    
    dataLoader.saveCurrentSerata(serataData, this.allBrani);
  }

  /**
   * Termina la serata corrente e archivia (salva cronologia)
   */
  finishSerata() {
    if (confirm('Vuoi terminare e archiviare questa serata?')) {
      const serataData = {
        dj: this.serata.dj || 'Unknown',
        data: this.serata.data,
        luogo: this.serata.luogo || 'Unknown',
        evento: this.serata.evento || 'Event',
      };

      // Archivia
      dataLoader.archiveCurrentSerata(serataData, this.allBrani);

      // Esporta SIAE
      this.exportSerataToSIAE();

      // RESET: riporta tutti i brani eseguiti al loro stato disponibile
      try {
        this.allBrani = this.allBrani.map(b => {
          if (String(b.flag || '').toUpperCase() === 'X' || b.eseguito === true || b.eseguito === 'X' || b.eseguito === 'x' || b.executed === true || b.executed === 'X' || b.executed === 'x') {
            return {
              ...b,
              flag: '',
              eseguito: false,
              executed: false,
              timestamp: '',
            };
          }
          return b;
        });

        // Ripristina ordine originale (brani disponibili prima, eseguiti dopo)
        if (typeof this.reorderBraniByOriginalIndex === 'function') {
          this.reorderBraniByOriginalIndex();
        }

        // Persisti nuovo stato: svuota la serata corrente (metadata verrà resettata sotto)
        const emptyMeta = { dj: '', data: '', luogo: '', evento: '' };
        dataLoader.saveCurrentSerata(emptyMeta, this.allBrani);
        Storage.set(BORDERO_CONFIG.CACHE_KEY_BRANI, this.allBrani);

        Toast.info('Stato brani ripristinato per nuova serata');
      } catch (e) {
        logger.error('Errore durante il reset degli stati dei brani', e);
        Toast.error('Errore nel reset dei brani: ' + e.message);
      }

      // Resetta metadata serata (campi input)
      this.resetSerataMetaFields();

      // Aggiorna UI e statistiche
      this.applyFilters();
      this.updateStats();
      this.lastActionTime = new Date();
      this.updateLastActionTime();

      // Nuova serata: chiede se iniziare subito e reinizializza se confermato
      setTimeout(() => {
        if (confirm('Avviare una nuova serata?')) {
          dataLoader.newSerata?.();
          this.init();
        }
      }, 1000);
    }
  }

  /**
   * UserForm
   */
  setupDeselectionConfirmModal() {
    const modal = document.getElementById('deselection-confirm-modal');
    const closeBtn = document.getElementById('deselection-confirm-close');
    const cancelBtn = document.getElementById('deselection-confirm-cancel');
    const confirmBtn = document.getElementById('deselection-confirm-accept');

    closeBtn?.addEventListener('click', () => this.resolveDeselectionConfirm(false));
    cancelBtn?.addEventListener('click', () => this.resolveDeselectionConfirm(false));
    confirmBtn?.addEventListener('click', () => this.resolveDeselectionConfirm(true));

    modal?.addEventListener('click', (event) => {
      if (event.target === modal) {
        this.resolveDeselectionConfirm(false);
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && this.deselectionConfirmState) {
        this.resolveDeselectionConfirm(false);
      }
    });
  }

  showDeselectionConfirm({ title, message, confirmLabel }) {
    const modal = document.getElementById('deselection-confirm-modal');
    const titleEl = document.getElementById('deselection-confirm-title');
    const messageEl = document.getElementById('deselection-confirm-message');
    const confirmBtn = document.getElementById('deselection-confirm-accept');

    if (!modal || !titleEl || !messageEl || !confirmBtn) {
      return Promise.resolve(window.confirm(message || title || 'Confermi la deselezione?'));
    }

    if (this.deselectionConfirmState) {
      this.resolveDeselectionConfirm(false);
    }

    titleEl.textContent = title || 'Conferma deselezione';
    messageEl.innerHTML = message || 'Confermi di annullare la selezione?';
    confirmBtn.textContent = confirmLabel || 'Conferma';

    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');

    return new Promise((resolve) => {
      this.deselectionConfirmState = { resolve };
      setTimeout(() => confirmBtn.focus(), 0);
    });
  }

  resolveDeselectionConfirm(confirmed) {
    const modal = document.getElementById('deselection-confirm-modal');
    if (modal) {
      modal.hidden = true;
      modal.setAttribute('aria-hidden', 'true');
    }

    const state = this.deselectionConfirmState;
    this.deselectionConfirmState = null;

    if (state && typeof state.resolve === 'function') {
      state.resolve(Boolean(confirmed));
    }
  }

  showUserForm() {
    // Bordero page lives in Bordero/pages, USERFORM index is at repo root /USERFORM/index.html.
    window.location.href = '../../USERFORM/index.html';
  }
}

// Inizializza quando DOM è pronto
document.addEventListener('DOMContentLoaded', () => {
  window.tableManager = new BorderoTableManager();
});

// Espone la classe per test headless e ambienti esterni
if (typeof window !== 'undefined') {
  window.BorderoTableManager = BorderoTableManager;
}

logger.info('✓ Bordero.js caricato');
