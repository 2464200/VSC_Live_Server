// --- FILTRO ALFABETICO/NUMERICO ---
// Event listener globale per fallback statico
document.addEventListener('DOMContentLoaded', function() {
  const alfafilter = document.getElementById('alfabeto-filter');
  if (alfafilter) {
    alfafilter.addEventListener('click', function(e) {
      if (e.target.classList.contains('alfabeto-btn')) {
        setAlfabetoFilter(e.target.getAttribute('data-value'));
        evidenziaBtn(e.target.getAttribute('data-value'));
      }
    });
  }
});

// Funzione per verifica password
function verifyPassword(actionType) {
  const password = prompt('Inserisci password per confermare: ' + actionType);
  if (password === null) {
    // Utente ha premuto Annulla
    return false;
  }
  if (password !== '0000') {
    alert('Password errata. Verrai reindirizzato alla pagina principale.');
    goEventiPage('eventi.html');
    return false;
  }
  return true;
}

function renderAlfabetoFilter() {
  const container = document.getElementById('alfabeto-filter');
  if (!container) return;
  const lettere = [
    { label: '0-9', value: 'NUM' },
    ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(l => ({ label: l, value: l })),
    { label: 'TUTTE', value: 'ALL' }
  ];
  container.innerHTML = '';
  lettere.forEach(({ label, value }) => {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.className = 'alfabeto-btn';
    btn.setAttribute('data-value', value);
    btn.style = 'padding:7px 13px;margin:0 2px 0 0;border-radius:8px;border:1px solid #ff7f00;background:#fff;color:#ff7f00;font-weight:700;cursor:pointer;transition:background 0.2s;';
    btn.onclick = () => {
      setAlfabetoFilter(value);
      evidenziaBtn(value);
    };
    container.appendChild(btn);
  });
}
function salvaDJLocal(name) {
  localStorage.setItem('EVENTI_DJ', name || '');
  const saveBadge = document.getElementById('dj-saved');
  if (saveBadge) saveBadge.style.display = name ? 'inline-block' : 'none';
}

function getDJLocal() {
  return localStorage.getItem('EVENTI_DJ') || '';
}

const pageState = {
  allBrani: [],
  summaryBrani: [],
  visibleBrani: [],
  log: [],
  query: '',
  refreshTimer: null,
  addPanelOpen: false,
  eventSource: null
};

async function salvaStato(id, stato, addTimestamp = false) {
  const timestamp = new Date().toISOString();
  const response = await eventiFetch('/log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id,
      stato,
      dj: getDJLocal() || null,
      timestamp
    })
  });

  if (!response.ok) {
    throw new Error(`Salvataggio stato fallito (${response.status})`);
  }
}

async function resetEventTimes() {
  const response = await eventiFetch('/log/reset-times', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || `Reset date/orari fallito (${response.status})`);
  }

  return payload;
}

function getExtraCoreoElements() {
  return {
    panel: document.getElementById('extra-coreo-panel'),
    status: document.getElementById('extra-coreo-status'),
    titolo: document.getElementById('extra-titolo'),
    brano: document.getElementById('extra-brano'),
    autore: document.getElementById('extra-autore'),
    id: document.getElementById('extra-id'),
    saveBtn: document.getElementById('btn-save-coreo')
  };
}

function setExtraCoreoStatus(message, isError = false) {
  const { status } = getExtraCoreoElements();
  if (!status) return;
  status.hidden = false;
  status.className = `lista-empty${isError ? ' error' : ''}`;
  status.textContent = message;
}

function clearExtraCoreoStatus() {
  const { status } = getExtraCoreoElements();
  if (!status) return;
  status.hidden = true;
  status.textContent = '';
}

function clearExtraCoreoForm() {
  const { titolo, brano, autore, id } = getExtraCoreoElements();
  if (titolo) titolo.value = '';
  if (brano) brano.value = '';
  if (autore) autore.value = '';
  if (id) id.value = '';
  clearExtraCoreoStatus();
}

