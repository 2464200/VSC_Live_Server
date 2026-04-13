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
const REFRESH_MS = 200000;
let refreshTimeoutId = null;
// NOTE: nextCoreoValue will always blink when updated

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

/**
 * Apre/chiude il pannello del menu dei controlli (aggiunge/rimuove la classe .active).
 */
function toggleMenu() {
  if (!menuPanel) return;
  menuPanel.classList.toggle('active');
}

/**
 * Attiva/disattiva lo schermo intero della pagina.
 * Nota: su iOS potrebbero esserci limitazioni al fullscreen.
 */
function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(err => {
      console.log('Errore fullscreen:', err);
    });
  } else {
    document.exitFullscreen();
  }
}

/* ===========================
   CONTROLLI DI SCROLL (SLIDER E PULSANTI)
   =========================== */

/**
 * Aggiorna il valore mostrato accanto agli slider (velocità e pausa).
 */
function updateControlsUI() {
  if (speedInput && speedValue)  speedValue.textContent = String(speedInput.value);
  if (pauseInput && pauseValue)  pauseValue.textContent = String(pauseInput.value);
}

/**
 * Gestione slider della velocità:
 * il valore dello slider modula i pixel al secondo (px/s) usati nello scroll.
 */
if (speedInput) {
  speedInput.addEventListener('input', () => {
    speedValue.textContent = speedInput.value;
    // Applichiamo subito la nuova velocità riavviando l’animazione se attiva
    if (isScrolling) restartScrolling();
  });
}

/**
 * Gestione slider della pausa:
 * controlla la pausa ai bordi (in secondi -> convertiti in millisecondi).
 */
if (pauseInput) {
  // Valore iniziale dalla UI
  pauseTime = (parseInt(pauseInput.value || '2', 10)) * 1000;
  pauseInput.addEventListener('input', () => {
    const value = parseInt(pauseInput.value || '0', 10);
    pauseValue.textContent = value;
    pauseTime = value * 1000; // converti in ms
  });
}

/**
 * Pulsante “Pausa”: ferma lo scroll automatico.
 */
if (stopButton) {
  stopButton.addEventListener('click', () => {
    isScrolling = false;
    cancelAnimationFrame(rafHandle);
    stopButton.textContent = '⏸️ In Pausa';
    stopButton.style.opacity = '0.7';
  });
}

/**
 * Pulsante “Riprendi”: riattiva lo scroll automatico.
 */
