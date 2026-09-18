const aggiuntiveState = {
  allCoreografie: [],
  visibleCoreografie: [],
  query: '',
  editingId: null,
  searchBound: false
};

async function loadCoreografieAggiuntive() {
  const paths = [
    '/Eventi/Coreografie_Aggiuntive.csv',
    '/eventi/Coreografie_Aggiuntive.csv'
  ];

  for (const basePath of paths) {
    try {
      const response = await fetch(`${basePath}?t=${Date.now()}`, { cache: 'no-store' });
      if (!response.ok) {
        continue;
      }
      const text = await response.text();
      return parseCoreografieCSV(text);
    } catch (error) {
      console.warn(`Tentativo fallito per ${basePath}:`, error.message);
    }
  }

  console.error('Errore caricamento CSV: file Coreografie_Aggiuntive.csv non trovato in nessun percorso valido');
  return [];
}

function parseCSVLine(line, delimiter = ',') {
  const result = [];
  let current = '';
  let insideQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === delimiter && !insideQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

function parseCoreografieCSV(text) {
  const lines = text.split('\n').slice(1).filter(line => line.trim());
  const coreografie = [];

  if (lines.length === 0) {
    return coreografie;
  }

  const sample = lines.find(line => line.trim()) || '';
  const delimiter = sample.includes(',') && (!sample.includes(';') || sample.indexOf(',') < sample.indexOf(';')) ? ',' : ';';

  lines.forEach((line, index) => {
    const parts = parseCSVLine(line, delimiter).map(part => part.replace(/^"|"$/g, '').trim());
    if (parts.length > 2 && parts[2]) {
      coreografie.push({
        id: parts[2],
        coreografia: parts[3] || '',
        brano: parts[4] || '',
        autore: parts[5] || '',
        lineIndex: index
      });
    }
  });

  return coreografie;
}

function renderCoreografie(container, coreografie) {
  container.innerHTML = '';

  if (!coreografie || coreografie.length === 0) {
    container.innerHTML = '<div class="lista-empty">Nessuna coreografia aggiuntiva trovata.</div>';
    return;
  }

  coreografie.forEach((item, index) => {
    const row = document.createElement('div');
    row.className = 'riga-brano aggiuntiva';
    row.dataset.coreoId = item.id;

    const editButton = document.createElement('button');
    editButton.className = 'edit-btn';
    editButton.textContent = 'Modifica';
    editButton.addEventListener('click', () => {
      openEditModal(item.id, item.coreografia, item.brano, item.autore);
    });

    const deleteButton = document.createElement('button');
    deleteButton.className = 'delete-btn';
    deleteButton.textContent = 'Elimina';
    deleteButton.addEventListener('click', () => {
      deleteCoreografia(item);
    });

    const actionGroup = document.createElement('div');
    actionGroup.className = 'action-inline';
    actionGroup.appendChild(editButton);
    actionGroup.appendChild(deleteButton);

    const titolo = document.createElement('span');
    titolo.className = 'titolo';
    titolo.innerHTML = `
      <strong><span class="red-number">(${index + 1})</span> ${item.coreografia}</strong>
      <span class="muted">ID ${item.id}${item.brano ? ` - brano: ${item.brano}` : ''}${item.autore ? ` - autore: ${item.autore}` : ''}</span>
    `;

    const pill = document.createElement('span');
    pill.className = 'stato-pill';
    pill.textContent = 'Aggiuntiva';

    row.appendChild(pill);
    row.appendChild(titolo);
    row.appendChild(actionGroup);

    container.appendChild(row);
  });
}

function escapeQuotes(str) {
  return (str || '').replace(/'/g, "\\'").replace(/"/g, '\\"');
}

function openEditModal(id, coreografia, brano, autore) {
  document.getElementById('edit-id').value = id;
  document.getElementById('edit-coreografia').value = coreografia;
  document.getElementById('edit-brano').value = brano;
  document.getElementById('edit-autore').value = autore;
  aggiuntiveState.editingId = id;
  document.getElementById('edit-modal').hidden = false;
}

function closeEditModal() {
  document.getElementById('edit-modal').hidden = true;
  aggiuntiveState.editingId = null;
  document.getElementById('edit-status').hidden = true;
}

async function saveEdit() {
  const id = document.getElementById('edit-id').value;
  const coreografia = document.getElementById('edit-coreografia').value.trim();
  const brano = document.getElementById('edit-brano').value.trim();
  const autore = document.getElementById('edit-autore').value.trim();

  console.log('saveEdit() called with:', { id, coreografia, brano, autore });

  if (!coreografia) {
    showEditStatus('Coreografia è obbligatoria', true);
    return;
  }

  const statusDiv = document.getElementById('edit-status');
  statusDiv.textContent = 'Salvataggio in corso...';
  statusDiv.hidden = false;

  const payload = { id, coreografia, brano, autore };

  try {
    const response = await eventiFetch('/aggiuntive/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    console.log('Response status:', response.status, 'OK:', response.ok);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error response:', response.status, errorText);
      throw new Error(`Errore salvataggio (${response.status})`);
    }

    const result = await response.json();
    console.log('Success response:', result);

    showEditStatus('Coreografia aggiornata con successo', false);
    setTimeout(() => {
      closeEditModal();
      renderCoreografieAggiuntive();
    }, 800);
  } catch (error) {
    console.error('Catch error:', error.message);
    showEditStatus(`Errore: ${error.message}`, true);
  }
}

