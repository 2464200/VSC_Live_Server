const EXCLUDED_COREOGRAFIE_TITLES = new Set([
  'video promo monster 2023',
  'audio video tester'
]);

class CoreografieStampaPage {
  constructor() {
    this.settingsStorageKey = 'bordero_coreografie_stampa_settings';
    this.standardRowsPerPage = 36;
    this.brani = [];
    this.serata = {};
    this.djNames = [];
    this.settings = null;
    this.persistSettingsBound = () => this.persistSettings();
    this.persistedSettings = this.loadPersistedSettings();
    this.init();
  }

  async init() {
    try {
      await dataLoader.initialize();
      this.brani = await dataLoader.loadBrani({ silent: true });
      this.djNames = (await dataLoader.loadDJ())
        .map((dj) => typeof dj === 'string' ? dj : (dj?.nome || dj?.name || ''))
        .filter((dj) => !/^(nome|name|dj)$/i.test(dj.trim()))
        .filter(Boolean);
      const currentSerata = dataLoader.getCurrentSerata();
      if (currentSerata) {
        this.serata = currentSerata.metadata || {};
        this.brani = currentSerata.brani || this.brani;
      }
      if (!this.serata.evento || !this.serata.luogo) {
        const locations = await dataLoader.loadLocations();
        const location = locations[0] || {};
        this.serata.evento = this.serata.evento || location.nome_evento || '';
        this.serata.luogo = this.serata.luogo || location.localita || location.paese || '';
      }
      this.populateSettings();
      this.renderLetterOptions();
      this.renderColumnSettings();
      this.setupListeners();
    } catch (error) {
      logger.error('Errore inizializzazione stampa coreografie', error);
      document.getElementById('print-status').textContent = 'Errore nel caricamento dei dati';
    }
  }

  populateSettings() {
    const saved = this.persistedSettings;
    const currentDate = saved?.date || this.serata.data || new Date().toISOString().split('T')[0];
    document.getElementById('event-name').value = saved?.eventName || this.serata.evento || '';
    const djList = document.getElementById('event-djs');
    const currentDjs = Array.isArray(saved?.djs)
      ? saved.djs
      : String(this.serata.dj || '').split(/\s*,\s*/).filter(Boolean);
    const availableDjs = [...this.djNames];
    currentDjs.forEach((dj) => {
      if (!availableDjs.some((name) => name.toLowerCase() === dj.toLowerCase())) availableDjs.push(dj);
    });
    const selectedDjs = Array.isArray(saved?.djs) ? currentDjs : (currentDjs.length ? currentDjs : availableDjs);
    djList.innerHTML = availableDjs.map((dj, index) => `
      <label class="dj-option" for="event-dj-${index}">
        <input id="event-dj-${index}" type="checkbox" name="djs" value="${this.escape(dj)}" ${selectedDjs.some((selected) => selected.toLowerCase() === dj.toLowerCase()) ? 'checked' : ''} />
        <span>${this.escape(dj)}</span>
      </label>
    `).join('');
    document.getElementById('event-place').value = saved?.place || this.serata.luogo || '';
    document.getElementById('event-date').value = currentDate;
    const mode = String(saved?.eventMode || '1');
    const modeInput = document.querySelector(`input[name="eventMode"][value="${this.escape(mode)}"]`);
    if (modeInput) modeInput.checked = true;
    document.getElementById('include-cover').checked = saved?.includeCover ?? true;
    document.getElementById('include-coreografie-count').checked = saved?.includeCoreografieCount ?? true;
    document.getElementById('duplex-print').checked = saved?.duplex ?? false;
    document.getElementById('number-pages').checked = saved?.numberPages ?? false;
  }

  renderColumnSettings() {
    const count = Number(document.querySelector('input[name="eventMode"]:checked')?.value || 1);
    const labels = ['Evento singolo', 'Mattina', 'Pomeriggio', 'Sera', 'DJ SET'];
    document.getElementById('column-settings').innerHTML = Array.from({ length: count }, (_, index) => `
      <label class="field-label column-label" for="column-${index}">Colonna ${index + 1}
        <input id="column-${index}" name="column-${index}" type="text" value="${this.escape(this.persistedSettings?.columnLabels?.[index] || labels[count === 1 ? 0 : index + 1])}" />
      </label>
    `).join('');
  }

  renderLetterOptions() {
    const groups = this.groupByInitial(this.brani);
    const letterFilter = document.getElementById('letter-filter');
    const options = Object.entries(groups)
      .filter(([, entries]) => entries.length)
      .map(([letter]) => `<option value="${this.escape(letter)}">Solo ${this.escape(letter)}</option>`)
      .join('');
    letterFilter.innerHTML = `<option value="ALL">Tutte le lettere e numeri/caratteri</option>${options}`;
    if ([...letterFilter.options].some((option) => option.value === this.persistedSettings?.letterFilter)) {
      letterFilter.value = this.persistedSettings.letterFilter;
    }
  }