function toggleExtraCoreoPanel(forceOpen) {
  const { panel, titolo } = getExtraCoreoElements();
  if (!panel) return;
  const nextOpen = typeof forceOpen === 'boolean' ? forceOpen : !pageState.addPanelOpen;
  pageState.addPanelOpen = nextOpen;
  panel.hidden = !nextOpen;

  if (!nextOpen) {
    clearExtraCoreoForm();
    return;
  }

  clearExtraCoreoStatus();
  if (titolo) titolo.focus();
}

async function salvaNuovaCoreografia() {
  const { titolo, brano, autore, id, saveBtn } = getExtraCoreoElements();
  const payload = {
    titolo: titolo?.value || '',
    brano: brano?.value || '',
    autore: autore?.value || '',
    id: id?.value || ''
  };

  if (!payload.titolo.trim()) {
    setExtraCoreoStatus('Inserisci il nome della coreografia prima di salvare.', true);
    titolo?.focus();
    return;
  }

  const originalLabel = saveBtn ? saveBtn.textContent : '';
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent = 'Salvataggio...';
  }

  try {
    const response = await eventiFetch('/brani-extra', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Il server Eventi attivo non è aggiornato per il salvataggio delle nuove coreografie. Riapri la pagina su /eventi/eventi.html e prova di nuovo.');
      }
      throw new Error(data.error || `Inserimento fallito (${response.status})`);
    }

    await refreshPageData();
    pageState.query = data.entry?.titolo || payload.titolo;
    const searchInput = document.getElementById('search-input');
    if (searchInput) searchInput.value = pageState.query;
    applySearchAndRender();
    clearExtraCoreoForm();
    toggleExtraCoreoPanel(false);
    alert(`Coreografia salvata con ID ${data.entry.id}. Ora è disponibile nella lista.`);
  } catch (error) {
    setExtraCoreoStatus(error.message || 'Errore durante il salvataggio della nuova coreografia.', true);
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = originalLabel;
    }
  }
}

function renderSummaryCards(summary) {
  const container = document.getElementById('summary-cards');
  if (!container) return;

  container.innerHTML = `
    <div class="summary-card is-primary"><div class="summary-label">Totale</div><div class="summary-value">${summary.totale}</div></div>
    <div class="summary-card"><div class="summary-label">Disponibili</div><div class="summary-value">${summary.disponibile}</div></div>
    <div class="summary-card is-accent"><div class="summary-label">Prenotati</div><div class="summary-value">${summary.prenotato}</div></div>
    <div class="summary-card is-success"><div class="summary-label">Eseguiti</div><div class="summary-value">${summary.eseguito}</div></div>
  `;
}

function updateStatusInfo() {
  const lastUpdate = document.getElementById('last-update');
  if (lastUpdate) {
    lastUpdate.textContent = `Ultimo aggiornamento: ${EventiState.getLastUpdateLabel(pageState.log)}`;
  }
  renderSummaryCards(EventiState.summarizeBrani(pageState.summaryBrani));
}

function renderRows(brani) {
  const container = document.getElementById('lista-brani');
  if (!container) {
    showListaMessage('lista-brani', 'Errore critico: container non trovato nel documento.', true);
    return;
  }

  container.innerHTML = '';

  if (!brani || brani.length === 0) {
    showListaMessage('lista-brani', pageState.query ? 'Nessun risultato per la ricerca corrente.' : 'Nessuna coreografia disponibile in questa vista.');
    return;
  }

  brani.forEach((brano, index) => {
    const row = document.createElement('div');
    row.className = 'riga-brano';
    row.dataset.branoId = brano.id;
    row.innerHTML = `
      <span class="stato-pill">disponibile</span>
      <label>
        <input type="checkbox" class="checkbox-prenota" />
        <span class="titolo">
          <strong><span class="red-number">(${index + 1})</span> ${brano.titolo}</strong>
          <span class="muted">ID ${brano.id}${brano.brano ? ` - brano: ${brano.brano}` : ''}</span>
        </span>
      </label>
      <span class="timestamp">${brano.timestamp ? new Date(brano.timestamp).toLocaleString('it-IT') : '--'}</span>
    `;

    const checkbox = row.querySelector('.checkbox-prenota');
    checkbox.addEventListener('change', async () => {
      checkbox.disabled = true;
      row.style.opacity = '0.6';
      try {
        await salvaStato(brano.id, 'prenotato', false);
        await refreshPageData();
        window.location.href = 'prenotati.html';
      } catch (error) {
        checkbox.disabled = false;
        checkbox.checked = false;
        row.style.opacity = '1';
        showListaMessage('lista-brani', `Errore prenotazione: ${error.message}`, true);
      }
    });

    container.appendChild(row);
  });
}