async function deleteCoreografia(item) {
  const conferma = window.confirm(`Vuoi eliminare la coreografia aggiuntiva "${item.coreografia}"?`);
  if (!conferma) {
    return;
  }

  try {
    let response;

    try {
      response = await eventiFetch('/aggiuntive/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id })
      });
    } catch (postError) {
      console.warn('Fallback DELETE dopo POST non riuscito:', postError.message);
      response = await eventiFetch(`/aggiuntive/${encodeURIComponent(item.id)}`, {
        method: 'DELETE'
      });
    }

    if (!response.ok) {
      let message = `Errore eliminazione (${response.status})`;
      try {
        const errorBody = await response.json();
        if (errorBody?.error) {
          message = errorBody.error;
        }
      } catch (_error) {
        // Mantieni il messaggio di fallback se la risposta non è JSON.
      }
      throw new Error(message);
    }

    await response.json();
    await renderCoreografieAggiuntive();
  } catch (error) {
    console.error('Errore deleteCoreografia:', error.message);
    window.alert(`Errore durante l'eliminazione: ${error.message}`);
  }
}

function showEditStatus(message, isError) {
  const statusDiv = document.getElementById('edit-status');
  statusDiv.textContent = message;
  statusDiv.hidden = false;
  statusDiv.style.color = isError ? '#dc3545' : '#28a745';
}

function bindSearchAggiuntive() {
  const input = document.getElementById('search-input');
  if (!input || aggiuntiveState.searchBound) return;

  EventiSearch.bindSearchInput(input, value => {
    aggiuntiveState.query = value;
    applySearchAggiuntive();
  });

  aggiuntiveState.searchBound = true;
}

function applySearchAggiuntive() {
  const query = aggiuntiveState.query.toLowerCase();
  aggiuntiveState.visibleCoreografie = aggiuntiveState.allCoreografie.filter(item => {
    const haystack = `${item.coreografia || ''} ${item.brano || ''} ${item.autore || ''}`.toLowerCase();
    return haystack.includes(query);
  });
  renderCoreografie(document.getElementById('lista-render'), aggiuntiveState.visibleCoreografie);
}

function updateLastUpdate() {
  const badge = document.getElementById('last-update');
  if (badge) {
    badge.textContent = `Ultimo aggiornamento: ${new Date().toLocaleString('it-IT')}`;
  }
}

