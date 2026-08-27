/* ===========================
   RIFERIMENTI AGLI ELEMENTI / STATO
   =========================== */

// Riferimenti agli elementi del DOM
const dataBody        = document.getElementById('data-body');
const speedInput      = document.getElementById('speed');
const pauseInput      = document.getElementById('pause');
const stopButton      = document.getElementById('stopScroll');
const resumeButton    = document.getElementById('resumeScroll');
const menuPanel       = document.getElementById('menuPanel');
const loader          = document.getElementById('loader');
const scrollContainer = document.getElementById('scrollContainer');
const speedValue      = document.getElementById('speedValue');
const pauseValue      = document.getElementById('pauseValue');

// Variabili di stato per lo scroll automatico
let direction     = 1;        // 1 = verso il basso, -1 = verso l’alto
let pauseTime     = 2000;     // pausa ai bordi (in ms)
let isScrolling   = true;     // indica se lo scroll è attivo
let rafHandle;                // handle di requestAnimationFrame
let lastTimestamp = 0;        // per calcolare il delta tempo tra frame

// Dati coreografie per le card (display.csv)
let choreographies = [];
const MAX_ROWS = 600;
const REFRESH_MS = 30000;
let refreshTimeoutId = null;

// --- util: robust CSV parser (handles quoted fields with commas/newlines)
function parseCSV(text) {
  const rows = [];
  let cur = '';
  let row = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cur += '"'; i++; } else { inQuotes = false; }
      } else { cur += ch; }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ',') { row.push(cur); cur = ''; }
      else if (ch === '\r') { continue; }
      else if (ch === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
      else { cur += ch; }
    }
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  return rows;
}

async function fetchWithTimeoutAndRetry(url, opts = {}, timeout = 10000, retries = 2) {
  let attempt = 0;
  while (true) {
    attempt++;
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
      const res = await fetch(url, { ...opts, signal: controller.signal });
      clearTimeout(id);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res;
    } catch (err) {
      clearTimeout(id);
      if (attempt > retries) throw err;
      await new Promise(r => setTimeout(r, 500 * attempt));
    }
  }
}

/* ===========================
   MENU E SCHERMO INTERO
   =========================== */

function toggleMenu() {
  if (!menuPanel) return;
  menuPanel.classList.toggle('active');
}

function toggleFullscreen() {
  const target = document.documentElement || document.body;
  if (!document.fullscreenElement) {
    const request = target.requestFullscreen?.() || target.webkitRequestFullscreen?.() || target.msRequestFullscreen?.();
    Promise.resolve(request).catch((err) => console.log('Errore fullscreen:', err));
  } else if (document.exitFullscreen) {
    document.exitFullscreen();
  }
}

function updateControlsUI() {
  if (speedInput && speedValue) speedValue.textContent = String(speedInput.value);
  if (pauseInput && pauseValue) pauseValue.textContent = String(pauseInput.value);
}

if (speedInput) {
  speedInput.addEventListener('input', () => {
    updateControlsUI();
    restartScrolling();
  });
}

if (pauseInput) {
  pauseInput.addEventListener('input', () => {
    pauseTime = Number(pauseInput.value) * 1000;
    updateControlsUI();
  });
}

if (stopButton) {
  stopButton.addEventListener('click', () => {
    isScrolling = false;
    cancelAnimationFrame(rafHandle);
  });
}

if (resumeButton) {
  resumeButton.addEventListener('click', () => {
    isScrolling = true;
    startScrolling();
  });
}


/* ===========================
   SCROLL FLUIDO CON requestAnimationFrame
   =========================== */

/**
 * Avvia lo scroll automatico del contenitore.
 * Usa requestAnimationFrame per sincronizzarsi con il refresh del display (scroll fluido).
 */
function startScrolling() {
  if (!isScrolling || !scrollContainer) return;
  cancelAnimationFrame(rafHandle);
  lastTimestamp = performance.now();
  rafHandle = requestAnimationFrame(stepScroll);
}

/**
 * Singolo “passo” di scroll calcolato in base al tempo trascorso.
 * La velocità è espressa in pixel/secondo e modulata dallo slider.
 */