function applySearchAndRender() {
  pageState.visibleBrani = EventiState.searchBrani(pageState.allBrani, pageState.query);
  renderRows(pageState.visibleBrani);
}

async function caricaDJList() {
  const djInput = document.getElementById('dj-input');
  if (!djInput) return;

  const djList = await fetchJSON('/dj');
  if (!Array.isArray(djList)) throw new Error('Formato DJ non valido');

  const current = getDJLocal();
  djInput.innerHTML = '<option value="">-- Seleziona DJ --</option>';
  djList.forEach(dj => {
    const option = document.createElement('option');
    option.value = dj.nome;
    option.textContent = dj.nome;
    djInput.appendChild(option);
  });

  if (current) {
    djInput.value = current;
    salvaDJLocal(current);
  }

  djInput.addEventListener('change', () => salvaDJLocal(djInput.value.trim()));
}

async function refreshPageData() {
  const [brani, log] = await Promise.all([
    fetchJSON(`/brani?ts=${Date.now()}`),
    fetchJSON(`/log?ts=${Date.now()}`)
  ]);

  if (!Array.isArray(brani) || !Array.isArray(log)) {
    throw new Error('Dati API non validi');
  }

  pageState.log = log;
  const decorated = EventiState.decorateBrani(brani, EventiState.buildLastStateMap(log));
  pageState.summaryBrani = decorated;
  pageState.allBrani = EventiState.filterBrani(decorated, 'disponibili');
  updateStatusInfo();
  applySearchAndRender();
}

function bindSearch() {
  const input = document.getElementById('search-input');
  if (!input) return;
  input.addEventListener('input', () => {
    pageState.query = input.value;
    applySearchAndRender();
  });
  if (isTouchDevice()) {
    input.addEventListener('click', showKeyboard);
  }
}

function bindExtraCoreoControls() {
  const openBtn = document.getElementById('btn-add-coreo');
  const cancelBtn = document.getElementById('btn-cancel-coreo');
  const saveBtn = document.getElementById('btn-save-coreo');
  const titleInput = document.getElementById('extra-titolo');

  if (openBtn) {
    openBtn.addEventListener('click', () => toggleExtraCoreoPanel());
  }

  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => toggleExtraCoreoPanel(false));
  }

  if (saveBtn) {
    saveBtn.addEventListener('click', salvaNuovaCoreografia);
  }

  if (titleInput) {
    titleInput.addEventListener('keydown', event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        salvaNuovaCoreografia();
      }
    });
  }
}

function startPolling() {
  if (pageState.refreshTimer) clearInterval(pageState.refreshTimer);
  pageState.refreshTimer = setInterval(async () => {
    if (!EventiState.shouldRefresh()) return;
    try {
      await refreshPageData();
    } catch (error) {
      console.error('Errore autorefresh:', error);
    }
  }, 15000);
}

// ===== CONFIGURAZIONE SSE CLIENT =====
const SSE_CLIENT_CONFIG = {
    maxRetries: 5,           // Numero massimo di retry prima di passare al polling
    initialRetryDelay: 3000, // Delay iniziale tra retry (ms)
    maxRetryDelay: 30000,    // Delay massimo tra retry (ms)
    heartbeatTimeout: 45000, // Timeout per heartbeat (ms) - deve essere > del server
    enablePollingFallback: true
};

let sseRetryCount = 0;
let sseLastError = null;
let sseReconnectTimer = null;

