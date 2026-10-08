(function () {
  const body = document.body;
  if (!body?.classList.contains("pdf-workbench")) return;

  const mode = body.dataset.scriptpdfMode === "prova" ? "prova" : "principale";
  const retryCount = mode === "prova" ? 2 : 1;
  const requestTimeoutMs = 8000;
  const storageKey = "scriptpdf.adobePath";
  const historyStorageKey = "scriptpdf.openHistory";
  const state = {
    files: [],
    currentIndex: -1,
    history: [],
    serverReady: false,
    loading: false,
    opening: false,
    previewOpen: false
  };

  const nodes = {
    status: document.getElementById("pdf-status"),
    statusDetail: document.getElementById("pdf-folder"),
    folderPath: document.getElementById("pdf-folder-path"),
    count: document.getElementById("pdf-count"),
    search: document.getElementById("pdf-search"),
    filter: document.getElementById("pdf-filter"),
    select: document.getElementById("pdf-select"),
    empty: document.getElementById("pdf-empty"),
    emptyTitle: document.getElementById("pdf-empty-title"),
    emptyMessage: document.getElementById("pdf-empty-message"),
    current: document.getElementById("pdf-current"),
    name: document.getElementById("pdf-name"),
    metadata: document.getElementById("pdf-metadata"),
    position: document.getElementById("pdf-position"),
    previewButton: document.getElementById("toggle-preview"),
    previewPanel: document.getElementById("pdf-preview-panel"),
    previewFrame: document.getElementById("pdf-preview"),
    historyCount: document.getElementById("pdf-history-count"),
    historyList: document.getElementById("pdf-history-list"),
    clearHistory: document.getElementById("clear-history"),
    viewer: document.getElementById("viewer-select"),
    adobePath: document.getElementById("adobe-path"),
    openButton: document.getElementById("open-pdf"),
    message: document.getElementById("pdf-message"),
    previous: document.getElementById("previous-pdf"),
    next: document.getElementById("next-pdf"),
    refresh: document.getElementById("refresh-pdf-list"),
    saveAdobe: document.getElementById("save-adobe-path"),
    closeViewers: document.getElementById("close-viewers"),
    refreshViewers: document.getElementById("refresh-viewers"),
    openedViewers: document.getElementById("opened-viewers")
  };

  function getApiOrigin() {
    const current = new URL(window.location.href);
    if (
      (current.hostname === "localhost" || current.hostname === "127.0.0.1")
      && current.port === "5500"
    ) {
      return current.origin;
    }
    return "http://localhost:5500";
  }

  async function requestJson(path, options = {}) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), requestTimeoutMs);
    try {
      const response = await window.fetch(`${getApiOrigin()}${path}`, {
        cache: "no-store",
        ...options,
        signal: controller.signal
      });
      let payload;
      try {
        payload = await response.json();
      } catch {
        throw new Error(`Risposta non valida dal server (HTTP ${response.status}).`);
      }
      if (!response.ok) {
        throw new Error(payload?.error || `Richiesta non riuscita (HTTP ${response.status}).`);
      }
      return payload;
    } finally {
      window.clearTimeout(timeout);
    }
  }

  function setStatus(message, status = "loading", detail = "") {
    nodes.status.textContent = message;
    nodes.status.dataset.state = status;
    if (detail) nodes.statusDetail.textContent = detail;
  }

  function setMessage(message, status = "") {
    nodes.message.textContent = message;
    if (status) {
      nodes.message.dataset.state = status;
    } else {
      delete nodes.message.dataset.state;
    }
  }

  function normalizePath(filePath) {
    return String(filePath || "").replace(/\//g, "\\").toLocaleLowerCase("it-IT");
  }

  function loadHistory() {
    try {
      const stored = window.localStorage.getItem(historyStorageKey);
      if (!stored) return;
      const parsed = JSON.parse(stored);
      if (!Array.isArray(parsed) || !parsed.every((entry) => (
        entry
        && typeof entry.path === "string"
        && typeof entry.name === "string"
        && Number.isFinite(new Date(entry.openedAt).getTime())
      ))) {
        throw new Error("La cronologia PDF salvata non ha un formato valido.");
      }
      state.history = parsed.slice(0, 20);
    } catch (error) {
      setMessage(`Impossibile leggere la cronologia PDF: ${error.message}`, "error");
    }
  }

  function saveHistory() {
    try {
      window.localStorage.setItem(historyStorageKey, JSON.stringify(state.history));
      return true;
    } catch (error) {
      setMessage(`Impossibile salvare la cronologia PDF: ${error.message}`, "error");
      return false;
    }
  }

  function getHistoryEntry(filePath) {
    const normalized = normalizePath(filePath);
    return state.history.find((entry) => normalizePath(entry.path) === normalized);
  }

  function renderHistory() {
    nodes.historyList.replaceChildren();
    nodes.historyCount.textContent = `${state.history.length} ${state.history.length === 1 ? "documento recente" : "documenti recenti"}`;

    if (!state.history.length) {
      const empty = document.createElement("li");
      empty.textContent = "Nessun PDF aperto di recente.";
      nodes.historyList.append(empty);
      return;
    }

    const availableFiles = new Map(state.files.map((file) => [normalizePath(file.path), file]));
    state.history.forEach((entry) => {
      const item = document.createElement("li");
      const file = availableFiles.get(normalizePath(entry.path));
      if (file) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "pdf-history-open";
        button.dataset.path = file.path;
        button.textContent = file.name;
        item.append(button);
      } else {
        const name = document.createElement("span");
        name.className = "pdf-history-missing";
        name.textContent = `${entry.name} · non presente nella cartella`;
        item.append(name);
      }
      const timestamp = document.createElement("time");
      timestamp.dateTime = new Date(entry.openedAt).toISOString();
      timestamp.textContent = new Date(entry.openedAt).toLocaleString("it-IT");
      item.append(timestamp);
      nodes.historyList.append(item);
    });
  }

  function recordOpenedFile(file) {
    const normalized = normalizePath(file.path);
    state.history = [
      { path: file.path, name: file.name, openedAt: Date.now() },
      ...state.history.filter((entry) => normalizePath(entry.path) !== normalized)
    ].slice(0, 20);
    if (saveHistory()) {
      renderHistory();
      if (nodes.filter.value === "unopened") nodes.filter.value = "all";
      renderFileOptions();
    }
  }

  function getFilteredFiles() {
    const query = nodes.search.value.trim().toLocaleLowerCase("it-IT");
    const filter = nodes.filter.value;
    const recentThreshold = Date.now() - (30 * 24 * 60 * 60 * 1000);
    return state.files
      .map((file, index) => ({ file, index }))
      .filter(({ file }) => !query || file.name.toLocaleLowerCase("it-IT").includes(query))
      .filter(({ file }) => {
        const entry = getHistoryEntry(file.path);
        if (filter === "recent") return entry && entry.openedAt >= recentThreshold;
        if (filter === "unopened") return !entry;
        return true;
      });
  }

  function getSelectedFile() {
    return state.currentIndex >= 0 && state.currentIndex < state.files.length
      ? state.files[state.currentIndex]
      : null;
  }

  function renderCurrentFile() {
    const hasFiles = state.files.length > 0;
    const visibleFiles = getFilteredFiles();
    const file = getSelectedFile();
    const hasFilters = nodes.search.value.trim() || nodes.filter.value !== "all";
    nodes.count.textContent = hasFilters
      ? `${visibleFiles.length} di ${state.files.length} PDF`
      : `${state.files.length} ${state.files.length === 1 ? "documento" : "documenti"}`;
    nodes.select.disabled = !visibleFiles.length || state.loading;
    nodes.openButton.disabled = !state.serverReady || !file || state.opening;
    nodes.previous.disabled = !state.serverReady || visibleFiles.length < 2 || state.loading;
    nodes.next.disabled = !state.serverReady || visibleFiles.length < 2 || state.loading;
    nodes.empty.hidden = visibleFiles.length > 0 || state.loading;
    nodes.current.hidden = !file;
    nodes.previewButton.disabled = !state.serverReady || !file;
    nodes.previewPanel.hidden = !state.previewOpen || !file;

    if (!visibleFiles.length && hasFiles) {
      nodes.emptyTitle.textContent = "Nessun PDF corrisponde ai filtri";
      nodes.emptyMessage.textContent = "Modifica la ricerca o scegli un altro filtro.";
    } else {
      nodes.emptyTitle.textContent = "Nessun documento disponibile";
      nodes.emptyMessage.textContent = "Inserisci i file PDF nella cartella indicata e aggiorna l'elenco.";
    }

    if (!file) return;

    nodes.name.textContent = file.name;
    nodes.metadata.textContent = [file.size, file.created].filter(Boolean).join(" · ") || "Documento PDF";
    const visibleIndex = visibleFiles.findIndex(({ index }) => index === state.currentIndex);
    nodes.position.textContent = `${visibleIndex + 1} / ${visibleFiles.length}`;
    nodes.select.value = String(state.currentIndex);
    if (state.previewOpen) setPreviewSource(file);
  }

  function setPreviewSource(file) {
    const previewUrl = `${getApiOrigin()}/api/serve-pdf?file=${encodeURIComponent(file.path)}`;
    if (nodes.previewFrame.src !== previewUrl) nodes.previewFrame.src = previewUrl;
  }

  function togglePreview() {
    state.previewOpen = !state.previewOpen;
    const file = getSelectedFile();
    nodes.previewPanel.hidden = !state.previewOpen || !file;
    nodes.previewButton.setAttribute("aria-expanded", String(state.previewOpen));
    nodes.previewButton.textContent = state.previewOpen ? "Nascondi anteprima" : "Mostra anteprima";
    if (state.previewOpen && file) setPreviewSource(file);
  }

  function renderFileOptions() {
    nodes.select.replaceChildren();
    const visibleFiles = getFilteredFiles();
    if (!visibleFiles.length) {
      const emptyOption = document.createElement("option");
      emptyOption.value = "";
      emptyOption.textContent = state.loading ? "Connessione in corso…" : "Nessun PDF corrispondente";
      nodes.select.append(emptyOption);
      if (state.currentIndex >= 0) state.currentIndex = -1;
      renderCurrentFile();
      return;
    }

    visibleFiles.forEach(({ file, index }) => {
      const option = document.createElement("option");
      option.value = String(index);
      option.textContent = `${String(index + 1).padStart(2, "0")} · ${file.name}`;
      nodes.select.append(option);
    });
    if (!visibleFiles.some(({ index }) => index === state.currentIndex)) {
      state.currentIndex = visibleFiles[0].index;
    }
    renderCurrentFile();
  }

  async function checkServer() {
    let lastError;
    for (let attempt = 1; attempt <= retryCount; attempt += 1) {
      try {
        const health = await requestJson("/api/health");
        if (health.status !== "ok") {
          throw new Error("Il server locale non ha confermato lo stato di servizio.");
        }
        return health;
      } catch (error) {
        lastError = error;
        if (attempt < retryCount) {
          await new Promise((resolve) => window.setTimeout(resolve, 500 * attempt));
        }
      }
    }
    throw lastError;
  }

  async function loadPdfList() {
    if (state.loading) return;
    state.loading = true;
    nodes.refresh.disabled = true;
    setMessage("");
    setStatus(mode === "prova" ? "Verifica del server PDF (tentativi ripetuti)…" : "Verifica del server PDF…");
    renderCurrentFile();

    try {
      const health = await checkServer();
      const previousPath = getSelectedFile()?.path;
      const result = await requestJson("/api/pdf-list");
      if (!result.success || !Array.isArray(result.files)) {
        throw new Error(result.error || "Il server non ha restituito un elenco PDF valido.");
      }
      if (!result.files.every((file) => file && typeof file.name === "string" && typeof file.path === "string")) {
        throw new Error("L'elenco contiene dati PDF incompleti.");
      }

      state.files = result.files;
      state.serverReady = true;
      renderHistory();
      const retainedIndex = previousPath
        ? state.files.findIndex((file) => file.path === previousPath)
        : -1;
      state.currentIndex = retainedIndex >= 0 ? retainedIndex : (state.files.length ? 0 : -1);
      const folder = result.folder || health.pdfFolder || "C:\\VSC_SCRIPT_PDF";
      nodes.folderPath.textContent = folder;
      if (state.files.length) {
        setStatus(
          `${state.files.length} ${state.files.length === 1 ? "PDF disponibile" : "PDF disponibili"}`,
          "ready",
          `Servizio unificato attivo · ${folder}`
        );
      } else {
        setStatus("Server pronto · nessun PDF trovato", "ready", `Aggiungi i documenti alla cartella ${folder}.`);
      }
      renderFileOptions();
    } catch (error) {
      state.serverReady = false;
      state.files = [];
      state.currentIndex = -1;
      renderHistory();
      renderFileOptions();
      const message = error?.name === "AbortError"
        ? "Timeout durante la connessione al server locale."
        : (error?.message || "Errore non specificato.");
      setStatus("Server PDF non disponibile", "error", message);
      setMessage(`${message} Avvia il server unificato sulla porta 5500 e riprova.`, "error");
    } finally {
      state.loading = false;
      nodes.refresh.disabled = false;
      renderFileOptions();
    }
  }

  function moveSelection(direction) {
    const visibleFiles = getFilteredFiles();
    if (visibleFiles.length < 2) return;
    const visibleIndex = visibleFiles.findIndex(({ index }) => index === state.currentIndex);
    const nextIndex = (visibleIndex + direction + visibleFiles.length) % visibleFiles.length;
    state.currentIndex = visibleFiles[nextIndex].index;
    renderCurrentFile();
    setMessage("");
  }

  async function openCurrentPdf() {
    const file = getSelectedFile();
    if (!state.serverReady || !file || state.opening) {
      setMessage("Seleziona un PDF e verifica che il server sia attivo.", "error");
      return;
    }

    const viewer = nodes.viewer.value;
    if (!["auto", "adobe", "chrome"].includes(viewer)) {
      setMessage("Seleziona una modalità viewer valida.", "error");
      return;
    }

    state.opening = true;
    nodes.openButton.disabled = true;
    setStatus(`Apertura di ${file.name}…`, "loading");
    setMessage("Richiesta di apertura sul monitor secondario…");
    try {
      const result = await requestJson("/api/open-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filePath: file.path,
          fileName: file.name,
          viewer,
          adobePath: nodes.adobePath.value.trim()
        })
      });
      if (!result.success) {
        throw new Error(result.error || "Il server non ha confermato l'apertura del PDF.");
      }
      recordOpenedFile(file);
      setStatus(`PDF inviato al viewer · ${file.name}`, "ready");
      setMessage(result.message || `Apertura richiesta per ${file.name} sul monitor secondario.`, "success");
      await refreshOpenedViewers(false);
    } catch (error) {
      const message = error?.name === "AbortError"
        ? "Timeout durante l'apertura del PDF."
        : (error?.message || "Errore non specificato.");
      setStatus("Impossibile aprire il PDF", "error", message);
      setMessage(message, "error");
    } finally {
      state.opening = false;
      renderCurrentFile();
    }
  }

  async function refreshOpenedViewers(showErrors = true) {
    try {
      const result = await requestJson("/api/opened-viewers");
      if (!result.success || !Array.isArray(result.list)) {
        throw new Error(result.error || "Elenco sessioni PDF non valido.");
      }
      nodes.openedViewers.replaceChildren();
      if (!result.list.length) {
        const empty = document.createElement("li");
        empty.textContent = "Nessuna sessione PDF gestita attiva.";
        nodes.openedViewers.append(empty);
      } else {
        result.list.forEach((viewer) => {
          const item = document.createElement("li");
          const fileName = String(viewer.file || "").split(/[\\/]/).pop() || "PDF";
          item.textContent = `${viewer.alive ? "Attiva" : "Non raggiungibile"} · ${fileName}${viewer.startedAt ? ` · avviata ${new Date(viewer.startedAt).toLocaleTimeString("it-IT")}` : ""}`;
          nodes.openedViewers.append(item);
        });
      }
      return result.list;
    } catch (error) {
      if (showErrors) setMessage(`Impossibile leggere le sessioni PDF: ${error.message}`, "error");
      throw error;
    }
  }

  async function closeManagedViewers() {
    let viewers;
    try {
      viewers = await refreshOpenedViewers();
    } catch {
      return;
    }
    const activeViewers = viewers.filter((viewer) => viewer.alive);
    if (!activeViewers.length) {
      setMessage("Non risultano sessioni PDF gestite attive.", "info");
      return;
    }

    const confirmed = window.confirm(
      `Verranno chiuse ${activeViewers.length} sessioni PDF aperte dal sistema ScriptPDF. Procedere?`
    );
    if (!confirmed) return;

    try {
      const result = await requestJson("/api/close-chrome", { method: "POST" });
      if (!result.success) {
        throw new Error(result.error || "Il server non ha confermato la chiusura.");
      }
      setMessage(`${activeViewers.length} sessioni PDF gestite chiuse.`, "success");
      await refreshOpenedViewers(false);
    } catch (error) {
      setMessage(`Impossibile chiudere le sessioni PDF: ${error.message}`, "error");
    }
  }

  function loadAdobePath() {
    try {
      nodes.adobePath.value = window.localStorage.getItem(storageKey) || "";
    } catch (error) {
      setMessage(`Impossibile leggere la preferenza Adobe: ${error.message}`, "error");
    }
  }

  function saveAdobePath() {
    try {
      window.localStorage.setItem(storageKey, nodes.adobePath.value.trim());
      setMessage("Percorso Adobe salvato su questo dispositivo.", "success");
    } catch (error) {
      setMessage(`Impossibile salvare il percorso Adobe: ${error.message}`, "error");
    }
  }

  function selectHistoryFile(event) {
    const button = event.target.closest(".pdf-history-open");
    if (!button) return;
    nodes.search.value = "";
    nodes.filter.value = "all";
    const index = state.files.findIndex((file) => normalizePath(file.path) === normalizePath(button.dataset.path));
    if (index < 0) return;
    state.currentIndex = index;
    renderFileOptions();
    setMessage("");
  }

  function clearHistory() {
    state.history = [];
    if (saveHistory()) {
      renderHistory();
      renderFileOptions();
      setMessage("Cronologia PDF locale svuotata.", "success");
    }
  }

  nodes.refresh.addEventListener("click", () => void loadPdfList());
  nodes.previous.addEventListener("click", () => moveSelection(-1));
  nodes.next.addEventListener("click", () => moveSelection(1));
  nodes.search.addEventListener("input", () => renderFileOptions());
  nodes.filter.addEventListener("change", () => renderFileOptions());
  nodes.select.addEventListener("change", () => {
    const index = Number.parseInt(nodes.select.value, 10);
    if (Number.isInteger(index) && index >= 0 && index < state.files.length) {
      state.currentIndex = index;
      renderCurrentFile();
      setMessage("");
    }
  });
  nodes.previewButton.addEventListener("click", togglePreview);
  nodes.historyList.addEventListener("click", selectHistoryFile);
  nodes.clearHistory.addEventListener("click", clearHistory);
  nodes.openButton.addEventListener("click", () => void openCurrentPdf());
  nodes.saveAdobe.addEventListener("click", saveAdobePath);
  nodes.adobePath.addEventListener("change", saveAdobePath);
  nodes.closeViewers.addEventListener("click", () => void closeManagedViewers());
  nodes.refreshViewers.addEventListener("click", () => void refreshOpenedViewers());
  document.addEventListener("keydown", (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.target instanceof window.HTMLInputElement || event.target instanceof window.HTMLSelectElement) return;
    if (event.key === "ArrowLeft") moveSelection(-1);
    if (event.key === "ArrowRight") moveSelection(1);
  });

  loadAdobePath();
  loadHistory();
  renderHistory();
  void loadPdfList();
})();