function stepScroll(timestamp) {
  if (!isScrolling) return;

  const delta = timestamp - lastTimestamp; // ms trascorsi dal frame precedente
  lastTimestamp = timestamp;

  // Velocità in px/s: aumentiamo il moltiplicatore per maggiore fluidità
  // Esempio: slider 18 -> 18 * 30 = 540 px/s
  const pixelsPerSecond = parseInt(speedInput?.value || '18', 10) * 10;
  const move = (pixelsPerSecond * delta) / 1000; // pixel da muovere in questo frame

  scrollContainer.scrollTop += direction * move;

  // Controllo fondo
  const atBottom = scrollContainer.scrollTop + scrollContainer.clientHeight >= scrollContainer.scrollHeight;
  if (atBottom) {
    direction = -1;
    // Pausa ai bordi
    setTimeout(() => { if (isScrolling) startScrolling(); }, pauseTime);
    return;
  }

  // Controllo inizio
  const atTop = scrollContainer.scrollTop <= 0;
  if (atTop) {
    direction = 1;
    // Pausa ai bordi
    setTimeout(() => { if (isScrolling) startScrolling(); }, pauseTime);
    return;
  }

  rafHandle = requestAnimationFrame(stepScroll);
}

/**
 * Riavvia lo scroll applicando subito il nuovo intervallo/velocità.
 */
function restartScrolling() {
  cancelAnimationFrame(rafHandle);
  startScrolling();
}

/* ===========================
   CARICAMENTO DELLE COREOGRAFIE (display.csv)
   =========================== */

/**
 * Crea la card HTML di una singola coreografia e la aggiunge al contenitore.
 */
function createChoreoCard(choreo) {
  const card = document.createElement('div');
  card.className = 'choreo-card' + (choreo.executed ? ' executed' : '');

  card.innerHTML = `
    <div class="choreo-header">
      <div class="choreo-number">${choreo.executed ? '✓' : '#' + choreo.number}</div>
      <div class="choreo-id">ID ${choreo.id}</div>
    </div>
    <div class="choreo-title">
      ${choreo.name}
    </div>
    <div class="choreo-details">
      <div class="detail-row">
        <span class="detail-icon">🎵</span>
        <span class="detail-label">Brano / Autore:</span>
        <span class="detail-value">${choreo.song || '--'}${choreo.author ? ` / ${choreo.author}` : ''}</span>
      </div>
      <div class="detail-row">
        <span class="detail-icon">💃</span>
        <span class="detail-label">Coreografo:</span>
        <span class="detail-value">${choreo.choreographer || '--'}</span>
      </div>
    </div>
  `;
  dataBody.appendChild(card);
}

/**
 * Carica la stessa sorgente dati del DISPLAY e mostra solo i brani richiesti.
 * La prima riga di brani.csv contiene le intestazioni delle colonne.
 */
async function loadDisplayCsv() {
  try {
    const dataUrl = window.resolveAppUrl
      ? window.resolveAppUrl('brani.csv?t=' + Date.now())
      : 'brani.csv?t=' + Date.now();
    const res = await fetchWithTimeoutAndRetry(dataUrl, { cache: 'no-store' }, 12000, 2);
    const text = await res.text();
    const rows = parseCSV(text);
    const dataRows = rows.slice(1).filter(r => {
      const requests = String(r[7] || '').trim().replace(',', '.');
      return r.length && r.some(c => c !== '') && requests && requests !== '-' && Number(requests) !== 0;
    });

    choreographies = [];
    dataBody.innerHTML = '';

    let toRender = dataRows;
    if (dataRows.length > MAX_ROWS) {
      toRender = dataRows.slice(0, MAX_ROWS);
      console.warn(`Dataset troppo grande: visualizzo prime ${MAX_ROWS} righe`);
    }

    toRender.forEach((cols, index) => {
      const normalized = cols.map(c => String(c || '').trim().replace(/^"+|"+$/g, ''));
      if (normalized.length >= 2) {
        const isExecuted = String(normalized[0]).toUpperCase().startsWith('X');
        const choreo = {
          number: index + 1,
          mark: normalized[0],
          id: normalized[2],
          name: normalized[3],
          song: normalized[4],
          author: normalized[5],
          choreographer: normalized[12],
          executed: isExecuted
        };
        choreographies.push(choreo);
        createChoreoCard(choreo);
      }
    });

    loader.classList.add('hidden');
    startScrolling();
  } catch (err) {
    console.error('Errore caricamento display.csv:', err);
    loader.innerHTML = '<p style="color: #e74c3c;">❌ Errore nel caricamento dei dati</p>';
  }
}

