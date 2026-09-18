(function () {
  const statusNode = document.getElementById("pagina04-status");
  const baseUrl = window.location.origin && window.location.origin !== "null"
    ? window.location.origin
    : "http://127.0.0.1:5500";

  const setStatus = (msg) => {
    if (statusNode) {
      statusNode.innerHTML = `<strong>Stato:</strong> ${msg}`;
    }
  };

  document.querySelectorAll("button[data-open]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const path = btn.getAttribute("data-open") || "";
      const full = `${baseUrl}${path}`;
      openManagedPage(full);
      setStatus(`apertura richiesta: ${full}`);
    });
  });

  document.getElementById("btn-open-pdf-legacy")?.addEventListener("click", () => {
    const full = "http://localhost:8765/Prova/ScriptPDF1.html";
    openManagedPage(full);
    setStatus(`apertura richiesta: ${full}`);
  });

  document.getElementById("btn-prev-file")?.addEventListener("click", () => {
    setStatus("CommandButton63: placeholder file precedente (nessuna logica VBA implementata nel form). ");
  });

  document.getElementById("btn-next-file")?.addEventListener("click", () => {
    setStatus("CommandButton64: placeholder file successivo (nessuna logica VBA implementata nel form). ");
  });

  document.getElementById("btn-close-pagina04")?.addEventListener("click", () => {
    const referrer = document.referrer || "";
    if (referrer.includes("/USERFORM/")) {
      window.history.back();
      return;
    }
    window.location.href = "../index.html";
  });

  document.getElementById("btn-close-acrobat")?.addEventListener("click", () => {
    setStatus("CommandButton65: richiesta chiusura Acrobat simulata in web. Ritorno a indice USERFORM.");
    window.location.href = "../index.html";
  });
})();