if (resumeButton) {
  resumeButton.addEventListener('click', () => {
    if (!isScrolling) {
      isScrolling = true;
      stopButton.textContent = '⏸️ Pausa';
      stopButton.style.opacity = '1';
      startScrolling();
    }
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
        <span class="detail-label">Brano:</span>
        <span class="detail-value">${choreo.song}</span>
      </div>
      <div class="detail-row">
        <span class="detail-icon">🎤</span>
        <span class="detail-label">Autore:</span>
        <span class="detail-value">${choreo.author}</span>
      </div>
      ${choreo.choreographer ? `
      <div class="detail-row">
        <span class="detail-icon">💃</span>
        <span class="detail-label">Coreografo:</span>
        <span class="detail-value">${choreo.choreographer}</span>
      </div>` : ''}
    </div>
  `;
  dataBody.appendChild(card);
}

/**
 * Carica e parse-a il file display.csv (saltando le prime 3 righe di intestazione),
 * crea le card e avvia lo scroll.
 */
async function loadDisplayCsv() {
  try {
    const res = await fetchWithTimeoutAndRetry('display.csv?t=' + Date.now(), { cache: 'no-store' }, 12000, 2);
    const text = await res.text();
    const rows = parseCSV(text);
    const dataRows = rows.slice(3).filter(r => r.length && r.some(c => c !== ''));

    choreographies = [];
    dataBody.innerHTML = '';

    let toRender = dataRows;
    if (dataRows.length > MAX_ROWS) {
      toRender = dataRows.slice(0, MAX_ROWS);
      console.warn(`Dataset troppo grande: visualizzo prime ${MAX_ROWS} righe`);
    }

    toRender.forEach((cols, index) => {
      const normalized = cols.map(c => String(c || '').trim().replace(/^"+|"+$/g, ''));
      if (normalized.length >= 6) {
        const isExecuted = String(normalized[0]).toUpperCase().startsWith('X');
        const choreo = {
          number: index + 1,
          mark: normalized[0],
          id: normalized[1],
          name: normalized[2],
          song: normalized[3],
          author: normalized[4],
          choreographer: normalized[5],
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
   NEXTCOREO: LETTURA DINAMICA DA NextCoreo.csv
   =========================== */

/**
 * Rimuove l’eventuale BOM (Byte Order Mark) all’inizio del testo.
 */
function stripBOM(text) {
  return text.replace(/^\uFEFF/, '');
}

/**
 * Estrae il PRIMO VALORE della PRIMA RIGA (cella B1),
 * cioè tutto fino alla prima virgola. Se non c’è virgola, restituisce l’intera riga.
 * Rimuove eventuali virgolette esterne e spazi superflui.
 */
function parseFirstValueB1(csvText) {
  const clean = stripBOM(csvText);
  const firstLine = clean.split(/\r?\n/).find(line => line.trim().length > 0) || '';
  let firstValue = firstLine.split(',')[1] ?? '';
  firstValue = firstValue.replace(/^"(.*)"$/, '$1').trim();
  return firstValue;
}

/**
 * Carica dal server il file NextCoreo.csv e aggiorna l’etichetta nella barra info.
 * - Cache busting per evitare versioni vecchie.
 * - In caso di errore, mostra messaggio esplicito.
 * - Converte il valore in MAIUSCOLO e lo mostra come “Prossima Coreo: …”.
 */
async function loadNextCoreo() {
  const target = document.getElementById("nextCoreoValue");
  if (!target) return;

  // Testo iniziale durante il caricamento
  target.textContent = 'Prossima Coreo: Caricamento...';

  try {
    const url = `NextCoreo.csv?t=${Date.now()}`; // cache busting
    const response = await fetchWithTimeoutAndRetry(url, { cache: 'no-store' }, 8000, 1);

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const text = await response.text();
    const b1FirstValue = parseFirstValueB1(text);

    if (b1FirstValue && b1FirstValue.length > 0) {
      const upperValue = b1FirstValue.toUpperCase();
      target.textContent = `${upperValue}`;
      target.title = `${upperValue}`;
      // blink sempre quando viene aggiornato
      target.classList.add('blink');
      target.classList.remove('fade-out');
    } else {
      target.textContent = '(Nessun valore in B1)';
      // anche in assenza di valore manteniamo il lampeggio visibile
      target.classList.add('blink');
    }
  } catch (err) {
    console.error('Errore nel caricamento di NextCoreo.csv:', err);
    target.textContent = '(Errore nel caricamento)';
  }
}

async function aggiornaScrittaRossa() {
  (async () => {
    try {
      const res = await fetchWithTimeoutAndRetry('NextCoreo.csv?t=' + Date.now(), { cache: 'no-store' }, 8000, 1);
      const text = await res.text();
      const rows = text.split(/\r?\n/);
      const primaCoreo = (rows[0] || '').split(',')[1] || '';
      const coreoElem = document.getElementById('nextCoreoValue');
      if (coreoElem) {
        const value = (primaCoreo || '').toString().trim();
        coreoElem.textContent = value;
        // Applicare lampeggio sempre
        coreoElem.classList.add('blink');
        coreoElem.classList.remove('fade-out');
      }
    } catch (err) {
      console.error('aggiornaScrittaRossa error', err);
    }
  })();

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
  const ora = new Date();
  const giorno = String(ora.getDate()).padStart(2, '0');
  const mese = String(ora.getMonth() + 1).padStart(2, '0');
  const anno = ora.getFullYear();
  const ore = String(ora.getHours()).padStart(2, '0');
  const minuti = String(ora.getMinutes()).padStart(2, '0');

  const dataOra = `📅 ${giorno}/${mese}/${anno} 🕒 ${ore}:${minuti}`;
  document.getElementById("dateTime").textContent = dataOra;
}

// aggiorna subito
aggiornaDataEOra();
setInterval(aggiornaDataEOra, 60000); // aggiorna ogni 60 secondi

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
 * - Caricamento “Prossima Coreo” e refresh ogni 45s
 * - Avvio dello scroll automatico dopo il caricamento
 */
document.addEventListener('DOMContentLoaded', () => {
  updateControlsUI();        // valori iniziali accanto agli slider
  loadDisplayCsv();          // carica le coreografie (cards)
  loadNextCoreo();           // carica “Prossima Coreo” subito
  setInterval(loadNextCoreo, 45000); // refresh automatico ogni 45 secondi
});
