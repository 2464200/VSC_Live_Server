(function () {
  const defaultBannerText = "la serata inizierà a breve";
  const textStorageKey = "userform-servizio-input";
  const stopStorageKey = "userform-servizio-stop";
  const lastLogoStorageKey = "userform-servizio-logo:last";
  const params = new URLSearchParams(window.location.search);
  const isDisplayMode = params.get("mode") === "display";

  function setStatus(message, state = "") {
    const status = document.getElementById("service-status");
    if (!status) return;
    status.textContent = message;
    if (state) status.dataset.state = state;
    else delete status.dataset.state;
  }

  function readStorage(key) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  function writeStorage(key, value) {
    try {
      window.localStorage.setItem(key, value);
      return true;
    } catch (error) {
      setStatus(`Impossibile salvare i dati: ${error.message}`, "error");
      return false;
    }
  }

  function closeDisplayWindow() {
    try {
      window.close();
    } catch {
      // Electron also closes the managed secondary window through its main process.
    }
  }

  function fitPublishedText(text) {
    const node = document.getElementById("published-message");
    if (!node) return;
    const availableWidth = Math.max(320, window.innerWidth * 0.88);
    const availableHeight = Math.max(240, window.innerHeight * 0.72);
    const widthSize = availableWidth / Math.max(6, text.length * 0.58);
    const heightSize = availableHeight / 1.2;
    node.style.fontSize = `${Math.max(32, Math.min(150, widthSize, heightSize))}px`;
  }

  function showPublishedText(text) {
    const message = document.getElementById("published-message");
    const image = document.getElementById("published-image");
    if (!message || !image) return;
    image.hidden = true;
    image.removeAttribute("src");
    message.hidden = false;
    message.textContent = text || defaultBannerText;
    fitPublishedText(message.textContent);
    window.addEventListener("resize", () => fitPublishedText(message.textContent));
  }

  function showPublishedLogo(id) {
    const message = document.getElementById("published-message");
    const image = document.getElementById("published-image");
    if (!message || !image) return;

    let payload = null;
    try {
      const stored = readStorage(lastLogoStorageKey);
      payload = stored ? JSON.parse(stored) : null;
    } catch {
      payload = null;
    }

    if (!payload || (id && payload.id !== id) || typeof payload.dataUrl !== "string" || !payload.dataUrl) {
      showPublishedText("Immagine non disponibile");
      return;
    }

    message.hidden = true;
    image.src = payload.dataUrl;
    image.alt = payload.name || "Immagine pubblicata";
    image.hidden = false;
  }

  function listenForStop() {
    window.addEventListener("storage", (event) => {
      if (event.key === stopStorageKey) closeDisplayWindow();
    });

    if (typeof BroadcastChannel !== "undefined") {
      const channel = new BroadcastChannel("userform-servizio-control");
      channel.addEventListener("message", (event) => {
        if (event.data?.type === "stop") closeDisplayWindow();
      });
    }
  }

  function initializeDisplay() {
    document.body.classList.add("service-display-mode");
    document.getElementById("service-operator").hidden = true;
    document.getElementById("service-presentation").hidden = false;

    if (params.get("output") === "logo") {
      showPublishedLogo(params.get("id"));
    } else {
      showPublishedText(params.get("text") || defaultBannerText);
    }
    listenForStop();
  }

  async function openPublication(output, values = {}) {
    const query = new URLSearchParams({ mode: "display", output, ...values });
    const route = `/USERFORM/pages/SERVIZIO.html?${query.toString()}`;
    const openSecondaryPage = window.electronAPI?.windowManager?.openSecondaryPage;

    if (typeof openSecondaryPage === "function") {
      const result = await openSecondaryPage({ path: route });
      if (!result?.success) throw new Error(result?.error || "Electron non ha aperto il monitor di pubblicazione.");
      return;
    }

    const opened = window.open(route, "_blank", "width=1200,height=800,resizable=yes,scrollbars=no");
    if (!opened) throw new Error("Il browser ha bloccato l’apertura della finestra di pubblicazione.");
  }

  function initializeOperator() {
    const messageInput = document.getElementById("service-message-input");
    const imageInput = document.getElementById("service-image-input");
    const dropzone = document.getElementById("service-dropzone");
    const previewWrap = document.getElementById("service-preview-wrap");
    const preview = document.getElementById("service-image-preview");
    const fileName = document.getElementById("service-file-name");
    const publishLogoButton = document.getElementById("publish-logo-btn");
    const clearLogoButton = document.getElementById("clear-logo-btn");
    let selectedLogo = null;

    const savedText = readStorage(textStorageKey) || defaultBannerText;
    messageInput.value = savedText === defaultBannerText ? "" : savedText;

    async function publishText() {
      const text = messageInput.value.trim() || defaultBannerText;
      writeStorage(textStorageKey, text);
      try {
        await openPublication("text", { text });
        setStatus("Messaggio pubblicato sul monitor secondario.", "success");
      } catch (error) {
        setStatus(error.message, "error");
      }
    }

    function clearLogo() {
      selectedLogo = null;
      imageInput.value = "";
      preview.removeAttribute("src");
      previewWrap.hidden = true;
      fileName.textContent = "";
      publishLogoButton.disabled = true;
      clearLogoButton.disabled = true;
    }

    function readImage(file) {
      setStatus("");
      if (!file || !file.type.startsWith("image/")) {
        setStatus("Seleziona un file immagine valido.", "error");
        return;
      }
      if (file.size > 1.5 * 1024 * 1024) {
        setStatus("L’immagine supera il limite di 1,5 MB.", "error");
        return;
      }

      const reader = new FileReader();
      reader.addEventListener("load", () => {
        if (typeof reader.result !== "string") {
          setStatus("Impossibile leggere il file immagine.", "error");
          return;
        }
        selectedLogo = { name: file.name, dataUrl: reader.result };
        preview.src = reader.result;
        preview.alt = `Anteprima di ${file.name}`;
        previewWrap.hidden = false;
        fileName.textContent = file.name;
        publishLogoButton.disabled = false;
        clearLogoButton.disabled = false;
      });
      reader.addEventListener("error", () => setStatus("Impossibile leggere il file immagine.", "error"));
      reader.readAsDataURL(file);
    }

    async function publishLogo() {
      if (!selectedLogo) return;
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const payload = { id, ...selectedLogo, publishedAt: Date.now() };
      if (!writeStorage(lastLogoStorageKey, JSON.stringify(payload))) return;

      try {
        await openPublication("logo", { id });
        setStatus("Immagine pubblicata sul monitor secondario.", "success");
      } catch (error) {
        setStatus(error.message, "error");
      }
    }

    document.getElementById("publish-text-btn").addEventListener("click", () => void publishText());
    document.getElementById("stop-text-btn").addEventListener("click", () => {
      messageInput.value = "";
      writeStorage(textStorageKey, defaultBannerText);
      writeStorage(stopStorageKey, JSON.stringify({ type: "stop", timestamp: Date.now() }));
      try {
        const channel = new BroadcastChannel("userform-servizio-control");
        channel.postMessage({ type: "stop" });
        channel.close();
      } catch {
        // The Electron API below still closes the managed display window.
      }
      setStatus("Pubblicazione fermata.", "success");
      const stopRequest = window.electronAPI?.windowManager?.stopServicePublication?.();
      if (stopRequest?.then) {
        stopRequest.then((result) => {
          if (result && !result.success && result.reason !== "secondary-window-unavailable") {
            setStatus("Non risulta una pubblicazione attiva.", "info");
          } else {
            setStatus("Pubblicazione fermata.", "success");
          }
        }).catch((error) => setStatus(`Impossibile fermare la pubblicazione: ${error.message}`, "error"));
      }
    });
    publishLogoButton.addEventListener("click", () => void publishLogo());
    clearLogoButton.addEventListener("click", clearLogo);
    imageInput.addEventListener("change", () => readImage(imageInput.files?.[0]));
    dropzone.addEventListener("dragover", (event) => {
      event.preventDefault();
      dropzone.classList.add("is-dragging");
    });
    dropzone.addEventListener("dragleave", () => dropzone.classList.remove("is-dragging"));
    dropzone.addEventListener("drop", (event) => {
      event.preventDefault();
      dropzone.classList.remove("is-dragging");
      readImage(event.dataTransfer?.files?.[0]);
    });
    messageInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        void publishText();
      }
    });
  }

  if (isDisplayMode) initializeDisplay();
  else initializeOperator();
})();