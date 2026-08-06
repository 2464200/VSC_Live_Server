(function () {
  const statusNode = document.getElementById("pagina09-status");
  const baseUrl = window.location.origin && window.location.origin !== "null"
    ? window.location.origin
    : "http://127.0.0.1:5500";

  const setStatus = (msg) => {
    if (statusNode) {
      statusNode.innerHTML = `<strong>Stato:</strong> ${msg}`;
    }
  };

  document.getElementById("btn-open-bordero")?.addEventListener("click", () => {
    const full = `${baseUrl}/Bordero/pages/bordero.html`;
    window.open(full, "_blank", "noopener,noreferrer");
    setStatus(`apertura richiesta: ${full}`);
  });

  document.getElementById("btn-open-eventi")?.addEventListener("click", () => {
    const full = `${baseUrl}/Eventi/public/eventi.html`;
    window.open(full, "_blank", "noopener,noreferrer");
    setStatus(`apertura richiesta: ${full}`);
  });

  document.getElementById("btn-close-pagina09")?.addEventListener("click", () => {
    const referrer = document.referrer || "";
    if (referrer.includes("/USERFORM/")) {
      window.history.back();
      return;
    }
    window.location.href = "../index.html";
  });
})();
