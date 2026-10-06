(function () {
  const generator = window.CountrySetlistGenerator;
  const fileHelper = window.DjPreselectionFile;
  const statusNode = document.getElementById('scaletta-status');
  const tableBody = document.getElementById('setlist-table-body');
  const generateButton = document.getElementById('btn-generate-setlist');
  const newButton = document.getElementById('btn-new-setlist');
  const saveButton = document.getElementById('btn-save-setlist');
  const fileFields = {
    dj: document.getElementById('setlist-dj-name'),
    date: document.getElementById('setlist-event-date'),
    event: document.getElementById('setlist-event-name'),
    preview: document.getElementById('setlist-file-name-preview')
  };
  const levelInputs = new Map([
    ['BASE', document.getElementById('setlist-count-base')],
    ['INTERMEDIO', document.getElementById('setlist-count-intermedio')],
    ['AVANZATO_1', document.getElementById('setlist-count-avanzato-1')],
    ['AVANZATO_2', document.getElementById('setlist-count-avanzato-2')],
    ['SUPERAVANZATO_1_2', document.getElementById('setlist-count-super-12')],
    ['SUPERAVANZATO_3', document.getElementById('setlist-count-super-3')],
    ['ALTRE_COREO', document.getElementById('setlist-count-altre-coreo')]
  ]);
  const summary = {
    available: document.getElementById('summary-available'),
    used: document.getElementById('summary-used'),
    count: document.getElementById('summary-track-count'),
    remaining: document.getElementById('summary-remaining'),
    levels: document.getElementById('setlist-level-summary')
  };

  let catalog = null;
  let setlist = [];
  let lastResult = null;
  let lastAvailableSeconds = 0;
  const STORAGE_KEY = 'userform_scaletta_state';
  window.SCALETTA_SETLIST = setlist;

  function persistState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        time: document.getElementById('setlist-available-time').value,
        counts: Object.fromEntries([...levelInputs].map(([key, input]) => [key, input.value])),
        dj: fileFields.dj.value,
        date: fileFields.date.value,
        event: fileFields.event.value,
        result: lastResult,
        availableSeconds: lastAvailableSeconds
      }));
    } catch {
      // storage non disponibile o pieno: la scaletta resta solo in memoria
    }
  }

  function restoreState() {
    const state = readStoredValue(STORAGE_KEY);
    if (!state || typeof state !== 'object') return;
    if (typeof state.time === 'string') document.getElementById('setlist-available-time').value = state.time;
    levelInputs.forEach((input, key) => {
      if (state.counts && state.counts[key] !== undefined) input.value = String(state.counts[key]);
    });
    if (state.dj || state.date || state.event) {
      fileFields.dj.value = state.dj || '';
      fileFields.date.value = state.date || '';
      fileFields.event.value = state.event || '';
      updateFileNamePreview();
    }
    if (state.result && Array.isArray(state.result.tracks) && state.result.tracks.length && state.availableSeconds > 0) {
      renderSetlist(state.result, state.availableSeconds);
    }
  }

  function setStatus(message, kind = 'info') {
    if (!statusNode) return;
    statusNode.replaceChildren();
    statusNode.dataset.kind = kind;
    message.split('\n').filter(Boolean).forEach((line) => {
      const paragraph = document.createElement('p');
      paragraph.textContent = line;
      statusNode.appendChild(paragraph);
    });
  }

  function getCounts() {
    return Object.fromEntries([...levelInputs].map(([key, input]) => [
      key,
      input.value.trim() === '' ? NaN : Number(input.value)
    ]));
  }

  function appendCell(row, value) {
    const cell = document.createElement('td');
    cell.textContent = value || '-';
    row.appendChild(cell);
  }

  function renderSetlist(result, availableSeconds) {
    setlist = result.tracks;
    lastResult = { tracks: result.tracks, levelCounts: result.levelCounts, totalDurationSeconds: result.totalDurationSeconds };
    lastAvailableSeconds = availableSeconds;
    window.SCALETTA_SETLIST = setlist;
    tableBody.replaceChildren();

    if (!setlist.length) {
      const row = document.createElement('tr');
      const cell = document.createElement('td');
      cell.colSpan = 6;
      cell.className = 'setlist-empty';
      cell.textContent = 'Nessun brano selezionato per i parametri indicati.';
      row.appendChild(cell);
      tableBody.appendChild(row);
    }

    setlist.forEach((track, index) => {
      const row = document.createElement('tr');
      appendCell(row, String(index + 1));
      appendCell(row, generator.LEVEL_BY_KEY[track.level]?.label || track.level);
      appendCell(row, track.autore);
      appendCell(row, track.coreografia);
      appendCell(row, track.brano);
      appendCell(row, track.durationLabel);
      tableBody.appendChild(row);
    });

    summary.available.textContent = generator.formatDuration(availableSeconds);
    summary.used.textContent = generator.formatDuration(result.totalDurationSeconds);
    summary.count.textContent = String(setlist.length);
    summary.remaining.textContent = generator.formatDuration(availableSeconds - result.totalDurationSeconds);
    summary.levels.replaceChildren();
    generator.LEVELS.forEach((level) => {
      const item = document.createElement('div');
      item.className = 'setlist-level-item';
      const term = document.createElement('dt');
      term.textContent = level.label;
      const description = document.createElement('dd');
      description.textContent = String(result.levelCounts[level.key] || 0);
      item.append(term, description);
      summary.levels.appendChild(item);
    });
    newButton.disabled = false;
    saveButton.disabled = setlist.length === 0;
  }

  function readStoredValue(key) {
    try {
      return JSON.parse(localStorage.getItem(key) || 'null');
    } catch {
      return null;
    }
  }

  function initializeFileMetadata() {
    const storedMetadata = readStoredValue('bordero_serata_meta') || {};
    const currentMetadata = readStoredValue('bordero_currentSerata')?.metadata || {};
    fileFields.dj.value = storedMetadata.dj || currentMetadata.dj || readStoredValue('bordero_selected_dj') || '';
    fileFields.date.value = storedMetadata.data || currentMetadata.data || readStoredValue('bordero_serata_data') || new Date().toISOString().slice(0, 10);
    fileFields.event.value = storedMetadata.evento || currentMetadata.evento || readStoredValue('bordero_serata_evento') || '';
    updateFileNamePreview();
  }

  function updateFileNamePreview() {
    try {
      fileFields.preview.textContent = fileHelper.buildFileName({
        dj: fileFields.dj.value,
        data: fileFields.date.value,
        evento: fileFields.event.value
      });
    } catch {
      fileFields.preview.textContent = 'DJ_DATA_EVENTO.json';
    }
  }

  async function saveSetlistForPreselection() {
    if (!setlist.length) {
      setStatus('Generare una scaletta prima di salvarla.', 'error');
      return;
    }

    try {
      const tracks = setlist.map((track) => ({
        ...track,
        levelLabel: generator.LEVEL_BY_KEY[track.level]?.label || track.level
      }));
      const totalDurationSeconds = tracks.reduce((total, track) => total + track.durationSeconds, 0);
      const payload = fileHelper.createPayload({
        dj: fileFields.dj.value,
        data: fileFields.date.value,
        evento: fileFields.event.value,
        tracks,
        totalDurationSeconds
      });
      const response = await fetch('/api/dj-preselezione/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dj: payload.dj,
          data: payload.data,
          evento: payload.evento,
          tracks,
          totalDurationSeconds
        })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) throw new Error(result.error || `Errore HTTP ${response.status}`);
      setStatus(`Scaletta salvata in ${result.folder}/${result.fileName}. Apri PreSelezione DJ e caricala dalla cartella salvata.`, 'success');
    } catch (error) {
      setStatus(error.message || 'Impossibile salvare la scaletta.', 'error');
    }
  }

  function generate() {
    if (!catalog) {
      setStatus('Catalogo non disponibile. Ricaricare la pagina o controllare il server.', 'error');
      return;
    }

    const availableSeconds = generator.parseEventTime(document.getElementById('setlist-available-time').value);
    const result = generator.generateSetlist({ catalog, counts: getCounts(), durationSeconds: availableSeconds });
    if (result.errors.length) {
      setStatus(result.errors.join('\n'), 'error');
      return;
    }

    renderSetlist(result, availableSeconds);
    persistState();
    const statusMessages = [`Scaletta generata: ${result.tracks.length} brani in ${generator.formatDuration(result.totalDurationSeconds)}.`, ...result.warnings];
    setStatus(statusMessages.join('\n'), result.warnings.length ? 'warning' : 'success');
  }

  function clearSetlist() {
    document.getElementById('setlist-available-time').value = '';
    levelInputs.forEach((input) => { input.value = '0'; });
    fileFields.dj.value = '';
    fileFields.date.value = '';
    fileFields.event.value = '';
    updateFileNamePreview();
    setlist = [];
    lastResult = null;
    lastAvailableSeconds = 0;
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignorato */ }
    window.SCALETTA_SETLIST = setlist;
    tableBody.replaceChildren();
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 6;
    cell.className = 'setlist-empty';
    cell.textContent = 'Genera una scaletta per visualizzare i brani.';
    row.appendChild(cell);
    tableBody.appendChild(row);
    summary.available.textContent = '--:--';
    summary.used.textContent = '--:--';
    summary.count.textContent = '0';
    summary.remaining.textContent = '--:--';
    summary.levels.replaceChildren();
    newButton.disabled = true;
    saveButton.disabled = true;
    setStatus('Parametri e risultato puliti.');
  }

  async function loadCatalog() {
    try {
      const response = await fetch(`../../Bordero/data/brani.csv?t=${Date.now()}`, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Risposta HTTP ${response.status}`);
      const csv = await response.text();
      catalog = generator.buildCatalog(csv);
      if (!catalog.stats.sourceRows) throw new Error('Il catalogo non contiene righe leggibili.');
      generateButton.disabled = false;
      setStatus(`Catalogo Borderò caricato: ${catalog.stats.sourceRows} righe, ${catalog.tracks.length} brani nei livelli richiesti.`);
    } catch (error) {
      catalog = null;
      setStatus(`Errore nel caricamento del catalogo Borderò: ${error.message}`, 'error');
    }
  }

  generateButton?.addEventListener('click', generate);
  newButton?.addEventListener('click', generate);
  saveButton?.addEventListener('click', saveSetlistForPreselection);
  document.getElementById('btn-clear-setlist')?.addEventListener('click', clearSetlist);
  Object.values(fileFields).filter((field) => field !== fileFields.preview).forEach((field) => {
    field.addEventListener('input', () => { updateFileNamePreview(); persistState(); });
    field.addEventListener('change', () => { updateFileNamePreview(); persistState(); });
  });
  [document.getElementById('setlist-available-time'), ...levelInputs.values()].forEach((input) => {
    input.addEventListener('input', persistState);
  });
  initializeFileMetadata();
  restoreState();
  loadCatalog();
})();