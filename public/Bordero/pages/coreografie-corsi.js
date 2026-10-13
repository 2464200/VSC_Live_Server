(function () {
  'use strict';

  const LEVELS = [
    'BASE', 'INTERMEDIO', 'AVANZATO', 'AVANZATO 1', 'AVANZATO 2', 'AVANZATO 1-2',
    'SUPER AVANZATO', 'SUPER AVANZATO 1', 'SUPER AVANZATO 2', 'SUPER AVANZATO 1-2'
  ];
  const PROGRAM_FILES_API = '/api/bordero/course-program/files';

  class ChoreoCoursePage {
    constructor() {
      this.store = window.choreoProgramStore;
      this.brani = [];
      this.state = this.store.getState();
      this.editingRecordId = '';
      this.recordsSort = { field: 'week', direction: 'desc' };
      this.recordsSeasonId = '';
      this.recordsFilter = { level: '', week: 52 };
      this.selectedCsv = null;
      this.init();
    }

    async init() {
      this.bindEvents();
      this.initializeFileDirectory();
      this.populateLevels();
      this.populateRecordsFilters();
      this.setSuggestedYear();
      this.setStatus('course-record-status', 'Caricamento catalogo e programmi…');
      try {
        await dataLoader.initialize(false);
        this.brani = await dataLoader.loadBrani();
        await this.store.load({ force: true });
        this.state = this.store.getState();
        this.populateSongOptions();
        this.render();
        this.store.startPolling();
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
            week: Number.isInteger(week) && week >= 1 && week <= 52 ? week : 52
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
      LEVELS.forEach((value) => level.add(new Option(this.formatLevel(value), value)));
      const week = document.getElementById('course-records-week-filter');
      week.replaceChildren(...Array.from({ length: 52 }, (_, index) =>
        new Option(index === 51 ? '52 · Tutte le settimane' : String(index + 1), String(index + 1))));
      week.value = '52';
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

    populateLevels() {
      const select = document.getElementById('course-record-level');
      select.replaceChildren(new Option('Seleziona livello', ''));
      LEVELS.forEach((level) => select.add(new Option(this.formatLevel(level), level)));
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
        this.recordsFilter = { level: '', week: 52 };
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
      const level = document.getElementById('course-record-level').value;
      const branoId = this.selectedSongId();
      if (!Number.isInteger(week) || week < 1 || week > 52 || !level) {
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
      if (atWeek.length >= 3) return this.setStatus('course-record-status', `La settimana ${week} per ${this.formatLevel(level)} ha già raggiunto il limite di tre coreografie.`, true);
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
      document.getElementById('course-record-week').value = '1';
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
          if (!year || !level || !Number.isInteger(week) || week < 1 || week > 52 || !branoId) {
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
          if (count > 3) throw new Error(`Settimana ${row.week}, ${this.formatLevel(row.level)}: il limite è tre coreografie.`);
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
      const normalized = String(value).trim().toLocaleUpperCase('it').replace(/\s+/g, ' ').replace(/[–]/g, '-');
      return LEVELS.find((level) => level === normalized) || '';
    }

    downloadTemplate() {
      const label = this.currentSeason()?.label || document.getElementById('new-season-label').value;
      const examples = this.brani.slice(0, 3).map((song, index) => [label, index < 2 ? 'BASE' : 'INTERMEDIO', 1, song.id].map((value) => this.csv(value)).join(','));
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
    formatLevel(level) { return String(level || '').toLocaleUpperCase('it'); }
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
