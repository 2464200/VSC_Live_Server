document.addEventListener("DOMContentLoaded", () => {
  // --- Selettori e stato ---
  const tbody = document.getElementById("data-body");
  const speedInput = document.getElementById("speed");
  const pauseInput = document.getElementById("pause");
  const btnStop = document.getElementById("stopScroll");
  const btnResume = document.getElementById("resumeScroll");
  const scrollContainer = document.getElementById("scroll-container"); // Assicurati che l'HTML abbia questo ID

  // Stato dello scroll (loop con requestAnimationFrame, più robusto di setInterval)
  let running = false;
  let direction = 1; // 1 = giù, -1 = su
  let pauseUntil = 0; // timestamp fino a cui si resta in pausa
  let lastStepTime = 0; // timestamp dell'ultimo passo di scroll
  let rafId = null;
  const MAX_ROWS = 600; // limite per evitare OOM su smartTV con dataset molto grande
  const REFRESH_MS = 200000; // 200s
  let refreshTimeoutId = null;

  // --- Indicatori visivi ---
  function mostraIndicatore(messaggio) {
    const warning = document.createElement("div");
    warning.className = "warning";
    warning.textContent = messaggio;
    document.body.appendChild(warning);
    setTimeout(() => warning.remove(), 3000);
  }

  // --- util: robust CSV parser (handles quoted fields with commas/newlines) ---
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
        } else {
          cur += ch;
        }
      } else {
        if (ch === '"') { inQuotes = true; }
        else if (ch === ',') { row.push(cur); cur = ''; }
        else if (ch === '\r') { continue; }
        else if (ch === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
        else { cur += ch; }
      }
    }
    // push last
    if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
    return rows;
  }

  // --- util: fetch with timeout + retry ---
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
        // backoff
        await new Promise(r => setTimeout(r, 500 * attempt));
      }
    }
  }

  // --- Caricamento CSV e popolamento tabella ---
  async function caricaCSV() {
    try {
      const res = await fetchWithTimeoutAndRetry('display.csv?t=' + Date.now(), { cache: 'no-store' }, 12000, 2);
      const text = await res.text();

      // parse CSV robusto
      const rows = parseCSV(text);
      // skip first 3 header rows if present (project convention)
      const dataRows = rows.slice(3).filter(r => r.length && r.some(c => c !== ''));

      if (dataRows.length === 0) {
        mostraIndicatore('Nessuna riga trovata in display.csv');
        return;
      }

      tbody.innerHTML = '';

      let rowsToRender = dataRows;
      if (dataRows.length > MAX_ROWS) {
        rowsToRender = dataRows.slice(0, MAX_ROWS);
        mostraIndicatore(`Dataset troppo grande; visualizzo prime ${MAX_ROWS} righe`);
      }

      rowsToRender.forEach(cols => {
        // trim quotes/spaces
        const celle = cols.map(c => String(c || '').trim().replace(/^"+|"+$/g, ''));
        if (celle.length < 2) return;

        const tr = document.createElement('tr');
        if (String(celle[0]).toUpperCase() === 'X') tr.classList.add('orange-row');
        for (let i = 1; i < celle.length; i++) {
          const td = document.createElement('td');
          td.textContent = celle[i];
          tr.appendChild(td);
        }
        tbody.appendChild(tr);
      });

      mostraIndicatore('Tabella aggiornata alle ' + new Date().toLocaleTimeString());
      pauseUntil = 0;
    } catch (err) {
      console.error('Errore nel caricamento del CSV:', err);
      mostraIndicatore('Errore nel caricamento del CSV');
    }
  }

  // --- Loop di scroll con requestAnimationFrame ---
  function scrollLoop(timestamp) {
    if (!running || !scrollContainer) return;

    const speedMs = Number(speedInput.value);         // intervallo tra passi (ms)
    const pausaMs = Number(pauseInput.value) * 1000;    // pausa agli estremi (ms)

    // Pausa agli estremi
    if (timestamp < pauseUntil) {
      requestAnimationFrame(scrollLoop);
      return;
    }

    // Esegui passo di scroll ogni speedMs
    if (!lastStepTime) lastStepTime = timestamp;
    if (timestamp - lastStepTime >= speedMs) {
      const atBottom = scrollContainer.scrollTop + scrollContainer.clientHeight >= scrollContainer.scrollHeight;
      const atTop = scrollContainer.scrollTop <= 0;

      if (atBottom && direction === 1) {
        // Inverti verso l’alto con pausa
        direction = -1;
        pauseUntil = timestamp + pausaMs;
        // mostraIndicatore("Scroll invertito verso l'alto");
      } else if (atTop && direction === -1) {
        // Inverti verso il basso con pausa
        direction = 1;
        pauseUntil = timestamp + pausaMs;
        // mostraIndicatore("Scroll invertito verso il basso");
      } else {
        // Esegui il passo
        scrollContainer.scrollTop += direction;
      }
      lastStepTime = timestamp;
    }

    rafId = requestAnimationFrame(scrollLoop);
  }

  function startScroll() {
    if (running) return;
    running = true;
    lastStepTime = 0;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(scrollLoop);
  }

  function stopScroll() {
    running = false;
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
  }

  function restartScroll() {
    stopScroll();
    startScroll();
  }

  // --- Controlli utente ---
  btnStop.addEventListener("click", () => {
    stopScroll();
    mostraIndicatore("Scroll fermato");
  });

  btnResume.addEventListener("click", () => {
    startScroll();
    mostraIndicatore("Scroll ripreso");
  });

  speedInput.addEventListener("change", restartScroll);
  pauseInput.addEventListener("change", restartScroll);

  // --- Schermo intero sul contenitore scrollabile ---
  window.toggleFullscreen = function() {
    const target = scrollContainer || document.documentElement;

    if (!document.fullscreenElement) {
      // Richiesta fullscreen sul container (più stabile)
      const p = target.requestFullscreen
        ? target.requestFullscreen()
        : target.webkitRequestFullscreen
        ? target.webkitRequestFullscreen()
        : target.msRequestFullscreen
        ? target.msRequestFullscreen()
        : Promise.reject(new Error("Fullscreen non supportato"));

      Promise.resolve(p).catch(err => {
        console.error(`Errore fullscreen: ${err.message}`);
      });
    } else {
      // Uscita dal fullscreen
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
      }
    }
  };

  // Mantieni lo scroll attivo su cambio stato fullscreen
  document.addEventListener("fullscreenchange", () => {
    // Piccolo delay per consentire al browser di ricalcolare dimensioni
    setTimeout(() => {
      restartScroll();
      if (document.fullscreenElement) {
        mostraIndicatore("Schermo intero attivato");
      } else {
        mostraIndicatore("Schermo intero disattivato");
      }
    }, 100);
  });

  // (Safari/WebKit) eventi alternativi
  document.addEventListener("webkitfullscreenchange", () => {
    setTimeout(() => {
      restartScroll();
      mostraIndicatore(document.webkitFullscreenElement ? "Schermo intero attivato" : "Schermo intero disattivato");
    }, 100);
  });

  // Pause refresh/animation when page is hidden (saves resources on TV)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      // stop scroll and cancel pending refresh
      stopScroll();
      if (refreshTimeoutId) { clearTimeout(refreshTimeoutId); refreshTimeoutId = null; }
    } else {
      // resume and force refresh
      caricaCSV();
      startScroll();
    }
  });

  // keyboard / remote control support
  document.addEventListener('keydown', (e) => {
    if (!scrollContainer) return;
    switch (e.key) {
      case 'ArrowDown':
        scrollContainer.scrollTop += Math.max(80, window.innerHeight * 0.08);
        e.preventDefault();
        break;
      case 'ArrowUp':
        scrollContainer.scrollTop -= Math.max(80, window.innerHeight * 0.08);
        e.preventDefault();
        break;
      case ' ': // space toggles
      case 'Enter':
        if (running) { stopScroll(); mostraIndicatore('Scroll in pausa'); }
        else { startScroll(); mostraIndicatore('Scroll attivo'); }
        e.preventDefault();
        break;
      case 'Escape':
      case 'Backspace':
        stopScroll();
        mostraIndicatore('Scroll fermato');
        break;
    }
  });

  // schedule refresh loop using setTimeout to avoid overlapping
  async function scheduleRefresh() {
    try {
      await caricaCSV();
    } catch (err) {
      console.error('scheduleRefresh error', err);
    }
    if (refreshTimeoutId) clearTimeout(refreshTimeoutId);
    refreshTimeoutId = setTimeout(scheduleRefresh, REFRESH_MS);
  }

  function aggiornaDataOra() {
  const elemento = document.getElementById("data-ora");
  const adesso = new Date();

  const opzioniData = {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  };

  const opzioniOra = {
    hour: "2-digit",
    minute: "2-digit",
    //second: "2-digit"
  };

  const dataFormattata = adesso.toLocaleDateString("it-IT", opzioniData);
  const oraFormattata = adesso.toLocaleTimeString("it-IT", opzioniOra);

  elemento.textContent = `Data: ${dataFormattata} - Ore: ${oraFormattata}`;
}

  // Aggiornamento immediato e schedule
  aggiornaDataOra();
  setInterval(aggiornaDataOra, 60000); // ogni 60s

  // Avvio
  scheduleRefresh();
  startScroll();

  // Cleanup on unload
  window.addEventListener('beforeunload', () => {
    stopScroll();
    if (refreshTimeoutId) clearTimeout(refreshTimeoutId);
  });
});
