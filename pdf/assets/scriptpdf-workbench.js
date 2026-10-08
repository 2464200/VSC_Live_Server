(function () {
  const body = document.body;
  if (!body?.classList.contains("pdf-workbench")) return;

  const mode = body.dataset.scriptpdfMode === "prova" ? "prova" : "principale";
  const retryCount = mode === "prova" ? 2 : 1;
  const requestTimeoutMs = 8000;
  const storageKey = "scriptpdf.adobePath";
  const state = {
    files: [],
    currentIndex: -1,
    serverReady: false,
    loading: false,
    opening: false
  };

  const nodes = {
    status: document.getElementById("pdf-status"),
    statusDetail: document.getElementById("pdf-folder"),
    folderPath: document.getElementById("pdf-folder-path"),
    count: document.getElementById("pdf-count"),
    select: document.getElementById("pdf-select"),
    empty: document.getElementById("pdf-empty"),
    current: document.getElementById("pdf-current"),
    name: document.getElementById("pdf-name"),
    metadata: document.getElementById("pdf-metadata"),
    position: document.getElementById("pdf-position"),
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

  function getSelectedFile() {
    return state.currentIndex >= 0 && state.currentIndex < state.files.length
      ? state.files[state.currentIndex]
      : null;
  }

  function renderCurrentFile() {
    const hasFiles = state.files.length > 0;
    const file = getSelectedFile();
    nodes.count.textContent = `${state.files.length} ${state.files.length === 1 ? "documento" : "documenti"}`;
    nodes.select.disabled = !hasFiles || state.loading;
    nodes.openButton.disabled = !state.serverReady || !file || state.opening;
    nodes.previous.disabled = !state.serverReady || state.files.length < 2 || state.loading;
    nodes.next.disabled = !state.serverReady || state.files.length < 2 || state.loading;
    nodes.empty.hidden = hasFiles || state.loading;
    nodes.current.hidden = !file;

    if (!file) return;

    nodes.name.textContent = file.name;
    nodes.metadata.textContent = [file.size, file.created].filter(Boolean).join(" · ") || "Documento PDF";
    nodes.position.textContent = `${state.currentIndex + 1} / ${state.files.length}`;
    nodes.select.value = String(state.currentIndex);
  }

  function renderFileOptions() {
    nodes.select.replaceChildren();
    if (!state.files.length) {
      const emptyOption = document.createElement("option");
      emptyOption.value = "";
      emptyOption.textContent = state.loading ? "Connessione in corso…" : "Nessun PDF nell'elenco";
      nodes.select.append(emptyOption);
      renderCurrentFile();
      return;
    }

    state.files.forEach((file, index) => {
      const option = document.createElement("option");
      option.value = String(index);
      option.textContent = `${String(index + 1).padStart(2, "0")} · ${file.name}`;
      nodes.select.append(option);
    });
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
    if (state.files.length < 2) return;
    state.currentIndex = (state.currentIndex + direction + state.files.length) % state.files.length;
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

  nodes.refresh.addEventListener("click", () => void loadPdfList());
  nodes.previous.addEventListener("click", () => moveSelection(-1));
  nodes.next.addEventListener("click", () => moveSelection(1));
  nodes.select.addEventListener("change", () => {
    const index = Number.parseInt(nodes.select.value, 10);
    if (Number.isInteger(index) && index >= 0 && index < state.files.length) {
      state.currentIndex = index;
      renderCurrentFile();
      setMessage("");
    }
  });
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
  void loadPdfList();
})();