  readSettings() {
    const form = document.getElementById('print-settings-form');
    const formData = new FormData(form);
    const count = Number(formData.get('eventMode') || 1);
    const selectedDjs = [...document.querySelectorAll('#event-djs input[name="djs"]:checked')]
      .map((input) => input.value.trim())
      .filter(Boolean);
    this.settings = {
      eventName: String(formData.get('eventName') || '').trim(),
      djs: selectedDjs.join(', '),
      place: String(formData.get('place') || '').trim(),
      date: String(formData.get('date') || ''),
      columnLabels: Array.from({ length: count }, (_, index) => String(formData.get(`column-${index}`) || '').trim()),
      letterFilter: String(formData.get('letterFilter') || 'ALL'),
      includeCover: document.getElementById('include-cover').checked,
      includeCoreografieCount: document.getElementById('include-coreografie-count').checked,
      duplex: document.getElementById('duplex-print').checked,
      numberPages: document.getElementById('number-pages').checked,
    };
    return this.settings;
  }

  loadPersistedSettings() {
    try {
      const stored = localStorage.getItem(this.settingsStorageKey);
      if (!stored) return null;
      const settings = JSON.parse(stored);
      return settings && typeof settings === 'object' ? settings : null;
    } catch (error) {
      logger.warn('Impossibile leggere le impostazioni di stampa salvate', error);
      return null;
    }
  }

  persistSettings() {
    try {
      const settings = this.readSettings();
      const eventMode = Number(document.querySelector('input[name="eventMode"]:checked')?.value || 1);
      localStorage.setItem(this.settingsStorageKey, JSON.stringify({
        ...settings,
        djs: [...document.querySelectorAll('#event-djs input[name="djs"]:checked')].map((input) => input.value).filter(Boolean),
        eventMode,
      }));
      this.persistedSettings = JSON.parse(localStorage.getItem(this.settingsStorageKey));
    } catch (error) {
      logger.warn('Impossibile salvare le impostazioni di stampa', error);
    }
  }

  render() {
    const documentNode = document.getElementById('print-document');
    const settings = this.settings;
    const groups = this.groupByInitial(this.brani);
    const selectedGroups = Object.entries(groups)
      .filter(([initial]) => settings.letterFilter === 'ALL' || initial === settings.letterFilter);
    const groupCount = Object.values(groups).filter((entries) => entries.length).length;
    const selectedCount = selectedGroups.reduce((total, [, entries]) => total + entries.length, 0);
    const eventName = this.escape(settings.eventName || 'Evento Monster Country Group');
    const eventDate = this.escape(this.formatDate(settings.date));
    this.nextPrintPageNumber = settings.includeCover ? 2 : 1;
    const cover = settings.includeCover ? `
      <section class="cover" aria-label="Copertina">
        <img class="cover-logo" src="../../MonsterCountryGroup_grey.png" alt="Monster Country Group" />
        <div class="cover-event">
          <div class="cover-event-label">Elenco Alfabetico Coreografie dell'Evento</div>
          <h1 class="cover-event-name">${eventName}</h1>
          <div class="cover-event-date">${eventDate}</div>
          <div class="cover-event-detail">DJ: ${this.escape(settings.djs || 'Nessun DJ selezionato')}</div>
          ${settings.place ? `<div class="cover-event-detail">${this.escape(settings.place)}</div>` : ''}
          ${settings.includeCoreografieCount ? `<div class="cover-event-detail">Coreografie negli elenchi: ${selectedCount}</div>` : ''}
        </div>
        ${this.pageNumberMarkup(1)}
      </section>
    ` : '';

    documentNode.style.setProperty('--event-column-count', String(this.settings.columnLabels.length));
    documentNode.classList.toggle('numbered-pages', this.settings.numberPages);
    documentNode.classList.toggle('duplex-print', this.settings.duplex);
    documentNode.innerHTML = `
      ${cover}
      ${selectedGroups.filter(([, entries]) => entries.length).map(([initial, entries]) => this.renderGroup(initial, entries)).join('')}
    `;

    const duplexMessage = this.settings.duplex ? ' · fronte/retro selezionato nel documento' : '';
    const selectedLabel = settings.letterFilter === 'ALL' ? `${groupCount} sezioni` : `sezione ${settings.letterFilter}`;
    document.getElementById('print-status').textContent = `${selectedCount} coreografie in ${selectedLabel}${duplexMessage}`;
  }