/* ===========================
   GESTI TOUCH / UX DEL MENU
   =========================== */

/**
 * Chiude il menu quando si clicca/tocca fuori dal pannello.
 */
if (menuPanel) {
  menuPanel.addEventListener('click', (e) => {
    if (e.target === menuPanel) toggleMenu();
  });

  // Previene lo scroll del corpo quando il menu è aperto (utile su mobile)
  menuPanel.addEventListener('touchmove', (e) => {
    e.preventDefault();
  }, { passive: false });
}

/**
 * Gesture swipe per aprire/chiudere il menu (mobile).
 */
let touchStartX = 0;
let touchEndX   = 0;

document.addEventListener('touchstart', e => {
  touchStartX = e.changedTouches[0].screenX;
});

document.addEventListener('touchend', e => {
  touchEndX = e.changedTouches[0].screenX;
  handleSwipe();
});

function handleSwipe() {
  const swipeThreshold = 100;

  // Swipe verso sinistra: chiudi il menu se aperto
  if (touchEndX < touchStartX - swipeThreshold) {
    if (menuPanel.classList.contains('active')) toggleMenu();
  }

  // Swipe verso destra: apri il menu se chiuso
  if (touchEndX > touchStartX + swipeThreshold) {
    if (!menuPanel.classList.contains('active')) toggleMenu();
  }
}

function aggiornaDataEOra() {
  const el = document.getElementById("dateTime") || document.getElementById("data-ora");
  if (!el) return;
  const ora = new Date();
  const giorno = String(ora.getDate()).padStart(2, '0');
  const mese = String(ora.getMonth() + 1).padStart(2, '0');
  const anno = ora.getFullYear();
  const ore = String(ora.getHours()).padStart(2, '0');
  const minuti = String(ora.getMinutes()).padStart(2, '0');
  const secondi = String(ora.getSeconds()).padStart(2, '0');

  const dataOra = `📅 ${giorno}/${mese}/${anno}  🕒 ${ore}:${minuti}:${secondi}`;
  el.textContent = dataOra;
}

// aggiorna subito
aggiornaDataEOra();
setInterval(aggiornaDataEOra, 1000); // aggiorna ogni secondo

// schedule refresh loop
async function scheduleRefresh() {
  try { await loadDisplayCsv(); } catch (e) { console.error(e); }
  if (refreshTimeoutId) clearTimeout(refreshTimeoutId);
  refreshTimeoutId = setTimeout(scheduleRefresh, REFRESH_MS);
}

// adjust scroll container position to avoid overlapping header
function adjustScrollContainer() {
  const header = document.querySelector('.header');
  if (header && scrollContainer) {
    const h = header.offsetHeight;
    scrollContainer.style.top = h + 'px';
  }
}
window.addEventListener('resize', adjustScrollContainer);

// visibility handling to save resources on TV
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    cancelAnimationFrame(rafHandle);
    if (refreshTimeoutId) clearTimeout(refreshTimeoutId);
  } else {
    scheduleRefresh();
    startScrolling();
  }
});

// keyboard support for TV remote
document.addEventListener('keydown', e => {
  if (!scrollContainer) return;
  switch (e.key) {
    case 'ArrowDown': scrollContainer.scrollTop += Math.max(80, window.innerHeight * 0.08); e.preventDefault(); break;
    case 'ArrowUp': scrollContainer.scrollTop -= Math.max(80, window.innerHeight * 0.08); e.preventDefault(); break;
    case 'Enter': case ' ': if (!isScrolling) startScrolling(); else { isScrolling = false; cancelAnimationFrame(rafHandle); } e.preventDefault(); break;
    case 'Escape': if (menuPanel && menuPanel.classList.contains('active')) toggleMenu(); break;
  }
});

// init load
scheduleRefresh();
// layout adjustment
adjustScrollContainer();

/* ===========================
   INIZIALIZZAZIONE GENERALE
   =========================== */

/**
 * Inizializza:
 * - UI degli slider
 * - Caricamento delle coreografie da display.csv
 * - Avvio dello scroll automatico dopo il caricamento
 */
document.addEventListener('DOMContentLoaded', () => {
  updateControlsUI();        // valori iniziali accanto agli slider
  loadDisplayCsv();          // carica le coreografie (cards)
});
