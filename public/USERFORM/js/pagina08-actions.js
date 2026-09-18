(function () {
  const statusNode = document.getElementById("pagina08-status");
  const baseUrl = window.location.origin && window.location.origin !== "null"
    ? window.location.origin
    : "http://127.0.0.1:5500";

  const setStatus = (msg) => {
    if (statusNode) {
      statusNode.innerHTML = `<strong>Stato:</strong> ${msg}`;
    }
  };

  document.getElementById("btn-scriptpdf-root")?.addEventListener("click", () => {
    const full = `${baseUrl}/ScriptPDF1.html`;
    openManagedPage(full);
    setStatus(`apertura richiesta: ${full}`);
  });

  document.getElementById("btn-scriptpdf-prova")?.addEventListener("click", () => {
    const full = `${baseUrl}/prova/ScriptPDF1.html`;
    openManagedPage(full);
    setStatus(`apertura richiesta: ${full}`);
  });

  document.getElementById("btn-close-pagina08")?.addEventListener("click", () => {
    const referrer = document.referrer || "";
    if (referrer.includes("/USERFORM/")) {
      window.history.back();
      return;
    }
    window.location.href = "../index.html";
  });
})();