async function renderCoreografieAggiuntive() {
  const container = document.getElementById('lista-render');
  if (!container) return;

  try {
    aggiuntiveState.allCoreografie = await loadCoreografieAggiuntive();
    bindSearchAggiuntive();
    applySearchAggiuntive();
    updateLastUpdate();
    setupModalEventListeners();

    // Assicurati che il modal rimanga nascosto al caricamento della pagina
    // La maschera di modifica si apre solo quando l'utente clicca il pulsante "Modifica"
    const modal = document.getElementById('edit-modal');
    if (modal) {
      modal.hidden = true;
    }
    renderAlfabetoFilterAggiuntive();
    evidenziaBtnAggiuntive('ALL');
  } catch (error) {
    console.error('Errore renderCoreografieAggiuntive:', error);
    container.innerHTML = `<div class="lista-empty">Errore caricamento dati: ${error.message}</div>`;
  }
}

// --- FILTRO ALFABETICO/NUMERICO ---
function renderAlfabetoFilterAggiuntive() {
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
    btn.onclick = () => {
      setAlfabetoFilterAggiuntive(value);
      evidenziaBtnAggiuntive(value);
    };
    container.appendChild(btn);
  });
}

function setAlfabetoFilterAggiuntive(val) {
  aggiuntiveState.alfabetoFilter = val;
  applySearchAggiuntive();
}

function evidenziaBtnAggiuntive(val) {
  document.querySelectorAll('.alfabeto-btn').forEach(btn => {
    btn.classList.toggle('selected', btn.getAttribute('data-value') === val);
  });
}

// Event listener globale per fallback statico
document.addEventListener('DOMContentLoaded', function() {
  const alfafilter = document.getElementById('alfabeto-filter');
  if (alfafilter) {
    alfafilter.addEventListener('click', function(e) {
      if (e.target.classList.contains('alfabeto-btn')) {
        setAlfabetoFilterAggiuntive(e.target.getAttribute('data-value'));
        evidenziaBtnAggiuntive(e.target.getAttribute('data-value'));
      }
    });
  }
});

// Override rendering per filtro
const _oldApplySearchAggiuntive = applySearchAggiuntive;
applySearchAggiuntive = function() {
  let coreografie = aggiuntiveState.allCoreografie;
  const query = aggiuntiveState.query ? aggiuntiveState.query.toLowerCase() : '';
  if (query) {
    coreografie = coreografie.filter(item => {
      const haystack = `${item.coreografia || ''} ${item.brano || ''} ${item.autore || ''}`.toLowerCase();
      return haystack.includes(query);
    });
  }
  if (aggiuntiveState.alfabetoFilter && aggiuntiveState.alfabetoFilter !== 'ALL') {
    if (aggiuntiveState.alfabetoFilter === 'NUM') {
      coreografie = coreografie.filter(b => /^[0-9]/.test(b.coreografia));
    } else {
      const letter = aggiuntiveState.alfabetoFilter;
      coreografie = coreografie.filter(b => (b.coreografia || '').toUpperCase().startsWith(letter));
    }
  }
  aggiuntiveState.visibleCoreografie = coreografie;
  renderCoreografie(document.getElementById('lista-render'), coreografie);
};

function setupModalEventListeners() {
  const btnSave = document.getElementById('btn-save-edit');
  const btnCancel = document.getElementById('btn-cancel-edit');
  const btnClose = document.getElementById('btn-modal-close');

  // Evita listener duplicati aggiungendo handler una sola volta
  if (btnSave && !btnSave._listenerAttached) {
    btnSave.addEventListener('click', saveEdit);
    btnSave._listenerAttached = true;
  }
  if (btnCancel && !btnCancel._listenerAttached) {
    btnCancel.addEventListener('click', closeEditModal);
    btnCancel._listenerAttached = true;
  }
  if (btnClose && !btnClose._listenerAttached) {
    btnClose.addEventListener('click', closeEditModal);
    btnClose._listenerAttached = true;
  }
}

window.renderCoreografieAggiuntive = renderCoreografieAggiuntive;
window.openEditModal = openEditModal;
window.closeEditModal = closeEditModal;
window.saveEdit = saveEdit;
