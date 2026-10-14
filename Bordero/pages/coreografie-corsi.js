(function () {
  'use strict';

  const PROGRAM_FILES_API = '/api/bordero/course-program/files';
  const MAX_WEEKLY_CHOREOGRAPHIES = 5;

  class ChoreoCoursePage {
    constructor() {
      this.store = window.choreoProgramStore;
      this.brani = [];
      this.levels = [];
      this.catalogRevision = 0;
      this.lastGoogleSyncAt = '';
      this.state = this.store.getState();
      this.editingRecordId = '';
      this.recordsSort = { field: 'week', direction: 'desc' };
      this.recordsSeasonId = '';
      this.recordsFilter = { level: '', week: 53 };
      this.selectedCsv = null;
      this.init();
    }

    async init() {
      this.bindEvents();
      this.initializeFileDirectory();
      this.populateLevels();
      this.populateRecordsFilters();
      this.setSuggestedYear();
      this.initializeCalendar();
      this.setStatus('course-record-status', 'Caricamento catalogo e programmi…');
      try {
        await dataLoader.initialize(false);
        await this.refreshCatalog();
        const cloud = window.firebaseCloudClient;
        if (cloud?.hasFreshCloudState && Array.isArray(cloud.latestCloudState?.catalogBrani)) {
          this.setCatalog(cloud.latestCloudState.catalogBrani);
        }
        await this.store.load({ force: true });
        this.state = this.store.getState();
        this.populateSongOptions();
        this.render();
        this.store.startPolling();
        if (this.isLocalFileHost()) {
          this.checkGoogleCatalogSync();
          this.catalogSyncTimer = window.setInterval(() => this.checkGoogleCatalogSync(), 5000);
        }
        window.addEventListener('bordero:choreo-program-updated', () => {
          this.state = this.store.getState();
          this.render();
        });
        this.setStatus('course-record-status', `${this.brani.length} brani disponibili nel catalogo Borderò.`);
      } catch (error) {
        this.setStatus('course-record-status', `Errore di caricamento: ${error.message}`, true);
      }
    }

    bindEvents() {
      window.addEventListener('bordero:cloud-updated', (event) => {
        if (Array.isArray(event.detail?.catalogBrani)) this.setCatalog(event.detail.catalogBrani);
      });
      window.addEventListener('bordero:data-updated', (event) => {
        if (event.detail?.type !== 'brani') return;
        const brani = Storage.get('BORDERO_BRANI_DATA');
        if (Array.isArray(brani)) this.setCatalog(brani);
      });
      window.addEventListener('storage', (event) => {
        if (!['BORDERO_BRANI_DATA', 'bordero_brani'].includes(event.key) || !event.newValue) return;
        try {
          const brani = JSON.parse(event.newValue);
          if (Array.isArray(brani)) this.setCatalog(brani);
        } catch (error) {
          console.warn('Catalogo corsi non aggiornato: dati in cache non validi.', error);
        }
      });
      window.addEventListener('focus', () => this.checkGoogleCatalogSync());
      document.getElementById('create-season-form').addEventListener('submit', (event) => this.createSeason(event));
      document.getElementById('course-season-select').addEventListener('change', () => {
        this.resetRecordForm();
        this.renderSelectedSeason();
      });
      document.getElementById('btn-activate-season').addEventListener('click', () => this.activateSeason());
      document.getElementById('course-record-form').addEventListener('submit', (event) => this.saveRecord(event));
      const songInput = document.getElementById('course-record-song');
      songInput.addEventListener('input', () => songInput.setCustomValidity(''));
      songInput.addEventListener('change', () => {
        const id = this.selectedSongId();
        if (id) this.setSongSelection(id);
      });
      document.getElementById('btn-cancel-course-edit').addEventListener('click', () => this.resetRecordForm());
      document.getElementById('course-records-body').addEventListener('click', (event) => this.handleRecordAction(event));
      document.getElementById('btn-import-course-csv').addEventListener('click', () => this.importCsv());
      document.getElementById('btn-download-course-template').addEventListener('click', () => this.downloadTemplate());
      document.getElementById('btn-export-course-csv').addEventListener('click', () => this.exportSeason());
      for (const id of ['course-records-level-filter', 'course-records-week-filter']) {
        document.getElementById(id).addEventListener('change', () => {
          const week = Number(document.getElementById('course-records-week-filter').value);
          this.recordsFilter = {
            level: document.getElementById('course-records-level-filter').value,
            week: Number.isInteger(week) && week >= 1 && week <= 53 ? week : 53
          };
          this.renderSelectedSeason();
        });
      }
      document.getElementById('btn-sync-course-program').addEventListener('click', () => this.syncAll());
      document.getElementById('btn-pick-course-csv').addEventListener('click', () => this.pickCsv());
      document.getElementById('course-csv-file').addEventListener('change', (event) => {
        this.selectedCsv = null;
        document.getElementById('course-selected-csv').textContent = event.target.files[0]?.name || 'Nessun file selezionato';
      });
      document.getElementById('btn-choose-course-file').addEventListener('click', () => this.chooseFolderCsv());
      document.getElementById('btn-browse-other-course-file').addEventListener('click', () => {
        document.getElementById('course-file-picker-panel').hidden = true;
        document.getElementById('course-csv-file').click();
      });
      document.getElementById('btn-close-course-file-picker').addEventListener('click', () => {
        document.getElementById('course-file-picker-panel').hidden = true;
      });
      document.querySelectorAll('[data-record-sort]').forEach((button) => {
        button.addEventListener('click', () => {
          const field = button.dataset.recordSort;
          const direction = this.recordsSort.field === field && this.recordsSort.direction === 'asc' ? 'desc' : 'asc';
          this.recordsSort = { field, direction };
          this.renderSelectedSeason();
        });
      });
    }

    updateRecordsSortButtons() {
      const labels = { week: 'SETTIMANA', level: 'LIVELLO', id: 'ID', title: 'COREOGRAFIA' };
      document.querySelectorAll('[data-record-sort]').forEach((button) => {
        const field = button.dataset.recordSort;
        const active = this.recordsSort.field === field;
        button.textContent = `${labels[field]}${active ? this.recordsSort.direction === 'asc' ? ' ↑' : ' ↓' : ''}`;
        button.classList.toggle('is-sorted', active);
        button.setAttribute('aria-pressed', String(active));
        button.title = `Ordina per ${labels[field].toLocaleLowerCase('it')} in ordine ${active && this.recordsSort.direction === 'asc' ? 'decrescente' : 'crescente'}`;
        button.disabled = !this.currentSeason();
      });
      document.querySelectorAll('.course-records-table th').forEach((header, index) => {
        const field = ['week', 'level', 'id', 'title'][index];
        if (field) header.setAttribute('aria-sort', this.recordsSort.field === field ? this.recordsSort.direction === 'asc' ? 'ascending' : 'descending' : 'none');
      });
    }

    isLocalFileHost() {
      return ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname);
    }

    async programFileRequest(suffix = '', options = {}) {
      const response = await fetch(`${PROGRAM_FILES_API}${suffix}`, { cache: 'no-store', ...options });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) {
        throw Object.assign(new Error(data?.error || 'Cartella programma non disponibile nell’app locale.'), { status: response.status });
      }
      if (data.directory) document.getElementById('course-file-directory').textContent = `Cartella programma: ${data.directory}`;
      return data;
    }

    async initializeFileDirectory() {
      try {
        const native = window.electronAPI?.courseProgramFiles;
        if (native) {
          const result = await native.getDirectory();
          if (!result.ok) throw new Error(result.error);
          document.getElementById('course-file-directory').textContent = `Cartella programma: ${result.directory}`;
        } else if (this.isLocalFileHost()) {
          await this.programFileRequest();
        } else {
          document.getElementById('course-file-directory').textContent = 'Salvataggio nella cartella di download del browser. Per usare C:\\VSC_PROGRAMMA apri l’app sul PC.';
        }
      } catch {
        document.getElementById('course-file-directory').textContent = 'Cartella programma: C:\\VSC_PROGRAMMA (disponibile avviando o riavviando l’app locale).';
      }
    }

    selectCsv(result) {
      this.selectedCsv = { name: result.name, text: async () => result.content };
      document.getElementById('course-csv-file').value = '';
      document.getElementById('course-selected-csv').textContent = result.name;
      document.getElementById('course-file-picker-panel').hidden = true;
      this.setStatus('course-import-status', `Selezionato ${result.name}. Premi Importa programma per caricarlo.`);
    }

    async pickCsv() {
      try {
        const native = window.electronAPI?.courseProgramFiles;
        if (native) {
          const result = await native.openCsv();
          if (!result.ok) throw new Error(result.error);
          if (!result.canceled) this.selectCsv(result);
        } else if (this.isLocalFileHost()) {
          const result = await this.programFileRequest();
          const select = document.getElementById('course-file-list');
          select.replaceChildren(new Option(result.files.length ? 'Seleziona CSV' : 'Nessun CSV nella cartella programma', ''));
          result.files.forEach((file) => select.add(new Option(file.name, file.name)));
          document.getElementById('btn-choose-course-file').disabled = !result.files.length;
          document.getElementById('course-file-picker-panel').hidden = false;
          select.focus();
        } else {
          document.getElementById('course-csv-file').click();
        }
      } catch (error) {
        this.setStatus('course-import-status', error.message, true);
        if (error.status === 404) document.getElementById('course-csv-file').click();
      }
    }

    async chooseFolderCsv() {
      const name = document.getElementById('course-file-list').value;
      if (!name) return this.setStatus('course-import-status', 'Seleziona il CSV nella cartella programma.', true);
      try {
        this.selectCsv(await this.programFileRequest(`/${encodeURIComponent(name)}`));
      } catch (error) {
        this.setStatus('course-import-status', error.message, true);
      }
    }

    populateRecordsFilters() {
      const level = document.getElementById('course-records-level-filter');
      level.replaceChildren(new Option('Tutti i livelli', ''));
      this.levels.forEach((value) => level.add(new Option(this.formatLevel(value), value)));
      level.value = this.recordsFilter.level;
      const week = document.getElementById('course-records-week-filter');
      week.replaceChildren(...Array.from({ length: 53 }, (_, index) =>
        new Option(index === 52 ? '53 · Tutte le settimane' : String(index + 1), String(index + 1))));
      week.value = String(this.recordsFilter.week);
    }

    sortSeasonRecords(records) {
      const compareText = (a, b) => String(a || '').localeCompare(String(b || ''), 'it', { numeric: true, sensitivity: 'base' });
      const title = (record) => {
        const song = this.findSong(record.branoId);
        return song ? this.trackTitle(song) : record.trackTitle || `Brano ${record.branoId}`;
      };
      const { field, direction } = this.recordsSort;
      return [...records].sort((a, b) => {
        let comparison;
        if (field === 'week') comparison = Number(a.week) - Number(b.week);
        else if (field === 'level') comparison = compareText(this.formatLevel(a.level), this.formatLevel(b.level));
        else if (field === 'id') comparison = compareText(a.branoId, b.branoId);
        else comparison = compareText(title(a), title(b));
        return (direction === 'desc' ? -comparison : comparison)
          || Number(b.week) - Number(a.week)
          || compareText(this.formatLevel(a.level), this.formatLevel(b.level))
          || compareText(title(a), title(b))
          || compareText(a.branoId, b.branoId);
      });
    }

    setSuggestedYear() {
      const now = new Date();
      const start = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
      document.getElementById('new-season-label').value = `${start}/${start + 1}`;
    }

    initializeCalendar() {
      const panel = document.getElementById('course-calendar');
      document.body.appendChild(panel);
      document.getElementById('btn-open-course-calendar').addEventListener('click', () => {
        if (panel.hidden) this.openCalendar();
        else this.closeCalendar();
      });
      document.getElementById('course-calendar-close').addEventListener('click', () => this.closeCalendar());
      window.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && !panel.hidden) {
          event.preventDefault();
          this.closeCalendar();
        }
      });
      window.addEventListener('resize', () => {
        if (!panel.hidden) this.positionCalendar(this.calendarPosition.left, this.calendarPosition.top);
      });
      const handle = document.getElementById('course-calendar-drag');
      handle.addEventListener('pointerdown', (event) => {
        if (event.button !== 0) return;
        const bounds = panel.getBoundingClientRect();
        this.calendarDrag = { id: event.pointerId, x: event.clientX - bounds.left, y: event.clientY - bounds.top };
        handle.setPointerCapture?.(event.pointerId);
        event.preventDefault();
      });
      handle.addEventListener('pointermove', (event) => {
        const drag = this.calendarDrag;
        if (drag && drag.id === event.pointerId) this.positionCalendar(event.clientX - drag.x, event.clientY - drag.y);
      });
      const stopDrag = () => { this.calendarDrag = null; };
      handle.addEventListener('pointerup', stopDrag);
      handle.addEventListener('pointercancel', stopDrag);
      handle.addEventListener('lostpointercapture', stopDrag);
      handle.addEventListener('keydown', (event) => {
        const moves = { ArrowLeft: [-20, 0], ArrowRight: [20, 0], ArrowUp: [0, -20], ArrowDown: [0, 20] };
        if (!Object.hasOwn(moves, event.key)) return;
        event.preventDefault();
        const [x, y] = moves[event.key];
        this.positionCalendar(this.calendarPosition.left + x, this.calendarPosition.top + y);
      });
      document.getElementById('course-calendar-toggle').addEventListener('click', (event) => {
        const toggle = event.currentTarget;
        const expanded = toggle.getAttribute('aria-expanded') === 'true';
        toggle.setAttribute('aria-expanded', String(!expanded));
        document.getElementById('course-calendar-body').hidden = expanded;
        if (!panel.hidden) this.positionCalendar(this.calendarPosition.left, this.calendarPosition.top);
      });
      document.getElementById('course-calendar-prev').addEventListener('click', () => this.moveCalendarMonth(-1));
      document.getElementById('course-calendar-next').addEventListener('click', () => this.moveCalendarMonth(1));
      document.getElementById('course-calendar-today').addEventListener('click', () => this.selectCalendarDate(new Date()));
      const days = document.getElementById('course-calendar-days');
      days.addEventListener('click', (event) => {
        const day = event.target.closest('button[data-date]');
        if (day) this.selectCalendarDate(this.calendarDateFromKey(day.dataset.date), true);
      });
      days.addEventListener('keydown', (event) => {
        const day = event.target.closest('button[data-date]');
        if (!day) return;
        const date = this.calendarDateFromKey(day.dataset.date);
        const offsets = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
        if (Object.hasOwn(offsets, event.key)) date.setDate(date.getDate() + offsets[event.key]);
        else if (event.key === 'Home') date.setDate(date.getDate() - (date.getDay() + 6) % 7);
        else if (event.key === 'End') date.setDate(date.getDate() + 6 - (date.getDay() + 6) % 7);
        else return;
        event.preventDefault();
        this.selectCalendarDate(date, true);
      });
      this.selectCalendarDate(new Date());
    }

    openCalendar() {
      const panel = document.getElementById('course-calendar');
      const button = document.getElementById('btn-open-course-calendar');
      panel.hidden = false;
      button.setAttribute('aria-expanded', 'true');
      if (this.calendarPosition) this.positionCalendar(this.calendarPosition.left, this.calendarPosition.top);
      else {
        const anchor = button.getBoundingClientRect();
        const bounds = panel.getBoundingClientRect();
        const top = anchor.bottom + bounds.height + 8 <= window.innerHeight - 8
          ? anchor.bottom + 8 : anchor.top - bounds.height - 8;
        this.positionCalendar(anchor.right - bounds.width, top);
      }
      document.getElementById('course-calendar-drag').focus({ preventScroll: true });
    }

    closeCalendar() {
      document.getElementById('course-calendar').hidden = true;
      const button = document.getElementById('btn-open-course-calendar');
      button.setAttribute('aria-expanded', 'false');
      button.focus({ preventScroll: true });
    }

    positionCalendar(left, top) {
      const panel = document.getElementById('course-calendar');
      const bounds = panel.getBoundingClientRect();
      this.calendarPosition = {
        left: Math.max(8, Math.min(left, window.innerWidth - bounds.width - 8)),
        top: Math.max(8, Math.min(top, window.innerHeight - bounds.height - 8))
      };
      panel.style.left = `${this.calendarPosition.left}px`;
      panel.style.top = `${this.calendarPosition.top}px`;
    }

    calendarDateKey(date) {
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    }

    calendarDateFromKey(key) {
      const [year, month, day] = key.split('-').map(Number);
      return new Date(year, month - 1, day, 12);
    }

    isoWeek(date) {
      const thursday = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
      thursday.setUTCDate(thursday.getUTCDate() + 4 - (thursday.getUTCDay() || 7));
      const year = thursday.getUTCFullYear();
      const week = Math.ceil(((thursday.getTime() - Date.UTC(year, 0, 1)) / 86400000 + 1) / 7);
      return { week, year };
    }

    selectCalendarDate(date, focus = false) {
      this.calendarSelectedDate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
      this.calendarMonth = new Date(date.getFullYear(), date.getMonth(), 1, 12);
      const { week, year } = this.isoWeek(this.calendarSelectedDate);
      const output = document.getElementById('course-calendar-week');
      output.textContent = `Settimana ${week} · ${year}`;
      output.dataset.week = String(week);
      output.dataset.year = String(year);
      output.dataset.date = this.calendarDateKey(this.calendarSelectedDate);
      document.getElementById('btn-open-course-calendar').textContent = `Calendario · sett. ${week}`;
      document.getElementById('course-calendar-selected-date').textContent = this.calendarSelectedDate.toLocaleDateString('it-IT', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
      });
      const input = document.getElementById('course-record-week');
      input.value = String(week);
      input.dispatchEvent(new Event('change', { bubbles: true }));
      this.renderCalendar(focus);
    }

    moveCalendarMonth(offset) {
      this.calendarMonth = new Date(this.calendarMonth.getFullYear(), this.calendarMonth.getMonth() + offset, 1, 12);
      this.renderCalendar();
    }

    renderCalendar(focus = false) {
      document.getElementById('course-calendar-month').textContent = this.calendarMonth.toLocaleDateString('it-IT', {
        month: 'long', year: 'numeric'
      });
      const first = new Date(this.calendarMonth);
      first.setDate(1 - (first.getDay() + 6) % 7);
      const today = this.calendarDateKey(new Date());
      const selected = this.calendarDateKey(this.calendarSelectedDate);
      const days = document.getElementById('course-calendar-days');
      const buttons = Array.from({ length: 42 }, (_, index) => {
        const date = new Date(first);
        date.setDate(first.getDate() + index);
        const key = this.calendarDateKey(date);
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'course-calendar-day';
        button.classList.toggle('is-outside', date.getMonth() !== this.calendarMonth.getMonth());
        button.dataset.date = key;
        button.textContent = String(date.getDate());
        button.setAttribute('aria-pressed', String(key === selected));
        if (key === today) button.setAttribute('aria-current', 'date');
        const { week, year } = this.isoWeek(date);
        const label = `${date.toLocaleDateString('it-IT', { dateStyle: 'full' })} · settimana ${week} del ${year}`;
        button.setAttribute('aria-label', label);
        button.title = label;
        button.tabIndex = key === selected ? 0 : -1;
        return button;
      });
      days.replaceChildren(...buttons);
      const active = days.querySelector('[aria-pressed="true"]') || buttons.find((button) => !button.classList.contains('is-outside'));
      active.tabIndex = 0;
      if (focus) active.focus();
    }

    populateLevels() {
      const select = document.getElementById('course-record-level');
      const selected = select.value;
      select.replaceChildren(new Option('Seleziona livello', ''));
      this.levels.forEach((level) => select.add(new Option(this.formatLevel(level), level)));
      select.value = this.levels.includes(selected) ? selected : '';
    }

    songLevel(song) {
      return this.formatLevel(String(song.info_livello || '').trim() || song['info livello'] || '');
    }

    setCatalog(brani) {
      const selectedId = this.selectedSongId();
      const songInput = document.getElementById('course-record-song');
      const draft = songInput.value;
      this.catalogRevision += 1;
      this.brani = typeof dataLoader.normalizeBraniList === 'function' ? dataLoader.normalizeBraniList(brani) : brani;
      this.levels = [...new Set(this.brani.map((song) => this.songLevel(song)).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b, 'it', { numeric: true }));
      if (!this.levels.includes(this.recordsFilter.level)) this.recordsFilter.level = '';
      this.populateLevels();
      this.populateRecordsFilters();
      this.populateSongOptions(selectedId);
      if (!selectedId) songInput.value = draft;
      this.renderSelectedSeason();
    }

    async refreshCatalog() {
      const revision = this.catalogRevision;
      const brani = await dataLoader.loadBrani({ silent: true });
      // Un aggiornamento cloud arrivato durante la lettura ha precedenza sul CSV.
      if (revision === this.catalogRevision) this.setCatalog(brani);
    }

    async checkGoogleCatalogSync() {
      if (!this.isLocalFileHost() || this.checkingGoogleSync) return;
      this.checkingGoogleSync = true;
      try {
        const response = await fetch('/api/bordero/sync-google/status', { cache: 'no-store' });
        if (!response.ok) return;
        const { ok, state } = await response.json();
        if (!ok || state?.inProgress || !state?.lastCompletedAt || state.lastCompletedAt === this.lastGoogleSyncAt) return;
        await this.refreshCatalog();
        this.lastGoogleSyncAt = state.lastCompletedAt;
      } catch (error) {
        // L'endpoint e' disponibile solo nell'app locale con il server unificato.
      } finally {
        this.checkingGoogleSync = false;
      }
    }

    populateSongOptions(selectedId = '') {
      const options = document.getElementById('course-song-options');
      options.replaceChildren();
      [...this.brani]
        .sort((a, b) => this.trackLabel(a).localeCompare(this.trackLabel(b), 'it'))
        .forEach((song) => {
          const option = document.createElement('option');
          option.value = this.trackLabel(song);
          options.appendChild(option);
        });
      this.setSongSelection(selectedId);
    }

    selectedSongId() {
      const value = document.getElementById('course-record-song').value.trim();
      if (!value) return '';
      const normalized = value.toLocaleLowerCase('it');
      // Una scelta completa mantiene l'ID anche quando più coreografie hanno lo stesso nome.
      const exact = this.brani.find((song) => String(song.id) === value || this.trackLabel(song).toLocaleLowerCase('it') === normalized);
      if (exact) return String(exact.id);
      const matches = this.brani.filter((song) => this.trackTitle(song).toLocaleLowerCase('it') === normalized
        || (/^\d+$/.test(value) && /^\d+$/.test(String(song.id)) && Number(song.id) === Number(value)));
      if (matches.length === 1) return String(matches[0].id);
      const existing = this.currentSeason()?.records.find((record) => record.id === this.editingRecordId);
      if (existing && !this.findSong(existing.branoId) && value === this.archivedSongLabel(existing)) return String(existing.branoId);
      return '';
    }

    archivedSongLabel(record) {
      return `${record.branoId} · ${record.trackTitle || record.branoId} (non più nel catalogo)`;
    }

    setSongSelection(id) {
      const input = document.getElementById('course-record-song');
      const song = this.findSong(id);
      const existing = this.currentSeason()?.records.find((record) => String(record.branoId) === String(id));
      input.value = song ? this.trackLabel(song) : existing ? this.archivedSongLabel(existing) : '';
      input.setCustomValidity('');
    }

    currentSeasonId() {
      return document.getElementById('course-season-select').value;
    }

    currentSeason() {
      return this.state.seasons[this.currentSeasonId()] || null;
    }

    render(selectedSeasonId) {
      const select = document.getElementById('course-season-select');
      const oldValue = selectedSeasonId || select.value;
      const seasonIds = Object.keys(this.state.seasons || {}).sort((a, b) => b.localeCompare(a));
      select.replaceChildren(new Option(seasonIds.length ? 'Seleziona stagione' : 'Crea o importa un programma', ''));
      seasonIds.forEach((id) => {
        const season = this.state.seasons[id];
        const label = `${season.label || id}${id === this.state.activeSeason ? ' · ATTIVA' : ''}`;
        select.add(new Option(label, id));
      });
      select.value = seasonIds.includes(oldValue) ? oldValue : (seasonIds.includes(this.state.activeSeason) ? this.state.activeSeason : seasonIds[0] || '');
      this.renderSelectedSeason();
    }

    renderSelectedSeason() {
      const season = this.currentSeason();
      const seasonId = season?.id || '';
      if (this.recordsSeasonId !== seasonId) {
        this.recordsSeasonId = seasonId;
        this.recordsSort = { field: 'week', direction: 'desc' };
        this.recordsFilter = { level: '', week: 53 };
      }
      this.updateRecordsSortButtons();
      const status = document.getElementById('course-season-status');
      status.textContent = !season ? 'Nessun programma selezionato' : season.id === this.state.activeSeason ? 'STAGIONE ATTIVA' : 'Archivio';
      status.classList.toggle('is-active', Boolean(season && season.id === this.state.activeSeason));
      document.getElementById('btn-activate-season').disabled = !season || season.id === this.state.activeSeason;
      const formDisabled = !season;
      ['course-record-week', 'course-record-level', 'course-record-song', 'btn-save-course-record'].forEach((id) => {
        document.getElementById(id).disabled = formDisabled;
      });
      document.getElementById('btn-export-course-csv').disabled = !season;
      document.getElementById('btn-import-course-csv').disabled = false;

      const records = season && Array.isArray(season.records) ? season.records : [];
      const levelFilter = document.getElementById('course-records-level-filter');
      const weekFilter = document.getElementById('course-records-week-filter');
      levelFilter.value = this.recordsFilter.level;
      weekFilter.value = String(this.recordsFilter.week);
      levelFilter.disabled = weekFilter.disabled = !season;
      const rows = this.sortSeasonRecords(records.filter((record) =>
        (!this.recordsFilter.level || record.level === this.recordsFilter.level)
        && Number(record.week) <= this.recordsFilter.week));
      document.getElementById('course-record-count').textContent = season
        ? `${season.label} · ${records.length} coreografie registrate${rows.length !== records.length ? ` · ${rows.length} mostrate` : ''}`
        : 'Seleziona o crea un anno accademico.';
      const body = document.getElementById('course-records-body');
      if (!rows.length) {
        body.innerHTML = `<tr><td colspan="6">${season ? records.length ? 'Nessuna coreografia per il livello e la settimana selezionati.' : 'Nessuna coreografia inserita per questa stagione.' : 'Crea o importa una stagione per iniziare.'}</td></tr>`;
        return;
      }
      body.innerHTML = rows.map((record) => {
        const song = this.findSong(record.branoId);
        const title = song ? this.trackTitle(song) : record.trackTitle || `Brano ${record.branoId}`;
        const author = song?.autore || record.author || '—';
        return `<tr>
          <td><span class="course-week-pill">SETT. ${Number(record.week)}</span></td>
          <td>${this.escape(this.formatLevel(record.level))}</td>
          <td>${this.escape(record.branoId)}</td>
          <td>${this.escape(title)}</td>
          <td>${this.escape(author)}</td>
          <td class="course-row-actions"><button type="button" class="btn btn-small btn-secondary" data-action="edit" data-record-id="${this.escape(record.id)}">Modifica</button><button type="button" class="btn btn-small course-delete-btn" data-action="delete" data-record-id="${this.escape(record.id)}">Rimuovi</button></td>
        </tr>`;
      }).join('');
    }

    async createSeason(event) {
      event.preventDefault();
      const label = document.getElementById('new-season-label').value.trim().replace(/[–-]/g, '/').replace(/\s/g, '');
      const match = label.match(/^(\d{4})\/(\d{4})$/);
      if (!match || Number(match[2]) !== Number(match[1]) + 1) {
        this.setStatus('course-record-status', 'Inserisci un anno accademico valido, ad esempio 2026/2027.', true);
        return;
      }
      const id = `${match[1]}-${match[2]}`;
      if (this.state.seasons[id]) {
        document.getElementById('course-season-select').value = id;
        this.renderSelectedSeason();
        this.setStatus('course-record-status', 'Questo anno accademico esiste già: è stato selezionato.');
        return;
      }
      const season = { id, label: `${match[1]}/${match[2]}`, records: [], createdAt: new Date().toISOString(), updatedAt: '' };
      const result = await this.store.saveSeason(season);
      this.state = this.store.getState();
      if (!this.state.activeSeason) {
        const activation = await this.store.setActiveSeason(id);
        this.state = this.store.getState();
        this.reportSave(activation.synced, activation.error);
      } else {
        this.reportSave(result.synced, result.error);
      }
      this.resetRecordForm();
      this.render(id);
    }

    async activateSeason() {
      const seasonId = this.currentSeasonId();
      if (!seasonId) return;
      const result = await this.store.setActiveSeason(seasonId);
      this.state = this.store.getState();
      this.render();
      this.reportSave(result.synced, result.error);
    }

    async saveRecord(event) {
      event.preventDefault();
      const season = this.currentSeason();
      if (!season) return this.setStatus('course-record-status', 'Crea o seleziona prima una stagione.', true);
      const week = Number(document.getElementById('course-record-week').value);
      const level = this.resolveLevel(document.getElementById('course-record-level').value);
      const branoId = this.selectedSongId();
      if (!Number.isInteger(week) || week < 1 || week > 53 || !level) {
        return this.setStatus('course-record-status', 'Completa settimana, livello e coreografia.', true);
      }
      if (!branoId) {
        const input = document.getElementById('course-record-song');
        input.setCustomValidity('Seleziona una coreografia dai suggerimenti oppure inserisci un ID o un nome completo univoco.');
        input.reportValidity();
        return this.setStatus('course-record-status', 'Seleziona una coreografia valida dal catalogo usando ID o nome.', true);
      }
      const records = [...season.records];
      const editingId = this.editingRecordId;
      if (editingId && !records.some((record) => record.id === editingId)) {
        this.resetRecordForm();
        return this.setStatus('course-record-status', 'La coreografia è stata rimossa. Inseriscila di nuovo se necessario.', true);
      }
      const duplicate = records.find((record) => record.id !== editingId && String(record.branoId) === String(branoId) && record.level === level);
      if (duplicate) return this.setStatus('course-record-status', 'Questa coreografia è già presente nel programma di questo livello. Modifica la settimana esistente.', true);
      const atWeek = records.filter((record) => record.id !== editingId && Number(record.week) === week && record.level === level);
      if (atWeek.length >= MAX_WEEKLY_CHOREOGRAPHIES) return this.setStatus('course-record-status', `La settimana ${week} per ${this.formatLevel(level)} ha già raggiunto il limite di cinque coreografie.`, true);
      const song = this.findSong(branoId);
      const existing = records.find((item) => item.id === editingId);
      if (!song && (!existing || String(existing.branoId) !== String(branoId))) {
        return this.setStatus('course-record-status', 'Seleziona una coreografia presente nel catalogo.', true);
      }
      const record = {
        id: editingId || (window.crypto?.randomUUID?.() || `lesson-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
        week, level, branoId: String(branoId), trackTitle: song ? this.trackTitle(song) : existing.trackTitle, author: song?.autore || existing?.author || '',
        updatedAt: new Date().toISOString()
      };
      const nextRecords = records.filter((item) => item.id !== editingId).concat(record);
      const result = await this.store.saveSeason({ ...season, records: nextRecords });
      this.state = this.store.getState();
      this.resetRecordForm();
      this.render();
      this.reportSave(result.synced, result.error);
    }

    handleRecordAction(event) {
      const button = event.target.closest('button[data-action]');
      if (!button) return;
      const season = this.currentSeason();
      const record = season?.records.find((item) => item.id === button.dataset.recordId);
      if (!record) return;
      if (button.dataset.action === 'edit') {
        this.editingRecordId = record.id;
        document.getElementById('course-record-id').value = record.id;
        document.getElementById('course-record-week').value = record.week;
        document.getElementById('course-record-level').value = record.level;
        this.setSongSelection(record.branoId);
        document.getElementById('btn-save-course-record').textContent = 'Salva modifica';
        document.getElementById('btn-cancel-course-edit').hidden = false;
        document.getElementById('course-record-week').focus();
        this.setStatus('course-record-status', 'Modifica settimana, livello o brano e salva.');
      } else if (button.dataset.action === 'delete' && window.confirm(`Rimuovere “${record.trackTitle || record.branoId}” dalla settimana ${record.week} (${this.formatLevel(record.level)})?`)) {
        this.store.saveSeason({ ...season, records: season.records.filter((item) => item.id !== record.id) }).then((result) => {
          this.state = this.store.getState();
          if (this.editingRecordId === record.id) this.resetRecordForm();
          this.render();
          this.reportSave(result.synced, result.error);
        });
      }
    }

    resetRecordForm() {
      this.editingRecordId = '';
      document.getElementById('course-record-form').reset();
      document.getElementById('course-record-song').setCustomValidity('');
      document.getElementById('course-record-week').value = String(this.isoWeek(this.calendarSelectedDate).week);
      document.getElementById('course-record-id').value = '';
      document.getElementById('btn-save-course-record').textContent = 'Aggiungi coreografia';
      document.getElementById('btn-cancel-course-edit').hidden = true;
    }

    async importCsv() {
      const file = this.selectedCsv || document.getElementById('course-csv-file').files[0];
      if (!file) return this.setStatus('course-import-status', 'Seleziona il CSV del programma da caricare.', true);
      try {
        const text = (await file.text()).replace(/^\uFEFF/, '');
        const parsed = this.parseCsv(text);
        if (!parsed.length) throw new Error('Il file non contiene righe di programma.');
        const rows = parsed.map((row, index) => {
          const label = row.anno_accademico || row.anno || row.stagione || '';
          const year = this.parseYear(label);
          const rawLevel = row.livello || row.level || '';
          const level = this.resolveLevel(rawLevel);
          const week = Number(row.settimana || row.week);
          const branoId = String(row.brano_id || row.id_brano || row.id || '').trim();
          if (!year || !level || !Number.isInteger(week) || week < 1 || week > 53 || !branoId) {
            throw new Error(`Riga ${index + 2}: anno, livello, settimana o brano_id non valido.`);
          }
          const song = this.findSong(branoId);
          if (!song) throw new Error(`Riga ${index + 2}: ID brano ${branoId} non trovato nel catalogo.`);
          return { year, level, week, branoId, song };
        });
        const seasonIds = new Set(rows.map((row) => row.year.id));
        if (seasonIds.size !== 1) throw new Error('Il CSV deve contenere una sola stagione accademica.');
        const seasonInfo = rows[0].year;
        const seasonId = seasonInfo.id;
        const label = seasonInfo.label;
        const counts = new Map();
        const duplicateIds = new Set();
        const records = rows.map((row) => {
          const key = `${row.level}|${row.week}`;
          const count = (counts.get(key) || 0) + 1;
          counts.set(key, count);
          if (count > MAX_WEEKLY_CHOREOGRAPHIES) throw new Error(`Settimana ${row.week}, ${this.formatLevel(row.level)}: il limite è cinque coreografie.`);
          const uniqueKey = `${row.level}|${row.branoId}`;
          if (duplicateIds.has(uniqueKey)) throw new Error(`Il brano ${row.branoId} è ripetuto per ${this.formatLevel(row.level)}.`);
          duplicateIds.add(uniqueKey);
          return {
            id: window.crypto?.randomUUID?.() || `import-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            week: row.week, level: row.level, branoId: row.branoId,
            trackTitle: this.trackTitle(row.song), author: row.song.autore || '', updatedAt: new Date().toISOString()
          };
        });
        if (this.state.seasons[seasonId] && !window.confirm(`Il programma ${label} verrà sostituito con ${rows.length} coreografie. Continuare?`)) return;
        const season = this.state.seasons[seasonId] || { id: seasonId, label, createdAt: new Date().toISOString() };
        const result = await this.store.saveSeason({ ...season, id: seasonId, label, records });
        this.state = this.store.getState();
        if (!this.state.activeSeason) {
          const activation = await this.store.setActiveSeason(seasonId);
          this.state = this.store.getState();
          this.reportSave(activation.synced, activation.error);
        } else {
          this.reportSave(result.synced, result.error);
        }
        this.resetRecordForm();
        this.render(seasonId);
        this.setStatus('course-import-status', `Importate ${records.length} coreografie per ${label}.`);
      } catch (error) {
        this.setStatus('course-import-status', error.message, true);
      }
    }

    parseCsv(text) {
      const lines = text.split(/\r?\n/).filter((line) => line.trim());
      if (lines.length < 2) return [];
      const delimiter = (lines[0].match(/;/g) || []).length > (lines[0].match(/,/g) || []).length ? ';' : ',';
      const parseLine = (line) => {
        const fields = [];
        let value = '';
        let quoted = false;
        for (let i = 0; i < line.length; i += 1) {
          const char = line[i];
          if (char === '"' && quoted && line[i + 1] === '"') { value += '"'; i += 1; }
          else if (char === '"') quoted = !quoted;
          else if (char === delimiter && !quoted) { fields.push(value.trim()); value = ''; }
          else value += char;
        }
        if (quoted) throw new Error('CSV non valido: virgolette non chiuse.');
        fields.push(value.trim());
        return fields;
      };
      const headers = parseLine(lines[0]).map((header) => header.trim().toLowerCase().replace(/[\s-]+/g, '_'));
      return lines.slice(1).map((line) => {
        const values = parseLine(line);
        return Object.fromEntries(headers.map((header, index) => [header, values[index] || '']));
      });
    }

    parseYear(value) {
      const match = String(value).trim().replace(/[–-]/g, '/').match(/^(\d{4})\s*\/\s*(\d{4})$/);
      if (!match || Number(match[2]) !== Number(match[1]) + 1) return null;
      return { id: `${match[1]}-${match[2]}`, label: `${match[1]}/${match[2]}` };
    }

    resolveLevel(value) {
      const normalized = this.formatLevel(value);
      return this.levels.find((level) => level === normalized) || '';
    }

    downloadTemplate() {
      const label = this.currentSeason()?.label || document.getElementById('new-season-label').value;
      const examples = this.brani.filter((song) => this.songLevel(song)).slice(0, 3)
        .map((song) => [label, this.songLevel(song), 1, song.id].map((value) => this.csv(value)).join(','));
      const content = `\uFEFFanno_accademico,livello,settimana,brano_id\r\n${examples.join('\r\n')}\r\n`;
      return this.download(`programma-coreografie-modello.csv`, content, 'text/csv;charset=utf-8');
    }

    exportSeason() {
      const season = this.currentSeason();
      if (!season) return;
      const records = [...season.records].sort((a, b) => Number(a.week) - Number(b.week) || a.level.localeCompare(b.level, 'it'));
      const lines = ['anno_accademico,livello,settimana,brano_id'];
      records.forEach((record) => lines.push([season.label, record.level, record.week, record.branoId].map((value) => this.csv(value)).join(',')));
      return this.download(`programma-coreografie-${season.id}.csv`, `\uFEFF${lines.join('\r\n')}\r\n`, 'text/csv;charset=utf-8');
    }

    async syncAll() {
      const button = document.getElementById('btn-sync-course-program');
      button.disabled = true;
      try {
        await this.store.syncAll();
        this.state = this.store.getState();
        this.setStatus('course-record-status', 'Programmi e stagione attiva sincronizzati su Firebase.');
      } catch (error) {
        this.setStatus('course-record-status', error.message, true);
      } finally {
        button.disabled = false;
      }
    }

    async download(name, content, type) {
      try {
        const native = window.electronAPI?.courseProgramFiles;
        if (native) {
          const result = await native.saveCsv({ name, content });
          if (!result.ok) throw new Error(result.error);
          if (!result.canceled) this.setStatus('course-import-status', `CSV salvato: ${result.filePath}`);
          return;
        }
        if (this.isLocalFileHost()) {
          const save = (overwrite = false) => this.programFileRequest('', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, content, overwrite })
          });
          let result;
          try { result = await save(); } catch (error) {
            if (error.status !== 409) throw error;
            if (!window.confirm(`Il file ${name} esiste già nella cartella programma. Sostituirlo?`)) return;
            result = await save(true);
          }
          this.setStatus('course-import-status', `CSV salvato: ${result.filePath}`);
          return;
        }
      } catch (error) {
        this.setStatus('course-import-status', error.message, true);
        return;
      }
      const link = document.createElement('a');
      link.href = URL.createObjectURL(new Blob([content], { type }));
      link.download = name;
      link.click();
      URL.revokeObjectURL(link.href);
    }

    reportSave(synced, error) {
      if (synced) this.setStatus('course-record-status', 'Salvato e sincronizzato su Firebase.');
      else this.setStatus('course-record-status', `Salvato su questo PC, sincronizzazione cloud non riuscita: ${error?.message || 'accedi dalla pagina Programma corsi e riprova'}`, true);
    }

    findSong(id) { return this.brani.find((song) => String(song.id) === String(id)); }
    trackTitle(song) { return String(song?.titolo || song?.coreografia || song?.brano || song?.id || 'Brano senza titolo'); }
    trackLabel(song) { return `${song.id ? `${song.id} · ` : ''}${this.trackTitle(song)}${song.autore ? ` — ${song.autore}` : ''}`; }
    formatLevel(level) { return String(level || '').trim().replace(/\s+/g, ' ').replace(/–/g, '-').toLocaleUpperCase('it'); }
    csv(value) { const text = String(value ?? ''); return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text; }
    escape(value) { const node = document.createElement('span'); node.textContent = String(value ?? ''); return node.innerHTML.replace(/"/g, '&quot;'); }
    setStatus(id, message, isError = false) {
      const node = document.getElementById(id);
      node.textContent = message;
      node.classList.toggle('is-error', isError);
    }
  }

  document.addEventListener('DOMContentLoaded', () => { window.choreoCoursePage = new ChoreoCoursePage(); });
})();