function startEventiStream() {
  if (typeof EventSource === 'undefined') {
    console.warn('EventSource non supportato dal browser; usiamo polling');
    if (SSE_CLIENT_CONFIG.enablePollingFallback) {
      console.log('Attivazione polling di fallback...');
      startPolling();
    }
    return;
  }

  // Chiudi eventuale connessione precedente
  if (pageState.eventSource) {
    try {
      pageState.eventSource.close();
    } catch (e) {}
    pageState.eventSource = null;
  }

  const url = `/eventi/api/stream?ts=${Date.now()}`;
  console.log(`🔌 Connessione SSE a: ${url}`);
  
  const source = new EventSource(url);
  pageState.eventSource = source;

  // Listener per eventi refresh dal server
  source.addEventListener('refresh', async () => {
    console.log('📥 Evento refresh ricevuto via SSE');
    if (!EventiState.shouldRefresh()) return;
    try {
      await refreshPageData();
    } catch (error) {
      console.error('Errore refresh SSE:', error);
    }
  });

  // Listener per heartbeat dal server
  source.addEventListener('heartbeat', (event) => {
    try {
      const data = JSON.parse(event.data);
      console.log(`💓 Heartbeat SSE: client attivi=${data.clients}, uptime=${data.uptime}s`);
    } catch (e) {
      console.log('💓 Heartbeat SSE ricevuto');
    }
  });

  // Gestione errori con retry intelligente
  source.addEventListener('error', (event) => {
    const status = event.target.readyState;
    let errorMsg = 'Connessione SSE chiusa';
    
    if (status === EventSource.CLOSED) {
      errorMsg = 'Connessione SSE chiusa (CLOSED)';
    } else if (status === EventSource.CONNECTING) {
      errorMsg = 'Connessione SSE in corso (CONNECTING)';
    } else if (status === 0) {
      errorMsg = 'Connessione SSE interrotta (status 0)';
    }
    
    console.warn(`⚠️ ${errorMsg}, tentativo ${sseRetryCount + 1}/${SSE_CLIENT_CONFIG.maxRetries}`);
    sseLastError = errorMsg;
    
    // Chiudi la sorgente
    if (pageState.eventSource) {
      try {
        pageState.eventSource.close();
      } catch (e) {}
      pageState.eventSource = null;
    }
    
    // Calcola delay crescente per retry
    const retryDelay = Math.min(
      SSE_CLIENT_CONFIG.initialRetryDelay * Math.pow(2, sseRetryCount),
      SSE_CLIENT_CONFIG.maxRetryDelay
    );
    
    if (sseRetryCount < SSE_CLIENT_CONFIG.maxRetries) {
      sseRetryCount++;
      console.log(`⏳ Riconnessione SSE tra ${retryDelay}ms...`);
      
      // Cancella timer precedente
      if (sseReconnectTimer) clearTimeout(sseReconnectTimer);
      
      sseReconnectTimer = setTimeout(() => {
        startEventiStream();
      }, retryDelay);
    } else {
      // Superato il numero massimo di retry
      console.error(`❌ Superati ${SSE_CLIENT_CONFIG.maxRetries} tentativi di riconnessione SSE`);
      
      if (SSE_CLIENT_CONFIG.enablePollingFallback) {
        console.log('🔄 Attivazione polling di fallback...');
        startPolling();
      } else {
        showListaMessage('lista-brani', 'Connessione al server persa. Ricarica la pagina per riprovare.', true);
      }
    }
  });

  // Connessione stabilita
  source.onopen = () => {
    console.log('✅ Connessione SSE stabilita');
    sseRetryCount = 0;
    sseLastError = null;
    if (sseReconnectTimer) {
      clearTimeout(sseReconnectTimer);
      sseReconnectTimer = null;
    }
  };
}

