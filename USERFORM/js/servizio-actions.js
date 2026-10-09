(function () {
  const defaultBannerText = "la serata inizierà a breve";
  const defaultTextStorageKey = "userform-servizio-default-text";
  const textStorageKey = "userform-servizio-input";
  const slideshowDatabaseName = "userform-servizio-presentations";
  const slideshowStoreName = "presentations";
  const slideshowDraftId = "draft";
  const stopStorageKey = "userform-servizio-stop";
  const publicationStateKey = "userform-servizio-publication-active";
  const lastLogoStorageKey = "userform-servizio-logo:last";
  const params = new URLSearchParams(window.location.search);
  const isDisplayMode = params.get("mode") === "display";
  let stopDisplayHandler = null;

  function setStatus(message, state = "") {
    if (typeof document === "undefined") return;
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

  function openSlideshowDatabase() {
    if (!window.indexedDB) return Promise.reject(new Error("IndexedDB non è disponibile in questo browser."));
    return new Promise((resolve, reject) => {
      const request = window.indexedDB.open(slideshowDatabaseName, 1);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(slideshowStoreName)) {
          database.createObjectStore(slideshowStoreName, { keyPath: "id" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("Impossibile aprire l’archivio delle presentazioni."));
    });
  }

  async function saveSlideshowRecord(record) {
    const database = await openSlideshowDatabase();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(slideshowStoreName, "readwrite");
      transaction.objectStore(slideshowStoreName).put(record);
      transaction.oncomplete = () => {
        database.close();
        resolve();
      };
      transaction.onerror = () => {
        database.close();
        reject(transaction.error || new Error("Impossibile salvare le slide."));
      };
      transaction.onabort = () => {
        database.close();
        reject(transaction.error || new Error("Salvataggio delle slide annullato."));
      };
    });
  }

  async function readSlideshowRecord(id) {
    const database = await openSlideshowDatabase();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(slideshowStoreName, "readonly");
      const request = transaction.objectStore(slideshowStoreName).get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error || new Error("Impossibile leggere la presentazione."));
      transaction.oncomplete = () => database.close();
      transaction.onerror = () => {
        database.close();
        reject(transaction.error || new Error("Impossibile leggere la presentazione."));
      };
    });
  }

  async function deleteSlideshowRecord(id) {
    const database = await openSlideshowDatabase();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(slideshowStoreName, "readwrite");
      transaction.objectStore(slideshowStoreName).delete(id);
      transaction.oncomplete = () => {
        database.close();
        resolve();
      };
      transaction.onerror = () => {
        database.close();
        reject(transaction.error || new Error("Impossibile eliminare i dati della presentazione."));
      };
    });
  }

  function isTiffFile(file) {
    return /\.(tif|tiff)$/i.test(file.name || "") || ["image/tiff", "image/tif"].includes(file.type.toLowerCase());
  }

  async function convertTiffToPng(file) {
    if (!window.UTIF) throw new Error("Decoder TIFF non disponibile. Ricarica la pagina e riprova.");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const images = window.UTIF.decode(bytes);
    const image = images?.[0];
    if (!image) throw new Error(`Il TIFF “${file.name}” non contiene una pagina leggibile.`);
    if (!image.width || !image.height || image.width * image.height > 40000000) {
      throw new Error(`Il TIFF “${file.name}” ha dimensioni troppo elevate.`);
    }

    window.UTIF.decodeImage(bytes, image);
    const rgba = window.UTIF.toRGBA8(image);
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Impossibile preparare la conversione TIFF.");
    const imageData = context.createImageData(image.width, image.height);
    imageData.data.set(rgba);
    context.putImageData(imageData, 0, 0);
    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob((result) => {
        if (result) resolve(result);
        else reject(new Error(`Conversione TIFF non riuscita per “${file.name}”.`));
      }, "image/png");
    });
    const pngName = file.name.replace(/\.tiff?$/i, "") + ".png";
    return { blob, name: pngName, type: "image/png" };
  }

  function getPublicationState() {
    try {
      return JSON.parse(readStorage(publicationStateKey) || "null");
    } catch {
      return null;
    }
  }

  function reflectPublicationState(active) {
    const stopButton = document.getElementById("stop-text-btn");
    if (!stopButton) return;
    stopButton.classList.toggle("is-publishing", active);
    stopButton.setAttribute("aria-pressed", String(active));
  }

  function setPublicationActive(active, state = {}) {
    reflectPublicationState(active);
    try {
      if (active) {
        window.localStorage.setItem(publicationStateKey, JSON.stringify({
          active: true,
          output: state.output,
          session: state.session,
          updatedAt: Date.now(),
        }));
      } else {
        window.localStorage.removeItem(publicationStateKey);
      }
    } catch {
      // The button still reflects the live state for this page instance.
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

  async function showSlideshow(id) {
    const message = document.getElementById("published-message");
    const image = document.getElementById("published-image");
    let stopped = false;
    let timer = null;
    let activeObjectUrl = null;
    let stopPromise = null;

    const stopSlideshow = () => {
      if (stopPromise) return stopPromise;
      stopped = true;
      if (timer) window.clearTimeout(timer);
      if (activeObjectUrl) URL.revokeObjectURL(activeObjectUrl);
      stopPromise = (async () => {
        try { await deleteSlideshowRecord(id); } catch { /* Cleanup is best-effort on close. */ }
        const stopRequest = window.electronAPI?.windowManager?.stopServicePublication?.();
        if (stopRequest?.then) {
          try { await stopRequest; } catch { /* The display still closes below. */ }
        }
        closeDisplayWindow();
      })();
      return stopPromise;
    };

    stopDisplayHandler = stopSlideshow;
    try {
      const presentation = await readSlideshowRecord(id);
      if (!presentation || !Array.isArray(presentation.slides) || !presentation.slides.length) {
        showPublishedText("Presentazione non disponibile");
        return;
      }

      const slides = presentation.slides;
      const isLooping = presentation.loop === true;
      const totalDurationMs = isLooping ? Infinity : Math.max(1, Number(presentation.totalDurationSeconds) || 1) * 1000;
      const startedAt = Date.now();
      let index = 0;
      message.hidden = true;
      image.alt = "Presentazione immagini";
      image.hidden = false;

      function showNextSlide() {
        if (stopped) return;
        const elapsed = Date.now() - startedAt;
        const remainingMs = totalDurationMs - elapsed;
        if (!isLooping && remainingMs <= 0) {
          void stopSlideshow();
          return;
        }

        const slide = slides[index];
        if (!slide?.blob) {
          void stopSlideshow();
          return;
        }

        const previousUrl = activeObjectUrl;
        activeObjectUrl = URL.createObjectURL(slide.blob);
        image.classList.remove("is-slideshow");
        void image.offsetWidth;
        image.src = activeObjectUrl;
        image.alt = slide.name || `Slide ${index + 1}`;
        image.classList.add("is-slideshow");
        if (previousUrl) window.setTimeout(() => URL.revokeObjectURL(previousUrl), 500);

        const slideDurationMs = Math.max(1, Number(slide.durationSeconds) || 5) * 1000;
        const delay = isLooping ? slideDurationMs : Math.max(1, Math.min(slideDurationMs, remainingMs));
        timer = window.setTimeout(() => {
          index = (index + 1) % slides.length;
          showNextSlide();
        }, delay);
      }

      showNextSlide();
    } catch (error) {
      showPublishedText(`Impossibile caricare la presentazione: ${error.message}`);
    }
  }

  function listenForStop() {
    const stop = () => {
      if (stopDisplayHandler) void stopDisplayHandler();
      else closeDisplayWindow();
    };
    window.addEventListener("storage", (event) => {
      if (event.key === stopStorageKey) stop();
    });

    if (typeof BroadcastChannel !== "undefined") {
      const channel = new BroadcastChannel("userform-servizio-control");
      channel.addEventListener("message", (event) => {
        if (event.data?.type === "stop") stop();
      });
    }

    window.addEventListener("pagehide", () => {
      const session = params.get("session");
      if (!session) return;

      const publication = getPublicationState();
      if (publication?.session === session) {
        try {
          window.localStorage.removeItem(publicationStateKey);
        } catch {
          // A close notification is also broadcast to the operator window.
        }
      }

      if (params.get("output") === "slideshow" && params.get("id")) {
        void deleteSlideshowRecord(params.get("id")).catch(() => null);
      }

      if (typeof BroadcastChannel !== "undefined") {
        const channel = new BroadcastChannel("userform-servizio-control");
        channel.postMessage({ type: "closed", session });
        channel.close();
      }
    }, { once: true });
  }

  function initializeDisplay() {
    document.body.classList.add("service-display-mode");
    document.getElementById("service-operator").hidden = true;
    document.getElementById("service-presentation").hidden = false;

    listenForStop();
    if (params.get("output") === "slideshow") {
      void showSlideshow(params.get("id"));
    } else if (params.get("output") === "logo") {
      showPublishedLogo(params.get("id"));
    } else {
      showPublishedText(params.get("text") || defaultBannerText);
    }
  }

  async function openPublication(output, values = {}) {
    const session = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const query = new URLSearchParams({ mode: "display", output, session, ...values });
    const route = `/USERFORM/pages/SERVIZIO.html?${query.toString()}`;
    const openSecondaryPage = window.electronAPI?.windowManager?.openSecondaryPage;

    if (typeof openSecondaryPage === "function") {
      const result = await openSecondaryPage({ path: route });
      if (!result?.success) throw new Error(result?.error || "Electron non ha aperto il monitor di pubblicazione.");
      return session;
    }

    const opened = window.open(route, "_blank", "width=1200,height=800,resizable=yes,scrollbars=no");
    if (!opened) throw new Error("Il browser ha bloccato l’apertura della finestra di pubblicazione.");
    return session;
  }

  function initializeOperator() {
    const messageInput = document.getElementById("service-message-input");
    const defaultMessageInput = document.getElementById("service-default-message");
    const imageInput = document.getElementById("service-image-input");
    const dropzone = document.getElementById("service-dropzone");
    const previewWrap = document.getElementById("service-preview-wrap");
    const preview = document.getElementById("service-image-preview");
    const fileName = document.getElementById("service-file-name");
    const publishLogoButton = document.getElementById("publish-logo-btn");
    const clearLogoButton = document.getElementById("clear-logo-btn");
    const slideshowInput = document.getElementById("service-slideshow-input");
    const slideshowDropzone = document.getElementById("service-slideshow-dropzone");
    const slideList = document.getElementById("service-slide-list");
    const slidesEmpty = document.getElementById("service-slides-empty");
    const totalDurationInput = document.getElementById("service-total-duration");
    const loopInput = document.getElementById("service-loop-forever");
    const slideshowSummary = document.getElementById("service-slideshow-summary");
    const publishSlideshowButton = document.getElementById("publish-slideshow-btn");
    const slides = [];
    let draftSaveQueue = Promise.resolve();
    let selectedLogo = null;

    const currentPublication = getPublicationState();
    reflectPublicationState(currentPublication?.active === true);

    if (typeof BroadcastChannel !== "undefined") {
      const channel = new BroadcastChannel("userform-servizio-control");
      channel.addEventListener("message", (event) => {
        if (event.data?.type !== "closed") return;
        if (getPublicationState()?.session === event.data.session) setPublicationActive(false);
      });
    }

    window.addEventListener("storage", (event) => {
      if (event.key !== publicationStateKey) return;
      let publication = null;
      try {
        publication = event.newValue ? JSON.parse(event.newValue) : null;
      } catch {
        publication = null;
      }
      reflectPublicationState(publication?.active === true);
    });

    const savedText = readStorage(textStorageKey) || defaultBannerText;
    messageInput.value = savedText === defaultBannerText ? "" : savedText;
    defaultMessageInput.value = readStorage(defaultTextStorageKey) || defaultBannerText;
    defaultMessageInput.addEventListener("input", () => {
      writeStorage(defaultTextStorageKey, defaultMessageInput.value.trim() || defaultBannerText);
    });

    function updateSlideshowSummary() {
      const cycleSeconds = slides.reduce((total, slide) => total + slide.durationSeconds, 0);
      if (!slides.length) {
        slideshowSummary.textContent = "Seleziona le slide per iniziare. Il ciclo permanente continua fino a STOP.";
        publishSlideshowButton.disabled = true;
      } else if (loopInput.checked) {
        slideshowSummary.textContent = `${slides.length} slide · ${cycleSeconds} secondi per ciclo · ripetizione continua fino a STOP.`;
        publishSlideshowButton.disabled = false;
      } else {
        slideshowSummary.textContent = `${slides.length} slide · ${cycleSeconds} secondi per ciclo · proiezione per ${totalDurationInput.value || 120} secondi.`;
        publishSlideshowButton.disabled = false;
      }
      totalDurationInput.disabled = loopInput.checked;
    }

    function persistSlideshowDraft() {
      const record = {
        id: slideshowDraftId,
        slides: slides.map(({ name, blob, durationSeconds }) => ({ name, blob, durationSeconds })),
        totalDurationSeconds: Number(totalDurationInput.value) || 120,
        loop: loopInput.checked,
        savedAt: Date.now(),
      };
      draftSaveQueue = draftSaveQueue
        .then(() => slides.length ? saveSlideshowRecord(record) : deleteSlideshowRecord(slideshowDraftId))
        .catch((error) => setStatus(`Impossibile salvare la sequenza: ${error.message}`, "error"));
    }

    function renderSlideList() {
      slideList.replaceChildren();
      slidesEmpty.hidden = slides.length > 0;
      publishSlideshowButton.disabled = slides.length === 0;

      slides.forEach((slide, index) => {
        const row = document.createElement("li");
        row.className = "service-slide-item";
        const thumbnail = document.createElement("img");
        thumbnail.className = "service-slide-thumb";
        thumbnail.src = slide.previewUrl;
        thumbnail.alt = "";

        const name = document.createElement("span");
        name.className = "service-slide-name";
        name.textContent = `${index + 1}. ${slide.name}`;
        name.title = slide.name;

        const timeLabel = document.createElement("label");
        timeLabel.className = "service-slide-time";
        const timeText = document.createElement("span");
        timeText.textContent = "Secondi";
        const timeInput = document.createElement("input");
        timeInput.type = "number";
        timeInput.min = "1";
        timeInput.max = "3600";
        timeInput.step = "1";
        timeInput.value = String(slide.durationSeconds);
        timeInput.setAttribute("aria-label", `Permanenza di ${slide.name} in secondi`);
        timeInput.addEventListener("change", () => {
          const seconds = Number.parseInt(timeInput.value, 10);
          if (!Number.isInteger(seconds) || seconds < 1 || seconds > 3600) {
            timeInput.value = String(slide.durationSeconds);
            setStatus("La permanenza per slide deve essere compresa tra 1 e 3600 secondi.", "error");
            return;
          }
          slide.durationSeconds = seconds;
          updateSlideshowSummary();
          persistSlideshowDraft();
          setStatus("");
        });
        timeLabel.append(timeText, timeInput);

        const actions = document.createElement("div");
        actions.className = "service-slide-actions";
        const moveUp = document.createElement("button");
        moveUp.type = "button";
        moveUp.textContent = "↑";
        moveUp.title = "Sposta slide in alto";
        moveUp.setAttribute("aria-label", `Sposta ${slide.name} in alto`);
        moveUp.disabled = index === 0;
        moveUp.addEventListener("click", () => moveSlide(index, -1));
        const moveDown = document.createElement("button");
        moveDown.type = "button";
        moveDown.textContent = "↓";
        moveDown.title = "Sposta slide in basso";
        moveDown.setAttribute("aria-label", `Sposta ${slide.name} in basso`);
        moveDown.disabled = index === slides.length - 1;
        moveDown.addEventListener("click", () => moveSlide(index, 1));
        const remove = document.createElement("button");
        remove.type = "button";
        remove.textContent = "×";
        remove.title = "Rimuovi slide";
        remove.setAttribute("aria-label", `Rimuovi ${slide.name}`);
        remove.addEventListener("click", () => removeSlide(index));
        actions.append(moveUp, moveDown, remove);
        row.append(thumbnail, name, timeLabel, actions);
        slideList.append(row);
      });
      updateSlideshowSummary();
    }

    function moveSlide(index, direction) {
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= slides.length) return;
      [slides[index], slides[targetIndex]] = [slides[targetIndex], slides[index]];
      renderSlideList();
      persistSlideshowDraft();
    }

    function removeSlide(index) {
      const [removed] = slides.splice(index, 1);
      if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
      renderSlideList();
      persistSlideshowDraft();
    }

    async function addSlideshowFiles(fileList) {
      const files = Array.from(fileList || []);
      for (const file of files) {
        if (slides.length >= 60) {
          setStatus("La sequenza può contenere al massimo 60 slide.", "error");
          break;
        }
        try {
          let normalized;
          if (isTiffFile(file)) {
            normalized = await convertTiffToPng(file);
          } else if (file.type.startsWith("image/")) {
            normalized = { blob: file, name: file.name, type: file.type };
          } else {
            throw new Error(`Formato immagine non supportato per “${file.name}”.`);
          }
          const previewUrl = URL.createObjectURL(normalized.blob);
          slides.push({
            name: normalized.name,
            blob: normalized.blob,
            previewUrl,
            durationSeconds: 5,
          });
        } catch (error) {
          setStatus(error.message, "error");
        }
      }
      slideshowInput.value = "";
      renderSlideList();
      persistSlideshowDraft();
      if (slides.length) setStatus(`${slides.length} slide pronte. Imposta i tempi e avvia la presentazione.`, "success");
    }

    async function loadSlideshowDraft() {
      try {
        const draft = await readSlideshowRecord(slideshowDraftId);
        if (!draft || !Array.isArray(draft.slides)) return;
        slides.splice(0, slides.length, ...draft.slides.map((slide) => ({
          ...slide,
          durationSeconds: Number(slide.durationSeconds) || 5,
          previewUrl: URL.createObjectURL(slide.blob),
        })));
        if (Number.isFinite(draft.totalDurationSeconds)) totalDurationInput.value = String(draft.totalDurationSeconds);
        loopInput.checked = draft.loop === true;
        renderSlideList();
      } catch (error) {
        setStatus(`Impossibile ripristinare le slide: ${error.message}`, "error");
      }
    }

    async function publishSlideshow() {
      if (!slides.length) return;
      const loop = loopInput.checked;
      const totalDurationSeconds = Number.parseInt(totalDurationInput.value, 10);
      if (!loop && (!Number.isInteger(totalDurationSeconds) || totalDurationSeconds < 1 || totalDurationSeconds > 86400)) {
        setStatus("La durata della proiezione deve essere compresa tra 1 e 86400 secondi.", "error");
        return;
      }

      const id = `slides-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const presentation = {
        id,
        slides: slides.map(({ name, blob, durationSeconds }) => ({ name, blob, durationSeconds })),
        loop,
        totalDurationSeconds: loop ? null : totalDurationSeconds,
        createdAt: Date.now(),
      };

      try {
        await saveSlideshowRecord(presentation);
        const session = await openPublication("slideshow", { id });
        setPublicationActive(true, { output: "slideshow", session });
        setStatus(loop
          ? `Presentazione avviata: ${slides.length} slide in ciclo permanente.`
          : `Presentazione avviata per ${totalDurationSeconds} secondi.`, "success");
      } catch (error) {
        try { await deleteSlideshowRecord(id); } catch { /* Keep the original open error. */ }
        setStatus(error.message, "error");
      }
    }

    async function publishText() {
      const oneTimeText = messageInput.value.trim();
      const text = oneTimeText
        || defaultMessageInput.value.trim()
        || defaultBannerText;
      writeStorage(textStorageKey, oneTimeText);
      try {
        const session = await openPublication("text", { text });
        setPublicationActive(true, { output: "text", session });
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
        const session = await openPublication("logo", { id });
        setPublicationActive(true, { output: "logo", session });
        setStatus("Immagine pubblicata sul monitor secondario.", "success");
      } catch (error) {
        setStatus(error.message, "error");
      }
    }

    document.getElementById("publish-text-btn").addEventListener("click", () => void publishText());
    document.getElementById("stop-text-btn").addEventListener("click", () => {
      setPublicationActive(false);
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
    slideshowInput.addEventListener("change", () => void addSlideshowFiles(slideshowInput.files));
    slideshowDropzone.addEventListener("dragover", (event) => {
      event.preventDefault();
      slideshowDropzone.classList.add("is-dragging");
    });
    slideshowDropzone.addEventListener("dragleave", () => slideshowDropzone.classList.remove("is-dragging"));
    slideshowDropzone.addEventListener("drop", (event) => {
      event.preventDefault();
      slideshowDropzone.classList.remove("is-dragging");
      void addSlideshowFiles(event.dataTransfer?.files);
    });
    totalDurationInput.addEventListener("change", () => {
      const seconds = Number.parseInt(totalDurationInput.value, 10);
      if (!Number.isInteger(seconds) || seconds < 1 || seconds > 86400) {
        totalDurationInput.value = "120";
        setStatus("La durata della proiezione deve essere compresa tra 1 e 86400 secondi.", "error");
      }
      updateSlideshowSummary();
      persistSlideshowDraft();
    });
    loopInput.addEventListener("change", () => {
      updateSlideshowSummary();
      persistSlideshowDraft();
    });
    publishSlideshowButton.addEventListener("click", () => void publishSlideshow());
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
    updateSlideshowSummary();
    void loadSlideshowDraft();
  }

  if (isDisplayMode) initializeDisplay();
  else initializeOperator();
})();