(() => {
  'use strict';

  const STORAGE_KEY = 'bordero.dj-preselezione.v1';
  const ITEMS_PER_PAGE = 50;
  const VDJ_BASE_URLS = ['http://localhost:8080', 'http://127.0.0.1:8080', 'https://localhost:8080', 'https://127.0.0.1:8080'];

  const elements = {
    playlistSelect: document.getElementById('playlist-select'),
    newPlaylistButton: document.getElementById('btn-new-playlist'),
    deletePlaylistButton: document.getElementById('btn-delete-playlist'),
    newPlaylistForm: document.getElementById('new-playlist-form'),
    newPlaylistName: document.getElementById('new-playlist-name'),
    cancelNewPlaylistButton: document.getElementById('btn-cancel-new-playlist'),
    exportButton: document.getElementById('btn-export-m3u'),
    refreshButton: document.getElementById('btn-refresh-archive'),
    archiveStatus: document.getElementById('archive-status'),
    actionStatus: document.getElementById('action-status'),
    archiveCount: document.getElementById('archive-count'),
    archiveAvailableCount: document.getElementById('archive-available-count'),
    archiveSearch: document.getElementById('archive-search'),
    archiveList: document.getElementById('archive-list'),
    archiveEmpty: document.getElementById('archive-empty'),
    archiveVisibleCount: document.getElementById('archive-visible-count'),
    catalogPageInfo: document.getElementById('catalog-page-info'),
    catalogPrev: document.getElementById('catalog-prev'),
    catalogNext: document.getElementById('catalog-next'),
    selectionCount: document.getElementById('selection-count'),
    selectionEmpty: document.getElementById('selection-empty'),
    selectionList: document.getElementById('selection-list')
  };

  let archiveTracks = [];
  let filteredTracks = [];
  let currentPage = 1;
  let currentSort = null;
  let currentSortDirection = 'asc';
  let currentSearch = '';
  let searchMode = 'general';
  let currentFilters = {};
  let activeFilterField = null;
  let savedState = loadSavedState();

  function createId() {
    return globalThis.crypto?.randomUUID?.() || `list-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function defaultState() {
    const id = createId();
    return {
      selectedPlaylistId: id,
      playlists: [{ id, name: 'Preselezione serata', tracks: [] }]
    };
  }

  function loadSavedState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (parsed && Array.isArray(parsed.playlists) && parsed.playlists.length) {
        const playlists = parsed.playlists
          .filter((playlist) => playlist && typeof playlist.id === 'string' && typeof playlist.name === 'string')
          .map((playlist) => ({
            id: playlist.id,
            name: playlist.name,
            tracks: Array.isArray(playlist.tracks)
              ? playlist.tracks.filter((track) => track && (track.branoId || track.id))
              : []
          }));
        if (playlists.length) {
          const selected = playlists.some((playlist) => playlist.id === parsed.selectedPlaylistId)
            ? parsed.selectedPlaylistId
            : playlists[0].id;
          return { selectedPlaylistId: selected, playlists };
        }
      }
    } catch (error) {
      console.warn('Impossibile leggere la preselezione salvata', error);
    }
    return defaultState();
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(savedState));
      window.dispatchEvent(new CustomEvent('bordero:preselection-updated', {
        detail: { count: currentPlaylist()?.tracks.length || 0 }
      }));
      return true;
    } catch (error) {
      console.error('Impossibile salvare la preselezione', error);
      setActionStatus('Spazio locale esaurito: la modifica non è stata salvata.', 'error');
      return false;
    }
  }

  function currentPlaylist() {
    return savedState.playlists.find((playlist) => playlist.id === savedState.selectedPlaylistId) || savedState.playlists[0];
  }

  function displayNameOf(track) {
    const brano = track.brano && typeof track.brano === 'object' ? track.brano : track;
    return String(brano.titolo || brano.coreografia || brano.brano || brano.id || 'Brano senza titolo');
  }

  function setArchiveStatus(message, state = 'info', allowAdminLink = false) {
    elements.archiveStatus.replaceChildren(document.createTextNode(message));
    elements.archiveStatus.dataset.state = state;
    if (allowAdminLink) {
      const link = document.createElement('a');
      link.href = 'admin.html';
      link.textContent = 'Apri configurazione archivio';
      elements.archiveStatus.append(' ', link);
    }
  }

  function setActionStatus(message, state = 'info') {
    elements.actionStatus.textContent = message;
    elements.actionStatus.dataset.state = state;
  }

  function setButtonBusy(button, busy, busyLabel) {
    if (!button.dataset.label) button.dataset.label = button.textContent;
    button.disabled = busy;
    button.textContent = busy ? busyLabel : button.dataset.label;
  }

  function renderPlaylistPicker() {
    elements.playlistSelect.replaceChildren();
    for (const playlist of savedState.playlists) {
      const option = document.createElement('option');
      option.value = playlist.id;
      option.textContent = playlist.name;
      option.selected = playlist.id === savedState.selectedPlaylistId;
      elements.playlistSelect.append(option);
    }
    elements.deletePlaylistButton.disabled = savedState.playlists.length < 2;
  }

  function createTextElement(tagName, className, text) {
    const element = document.createElement(tagName);
    element.className = className;
    element.textContent = text;
    return element;
  }

  function renderArchive() {
    const query = elements.archiveSearch.value.trim().toLowerCase();
    currentSearch = query;
    filteredTracks = archiveTracks.filter((track) => matchesTrack(track, query));
    for (const [field, filter] of Object.entries(currentFilters)) {
      if (filter.mode === 'richiesteZero') {
        filteredTracks = filteredTracks.filter((track) => isZero(track.richieste));
      } else if (filter.mode === 'richiesteNonZero') {
        filteredTracks = filteredTracks.filter((track) => !isZero(track.richieste));
      } else {
        filteredTracks = filteredTracks.filter((track) => normalize(track[field]) === normalize(filter.value));
      }
    }
    if (currentSort) {
      const direction = currentSortDirection === 'asc' ? 1 : -1;
      filteredTracks.sort((left, right) => compareTracks(left, right, currentSort) * direction);
    }

    const pageCount = Math.max(1, Math.ceil(filteredTracks.length / ITEMS_PER_PAGE));
    currentPage = Math.min(currentPage, pageCount);
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const visible = filteredTracks.slice(start, start + ITEMS_PER_PAGE);
    const activeTracks = currentPlaylist()?.tracks || [];
    const selectedIds = new Set(activeTracks.map((track) => String(track.branoId || track.id)));

    elements.archiveList.replaceChildren();
    for (const track of visible) {
      const row = document.createElement('div');
      const selected = selectedIds.has(String(track.id));
      const isExecuted = isTrackExecuted(track);
      const isVideoOnly = window.isVideoOnlyBrano?.(track) || false;
      row.className = `track-row${selected ? ' is-selected' : ''}${isExecuted ? ' is-executed' : ''}`;
      row.title = isExecuted ? 'Brano già eseguito' : 'Seleziona per aggiungere alla preselezione';
      row.append(createTextElement('span', 'track-id', track.id || '—'));
      const titleCopy = document.createElement('div');
      titleCopy.className = 'track-copy';
      titleCopy.append(createTextElement('span', 'track-title', displayNameOf(track)));
      titleCopy.append(createTextElement('span', 'track-path', [track.brano, track.autore].filter(Boolean).join(' · ')));
      row.append(titleCopy);
      row.append(createTextElement('span', 'track-meta', track.coreografo || '—'));
      row.append(createTextElement('span', 'track-meta', track.info_livello || track.info_coreo_1 || '—'));
      row.append(createTextElement('span', 'track-requests', track.richieste || '—'));

      const statusActions = document.createElement('div');
      statusActions.className = 'track-status-actions';
      const statusButton = document.createElement('button');
      statusButton.type = 'button';
      statusButton.className = `preselect-button preselect-button-quiet track-status-button${isExecuted ? ' is-executed' : ''}`;
      statusButton.textContent = isExecuted ? '⚑' : selected ? '✓' : '+';
      statusButton.disabled = isExecuted || selected || isVideoOnly;
      statusButton.title = isExecuted ? 'Brano già eseguito' : isVideoOnly ? 'Brano solo-video' : selected ? 'Già nella preselezione' : 'Aggiungi alla preselezione';
      statusButton.setAttribute('aria-label', `${statusButton.title}: ${displayNameOf(track)}`);
      if (!isExecuted && !selected && !isVideoOnly) {
        statusButton.addEventListener('click', () => addTrack(track));
      }
      statusActions.append(statusButton);

      if (isExecuted) {
        const restoreButton = document.createElement('button');
        restoreButton.type = 'button';
        restoreButton.className = 'preselect-button preselect-button-quiet restore-track-button';
        restoreButton.textContent = 'Ripristina';
        restoreButton.title = 'Riporta il brano tra quelli disponibili';
        restoreButton.setAttribute('aria-label', `Ripristina ${displayNameOf(track)}`);
        restoreButton.addEventListener('click', () => restoreTrack(track));
        statusActions.append(restoreButton);
      }
      row.append(statusActions);
      row.addEventListener('click', (event) => {
        if (!event.target.closest('button') && !selected && !isExecuted && !isVideoOnly) addTrack(track);
      });
      elements.archiveList.append(row);
    }

    const availableCount = archiveTracks.filter((track) => !isTrackExecuted(track)).length;
    elements.archiveCount.textContent = `${archiveTracks.length} ${archiveTracks.length === 1 ? 'totale' : 'totali'}`;
    elements.archiveAvailableCount.textContent = `${availableCount} ${availableCount === 1 ? 'disponibile' : 'disponibili'}`;
    elements.archiveEmpty.hidden = visible.length > 0;
    if (!archiveTracks.length) {
      elements.archiveEmpty.textContent = 'Nessun brano disponibile nel database Borderò';
    } else if (!filteredTracks.length) {
      elements.archiveEmpty.textContent = 'Nessun risultato';
    }
    const firstVisible = filteredTracks.length ? start + 1 : 0;
    elements.archiveVisibleCount.textContent = `${filteredTracks.length} risultati · ${firstVisible}-${Math.min(start + visible.length, filteredTracks.length)} visualizzati`;
    elements.catalogPageInfo.textContent = `Pagina ${currentPage} / ${pageCount}`;
    elements.catalogPrev.disabled = currentPage <= 1;
    elements.catalogNext.disabled = currentPage >= pageCount;
    updateFilterButtonStates();
    updateSortButtonStates();
  }

  function normalize(value) {
    return String(value ?? '').trim().toLocaleLowerCase('it');
  }

  function isTrackExecuted(track) {
    return !window.isVideoOnlyBrano?.(track) && String(track?.flag || '').toUpperCase() === 'X';
  }

  function matchesTrack(track, query) {
    if (!query) return true;
    const fields = searchMode === 'title'
      ? ['titolo']
      : searchMode === 'id'
        ? ['id']
        : ['id', 'titolo', 'brano', 'autore', 'richieste', 'coreografo', 'collaboratori', 'genere', 'info_livello', 'info_coreo_1', 'info_coreo_2'];
    return fields.some((field) => normalize(track[field]).includes(query));
  }

  function isZero(value) {
    const text = String(value ?? '').trim().replace(',', '.');
    return !text || text === '-' || (Number.isFinite(Number(text)) && Number(text) === 0);
  }

  function compareTracks(left, right, field) {
    const leftText = String(left[field] ?? '').trim();
    const rightText = String(right[field] ?? '').trim();
    if (field === 'id' || field === 'richieste') {
      const leftNumber = Number(leftText.replace(',', '.'));
      const rightNumber = Number(rightText.replace(',', '.'));
      if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) return leftNumber - rightNumber;
    }
    return leftText.localeCompare(rightText, 'it', { numeric: true, sensitivity: 'base' });
  }

  function updateSortButtonStates() {
    const fields = { 'btn-sort-id': 'id', 'btn-sort-coreografo': 'coreografo', 'btn-sort-autore': 'autore', 'btn-sort-richieste': 'richieste' };
    for (const [id, field] of Object.entries(fields)) {
      const button = document.getElementById(id);
      button?.classList.toggle('active', currentSort === field);
      if (button && currentSort === field) button.dataset.direction = currentSortDirection;
      else if (button) delete button.dataset.direction;
    }
  }

  function updateFilterButtonStates() {
    const fields = { 'btn-filter-coreografia': 'info_livello', 'btn-filter-livello': 'coreografo', 'btn-filter-altro': 'autore', 'btn-filter-richieste': 'richieste' };
    for (const [id, field] of Object.entries(fields)) {
      document.getElementById(id)?.classList.toggle('active', Boolean(currentFilters[field]));
    }
  }

  function openFilterPicker(field, label) {
    activeFilterField = field;
    document.getElementById('filter-picker-title').textContent = `Filtra per ${label}`;
    document.getElementById('filter-picker-search').value = '';
    renderFilterOptions();
    document.getElementById('filter-picker-modal').hidden = false;
    document.getElementById('filter-picker-search').focus();
  }

  function renderFilterOptions() {
    const options = document.getElementById('filter-picker-options');
    const query = normalize(document.getElementById('filter-picker-search').value);
    const field = activeFilterField;
    const values = [...new Set(archiveTracks.map((track) => String(track[field] || '').trim()).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, 'it', { sensitivity: 'base' }));
    const entries = field === 'richieste'
      ? [{ label: 'Richieste = 0', filter: { mode: 'richiesteZero' } }, { label: 'Richieste > 0', filter: { mode: 'richiesteNonZero' } }, ...values.map((value) => ({ label: value, filter: { mode: 'exactValue', value } }))]
      : values.map((value) => ({ label: value, filter: { mode: 'exactValue', value } }));
    options.replaceChildren();
    const clear = document.createElement('button');
    clear.type = 'button';
    clear.className = 'filter-picker-option is-clear';
    clear.textContent = 'Tutti i valori';
    clear.addEventListener('click', () => applyFilter(null));
    options.append(clear);
    entries.filter((entry) => normalize(entry.label).includes(query)).forEach((entry) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'filter-picker-option';
      button.textContent = entry.label;
      button.addEventListener('click', () => applyFilter(entry.filter));
      options.append(button);
    });
  }

  function applyFilter(filter) {
    if (filter) currentFilters[activeFilterField] = filter;
    else delete currentFilters[activeFilterField];
    document.getElementById('filter-picker-modal').hidden = true;
    currentPage = 1;
    renderArchive();
  }

  function createRowButton(label, title, handler, disabled = false, primary = false) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `preselect-button ${primary ? 'preselect-button-primary' : 'preselect-button-quiet'}`;
    button.textContent = label;
    button.title = title;
    button.disabled = disabled;
    button.addEventListener('click', handler);
    return button;
  }

  function createIconButton(label, title, handler, disabled = false) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'row-icon-button';
    button.textContent = label;
    button.title = title;
    button.setAttribute('aria-label', title);
    button.disabled = disabled;
    button.addEventListener('click', handler);
    return button;
  }

  function createTrackDeckButtons(track, index) {
    const buttons = document.createDocumentFragment();
    [1, 2].forEach((deck) => {
      const button = createRowButton(
        `DECK ${deck}`,
        `Carica ${displayNameOf(track)} su Deck ${deck}`,
        () => loadTrackOnDeck(index, deck),
        false,
        false
      );
      button.classList.add('deck-load-button', `deck-load-button-${deck}`);
      button.setAttribute('aria-pressed', String(Number(track.deck) === deck));
      buttons.append(button);
    });
    return buttons;
  }

  async function loadTrackOnDeck(index, deck) {
    const track = currentPlaylist()?.tracks[index];
    if (!track) return;
    track.deck = deck === 2 ? 2 : 1;
    if (!saveState()) return;
    renderSelection();
    await loadTrack(track, deck);
  }

  function renderSelection() {
    const playlist = currentPlaylist();
    const tracks = playlist?.tracks || [];
    elements.selectionList.replaceChildren();
    elements.selectionCount.textContent = `${tracks.length} ${tracks.length === 1 ? 'brano' : 'brani'}`;
    elements.selectionEmpty.hidden = tracks.length > 0;
    elements.selectionList.hidden = tracks.length === 0;

    tracks.forEach((track, index) => {
      const row = document.createElement('li');
      row.className = 'selection-row';
      const copy = document.createElement('div');
      copy.className = 'track-copy';
      copy.append(createTextElement('span', 'track-title', displayNameOf(track)));
      const brano = track.brano || {};
      if (String(brano.flag || '').toUpperCase() === 'X') row.classList.add('is-executed');
      copy.append(createTextElement('span', 'track-path', [brano.id ? `ID ${brano.id}` : '', brano.brano, brano.autore].filter(Boolean).join(' · ')));
      row.append(copy);

      const actions = document.createElement('div');
      actions.className = 'row-actions';
      actions.append(createIconButton('↑', 'Sposta in alto', () => moveTrack(index, -1), index === 0));
      actions.append(createIconButton('↓', 'Sposta in basso', () => moveTrack(index, 1), index === tracks.length - 1));
      actions.append(createTrackDeckButtons(track, index));
      actions.append(createIconButton('×', 'Rimuovi dalla lista', () => removeTrack(index)));
      const isExecuted = String(brano.flag || '').toUpperCase() === 'X';
      const isVideoOnly = window.isVideoOnlyBrano?.(brano) || false;
      const executedButton = createRowButton(
        'ESEGUITO',
        isExecuted ? 'Brano già eseguito' : 'Segna il brano come eseguito nel Borderò',
        () => markTrackExecuted(track),
        isExecuted || isVideoOnly,
        true
      );
      executedButton.classList.add('mark-executed-button');
      actions.append(executedButton);
      row.append(actions);
      elements.selectionList.append(row);
    });

    renderArchive();
  }

  function addTrack(track) {
    const playlist = currentPlaylist();
    if (!playlist || !track.id) return;
    const exists = playlist.tracks.some((item) => String(item.branoId || item.id) === String(track.id));
    if (exists) return;

    playlist.tracks.push({
      id: String(track.id),
      branoId: String(track.id),
      deck: 1,
      brano: { ...track }
    });
    if (saveState()) {
      renderSelection();
      setActionStatus(`Aggiunto: ${displayNameOf(track)}`, 'success');
    }
  }

  function moveTrack(index, direction) {
    const tracks = currentPlaylist()?.tracks;
    const targetIndex = index + direction;
    if (!tracks || targetIndex < 0 || targetIndex >= tracks.length) return;
    [tracks[index], tracks[targetIndex]] = [tracks[targetIndex], tracks[index]];
    if (saveState()) renderSelection();
  }

  function removeTrack(index) {
    const tracks = currentPlaylist()?.tracks;
    if (!tracks || !tracks[index]) return;
    const [removed] = tracks.splice(index, 1);
    if (saveState()) {
      renderSelection();
      setActionStatus(`Rimosso: ${displayNameOf(removed)}`);
    }
  }

  function createPlaylist(name) {
    const cleanName = name.trim();
    if (!cleanName) return false;
    if (savedState.playlists.some((playlist) => playlist.name.toLowerCase() === cleanName.toLowerCase())) {
      setActionStatus('Esiste già una lista con questo nome.', 'error');
      return false;
    }
    const playlist = { id: createId(), name: cleanName, tracks: [] };
    savedState.playlists.push(playlist);
    savedState.selectedPlaylistId = playlist.id;
    if (!saveState()) return false;
    renderPlaylistPicker();
    renderSelection();
    setActionStatus(`Creata la lista “${cleanName}”.`, 'success');
    return true;
  }

  async function exportPlaylist() {
    const playlist = currentPlaylist();
    if (!playlist?.tracks.length) {
      setActionStatus('Aggiungi almeno un brano prima di esportare.', 'error');
      return;
    }
    elements.exportButton.disabled = true;
    setActionStatus('Associazione dei brani ai file audio in corso...');
    try {
      const lines = ['#EXTM3U'];
      const unmatched = [];
      for (const track of playlist.tracks) {
        try {
          const match = await resolveAudioFile(track);
          const title = displayNameOf(track).replace(/[\r\n,]/g, ' ').trim();
          lines.push(`#EXTINF:-1,${title}`);
          lines.push(match.fullPath);
        } catch (_) {
          unmatched.push(displayNameOf(track));
        }
      }
      if (lines.length === 1) throw new Error('Nessun brano della lista è associabile a un file audio.');
      const safeName = playlist.name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim() || 'Preselezione';
      const blob = new Blob([`\uFEFF${lines.join('\r\n')}\r\n`], { type: 'audio/x-mpegurl;charset=utf-8' });
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = `${safeName}.m3u8`;
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
      setActionStatus(`Esportati ${lines.length - 1} brani${unmatched.length ? `; non associati: ${unmatched.length}` : ''}.`, unmatched.length ? 'error' : 'success');
    } catch (error) {
      setActionStatus(error?.message || String(error), 'error');
    } finally {
      elements.exportButton.disabled = false;
    }
  }

  async function resolveAudioFile(track) {
    const brano = track.brano || track;
    const response = await fetch('/api/music-archive/match', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brano: {
        id: brano.id || track.branoId,
        titolo: brano.titolo,
        coreografia: brano.titolo,
        brano: brano.brano,
        autore: brano.autore
      } })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) throw new Error(result.error || 'Errore di ricerca nell’archivio audio.');
    if (result.status === 'exact' && result.match?.fullPath) return result.match;
    if (result.status === 'ambiguous') throw new Error(`Trovati più file per “${displayNameOf(track)}”. Verifica il brano dalla pagina Borderò prima di caricarlo.`);
    throw new Error(`File audio non trovato per “${displayNameOf(track)}”.`);
  }

  async function requestVirtualDj(script, timeoutMs = 4000) {
    const url = new URL('/api/vdj/proxy', window.location.origin);
    url.searchParams.set('baseUrl', VDJ_BASE_URLS[0]);
    url.searchParams.set('baseUrls', VDJ_BASE_URLS.join(','));
    url.searchParams.set('endpoint', '/execute');
    url.searchParams.set('script', script);
    url.searchParams.set('timeoutMs', String(timeoutMs));
    const response = await fetch(url, { cache: 'no-store' });
    const text = await response.text();
    if (!response.ok) throw new Error(text || `VirtualDJ ha risposto con HTTP ${response.status}`);
    return text.trim();
  }

  async function ensureVirtualDjRuntime() {
    const response = await fetch('/api/vdj/ensure-running', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ baseUrl: VDJ_BASE_URLS[0], baseUrls: VDJ_BASE_URLS.join(','), timeoutMs: 15000 }),
      cache: 'no-store'
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.ok) throw new Error(payload.error || `VirtualDJ non disponibile (HTTP ${response.status})`);
  }

  function isPlaying(value) {
    return ['true', '1', 'yes'].includes(String(value).trim().toLowerCase());
  }

  async function loadTrack(track, requestedDeck = Number(track.deck) === 2 ? 2 : 1) {
    const loadButtons = [...elements.selectionList.querySelectorAll('.row-actions .deck-load-button')];
    loadButtons.forEach((button) => { button.disabled = true; });
    setActionStatus('Connessione a VirtualDJ...', 'info');
    try {
      await ensureVirtualDjRuntime();
      const deck = requestedDeck === 2 ? 2 : 1;
      const deckIsPlaying = isPlaying(await requestVirtualDj(`deck ${deck} get_play`));
      if (deckIsPlaying) {
        throw new Error(`Il Deck ${deck} sta suonando. Scegli l'altro deck per caricare il brano.`);
      }

      const audioFile = await resolveAudioFile(track);
      const safePath = audioFile.fullPath.replace(/"/g, '\\"');
      await requestVirtualDj(`deck ${deck} load "${safePath}"`);
      setActionStatus(`Caricato su Deck ${deck}: ${displayNameOf(track)}`, 'success');
    } catch (error) {
      setActionStatus(`VirtualDJ: ${error?.message || error}`, 'error');
    } finally {
      loadButtons.forEach((button) => { button.disabled = false; });
    }
  }

  async function markTrackExecuted(track) {
    const brano = track.brano || track;
    if (window.isVideoOnlyBrano?.(brano)) {
      setActionStatus('I brani solo-video non possono essere segnati come eseguiti.', 'error');
      return;
    }
    if (String(brano.flag || '').toUpperCase() === 'X') return;

    const currentSerata = dataLoader.getCurrentSerata();
    const currentTracks = Array.isArray(currentSerata?.brani) && currentSerata.brani.length
      ? currentSerata.brani.map((item) => ({ ...item }))
      : archiveTracks.map((item) => ({ ...item }));
    const target = currentTracks.find((item) => String(item.id) === String(track.branoId || track.id));
    if (!target) {
      setActionStatus('Brano non trovato nella serata corrente.', 'error');
      return;
    }

    const timestamp = DateUtils.formatDate(new Date());
    target.flag = 'X';
    target.eseguito = 'X';
    target.executed = true;
    target.timestamp = timestamp;
    currentTracks.forEach((item) => {
      item.consoleStatus = '';
      item.consoleDeck = null;
    });

    const nextSelection = Storage.get('bordero_next_coreo_selection', null);
    if (target.next_selected || String(nextSelection?.id || '') === String(target.id)) {
      currentTracks.forEach((item) => { item.next_selected = false; });
      Storage.remove('bordero_next_coreo_selection');
      window.dispatchEvent(new Event('bordero:next-coreo-updated'));
    }

    const orderedTracks = [
      ...currentTracks
        .filter((item) => String(item.flag || '').toUpperCase() !== 'X')
        .sort((left, right) => (Number(left.originalIndex) || 0) - (Number(right.originalIndex) || 0)),
      ...currentTracks.filter((item) => String(item.flag || '').toUpperCase() === 'X')
    ];
    const metadata = currentSerata?.metadata || {};
    dataLoader.saveCurrentSerata(metadata, orderedTracks);
    Storage.set(BORDERO_CONFIG.CACHE_KEY_BRANI, orderedTracks);
    const flagged = Storage.get(BORDERO_CONFIG.CACHE_KEY_FLAGGED, []);
    if (!flagged.some((id) => String(id) === String(target.id))) {
      flagged.push(target.id);
      Storage.set(BORDERO_CONFIG.CACHE_KEY_FLAGGED, flagged);
    }

    archiveTracks = archiveTracks.map((item) => String(item.id) === String(target.id)
      ? { ...item, flag: 'X', eseguito: 'X', executed: true, timestamp }
      : item);
    savedState.playlists.forEach((playlist) => {
      playlist.tracks.forEach((item) => {
        if (String(item.branoId || item.id) === String(target.id)) {
          item.brano = { ...item.brano, flag: 'X', eseguito: 'X', executed: true, timestamp };
        }
      });
    });
    saveState();
    renderSelection();
    setActionStatus(`${displayNameOf(track)} segnato come eseguito.`, 'success');

    try {
      const selection = Storage.get('bordero_next_coreo_selection', null);
      const nextCoreo = String(selection?.title || selection?.nextValue || '--').trim() || '--';
      const response = await fetch('/api/bordero/cloud-sync-state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nextCoreo, serata: metadata, brani: orderedTracks })
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
    } catch (error) {
      console.warn('Impossibile sincronizzare lo stato serata sul cloud', error?.message || error);
    }
  }

  async function restoreTrack(track) {
    const trackId = String(track.id);
    const currentSerata = dataLoader.getCurrentSerata();
    const currentTracks = Array.isArray(currentSerata?.brani) && currentSerata.brani.length
      ? currentSerata.brani.map((item) => ({ ...item }))
      : archiveTracks.map((item) => ({ ...item }));
    const target = currentTracks.find((item) => String(item.id) === trackId);
    if (!target || String(target.flag || '').toUpperCase() !== 'X') {
      await refreshArchive();
      setActionStatus('Il brano risulta già disponibile.', 'info');
      return;
    }

    target.flag = '';
    target.eseguito = '';
    target.executed = false;
    target.timestamp = '';
    target.consoleStatus = '';
    target.consoleDeck = null;
    const orderedTracks = [
      ...currentTracks
        .filter((item) => String(item.flag || '').toUpperCase() !== 'X')
        .sort((left, right) => (Number(left.originalIndex) || 0) - (Number(right.originalIndex) || 0)),
      ...currentTracks.filter((item) => String(item.flag || '').toUpperCase() === 'X')
    ];
    const metadata = currentSerata?.metadata || {};
    dataLoader.saveCurrentSerata(metadata, orderedTracks);
    Storage.set(BORDERO_CONFIG.CACHE_KEY_BRANI, orderedTracks);
    Storage.set(
      BORDERO_CONFIG.CACHE_KEY_FLAGGED,
      Storage.get(BORDERO_CONFIG.CACHE_KEY_FLAGGED, []).filter((id) => String(id) !== trackId)
    );

    archiveTracks = archiveTracks.map((item) => String(item.id) === trackId
      ? { ...item, flag: '', eseguito: '', executed: false, timestamp: '' }
      : item);
    savedState.playlists.forEach((playlist) => {
      playlist.tracks.forEach((item) => {
        if (String(item.branoId || item.id) === trackId) {
          item.brano = { ...item.brano, flag: '', eseguito: '', executed: false, timestamp: '' };
        }
      });
    });
    saveState();
    renderSelection();
    setActionStatus(`${displayNameOf(track)} riportato tra i brani disponibili.`, 'success');

    try {
      const selection = Storage.get('bordero_next_coreo_selection', null);
      const nextCoreo = String(selection?.title || selection?.nextValue || '--').trim() || '--';
      const response = await fetch('/api/bordero/cloud-sync-state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nextCoreo, serata: metadata, brani: orderedTracks })
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
    } catch (error) {
      console.warn('Impossibile sincronizzare lo stato serata sul cloud', error?.message || error);
    }
  }

  async function refreshArchive() {
    setArchiveStatus('Lettura del database Borderò...');
    try {
      await dataLoader.initialize(false);
      const loadedTracks = await dataLoader.loadBrani({ silent: true });
      const currentSerata = dataLoader.getCurrentSerata();
      const executedMap = new Map((currentSerata?.brani || []).map((item) => [String(item.id), item]));
      archiveTracks = loadedTracks.map((track) => {
        const saved = executedMap.get(String(track.id));
        return saved && String(saved.flag || '').toUpperCase() === 'X'
          ? { ...track, flag: 'X', timestamp: saved.timestamp || track.timestamp }
          : track;
      });

      const byId = new Map(archiveTracks.map((track) => [String(track.id), track]));
      let changed = false;
      savedState.playlists.forEach((playlist) => {
        const updatedTracks = playlist.tracks
          .map((selected) => {
            const id = String(selected.branoId || selected.id || '');
            const brano = byId.get(id);
            if (!brano) return null;
            if (selected.brano !== brano) changed = true;
            return { id, branoId: id, deck: Number(selected.deck) === 2 ? 2 : 1, brano: { ...brano } };
          })
          .filter(Boolean);
        if (updatedTracks.length !== playlist.tracks.length) changed = true;
        playlist.tracks = updatedTracks;
      });
      if (changed) saveState();
      currentPage = 1;
      setArchiveStatus(`${archiveTracks.length} brani nel database · ${BORDERO_CONFIG.CSV_BRANI}`, 'success');
      renderArchive();
    } catch (error) {
      archiveTracks = [];
      renderArchive();
      setArchiveStatus(`Errore caricamento database Borderò: ${error?.message || error}`, 'error');
    }
  }

  elements.playlistSelect.addEventListener('change', () => {
    savedState.selectedPlaylistId = elements.playlistSelect.value;
    if (saveState()) {
      renderPlaylistPicker();
      renderSelection();
      setActionStatus(`Lista attiva: ${currentPlaylist().name}`);
    }
  });

  elements.newPlaylistButton.addEventListener('click', () => {
    elements.newPlaylistForm.hidden = !elements.newPlaylistForm.hidden;
    if (!elements.newPlaylistForm.hidden) elements.newPlaylistName.focus();
  });

  elements.cancelNewPlaylistButton.addEventListener('click', () => {
    elements.newPlaylistForm.hidden = true;
    elements.newPlaylistName.value = '';
  });

  elements.newPlaylistForm.addEventListener('submit', (event) => {
    event.preventDefault();
    if (createPlaylist(elements.newPlaylistName.value)) {
      elements.newPlaylistName.value = '';
      elements.newPlaylistForm.hidden = true;
    }
  });

  elements.deletePlaylistButton.addEventListener('click', () => {
    if (savedState.playlists.length < 2) return;
    const playlist = currentPlaylist();
    if (!window.confirm(`Eliminare la lista “${playlist.name}” e i suoi ${playlist.tracks.length} brani selezionati?`)) return;
    savedState.playlists = savedState.playlists.filter((item) => item.id !== playlist.id);
    savedState.selectedPlaylistId = savedState.playlists[0].id;
    if (saveState()) {
      renderPlaylistPicker();
      renderSelection();
      setActionStatus('Lista eliminata.');
    }
  });

  const sortButtons = {
    'btn-sort-id': 'id',
    'btn-sort-coreografo': 'coreografo',
    'btn-sort-autore': 'autore',
    'btn-sort-richieste': 'richieste'
  };
  Object.entries(sortButtons).forEach(([buttonId, field]) => {
    document.getElementById(buttonId).addEventListener('click', () => {
      currentSortDirection = currentSort === field && currentSortDirection === 'asc' ? 'desc' : 'asc';
      currentSort = field;
      currentPage = 1;
      renderArchive();
    });
  });

  const filterButtons = {
    'btn-filter-coreografia': ['info_livello', 'LIVELLO'],
    'btn-filter-livello': ['coreografo', 'COREOGRAFO'],
    'btn-filter-altro': ['autore', 'AUTORE'],
    'btn-filter-richieste': ['richieste', 'RICHIESTE']
  };
  Object.entries(filterButtons).forEach(([buttonId, [field, label]]) => {
    document.getElementById(buttonId).addEventListener('click', () => {
      if (currentFilters[field]) {
        delete currentFilters[field];
        currentPage = 1;
        renderArchive();
        return;
      }
      openFilterPicker(field, label);
    });
  });

  elements.archiveSearch.addEventListener('input', () => {
    currentPage = 1;
    renderArchive();
  });
  document.querySelectorAll('[data-search-mode]').forEach((button) => {
    button.addEventListener('click', () => {
      searchMode = button.dataset.searchMode;
      document.querySelectorAll('[data-search-mode]').forEach((item) => item.classList.toggle('is-active', item === button));
      currentPage = 1;
      renderArchive();
    });
  });
  document.getElementById('btn-reset-filters').addEventListener('click', () => {
    currentFilters = {};
    currentSearch = '';
    searchMode = 'general';
    currentSort = null;
    currentSortDirection = 'asc';
    currentPage = 1;
    elements.archiveSearch.value = '';
    document.querySelectorAll('[data-search-mode]').forEach((button) => button.classList.toggle('is-active', button.dataset.searchMode === 'general'));
    document.getElementById('filter-picker-modal').hidden = true;
    renderArchive();
    setActionStatus('Filtri, ricerca e ordinamento azzerati.');
  });
  document.getElementById('filter-picker-close').addEventListener('click', () => {
    document.getElementById('filter-picker-modal').hidden = true;
  });
  document.getElementById('filter-picker-search').addEventListener('input', renderFilterOptions);
  document.getElementById('filter-picker-modal').addEventListener('click', (event) => {
    if (event.target.id === 'filter-picker-modal') event.currentTarget.hidden = true;
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') document.getElementById('filter-picker-modal').hidden = true;
  });
  elements.catalogPrev.addEventListener('click', () => {
    currentPage = Math.max(1, currentPage - 1);
    renderArchive();
    elements.archiveList.scrollTop = 0;
  });
  elements.catalogNext.addEventListener('click', () => {
    currentPage = Math.min(Math.ceil(filteredTracks.length / ITEMS_PER_PAGE), currentPage + 1);
    renderArchive();
    elements.archiveList.scrollTop = 0;
  });
  elements.exportButton.addEventListener('click', exportPlaylist);
  elements.refreshButton.addEventListener('click', refreshArchive);
  renderPlaylistPicker();
  renderSelection();
  refreshArchive();
  window.addEventListener('storage', (event) => {
    if (event.key === BORDERO_CONFIG.CACHE_KEY_CURRENT_SERATA) refreshArchive();
  });
})();