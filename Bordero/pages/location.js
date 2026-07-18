class LocationPage {
  constructor() {
    this.locations = [];
    this.filteredLocations = [];
    this.selectedIndex = -1;
    this.activeValuePicker = null;
    this.locationFieldMap = [
      ['nome_evento', 'Nome_evento'],
      ['localita', 'Localita'],
      ['tipo_struttura', 'Tipo_Struttura'],
      ['struttura_coperta', 'Struttura_Coperta'],
      ['provincia', 'Provincia'],
      ['paese', 'Paese'],
      ['indirizzo', 'Indirizzo'],
      ['civico', 'Civico'],
      ['referente', 'Referente'],
      ['cell_referente', 'Cell_Referente'],
      ['tipo_pista', 'Tipo_Pista'],
      ['tipo_prese_corrente', 'Tipo_Prese_Corrente'],
      ['impianto_audio', 'Impianto_Audio'],
      ['impianto_luci', 'Impianto_Luci'],
      ['service', 'Service'],
      ['palco_dj', 'Palco_DJ'],
      ['palco_ballerini', 'Palco_Ballerini'],
      ['parcheggio', 'Parcheggio'],
      ['bar_ristoro', 'Bar_Ristoro'],
      ['toilette', 'Toilette']
    ];
    this.popupFieldConfigs = {
      struttura_coperta: { inputId: 'struttura-coperta', buttonId: 'btn-struttura-coperta', label: 'Struttura Coperta', source: 'yesNo', placeholder: 'Seleziona...' },
      provincia: { inputId: 'provincia', buttonId: 'btn-provincia', label: 'Provincia', source: 'province', placeholder: 'Seleziona...' },
      paese: { inputId: 'paese', buttonId: 'btn-paese', label: 'Paese', source: 'paese', placeholder: 'Seleziona prima la provincia...' },
      tipo_pista: { inputId: 'tipo-pista', buttonId: 'btn-tipo-pista', label: 'Tipo Pista', source: 'tipoPista', placeholder: 'Seleziona...' },
      tipo_prese_corrente: { inputId: 'tipo-prese-corrente', buttonId: 'btn-tipo-prese-corrente', label: 'Tipo Prese Corrente', source: 'tipoPreseCorrente', placeholder: 'Seleziona...' },
      impianto_audio: { inputId: 'impianto-audio', buttonId: 'btn-impianto-audio', label: 'Impianto Audio', source: 'yesNo', placeholder: 'Seleziona...' },
      impianto_luci: { inputId: 'impianto-luci', buttonId: 'btn-impianto-luci', label: 'Impianto Luci', source: 'yesNo', placeholder: 'Seleziona...' },
      service: { inputId: 'service', buttonId: 'btn-service', label: 'Service', source: 'yesNo', placeholder: 'Seleziona...' },
      palco_dj: { inputId: 'palco-dj', buttonId: 'btn-palco-dj', label: 'Palco DJ', source: 'yesNo', placeholder: 'Seleziona...' },
      palco_ballerini: { inputId: 'palco-ballerini', buttonId: 'btn-palco-ballerini', label: 'Palco Ballerini', source: 'yesNo', placeholder: 'Seleziona...' },
      parcheggio: { inputId: 'parcheggio', buttonId: 'btn-parcheggio', label: 'Parcheggio', source: 'yesNo', placeholder: 'Seleziona...' },
      bar_ristoro: { inputId: 'bar-ristoro', buttonId: 'btn-bar-ristoro', label: 'Bar Ristoro', source: 'yesNo', placeholder: 'Seleziona...' },
      toilette: { inputId: 'toilette', buttonId: 'btn-toilette', label: 'Toilette', source: 'yesNo', placeholder: 'Seleziona...' },
    };
    this.locationPopupOptions = {
      yesNo: [],
      tipoPista: [],
      tipoPreseCorrente: [],
      province: [],
      paesiByProvincia: {},
    };
    this.init();
  }

  async init() {
    try {
      await dataLoader.initialize(false);
      const [locations, popupOptions] = await Promise.all([
        dataLoader.loadLocations(),
        dataLoader.loadLocationPopupOptions(),
      ]);

      this.locations = Array.isArray(locations) ? locations : [];
      this.locationPopupOptions = this.withFallbackPopupOptions(popupOptions);

      this.populateFilterFields();
      this.bindEvents();
      this.refreshPopupButtons();
      this.applyFilters();
      this.selectFirstAvailable();
    } catch (error) {
      logger.error('Errore inizializzazione pagina Location', error);
      Toast.error('Errore caricamento pagina Location: ' + error.message);
    }
  }

  bindEvents() {
    document.getElementById('filter-field')?.addEventListener('change', () => {
      this.populateFilterValues();
      this.applyFilters();
    });

    document.getElementById('filter-value')?.addEventListener('change', () => this.applyFilters());
    document.getElementById('search-term')?.addEventListener('input', () => this.applyFilters());
    document.getElementById('btn-reset-filters')?.addEventListener('click', () => this.resetFilters());
    document.getElementById('btn-export-location')?.addEventListener('click', () => this.exportLocationsCsv());
    document.getElementById('btn-sync-location')?.addEventListener('click', () => this.syncLocationFromExcel());
    document.getElementById('btn-nuovo')?.addEventListener('click', () => this.clearForm());
    document.getElementById('btn-salva')?.addEventListener('click', () => this.saveNewRecord());
    document.getElementById('btn-modifica')?.addEventListener('click', () => this.updateRecord());
    document.getElementById('btn-elimina')?.addEventListener('click', () => this.deleteRecord());
    document.getElementById('btn-precedente')?.addEventListener('click', () => this.selectRelative(-1));
    document.getElementById('btn-successivo')?.addEventListener('click', () => this.selectRelative(1));
    document.getElementById('btn-chiudi')?.addEventListener('click', () => { window.location.href = '../index.html'; });

    Object.entries(this.popupFieldConfigs).forEach(([fieldKey, config]) => {
      document.getElementById(config.buttonId)?.addEventListener('click', () => this.openValuePicker(fieldKey));
    });

    this.setupValuePicker();

    window.addEventListener('bordero:data-updated', async (event) => {
      if (!event?.detail?.type) return;
      if (event.detail.type === 'location') {
        this.locations = await dataLoader.loadLocations();
        this.locationPopupOptions = this.withFallbackPopupOptions(this.locationPopupOptions);
        this.populateFilterValues();
        this.applyFilters();
      }
      if (event.detail.type === 'location-options' || event.detail.type === 'dbase') {
        this.locationPopupOptions = this.withFallbackPopupOptions(await dataLoader.loadLocationPopupOptions());
        this.refreshPopupButtons();
      }
    });

    window.addEventListener('storage', async (event) => {
      if (!event.key) return;

      if (event.key === 'BORDERO_LOCATION_DATA' || event.key === BORDERO_CONFIG.CACHE_KEY_LOCATION) {
        this.locations = await dataLoader.loadLocations();
        this.locationPopupOptions = this.withFallbackPopupOptions(this.locationPopupOptions);
        this.populateFilterValues();
        this.applyFilters();
      }

      if (event.key === 'BORDERO_LOCATION_OPTION_ROWS' || event.key === BORDERO_CONFIG.CACHE_KEY_LOCATION_OPTIONS) {
        this.locationPopupOptions = this.withFallbackPopupOptions(await dataLoader.loadLocationPopupOptions());
        this.refreshPopupButtons();
      }
    });
  }

  populateFilterFields() {
    const select = document.getElementById('filter-field');
    if (!select) return;

    select.innerHTML = this.locationFieldMap
      .map(([key, label]) => `<option value="${key}">${label}</option>`)
      .join('');

    this.populateFilterValues();
  }

  populateFilterValues() {
    const field = document.getElementById('filter-field')?.value || this.locationFieldMap[0][0];
    const select = document.getElementById('filter-value');
    if (!select) return;

    const values = [...new Set(this.locations
      .map(item => String(item[field] || '').trim())
      .filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, 'it', { sensitivity: 'base' }));

    select.innerHTML = '<option value="">Tutti i valori</option>' + values
      .map(value => `<option value="${this.escapeAttribute(value)}">${this.escapeHtml(value)}</option>`)
      .join('');
  }

  withFallbackPopupOptions(options) {
    const normalized = {
      yesNo: Array.isArray(options?.yesNo) ? [...options.yesNo] : [],
      tipoPista: Array.isArray(options?.tipoPista) ? [...options.tipoPista] : [],
      tipoPreseCorrente: Array.isArray(options?.tipoPreseCorrente) ? [...options.tipoPreseCorrente] : [],
      province: Array.isArray(options?.province) ? [...options.province] : [],
      paesiByProvincia: typeof options?.paesiByProvincia === 'object' && options?.paesiByProvincia
        ? { ...options.paesiByProvincia }
        : {},
    };

    const uniqueSorted = (values) => [...new Set((values || []).map(value => String(value || '').trim()).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, 'it', { sensitivity: 'base' }));

    if (normalized.yesNo.length === 0) {
      normalized.yesNo = uniqueSorted(['SI', 'NO', 'DA ACCERTARE', 'DA CONFERMARE', 'SCONOSCIUTO']);
    } else {
      normalized.yesNo = uniqueSorted(normalized.yesNo);
    }

    if (normalized.tipoPista.length === 0) {
      normalized.tipoPista = uniqueSorted(this.locations.map(item => item.tipo_pista));
    } else {
      normalized.tipoPista = uniqueSorted(normalized.tipoPista);
    }

    if (normalized.tipoPreseCorrente.length === 0) {
      normalized.tipoPreseCorrente = uniqueSorted(this.locations.map(item => item.tipo_prese_corrente));
    } else {
      normalized.tipoPreseCorrente = uniqueSorted(normalized.tipoPreseCorrente);
    }

    if (normalized.province.length === 0) {
      normalized.province = uniqueSorted(this.locations.map(item => item.provincia));
    } else {
      normalized.province = uniqueSorted(normalized.province);
    }

    Object.keys(normalized.paesiByProvincia).forEach((province) => {
      normalized.paesiByProvincia[province] = uniqueSorted(normalized.paesiByProvincia[province]);
    });

    this.locations.forEach((item) => {
      const province = String(item.provincia || '').trim();
      const paese = String(item.paese || '').trim();
      if (!province || !paese) return;
      if (!normalized.paesiByProvincia[province]) {
        normalized.paesiByProvincia[province] = [];
      }
      if (!normalized.paesiByProvincia[province].includes(paese)) {
        normalized.paesiByProvincia[province].push(paese);
      }
    });

    Object.keys(normalized.paesiByProvincia).forEach((province) => {
      normalized.paesiByProvincia[province] = uniqueSorted(normalized.paesiByProvincia[province]);
    });

    return normalized;
  }

  refreshPopupButtons() {
    Object.keys(this.popupFieldConfigs).forEach((fieldKey) => {
      const currentValue = document.getElementById(this.popupFieldConfigs[fieldKey].inputId)?.value || '';
      this.updatePopupButton(fieldKey, currentValue);
    });
  }

  setupValuePicker() {
    const modal = document.getElementById('value-picker-modal');
    const closeBtn = document.getElementById('value-picker-close');
    const searchInput = document.getElementById('value-picker-search');

    closeBtn?.addEventListener('click', () => this.closeValuePicker());
    modal?.addEventListener('click', (event) => {
      if (event.target === modal) {
        this.closeValuePicker();
      }
    });

    searchInput?.addEventListener('input', () => this.renderValuePickerOptions());

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && this.activeValuePicker) {
        this.closeValuePicker();
      }
    });
  }

  getPopupOptionsForField(fieldKey) {
    const config = this.popupFieldConfigs[fieldKey];
    if (!config) return [];

    if (config.source === 'paese') {
      const province = document.getElementById('provincia')?.value || '';
      if (!province) return [];
      return [...(this.locationPopupOptions.paesiByProvincia[province] || [])];
    }

    return [...(this.locationPopupOptions[config.source] || [])];
  }

  openValuePicker(fieldKey) {
    const config = this.popupFieldConfigs[fieldKey];
    if (!config) return;

    const button = document.getElementById(config.buttonId);
    if (button?.classList.contains('is-disabled')) {
      return;
    }

    const options = this.getPopupOptionsForField(fieldKey);
    const modal = document.getElementById('value-picker-modal');
    const titleEl = document.getElementById('value-picker-title');
    const searchInput = document.getElementById('value-picker-search');
    if (!modal || !titleEl) return;

    titleEl.textContent = `Seleziona ${config.label}`;
    if (searchInput) searchInput.value = '';
    this.activeValuePicker = { fieldKey, options };
    this.renderValuePickerOptions();
    modal.hidden = false;
    searchInput?.focus();
  }

  closeValuePicker() {
    const modal = document.getElementById('value-picker-modal');
    if (modal) {
      modal.hidden = true;
    }
    this.activeValuePicker = null;
  }

  renderValuePickerOptions() {
    const optionsEl = document.getElementById('value-picker-options');
    const searchInput = document.getElementById('value-picker-search');
    if (!optionsEl || !this.activeValuePicker) return;

    const query = String(searchInput?.value || '').trim().toLowerCase();
    const values = this.activeValuePicker.options.filter((value) => !query || value.toLowerCase().includes(query));
    this.activeValuePicker.filteredValues = values;

    if (values.length === 0) {
      optionsEl.innerHTML = '<div class="value-picker-empty">Nessun valore disponibile per questa selezione.</div>';
      return;
    }

    const clearButton = '<button type="button" class="value-picker-option is-clear" data-popup-index="-1">Svuota selezione</button>';
    const valueButtons = values.map((value, index) => `
      <button type="button" class="value-picker-option" data-popup-index="${index}">${this.escapeHtml(value)}</button>
    `).join('');

    optionsEl.innerHTML = clearButton + valueButtons;
    optionsEl.querySelectorAll('.value-picker-option').forEach((button) => {
      button.addEventListener('click', () => this.applyPopupValue(Number(button.getAttribute('data-popup-index'))));
    });
  }

  applyPopupValue(selectedIndex) {
    if (!this.activeValuePicker) return;

    const { fieldKey, filteredValues, options } = this.activeValuePicker;
    const values = Array.isArray(filteredValues) ? filteredValues : options;
    const selectedValue = Number.isInteger(selectedIndex) && selectedIndex >= 0 ? (values[selectedIndex] || '') : '';
    this.setPopupFieldValue(fieldKey, selectedValue);
    this.closeValuePicker();
  }

  setPopupFieldValue(fieldKey, value) {
    const config = this.popupFieldConfigs[fieldKey];
    if (!config) return;

    const input = document.getElementById(config.inputId);
    if (input) {
      input.value = value || '';
    }

    if (fieldKey === 'provincia') {
      const paeseInput = document.getElementById('paese');
      if (paeseInput) {
        paeseInput.value = '';
      }
      this.updatePopupButton('paese', '');
    }

    this.updatePopupButton(fieldKey, value || '');
  }

  updatePopupButton(fieldKey, value) {
    const config = this.popupFieldConfigs[fieldKey];
    if (!config) return;

    const button = document.getElementById(config.buttonId);
    if (!button) return;

    const hasValue = String(value || '').trim().length > 0;
    const placeholder = fieldKey === 'paese' && !(document.getElementById('provincia')?.value || '')
      ? 'Seleziona prima la provincia...'
      : config.placeholder;

    button.textContent = hasValue ? value : placeholder;
    button.classList.toggle('is-empty', !hasValue);

    const shouldDisable = fieldKey === 'paese' && !(document.getElementById('provincia')?.value || '');
    button.classList.toggle('is-disabled', shouldDisable);
    button.setAttribute('aria-disabled', shouldDisable ? 'true' : 'false');
  }

  applyFilters() {
    const field = document.getElementById('filter-field')?.value || this.locationFieldMap[0][0];
    const filterValue = (document.getElementById('filter-value')?.value || '').trim().toLowerCase();
    const searchTerm = (document.getElementById('search-term')?.value || '').trim().toLowerCase();

    this.filteredLocations = this.locations
      .map((location, index) => ({ location, index }))
      .filter(({ location }) => {
        const fieldValue = String(location[field] || '').toLowerCase();
        const matchesFilter = !filterValue || fieldValue.includes(filterValue);

        if (!matchesFilter) return false;
        if (!searchTerm) return true;

        return this.locationFieldMap.some(([key]) => String(location[key] || '').toLowerCase().includes(searchTerm));
      });

    this.reconcileSelectionAfterDataChange();

    this.renderList(field);
    this.syncFormWithCurrentSelection();
    this.updateStats();
  }

  reconcileSelectionAfterDataChange() {
    if (this.filteredLocations.length === 0) {
      this.selectedIndex = -1;
      return;
    }

    const currentIsStillVisible = this.filteredLocations.some((item) => item.index === this.selectedIndex);
    if (!currentIsStillVisible) {
      this.selectedIndex = this.filteredLocations[0].index;
    }
  }

  syncFormWithCurrentSelection() {
    if (this.selectedIndex < 0 || this.selectedIndex >= this.locations.length) {
      this.clearFormFieldsOnly();
      return;
    }

    const record = this.locations[this.selectedIndex];
    if (!record) {
      this.clearFormFieldsOnly();
      return;
    }

    this.fillFormFromRecord(record, this.selectedIndex);
  }

  fillFormFromRecord(record, index) {
    document.getElementById('record-id').value = String(index + 2);
    document.getElementById('nome-evento').value = record.nome_evento || '';
    document.getElementById('localita').value = record.localita || '';
    document.getElementById('tipo-struttura').value = record.tipo_struttura || '';
    this.setPopupFieldValue('struttura_coperta', record.struttura_coperta || '');
    this.setPopupFieldValue('provincia', record.provincia || '');
    this.setPopupFieldValue('paese', record.paese || '');
    document.getElementById('indirizzo').value = record.indirizzo || '';
    document.getElementById('civico').value = record.civico || '';
    document.getElementById('referente').value = record.referente || '';
    document.getElementById('cell-referente').value = record.cell_referente || '';
    this.setPopupFieldValue('tipo_pista', record.tipo_pista || '');
    this.setPopupFieldValue('tipo_prese_corrente', record.tipo_prese_corrente || '');
    this.setPopupFieldValue('impianto_audio', record.impianto_audio || '');
    this.setPopupFieldValue('impianto_luci', record.impianto_luci || '');
    this.setPopupFieldValue('service', record.service || '');
    this.setPopupFieldValue('palco_dj', record.palco_dj || '');
    this.setPopupFieldValue('palco_ballerini', record.palco_ballerini || '');
    this.setPopupFieldValue('parcheggio', record.parcheggio || '');
    this.setPopupFieldValue('bar_ristoro', record.bar_ristoro || '');
    this.setPopupFieldValue('toilette', record.toilette || '');
  }

  clearFormFieldsOnly() {
    [
      'record-id', 'nome-evento', 'localita', 'tipo-struttura', 'indirizzo', 'civico', 'referente', 'cell-referente'
    ].forEach((id) => {
      const element = document.getElementById(id);
      if (element) element.value = '';
    });

    Object.keys(this.popupFieldConfigs).forEach((fieldKey) => this.setPopupFieldValue(fieldKey, ''));
  }

  renderList(field) {
    const body = document.getElementById('location-list-body');
    const caption = document.getElementById('list-caption');
    if (!body) return;

    const fieldLabel = this.locationFieldMap.find(([key]) => key === field)?.[1] || field;
    if (caption) {
      caption.textContent = `Filtro attivo su ${fieldLabel}`;
    }

    if (this.filteredLocations.length === 0) {
      body.innerHTML = '<tr><td colspan="4" class="empty-row">Nessuna location trovata.</td></tr>';
      this.selectedIndex = -1;
      this.updateCounter();
      return;
    }

    body.innerHTML = this.filteredLocations.map(({ location, index }) => {
      const rowNumber = index + 2;
      const selectedClass = index === this.selectedIndex ? 'is-selected' : '';
      return `
        <tr class="${selectedClass}" data-index="${index}">
          <td>${rowNumber}</td>
          <td>${this.escapeHtml(location.nome_evento || '')}</td>
          <td>${this.escapeHtml(location.localita || '')}</td>
          <td>${this.escapeHtml(location[field] || '')}</td>
        </tr>`;
    }).join('');

    body.querySelectorAll('tr[data-index]').forEach((row) => {
      row.addEventListener('click', () => this.selectRecord(Number(row.dataset.index)));
      row.addEventListener('dblclick', () => this.selectRecord(Number(row.dataset.index)));
    });

    this.updateCounter();
  }

  selectFirstAvailable() {
    if (this.filteredLocations.length === 0) {
      this.clearForm();
      return;
    }

    const firstIndex = this.filteredLocations[0].index;
    this.selectRecord(firstIndex);
  }

  selectRecord(index) {
    if (index < 0 || index >= this.locations.length) return;

    this.selectedIndex = index;
    const record = this.locations[index];
    if (!record) return;

    this.fillFormFromRecord(record, index);

    this.renderList(document.getElementById('filter-field')?.value || this.locationFieldMap[0][0]);
    this.updateStats();
  }

  clearForm() {
    this.selectedIndex = -1;
    this.clearFormFieldsOnly();
    this.renderList(document.getElementById('filter-field')?.value || this.locationFieldMap[0][0]);
    this.updateStats();
  }

  resetFilters() {
    const filterField = document.getElementById('filter-field');
    const filterValue = document.getElementById('filter-value');
    const searchTerm = document.getElementById('search-term');

    if (filterField) {
      filterField.selectedIndex = 0;
    }
    if (filterValue) {
      filterValue.value = '';
    }
    if (searchTerm) {
      searchTerm.value = '';
    }

    this.populateFilterValues();
    this.applyFilters();
    this.selectFirstAvailable();
  }

  validateForm() {
    if (!document.getElementById('nome-evento').value.trim()) {
      Toast.warning('Inserire Nome Evento');
      return false;
    }
    if (!document.getElementById('localita').value.trim()) {
      Toast.warning('Inserire Localita');
      return false;
    }
    if (!document.getElementById('referente').value.trim()) {
      Toast.warning('Inserire Referente');
      return false;
    }
    return true;
  }

  collectFormData() {
    return {
      nome_evento: document.getElementById('nome-evento').value.trim(),
      localita: document.getElementById('localita').value.trim(),
      tipo_struttura: document.getElementById('tipo-struttura').value.trim(),
      struttura_coperta: document.getElementById('struttura-coperta').value.trim(),
      provincia: document.getElementById('provincia').value.trim(),
      paese: document.getElementById('paese').value.trim(),
      indirizzo: document.getElementById('indirizzo').value.trim(),
      civico: document.getElementById('civico').value.trim(),
      referente: document.getElementById('referente').value.trim(),
      cell_referente: document.getElementById('cell-referente').value.trim(),
      tipo_pista: document.getElementById('tipo-pista').value.trim(),
      tipo_prese_corrente: document.getElementById('tipo-prese-corrente').value.trim(),
      impianto_audio: document.getElementById('impianto-audio').value.trim(),
      impianto_luci: document.getElementById('impianto-luci').value.trim(),
      service: document.getElementById('service').value.trim(),
      palco_dj: document.getElementById('palco-dj').value.trim(),
      palco_ballerini: document.getElementById('palco-ballerini').value.trim(),
      parcheggio: document.getElementById('parcheggio').value.trim(),
      bar_ristoro: document.getElementById('bar-ristoro').value.trim(),
      toilette: document.getElementById('toilette').value.trim(),
    };
  }

  async saveNewRecord() {
    if (!this.validateForm()) return;
    this.locations.push(this.collectFormData());
    await this.persistLocations('Location salvata.');
    this.clearForm();
  }

  async updateRecord() {
    if (this.selectedIndex < 0) {
      Toast.warning('Seleziona una Location.');
      return;
    }
    if (!this.validateForm()) return;
    this.locations[this.selectedIndex] = this.collectFormData();
    await this.persistLocations('Record aggiornato.');
    this.selectRecord(this.selectedIndex);
  }

  async deleteRecord() {
    if (this.selectedIndex < 0) {
      Toast.warning('Seleziona una Location.');
      return;
    }

    if (!window.confirm('Eliminare il record selezionato?')) {
      return;
    }

    this.locations.splice(this.selectedIndex, 1);
    this.selectedIndex = -1;
    await this.persistLocations('Record eliminato.');
    this.clearForm();
    this.selectFirstAvailable();
  }

  async persistLocations(successMessage) {
    Storage.set('BORDERO_LOCATION_DATA', this.locations);
    Storage.set(BORDERO_CONFIG.CACHE_KEY_LOCATION, this.locations);
    await excelSync.syncToDisk('location', this.locations);
    this.locationPopupOptions = this.withFallbackPopupOptions(this.locationPopupOptions);
    this.populateFilterValues();
    this.refreshPopupButtons();
    this.applyFilters();
    Toast.success(successMessage);
  }

  selectRelative(direction) {
    if (this.filteredLocations.length === 0) return;

    const currentFilteredIndex = this.filteredLocations.findIndex(item => item.index === this.selectedIndex);
    const startIndex = currentFilteredIndex >= 0 ? currentFilteredIndex : 0;
    const nextFilteredIndex = (startIndex + direction + this.filteredLocations.length) % this.filteredLocations.length;
    this.selectRecord(this.filteredLocations[nextFilteredIndex].index);
  }

  updateStats() {
    document.getElementById('stat-total-records').textContent = String(this.locations.length);
    document.getElementById('stat-filtered-records').textContent = String(this.filteredLocations.length);
    document.getElementById('stat-selected-record').textContent = this.selectedIndex >= 0 ? String(this.selectedIndex + 2) : '--';
    this.updateCounter();
  }

  updateCounter() {
    const counter = document.getElementById('record-counter');
    if (!counter) return;

    if (this.filteredLocations.length === 0 || this.selectedIndex < 0) {
      counter.textContent = `0 / ${this.filteredLocations.length}`;
      return;
    }

    const current = this.filteredLocations.findIndex(item => item.index === this.selectedIndex);
    counter.textContent = `${current + 1} / ${this.filteredLocations.length}`;
  }

  async syncLocationFromExcel() {
    if (!excelSync.excelFile) {
      Toast.warning('Seleziona prima un file Excel dalla pagina Admin.');
      return;
    }

    try {
      const arrayBuffer = await excelSync.excelFile.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const [locationSynced, dbaseSynced] = await Promise.all([
        excelSync.syncLocation(workbook),
        excelSync.syncDBase(workbook),
      ]);
      if (!locationSynced) {
        Toast.warning('Sincronizzazione Location non completata.');
        return;
      }

      this.locations = await dataLoader.loadLocations();
      this.locationPopupOptions = this.withFallbackPopupOptions(await dataLoader.loadLocationPopupOptions());
      this.populateFilterValues();
      this.refreshPopupButtons();
      this.applyFilters();
      this.selectFirstAvailable();
      if (!dbaseSynced) {
        Toast.warning('Location aggiornata, ma le opzioni popup da dBase non sono state ricaricate completamente.');
      }
    } catch (error) {
      logger.error('Errore sync Location da Excel', error);
      Toast.error('Errore sincronizzazione Location: ' + error.message);
    }
  }

  exportLocationsCsv() {
    if (!Array.isArray(this.locations) || this.locations.length === 0) {
      Toast.warning('Nessuna location da esportare');
      return;
    }
    dataLoader.exportToCSV(this.locations);
  }

  escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  escapeAttribute(value) {
    return this.escapeHtml(value).replace(/`/g, '&#96;');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.locationPage = new LocationPage();
});