(function () {
  const statusNode = document.getElementById("script-pdf-status");
  const statusMessage = statusNode?.querySelector(".script-pdf-status-message");

  function setStatus(message, state = "ready") {
    if (statusNode && statusMessage) {
      statusNode.dataset.state = state;
      statusMessage.textContent = message;
    }
  }

  async function openScriptPdf(button) {
    const route = button.dataset.route;

    try {
      const target = new URL(route, window.location.origin);
      const isScriptPdfRoute = /^\/(?:pdf\/pages\/script-pdf-(?:gestione|prova)\.html|(?:prova\/)?scriptpdf1\.html|pdf\/viewers\/scriptpdf1\.html)$/i.test(target.pathname);
      if (target.origin !== window.location.origin || !isScriptPdfRoute) {
        throw new Error("Percorso ScriptPDF non valido.");
      }

      const openManagedRoute = window.electronAPI?.windowManager?.openSecondaryPage;
      if (typeof openManagedRoute === "function") {
        const result = await openManagedRoute({ path: `${target.pathname}${target.search}${target.hash}` });
        if (!result?.success) {
          throw new Error("Electron non ha completato l'apertura della pagina.");
        }
      } else if (typeof window.openManagedPage !== "function" || !window.openManagedPage(target.href)) {
        throw new Error("Il gestore di apertura delle pagine non è disponibile.");
      }

      const label = button.dataset.label || button.textContent.trim().replace(/\s*↗\s*$/, "");
      setStatus(`Apertura richiesta: ${label}.`);
    } catch (error) {
      setStatus(`Impossibile aprire ScriptPDF: ${error.message}`, "error");
    }
  }

  document.querySelectorAll(".script-pdf-open-link[data-route]").forEach((button) => {
    button.addEventListener("click", () => void openScriptPdf(button));
  });

  document.getElementById("btn-close-script-pdf")?.addEventListener("click", () => {
    if (document.referrer.includes("/USERFORM/")) {
      window.history.back();
      return;
    }

    window.location.href = "../index.html";
  });
})();
