(function () {
  const input = document.getElementById("service-message-input");
  const publishTextBtn = document.getElementById("publish-text-btn");
  const stopTextBtn = document.getElementById("stop-text-btn");
  const publishLogoBtn = document.getElementById("publish-logo-btn");
  const publishLogoLabel = document.getElementById("publish-logo-label");
  const publishFileBtn = document.getElementById("publish-file-btn");
  const carouselImagesInput = document.getElementById("carousel-images-input");
  const carouselIntervalInput = document.getElementById("carousel-interval-input");
  const publishCarouselBtn = document.getElementById("publish-carousel-btn");
  const publishCarouselFolderBtn = document.getElementById("publish-carousel-folder-btn");
  const stopCarouselBtn = document.getElementById("stop-carousel-btn");
  const carouselStatus = document.getElementById("carousel-status");
  const indexBtn = document.getElementById("index-btn");
  const closeBtn = document.getElementById("close-btn");
  const closeWindowBtn = document.getElementById("close-window-btn");

  const defaultBannerText = "la serata inizierà a breve";
  const carouselStoragePrefix = "userform-servizio-carousel:";
  const servizioBaseDirDefault = "C:\\VSC_Servizio";
  let selectedElectronSlides = [];

  function moveToPrimaryMonitor() {
    try {
      const primaryLeft = screen.availLeft || 0;
      const primaryTop = screen.availTop || 0;
      window.moveTo(primaryLeft + 20, primaryTop + 20);
    } catch (error) {
      // Ignora in browser dove il movimento di finestra è bloccato.
    }
  }

  if (window.addEventListener) {
    window.addEventListener("load", moveToPrimaryMonitor, { once: true });
  }

  const storageKey = "userform-servizio-input";

  function saveInputValue(value) {
    const clean = (value || "").trim();
    const text = clean || defaultBannerText;
    try {
      localStorage.setItem(storageKey, text);
    } catch (error) {
      console.warn("Impossibile salvare nel localStorage:", error);
    }
    return text;
  }

  function readInputValue() {
    try {
      return localStorage.getItem(storageKey) || defaultBannerText;
    } catch (error) {
      return defaultBannerText;
    }
  }

  function openExternal(url) {
    const target = new URL(url, window.location.href).toString();
    window.open(target, "_blank", "noopener,noreferrer");
  }

  function openLogoPicker() {
    const target = new URL("../pages/SERVIZIO-LOGO.html", window.location.href).toString();
    window.open(target, "_blank", "width=900,height=760,resizable=yes,scrollbars=yes");
  }

  function setCarouselStatus(message, isError = false) {
    if (!carouselStatus) {
      return;
    }
    carouselStatus.textContent = message || "";
    carouselStatus.style.color = isError ? "#8f0000" : "#1d1d1d";
  }

  function pruneOldCarouselEntries() {
    try {
      const keys = Object.keys(localStorage)
        .filter((key) => key.startsWith(carouselStoragePrefix))
        .sort();

      const maxEntries = 5;
      if (keys.length <= maxEntries) {
        return;
      }

      keys.slice(0, keys.length - maxEntries).forEach((key) => {
        localStorage.removeItem(key);
      });
    } catch (error) {
      console.warn("Impossibile ripulire le carrellate precedenti:", error);
    }
  }

  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error(`Lettura fallita per ${file?.name || "file"}`));
      reader.readAsDataURL(file);
    });
  }

  async function buildCarouselPayload(files, intervalSec) {
    const slides = [];
    for (const file of files) {
      const dataUrl = await fileToDataUrl(file);
      slides.push({
        name: file.name || "immagine",
        type: file.type || "image/*",
        dataUrl
      });
    }

    return {
      createdAt: Date.now(),
      intervalSec,
      slides
    };
  }

  async function openPublishCarouselWindow(carouselId) {
    const appRoute = `/userform/pages/servizio-pubblica.html?mode=carousel&id=${encodeURIComponent(carouselId)}`;

    if (window.electronAPI?.windowManager?.openSecondaryPage) {
      try {
        const result = await window.electronAPI.windowManager.openSecondaryPage({ path: appRoute });
        if (result?.success) {
          return true;
        }
      } catch (error) {
        console.warn("Impossibile aprire la carrellata via Electron, fallback browser:", error);
      }
    }

    const url = `../pages/SERVIZIO-PUBBLICA.html?mode=carousel&id=${encodeURIComponent(carouselId)}`;
    const width = 1200;
    const height = 760;
    const primaryLeft = screen.availLeft || 0;
    const primaryWidth = screen.availWidth || screen.width || 1600;
    const secondaryLeft = primaryLeft + primaryWidth + 40;
    const top = (screen.availTop || 0) + 40;
    const features = `width=${width},height=${height},left=${secondaryLeft},top=${top},resizable=yes,scrollbars=no`;
    const popup = window.open(url, "_blank", features);
    return Boolean(popup);
  }

  async function openPublishFolderCarouselWindow(intervalSec) {
    const appRoute = `/userform/pages/servizio-pubblica.html?mode=folder&interval=${encodeURIComponent(intervalSec)}`;

    if (window.electronAPI?.windowManager?.openSecondaryPage) {
      try {
        const result = await window.electronAPI.windowManager.openSecondaryPage({ path: appRoute });
        if (result?.success) {
          return true;
        }
      } catch (error) {
        console.warn("Impossibile aprire la carrellata da cartella via Electron, fallback browser:", error);
      }
    }

    const url = `../pages/SERVIZIO-PUBBLICA.html?mode=folder&interval=${encodeURIComponent(intervalSec)}`;
    const width = 1200;
    const height = 760;
    const primaryLeft = screen.availLeft || 0;
    const primaryWidth = screen.availWidth || screen.width || 1600;
    const secondaryLeft = primaryLeft + primaryWidth + 40;
    const top = (screen.availTop || 0) + 40;
    const features = `width=${width},height=${height},left=${secondaryLeft},top=${top},resizable=yes,scrollbars=no`;
    const popup = window.open(url, "_blank", features);
    return Boolean(popup);
  }

  async function publishCarousel() {
    const intervalRaw = Number(carouselIntervalInput?.value || 6);
    const intervalSec = Number.isFinite(intervalRaw) ? Math.min(60, Math.max(1, Math.round(intervalRaw))) : 6;

    const files = Array.from(carouselImagesInput?.files || []).filter((file) => file.type.startsWith("image/"));
    const hasElectronSelection = Array.isArray(selectedElectronSlides) && selectedElectronSlides.length > 0;

    if (!files.length && !hasElectronSelection) {
      setCarouselStatus("Seleziona almeno un'immagine prima di pubblicare.", true);
      return;
    }

    setCarouselStatus("Preparazione immagini in corso...");

    try {
      const payload = files.length
        ? await buildCarouselPayload(files, intervalSec)
        : {
            createdAt: Date.now(),
            intervalSec,
            slides: selectedElectronSlides
          };
      const carouselId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      localStorage.setItem(`${carouselStoragePrefix}${carouselId}`, JSON.stringify(payload));
      pruneOldCarouselEntries();

      const opened = await openPublishCarouselWindow(carouselId);
      if (!opened) {
        setCarouselStatus("Popup bloccato: abilita i popup o usa lo script PowerShell monitor 2.", true);
        return;
      }

      setCarouselStatus(`Carrellata avviata: ${payload.slides.length} immagini, ${intervalSec}s per slide.`);
    } catch (error) {
      console.error("Errore pubblicazione carrellata:", error);
      const isQuota = String(error?.message || "").toLowerCase().includes("quota");
      if (isQuota) {
        setCarouselStatus("Memoria browser piena: riduci numero/dimensione delle immagini.", true);
      } else {
        setCarouselStatus("Errore durante la pubblicazione della carrellata.", true);
      }
    }
  }

  async function publishCarouselFromFolder() {
    const intervalRaw = Number(carouselIntervalInput?.value || 6);
    const intervalSec = Number.isFinite(intervalRaw) ? Math.min(60, Math.max(1, Math.round(intervalRaw))) : 6;

    setCarouselStatus("Apertura carrellata da cartella VSC_Servizio...");
    const opened = await openPublishFolderCarouselWindow(intervalSec);
    if (!opened) {
      setCarouselStatus("Popup bloccato: abilita i popup o usa lo script PowerShell monitor 2.", true);
      return;
    }

    setCarouselStatus(`Carrellata da cartella avviata (${intervalSec}s per slide).`);
  }

  async function stopCarousel() {
    const route = "/bordero/pages/display.html";
    try {
      if (window.electronAPI?.windowManager?.openSecondaryPage) {
        const result = await window.electronAPI.windowManager.openSecondaryPage({ path: route });
        if (!result?.success) {
          throw new Error(result?.error || "Ripristino display non riuscito");
        }
      } else {
        window.open(route, "bordero-service-secondary");
      }
      setCarouselStatus("Carrellata terminata: display ripristinato.");
    } catch (error) {
      console.error("Errore arresto carrellata:", error);
      setCarouselStatus("Impossibile terminare la carrellata.", true);
    }
  }

  async function openPublishWindow(text) {
    const message = (text || "").trim() || defaultBannerText;
    const appRoute = `/userform/pages/servizio-pubblica.html?text=${encodeURIComponent(message)}`;

    if (window.electronAPI?.windowManager?.openSecondaryPage) {
      try {
        const result = await window.electronAPI.windowManager.openSecondaryPage({ path: appRoute });
        if (result?.success) {
          return;
        }
      } catch (error) {
        console.warn("Impossibile aprire la pagina servizio via Electron, fallback browser:", error);
      }
    }

    const url = `../pages/SERVIZIO-PUBBLICA.html?text=${encodeURIComponent(message)}`;
    const width = 900;
    const height = 700;
    const primaryLeft = screen.availLeft || 0;
    const primaryWidth = screen.availWidth || screen.width || 1600;
    const secondaryLeft = primaryLeft + primaryWidth + 40;
    const top = (screen.availTop || 0) + 60;
    const features = `width=${width},height=${height},left=${secondaryLeft},top=${top},resizable=yes,scrollbars=no`;

    window.open(url, "_blank", features);
  }

  async function publishText() {
    const value = input ? input.value : "";
    const text = saveInputValue(value);
    if (input) {
      input.value = text;
      input.blur();
    }
    await openPublishWindow(text);
  }

  function stopText() {
    if (input) {
      input.value = "";
    }
    saveInputValue("");
  }

  if (input) {
    const storedValue = readInputValue();
    input.value = storedValue === defaultBannerText ? "" : storedValue;
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        publishText();
      }
    });
  }

  if (publishTextBtn) {
    publishTextBtn.addEventListener("click", publishText);
  }

  if (stopTextBtn) {
    stopTextBtn.addEventListener("click", stopText);
  }

  if (publishLogoBtn) {
    publishLogoBtn.addEventListener("click", openLogoPicker);
  }

  if (publishLogoLabel) {
    publishLogoLabel.addEventListener("click", openLogoPicker);
    publishLogoLabel.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openLogoPicker();
      }
    });
  }

  if (publishFileBtn) {
    publishFileBtn.addEventListener("click", () => openExternal("../../Prova/Image.html"));
  }

  if (publishCarouselBtn) {
    publishCarouselBtn.addEventListener("click", publishCarousel);
  }

  if (carouselImagesInput) {
    const pickFromServizioFolder = async (event) => {
      if (!window.electronAPI?.filePicker?.pickImagesFromServizio) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      try {
        const result = await window.electronAPI.filePicker.pickImagesFromServizio();
        if (!result || result.canceled) {
          return;
        }

        const baseDir = String(result.baseDir || servizioBaseDirDefault)
          .trim()
          .replace(/\//g, '\\')
          .replace(/[\\]+$/, '')
          .toLowerCase();
        const picked = Array.isArray(result.filePaths) ? result.filePaths : [];
        const mapped = picked
          .map((filePath) => String(filePath || '').trim())
          .filter(Boolean)
          .map((filePath) => {
            const normalized = filePath.replace(/\//g, '\\');
            const lower = normalized.toLowerCase();
            if (!lower.startsWith(baseDir + '\\') && lower !== baseDir) {
              return null;
            }
            const fileName = normalized.split('\\').pop();
            if (!fileName) {
              return null;
            }
            return {
              name: fileName,
              url: `/servizio-media/${encodeURIComponent(fileName)}?t=${Date.now()}`
            };
          })
          .filter(Boolean);

        selectedElectronSlides = mapped;

        if (!mapped.length) {
          setCarouselStatus(`Nessun file valido in ${servizioBaseDirDefault}.`, true);
          return;
        }

        if (carouselImagesInput) {
          carouselImagesInput.title = `${mapped.length} immagini selezionate da ${servizioBaseDirDefault}`;
        }
        setCarouselStatus(`Selezionate ${mapped.length} immagini da ${servizioBaseDirDefault}.`);
      } catch (error) {
        console.error('Errore selezione immagini servizio:', error);
        setCarouselStatus('Errore apertura selettore file VSC_Servizio.', true);
      }
    };

    carouselImagesInput.addEventListener("click", pickFromServizioFolder);
    carouselImagesInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        pickFromServizioFolder(event);
      }
    });
  }

  if (publishCarouselFolderBtn) {
    publishCarouselFolderBtn.addEventListener("click", publishCarouselFromFolder);
  }

  if (stopCarouselBtn) {
    stopCarouselBtn.addEventListener("click", stopCarousel);
  }

  if (indexBtn) {
    indexBtn.addEventListener("click", () => {
      window.location.href = "../index.html";
    });
  }

  if (closeBtn || closeWindowBtn) {
    const closeAction = () => {
      if (window.close) {
        window.close();
      }
      try {
        window.open("", "_self").close();
      } catch (error) {
        // browser blocks immediate close in some contexts: ignore
      }
    };

    [closeBtn, closeWindowBtn].forEach((button) => {
      if (button) {
        button.addEventListener("click", closeAction);
      }
    });
  }
})();
