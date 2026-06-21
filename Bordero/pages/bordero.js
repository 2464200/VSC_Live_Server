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
    this.currentPage = 1;
    this.itemsPerPage = BORDERO_CONFIG.ITEMS_PER_PAGE;
    this.lastActionTime = null;

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

      // Poi carica dati
      this.allBrani = this.ensureOriginalIndices(await dataLoader.loadBrani());
      this.filteredBrani = [...this.allBrani];

      // Setup UI
      this.setupEventListeners();
      this.setupSerataMeta();
      this.renderTable();

      logger.info(`✓ Inizializzato con ${this.allBrani.length} brani`);
      Toast.success(`Caricati ${this.allBrani.length} brani`);
    } catch (error) {
      logger.error('Errore inizializzazione', error);
      Toast.error('Errore caricamento tabella: ' + error.message);
    }
  }

  /**
   * Setup serata metadata (D2:D5)
   */
  setupSerataMeta() {
    // Data è fresh ogni volta (oggi)
    document.getElementById('data-serata').valueAsDate = new Date();

    // DJ dropdown da dBase
    this.populateDJSelect();

    // Data
    document.getElementById('data-serata').addEventListener('change', (e) => {
      this.serata.data = e.target.value;
      logger.debug('Data serata:', this.serata.data);
    });

    // Luogo dropdown da Comuni Italia
    this.populateComuniSelect();

    // Evento libero
    document.getElementById('evento-text').addEventListener('change', (e) => {
      this.serata.evento = e.target.value;
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
        const option = document.createElement('option');
        option.value = item.nome || item.name || '';
        option.textContent = item.nome || item.name || '';
        djSelect.appendChild(option);
      });

      djSelect.addEventListener('change', (e) => {
        this.serata.dj = e.target.value;
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
        const option = document.createElement('option');
        option.value = item.nome || item.name || '';
        option.textContent = item.nome || item.name || '';
        comuniSelect.appendChild(option);
      });

      comuniSelect.addEventListener('change', (e) => {
        this.serata.luogo = e.target.value;
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

    // Filter buttons
    document.getElementById('btn-filter-coreografia')?.addEventListener('click', () =>
      this.quickFilter('info_coreo', 'COREOGRAFIA')
    );
    document.getElementById('btn-filter-genere')?.addEventListener('click', () =>
      this.quickFilter('genere', 'COUNTRY') // Adatta al tuo genere
    );
    document.getElementById('btn-filter-livello')?.addEventListener('click', () =>
      this.quickFilter('info_livello', 'AVANZATO') // Adatta al tuo livello
    );

    // Search
    document.getElementById('search-box')?.addEventListener('input', (e) => {
      this.currentSearch = e.target.value;
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
   * Quick filter per colonna
   */
  quickFilter(field, value) {
    logger.info(`Quick filter: ${field} = ${value}`);

    if (this.currentFilters[field] === value) {
      // Toggle off
      delete this.currentFilters[field];
    } else {
      // Apply
      this.currentFilters[field] = value;
    }

    this.applyFilters();
  }

  /**
   * Applica tutti i filtri
   */
  applyFilters() {
    logger.debug('Applicando filtri...');

    // Start con tutti i brani
    this.filteredBrani = [...this.allBrani];

    // Applica filtri
    Object.keys(this.currentFilters).forEach(field => {
      const value = this.currentFilters[field];
      this.filteredBrani = ObjectUtils.filterByField(this.filteredBrani, field, value);
    });

    // Applica ricerca
    if (this.currentSearch) {
      const searchFields = ['titolo', 'brano', 'coreografia', 'autore', 'coreografo', 'collaboratori'];
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
      row.addEventListener('click', () => {
        const branoId = row.dataset.branoId;
        this.toggleCompleted(branoId);
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
        <td class="col-titolo">${brano.titolo || '-'}</td>
        <td class="col-brano">${brano.brano || '-'}</td>
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
   * Alias per compatibilità: toggle lo stato di completamento del brano
   */
  markAsCompleted(branoId) {
    this.toggleCompleted(branoId);
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
      { id: 'btn-filter-coreografia', field: 'info_coreo', value: 'COREOGRAFIA' },
      { id: 'btn-filter-genere', field: 'genere', value: 'COUNTRY' },
      { id: 'btn-filter-livello', field: 'info_livello', value: 'AVANZATO' },
    ];

    buttons.forEach(({ id, field }) => {
      const btn = document.getElementById(id);
      if (btn) {
        if (this.currentFilters[field]) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      }
    });
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

    // Disable buttons
    document.getElementById('btn-first-page').disabled = this.currentPage === 1;
    document.getElementById('btn-prev-page').disabled = this.currentPage === 1;
    document.getElementById('btn-next-page').disabled = this.currentPage === totalPages;
    document.getElementById('btn-last-page').disabled = this.currentPage === totalPages;
  }

  prevPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.renderTable();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  firstPage() {
   if (this.currentPage !== 1) {
     this.currentPage = 1;
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
   if (this.currentPage !== totalPages) {
     this.currentPage = totalPages || 1;
     this.renderTable();
     window.scrollTo({ top: 0, behavior: 'smooth' });
   }
  }

  /**
   * Statistiche live
   */
  updateStats() {
    const total = this.filteredBrani.length;
    const completed = this.filteredBrani.filter(b => b.flag === 'X').length;
    const pending = total - completed;
 
    document.getElementById('stat-total').textContent = total;
    document.getElementById('stat-completed').textContent = `${completed} (${total > 0 ? Math.round((completed / total) * 100) : 0}%)`;
    document.getElementById('stat-pending').textContent = pending;
  }
 
  ensureOriginalIndices(brani) {
    return brani.map((brano, index) => ({
      ...brano,
      originalIndex: typeof brano.originalIndex === 'number' ? brano.originalIndex : index,
    }));
  }
 
  reorderBrani() {
    this.allBrani.sort((a, b) => {
      const aCompleted = a.flag === 'X';
      const bCompleted = b.flag === 'X';
      if (aCompleted !== bCompleted) {
        return aCompleted ? 1 : -1;
      }
      return (a.originalIndex || 0) - (b.originalIndex || 0);
    });
  }
 
  toggleCompleted(branoId) {
    const brano = this.allBrani.find(b => String(b.id) === String(branoId));
    if (!brano) return;
 
    const wasCompleted = brano.flag === 'X';
    if (wasCompleted) {
      brano.flag = '';
      brano.timestamp = '';
      Toast.info(`"${brano.titolo}" è di nuovo disponibile`);
      logger.info(`Brano ${branoId} resettato disponibile`);
    } else {
      brano.flag = 'X';
      brano.timestamp = DateUtils.formatDate(new Date());
      Toast.success(`✓ "${brano.titolo}" completato`);
      logger.info(`Brano ${branoId} marcato come completato`);
    }
 
    this.reorderBrani();
    Storage.set(BORDERO_CONFIG.CACHE_KEY_BRANI, this.allBrani);
 
    if (!wasCompleted) {
      this.autoSaveSerata();
    }
 
    this.lastActionTime = new Date();
    this.updateLastActionTime();
    this.applyFilters();
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

      // Nuova serata
      setTimeout(() => {
        if (confirm('Avviare una nuova serata?')) {
          dataLoader.newSerata();
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

logger.info('✓ Bordero.js caricato');
