(function () {
  const input = document.getElementById("service-message-input");
  const publishTextBtn = document.getElementById("publish-text-btn");
  const stopTextBtn = document.getElementById("stop-text-btn");
  const publishLogoBtn = document.getElementById("publish-logo-btn");
  const publishFileBtn = document.getElementById("publish-file-btn");
  const indexBtn = document.getElementById("index-btn");
  const closeBtn = document.getElementById("close-btn");
  const closeWindowBtn = document.getElementById("close-window-btn");

  const defaultBannerText = "la serata inizierà a breve";

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

  function openPublishWindow(text) {
    const message = (text || "").trim() || defaultBannerText;
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

  function publishText() {
    const value = input ? input.value : "";
    const text = saveInputValue(value);
    if (input) {
      input.value = text;
      input.blur();
    }
    openPublishWindow(text);
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
    publishLogoBtn.addEventListener("click", () => openExternal("../../Prova/Logo.html"));
  }

  if (publishFileBtn) {
    publishFileBtn.addEventListener("click", () => openExternal("../../Prova/Image.html"));
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