  groupByInitial(brani) {
    const groups = Object.fromEntries('ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(letter => [letter, []]));
    groups['0-9 / #'] = [];
    const seenTitles = new Set();

    brani.filter(brano => brano && (brano.titolo || brano.coreografia)).forEach(brano => {
      const title = String(brano.titolo || brano.coreografia).trim();
      const titleKey = title
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .toLocaleLowerCase('it-IT');
      if (EXCLUDED_COREOGRAFIE_TITLES.has(titleKey)) return;
      if (seenTitles.has(titleKey)) return;
      seenTitles.add(titleKey);
      const first = title.normalize('NFD').replace(/[\u0300-\u036f]/g, '').charAt(0).toUpperCase();
      const group = /^[A-Z]$/.test(first) ? first : '0-9 / #';
      groups[group].push(brano);
    });

    Object.values(groups).forEach(entries => entries.sort((a, b) => this.titleOf(a).localeCompare(this.titleOf(b), 'it', { sensitivity: 'base', numeric: true })));
    return groups;
  }

  renderGroup(initial, entries) {
    const columnHeadings = this.settings.columnLabels
      .map((label) => `<div class="event-column-heading">${this.escape(label || 'Evento')}</div>`)
      .join('');
    const pages = [];
    for (let start = 0; start < entries.length; start += this.standardRowsPerPage) {
      const pageEntries = entries.slice(start, start + this.standardRowsPerPage);
      const pageNumber = Math.floor(start / this.standardRowsPerPage) + 1;
      const emptyRows = Math.max(0, this.standardRowsPerPage - pageEntries.length);
      const pageLabel = pageNumber > 1
        ? `<small class="continuation-label">${pageNumber === 2 ? 'seconda' : this.pageWord(pageNumber)} pagina</small>`
        : '';
      const printPageNumber = this.nextPrintPageNumber++;
      const fillerMarkup = Array.from({ length: emptyRows }, () => this.renderEmptyEntry()).join('');
      pages.push(`
        <section class="letter-section${pageNumber > 1 ? ' continuation-page' : ''}">
          <div class="letter-heading"><h2>${this.escape(initial)} ${pageLabel}</h2><span>${pageEntries.length} di ${entries.length} coreografie</span></div>
          <div class="coreography-column-headings">
            <span></span><span>Coreografia</span><div class="event-columns">${columnHeadings}</div>
          </div>
          <div class="coreography-list">
            ${pageEntries.map((brano) => this.renderEntry(brano)).join('')}
            ${fillerMarkup}
          </div>
          ${this.pageNumberMarkup(printPageNumber)}
        </section>
      `);
    }
    return pages.join('');
  }

  pageNumberMarkup(pageNumber) {
    return this.settings.numberPages ? `<div class="page-number">Pagina ${pageNumber}</div>` : '';
  }

  renderEntry(brano) {
    const columns = this.settings.columnLabels.map(label => `<div class="event-column" aria-label="${this.escape(label)}"></div>`).join('');
    return `
      <article class="coreography-entry">
        <div class="coreography-id">${this.escape(brano.id || '')}</div>
        <div class="coreography-main">
          <h3 class="coreography-title">${this.escape(this.titleOf(brano))}</h3>
        </div>
        <div class="event-columns">${columns}</div>
      </article>
    `;
  }

  renderEmptyEntry() {
    const columns = this.settings.columnLabels.map(() => '<div class="event-column"></div>').join('');
    return `
      <article class="coreography-entry empty-entry" aria-hidden="true">
        <div class="coreography-id"></div>
        <div class="coreography-main"></div>
        <div class="event-columns">${columns}</div>
      </article>
    `;
  }

  pageWord(pageNumber) {
    const words = ['prima', 'seconda', 'terza', 'quarta', 'quinta'];
    return words[pageNumber - 1] || `pagina ${pageNumber}`;
  }

  titleOf(brano) {
    return brano.titolo || brano.coreografia || brano.brano || 'Senza titolo';
  }

  formatDate(value) {
    if (!value) return 'Data evento non disponibile';
    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat('it-IT', { dateStyle: 'long' }).format(date);
  }

  escape(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character]));
  }

  setupListeners() {
    document.querySelectorAll('input[name="eventMode"]').forEach(input => input.addEventListener('change', () => {
      this.renderColumnSettings();
      this.bindPersistenceListeners();
      this.persistSettings();
    }));
    this.bindPersistenceListeners();
    document.getElementById('print-settings-form').addEventListener('submit', (event) => {
      event.preventDefault();
      if (!event.currentTarget.reportValidity()) return;
      this.readSettings();
      this.persistSettings();
      this.render();
      this.showPreview();
    });
    document.getElementById('btn-print').addEventListener('click', () => window.print());
    document.getElementById('btn-edit-settings').addEventListener('click', () => {
      this.showSettings();
    });
    window.addEventListener('afterprint', () => this.showPreview());
    document.getElementById('btn-back').addEventListener('click', () => { window.location.href = 'bordero.html'; });
  }

  bindPersistenceListeners() {
    document.querySelectorAll('#print-settings-form input:not([name="eventMode"]), #print-settings-form select').forEach((control) => {
      control.removeEventListener('input', this.persistSettingsBound);
      control.removeEventListener('change', this.persistSettingsBound);
      control.addEventListener('input', this.persistSettingsBound);
      control.addEventListener('change', this.persistSettingsBound);
    });
  }

  showPreview() {
    document.querySelector('.settings-layout').hidden = true;
    document.getElementById('preview-toolbar').hidden = false;
  }

  showSettings() {
    document.querySelector('.settings-layout').hidden = false;
    document.getElementById('preview-toolbar').hidden = true;
    document.querySelector('.settings-layout').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

document.addEventListener('DOMContentLoaded', () => { window.coreografieStampaPage = new CoreografieStampaPage(); });
