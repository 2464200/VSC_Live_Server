(function () {
  const captionNode = document.getElementById("servizio-caption");
  const listBody = document.getElementById("listbox-richieste-body");
  const textbox6 = document.getElementById("textbox6");
  const nextPreview = document.getElementById("nextcoreo-preview");
  const statusNode = document.getElementById("servizio-status");
  const btnCloseForm = document.getElementById("btn-close-servizio");
  const btnOpenLogo = document.getElementById("btn-open-logo");
  const btnOpenImage = document.getElementById("btn-open-image");
  const btnOpenServizio = document.getElementById("btn-open-servizio");
  const btnCloseExternal = document.getElementById("btn-close-external");

  let externalWindow = null;

  const baseUrl = window.location.origin && window.location.origin !== "null"
    ? window.location.origin
    : "http://localhost:5500";

  const setStatus = (msg) => {
    if (statusNode) {
      statusNode.innerHTML = `<strong>Stato:</strong> ${msg}`;
    }
  };

  if (captionNode) {
    captionNode.textContent = "DJ'S BORDERO' - 2025 [DJ LUCAS BERRY]";
  }

  if (listBody) {
    const rows = [];
    for (let i = 1; i <= 20; i += 1) {
      rows.push({
        colA: `A${i}`,
        colB: `Publisher row ${i}`
      });
    }

    listBody.innerHTML = rows
      .map((row) => `<tr><td>${row.colA}</td><td>${row.colB}</td></tr>`)
      .join("");
  }

  if (textbox6) {
    textbox6.addEventListener("input", () => {
      const phrase = textbox6.value || "";

      if (nextPreview) {
        nextPreview.textContent = phrase || "(vuoto)";
      }

      setStatus("TextBox6_Change simulato: aggiornato NEXTCOREO!A10 e richiesta scrittura CSV.");
    });
  }

  const openExternal = (path) => {
    const full = `${baseUrl}${path}`;
    externalWindow = window.open(full, "_blank", "noopener,noreferrer");
    setStatus(`apertura richiesta: ${full}`);
  };

  if (btnOpenLogo) {
    btnOpenLogo.addEventListener("click", () => openExternal("/prova/logo.html"));
  }

  if (btnOpenImage) {
    btnOpenImage.addEventListener("click", () => openExternal("/prova/image.html"));
  }

  if (btnOpenServizio) {
    btnOpenServizio.addEventListener("click", () => openExternal("/servizio.html"));
  }

  if (btnCloseExternal) {
    btnCloseExternal.addEventListener("click", () => {
      if (externalWindow && !externalWindow.closed) {
        externalWindow.close();
        setStatus("finestra esterna chiusa (quando consentito dal browser).");
        return;
      }

      setStatus("nessuna finestra esterna tracciata da chiudere.");
    });
  }

  if (btnCloseForm) {
    btnCloseForm.addEventListener("click", () => {
      const referrer = document.referrer || "";
      if (referrer.includes("/USERFORM/")) {
        window.history.back();
        return;
      }

      window.location.href = "../index.html";
    });
  }
})();