async function carica() {
  showListaMessage('lista-brani', 'Caricamento coreografie...');

  const serverOnline = await checkServerOnline();
  if (!serverOnline) {
    showListaMessage('lista-brani', 'Server Eventi non raggiungibile. Verifica che l’applicazione sia servita dall’indirizzo corretto e apri la diagnostica Eventi in rete.', true);
    return;
  }
  // Se l'URL contiene #inserimento, apri automaticamente il pannello di inserimento
  if (window.location.hash === '#inserimento') {
    const panel = document.getElementById('extra-coreo-panel');
    if (panel) {
      panel.hidden = false;
    }
    // Rimuovi l'hash per evitare riapertura dopo refresh
    history.replaceState(null, '', window.location.pathname);
  }
  try {
    await caricaDJList();
    bindSearch();
    createKeyboard();
    bindExtraCoreoControls();

    const exportBtn = document.getElementById('btn-export');
    if (exportBtn) {
      exportBtn.addEventListener('click', async () => {
        // Verifica password prima di procedere
        if (!verifyPassword('Esporta CSV per SIAE')) {
          return;
        }
        try {
          const result = await fetchJSON(`/export-csv?siae=1&ts=${Date.now()}`);
          alert('CSV SIAE generato. URL: ' + result.csv);
        } catch (error) {
          console.error('Errore export CSV SIAE:', error);
          alert('Errore durante export CSV SIAE.');
        }
      });
    }

    const resetBtn = document.getElementById('btn-reset-times');
    if (resetBtn) {
      resetBtn.addEventListener('click', async () => {
        // Verifica password prima di procedere
        if (!verifyPassword('Reset date e orari')) {
          return;
        }

        const confirmed = window.confirm(
          'Vuoi resettare date e orari del modulo Eventi per iniziare un nuovo evento?\n\n' +
          "L'operazione azzera la cronologia corrente delle coreografie eseguite/prenotate e riporta la lista alla situazione iniziale."
        );

        if (!confirmed) {
          return;
        }

        resetBtn.disabled = true;
        const originalLabel = resetBtn.textContent;
        resetBtn.textContent = 'Reset in corso...';

        try {
          const result = await resetEventTimes();
          await refreshPageData();
          alert(result.message || 'Date e orari resettati con successo.');
        } catch (error) {
          console.error('Errore reset date/orari:', error);
          alert(`Errore durante il reset: ${error.message}`);
        } finally {
          resetBtn.disabled = false;
          resetBtn.textContent = originalLabel;
        }
      });
    }

    await refreshPageData();
    startEventiStream();
    startPolling();
  } catch (error) {
    console.error('Errore caricamento iniziale:', error);
    showListaMessage('lista-brani', 'Errore caricamento coreografie: ' + (error.message || 'Controlla la connessione con il server.'), true);
  }
}

let shiftActive = false;

// Tastiera virtuale
function isTouchDevice() {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0 || /iPad|iPhone|iPod/.test(navigator.userAgent);
}

function createKeyboard() {
  const keyboard = document.getElementById('keyboard');
  const rows = [
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
    ['Z', 'X', 'C', 'V', 'B', 'N', 'M']
  ];

  let html = '';
  
  // Righe lettere
  rows.forEach((row, idx) => {
    html += '<div class="keyboard-row">';
    if (idx === 2) html += '<button class="key shift" data-action="shift">MAIUSC</button>';
    
    row.forEach(key => {
      html += '<button class="key" data-char="' + key + '">' + key + '</button>';
    });
    
    if (idx === 2) html += '<button class="key backspace" data-action="backspace">⌫</button>';
    html += '</div>';
  });

  // Riga spazio + invio
  html += '<div class="keyboard-row">';
  html += '<button class="key space" data-char=" ">SPAZIO</button>';
  html += '<button class="key enter" data-action="submit">INVIO</button>';
  html += '</div>';

  // Numeri
  html += '<div class="keyboard-row">';
  for (let i = 0; i <= 9; i++) {
    html += '<button class="key" data-char="' + i + '">' + i + '</button>';
  }
  html += '</div>';

  keyboard.innerHTML = html;

  // Event listeners - con controlli di sicurezza
  document.querySelectorAll('[data-char]').forEach(btn => {
    btn.addEventListener('click', () => addChar(btn.dataset.char));
  });
  
  const shiftBtn = document.querySelector('[data-action="shift"]');
  if (shiftBtn) {
    shiftBtn.addEventListener('click', toggleShift);
  }
  
  const backspaceBtn = document.querySelector('[data-action="backspace"]');
  if (backspaceBtn) {
    backspaceBtn.addEventListener('click', backspace);
  }
  
  const submitBtn = document.querySelector('[data-action="submit"]');
  if (submitBtn) {
    submitBtn.addEventListener('click', () => {
      // Per la ricerca, invio chiude la tastiera
      document.getElementById('keyboard').classList.remove('active');
    });
  }
}

