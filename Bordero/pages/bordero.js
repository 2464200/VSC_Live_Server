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
    this.currentFilters = {};
    this.currentSearch = '';
    this.searchMode = 'general';
    this.searchMode = 'general';
    this.currentPage = 1;
    this.itemsPerPage = BORDERO_CONFIG.ITEMS_PER_PAGE;
    this.lastActionTime = null;
    this.serataMetaStorageKey = 'bordero_serata_meta';

    // Serata info
    this.serata = {
      dj: '',
      data: new Date().toISOString().split('T')[0],
      luogo: '',
      evento: '',
    };

    this.init();
  }

  async init() {
    logger.info('BorderoTableManager initializing...');

    try {
      // Prima sincronizza da Excel
      await dataLoader.initialize();

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

      this.filteredBrani = [...this.allBrani];

      // Setup UI
      this.setupEventListeners();
      this.setupSerataMeta();
      this.updateSearchPlaceholder();
      this.renderTable();

      logger.info(`✓ Inizializzato con ${this.allBrani.length} brani`);
      Toast.success(`Caricati ${this.allBrani.length} brani`);
    } catch (error) {
      logger.error('Errore inizializzazione', error);
      Toast.error('Errore caricamento tabella: ' + error.message);
    }
  }

  getStoredSerataMeta() {
    const stored = Storage.get(this.serataMetaStorageKey, null);
    if (stored && typeof stored === 'object') {
      return stored;
    }

    return {
      dj: Storage.get('bordero_selected_dj', ''),
      data: Storage.get('bordero_serata_data', ''),
      luogo: Storage.get('bordero_selected_luogo', ''),
      evento: Storage.get('bordero_serata_evento', ''),
    };
  }

  persistSerataMeta() {
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
    Storage.remove('bordero_serata_data');
    Storage.remove('bordero_serata_evento');
  }

  resetSerataMetaFields() {
    this.serata = {
      dj: '',
      data: new Date().toISOString().split('T')[0],
      luogo: '',
      evento: '',
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

    const luogoSelect = document.getElementById('luogo-select');
    if (luogoSelect) {
      luogoSelect.value = '';
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
      luogo: storedMeta.luogo || '',
      evento: storedMeta.evento || '',
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

    // Luogo dropdown da Comuni Italia
    this.populateComuniSelect();

    // Evento libero
    document.getElementById('evento-text')?.addEventListener('input', (e) => {
      this.serata.evento = e.target.value;
      this.persistSerataMeta();
      logger.debug('Evento:', this.serata.evento);
    });
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

      djSelect.addEventListener('change', (e) => {
        const value = e.target.value.trim();
        this.serata.dj = value;
        this.persistSerataMeta();
        logger.debug('DJ selezionato:', this.serata.dj);
      });

      logger.debug(`DJ select popolato con ${dj.length} opzioni`);
    } catch (error) {
      logger.error('Errore popolo DJ', error);
    }
  }

  /**
   * Popola il select dei Comuni
   */
  async populateComuniSelect() {
    const comuniSelect = document.getElementById('luogo-select');
    
    try {
      const comuni = await dataLoader.loadComuni();
      comuniSelect.innerHTML = '<option value="">-- Seleziona Luogo --</option>';
      
      comuni.forEach(item => {
        const nome = item.nome || item.name || '';
        if (!nome) return;

        const option = document.createElement('option');
        option.value = nome;
        option.textContent = nome;
        comuniSelect.appendChild(option);
      });

      const savedLuogo = this.serata.luogo || '';
      if (savedLuogo) {
        comuniSelect.value = savedLuogo;
      }

      comuniSelect.addEventListener('change', (e) => {
        const value = e.target.value.trim();
        this.serata.luogo = value;
        this.persistSerataMeta();
        logger.debug('Luogo selezionato:', this.serata.luogo);
      });

      logger.debug(`Comuni select popolato con ${comuni.length} opzioni`);
    } catch (error) {
      logger.error('Errore popolo comuni', error);
    }
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Sort buttons (esclusivi)
    document.getElementById('btn-sort-id')?.addEventListener('click', () => this.sortBy('id'));
    document.getElementById('btn-sort-genere')?.addEventListener('click', () => this.sortBy('genere'));
    document.getElementById('btn-sort-autore')?.addEventListener('click', () => this.sortBy('autore'));
    document.getElementById('btn-view-executed')?.addEventListener('click', () => {
      window.location.href = 'brani-eseguiti.html';
    });

    // Filter buttons
    document.getElementById('btn-filter-coreografia')?.addEventListener('click', () =>
      this.togglePresenceFilter('info_coreo', 'btn-filter-coreografia')
    );
    document.getElementById('btn-filter-genere')?.addEventListener('click', () =>
      this.togglePresenceFilter('genere', 'btn-filter-genere')
    );
    document.getElementById('btn-filter-livello')?.addEventListener('click', () =>
      this.togglePresenceFilter('info_livello', 'btn-filter-livello')
    );
    document.getElementById('btn-filter-altro')?.addEventListener('click', () =>
      this.togglePresenceFilter(['collaboratori', 'compositore', 'durata', 'info_coreo'], 'btn-filter-altro')
    );

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

    // Reset filters
    document.getElementById('btn-reset-filters')?.addEventListener('click', () => {
      this.resetFilters();
    });
    document.getElementById('btn-reset-filters-empty')?.addEventListener('click', () => {
      this.resetFilters();
    });

    // Azioni
    document.getElementById('btn-userform')?.addEventListener('click', () => this.showUserForm());
    document.getElementById('btn-export')?.addEventListener('click', () => this.exportSerataToSIAE());
    document.getElementById('btn-print')?.addEventListener('click', () => window.print());
    document.getElementById('btn-finish-serata')?.addEventListener('click', () => this.finishSerata());

    // Pagination
    document.getElementById('btn-first-page')?.addEventListener('click', () => this.firstPage());
    document.getElementById('btn-prev-page')?.addEventListener('click', () => this.prevPage());
    document.getElementById('btn-next-page')?.addEventListener('click', () => this.nextPage());
    document.getElementById('btn-last-page')?.addEventListener('click', () => this.lastPage());
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
  }

  /**
   * Sort per colonna (esclusivo - resetta altri sort)
   */
  sortBy(field) {
    logger.info(`Sorting by ${field}`);

    if (this.currentSort === field) {
      // Toggle ascending/descending
      this.currentSort = field;
      this.filteredBrani = ObjectUtils.sortByField(this.filteredBrani, field, false);
    } else {
      // Nuovo sort
      this.currentSort = field;
      this.filteredBrani = ObjectUtils.sortByField(this.filteredBrani, field, true);
    }

    // Resetta pagina
    this.currentPage = 1;

    // Update UI
    this.updateSortButtons();
    this.renderTable();

    Toast.info(`Ordinato per ${field}`);
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

    // Applica filtri
    Object.entries(this.currentFilters).forEach(([key, config]) => {
      if (!config || typeof config !== 'object') return;

      if (config.mode === 'hasValue') {
        const fields = config.fields || [key];
        this.filteredBrani = this.filteredBrani.filter(item =>
          fields.some(field => String(item[field] ?? '').trim() !== '')
        );
      } else {
        const value = config.value ?? '';
        this.filteredBrani = ObjectUtils.filterByField(this.filteredBrani, key, value);
      }
    });

    // Applica ricerca
    if (this.currentSearch) {
      let searchFields = ['titolo', 'autore', 'coreografo', 'collaboratori', 'genere', 'info_livello', 'info_coreo'];

      if (this.searchMode === 'title') {
        searchFields = ['titolo'];
      } else if (this.searchMode === 'id') {
        searchFields = ['id'];
      }

      this.filteredBrani = ObjectUtils.searchMultiField(this.filteredBrani, this.currentSearch, searchFields);
    }

    // Re-applica sort
    if (this.currentSort) {
      this.filteredBrani = ObjectUtils.sortByField(this.filteredBrani, this.currentSort, true);
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
  resetFilters() {
    logger.info('Resettando filtri...');

    this.currentFilters = {};
    this.currentSearch = '';
    this.currentSort = null;
    this.currentPage = 1;

    // Reset UI
    document.getElementById('search-box').value = '';
    this.updateSortButtons();
    this.updateFilterButtons();
    this.updateSearchButtons();
    this.updateSearchPlaceholder();

    // Render
    this.filteredBrani = [...this.allBrani];
    this.renderTable();

    Toast.info('Filtri resettati');
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
      row.addEventListener('click', (e) => {
        const branoId = row.dataset.branoId;
        this.markAsCompleted(branoId);
      });
    });

    this.updatePagination();
    this.updateStats();
  }

  /**
   * Crea HTML riga brano
   */
  createBranoRow(brano) {
    const isCompleted = brano.flag === 'X';
    const completedClass = isCompleted ? 'completed' : '';
    const flagIcon = isCompleted ? '✅' : '';
    const timestamp = brano.timestamp || '';

    return `
      <tr class="brani-row ${completedClass}" data-brano-id="${brano.id}">
        <td class="col-flag">
          <span class="flag-icon">${flagIcon}</span>
        </td>
        <td class="col-id">${brano.id}</td>
        <td class="col-timestamp">${timestamp}</td>
        <td class="col-titolo">${brano.titolo || brano.coreografia || brano.brano || '-'}</td>
        <td class="col-autore">${brano.autore}</td>
        <td class="col-genere">${brano.genere || '-'}</td>
        <td class="col-livello">${brano.info_livello || '-'}</td>
        <td class="col-coreo">${brano.info_coreo || '-'}</td>
        <td class="col-coreografo">${brano.coreografo || '-'}</td>
        <td class="col-collaboratori">${brano.collaboratori || '-'}</td>
      </tr>
    `;
  }

  /**
   * Marca brano come completato (X) e fa scivolare al fondo
   */
  markAsCompleted(branoId) {
    const brano = this.allBrani.find(b => String(b.id) === String(branoId));
    if (!brano) return;

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
   * Update buttons stato
   */
  updateSortButtons() {
    const buttons = ['btn-sort-id', 'btn-sort-genere', 'btn-sort-autore'];
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

  updateFilterButtons() {
    const buttons = [
      { id: 'btn-filter-coreografia', key: 'info_coreo' },
      { id: 'btn-filter-genere', key: 'genere' },
      { id: 'btn-filter-livello', key: 'info_livello' },
      { id: 'btn-filter-altro', key: ['collaboratori', 'compositore', 'durata', 'info_coreo'].join('|') },
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
      general: '🔍 Cerca titolo, autore, genere, livello o coreografia...',
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
    const completed = this.allBrani.filter(b => String(b.flag).toUpperCase() === 'X').length;
    const pending = total - completed;

    document.getElementById('stat-total').textContent = total;
    document.getElementById('stat-completed').textContent = `${completed} (${total > 0 ? Math.round((completed / total) * 100) : 0}%)`;
    document.getElementById('stat-pending').textContent = pending;
  }

  updateLastActionTime() {
    const el = document.getElementById('stat-last-action');
    if (el && this.lastActionTime) {
      el.textContent = DateUtils.formatTime(this.lastActionTime);
    }
  }

  /**
   * Export serata a CSV SIAE (solo brani eseguiti)
   * Formato SIAE: Titolo, Autore, Compositore, Performer, Durata
   */
  exportSerataToSIAE() {
    const completed = this.allBrani.filter(b => b.flag === 'X');

    if (completed.length === 0) {
      Toast.warning('Nessun brano eseguito da esportare');
      return;
    }

    // CSV SIAE format
    const headers = ['Titolo', 'Autore', 'Compositore', 'Performer', 'Durata'];
    let csv = headers.join(',') + '\n';

    completed.forEach(brano => {
      const values = [
        `"${brano.titolo || ''}"`,
        `"${brano.autore || ''}"`,
        `"${brano.compositore || ''}"`,
        `"${brano.performer || ''}"`,
        `"${brano.durata || ''}"`,
      ];
      csv += values.join(',') + '\n';
    });

    // Genera filename: Serata_DJ_Data_Evento
    const filename = `Serata_${this.serata.dj || 'Unknown'}_${this.serata.data}_${this.serata.evento || 'Event'}.csv`
      .replace(/\s+/g, '_')
      .replace(/[^\w.-]/g, '');

    // Scarica file (nota: il salvataggio a C:\VSC_SIAE\ richiede backend/Electron)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    logger.info(`Esportati ${completed.length} brani in formato SIAE`);
    Toast.success(`✓ Esportati ${completed.length} brani (SIAE)`);
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
          if (String(b.flag || '').toUpperCase() === 'X') {
            return {
              ...b,
              flag: '',
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
  showUserForm() {
    alert('UserForm da implementare'); // TODO
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