function showKeyboard() {
  document.getElementById('keyboard').classList.toggle('active');
  if (document.getElementById('keyboard').classList.contains('active')) {
    document.getElementById('search-input').focus();
  }
}

function toggleShift() {
  shiftActive = !shiftActive;
  const keys = document.querySelectorAll('.key:not(.shift):not(.backspace):not(.space):not(.enter)');
  keys.forEach(key => {
    if (key.textContent.length === 1) {
      key.textContent = shiftActive ? key.textContent.toUpperCase() : key.textContent.toLowerCase();
    }
  });
  const shiftBtn = document.querySelector('.shift');
  if (shiftBtn) {
    shiftBtn.classList.toggle('active');
  }
}

function addChar(char) {
  const input = document.getElementById('search-input');
  if (shiftActive && char.match(/[a-z]/i)) {
    input.value += char.toUpperCase();
    // Disattiva shift dopo un carattere
    if (shiftActive) toggleShift();
  } else {
    input.value += char;
  }
  input.focus();
  // Trigger input event to update search
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function backspace() {
  const input = document.getElementById('search-input');
  input.value = input.value.slice(0, -1);
  input.focus();
  // Trigger input event
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

window.addEventListener('DOMContentLoaded', carica);

// --- FILTRO ALFABETICO/NUMERICO ---
function renderAlfabetoFilter() {
  const container = document.getElementById('alfabeto-filter');
  if (!container) return;
  const lettere = [
    { label: '0-9', value: 'NUM' },
    ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(l => ({ label: l, value: l })),
    { label: 'TUTTE', value: 'ALL' }
  ];
  container.innerHTML = '';
  lettere.forEach(({ label, value }) => {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.className = 'alfabeto-btn';
    btn.setAttribute('data-value', value);
    btn.style = 'padding:7px 13px;margin:0 2px 0 0;border-radius:8px;border:1px solid #ff7f00;background:#fff;color:#ff7f00;font-weight:700;cursor:pointer;transition:background 0.2s;';
    btn.onclick = () => {
      setAlfabetoFilter(value);
      evidenziaBtn(value);
    };
    container.appendChild(btn);
  });
}

function setAlfabetoFilter(val) {
  pageState.alfabetoFilter = val;
  applySearchAndRender();
}

function evidenziaBtn(val) {
  document.querySelectorAll('.alfabeto-btn').forEach(btn => {
    btn.style.background = (btn.getAttribute('data-value') === val) ? '#ff7f00' : '#fff';
    btn.style.color = (btn.getAttribute('data-value') === val) ? '#fff' : '#ff7f00';
  });
}

// Override rendering per filtro
const _oldApplySearchAndRender = applySearchAndRender;
applySearchAndRender = function() {
  let brani = EventiState.searchBrani(pageState.allBrani, pageState.query);
  if (pageState.alfabetoFilter && pageState.alfabetoFilter !== 'ALL') {
    if (pageState.alfabetoFilter === 'NUM') {
      brani = brani.filter(b => /^[0-9]/.test(b.titolo));
    } else {
      const letter = pageState.alfabetoFilter;
      brani = brani.filter(b => (b.titolo || '').toUpperCase().startsWith(letter));
    }
  }
  pageState.visibleBrani = brani;
  renderRows(brani);
};

// Inizializza barra filtro all'avvio
const _oldCarica = carica;
carica = async function() {
  renderAlfabetoFilter();
  _oldCarica.apply(this, arguments);
  evidenziaBtn('ALL');
};
