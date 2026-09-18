(function () {
  const statusNode = document.getElementById("pagina06-status");

  const setStatus = (msg) => {
    if (statusNode) {
      statusNode.innerHTML = `<strong>Stato:</strong> ${msg}`;
    }
  };

  document.querySelectorAll("button[data-link]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const url = btn.getAttribute("data-link") || "";
      if (!url) {
        return;
      }
      openManagedPage(url);
      setStatus(`apertura link richiesta: ${url}`);
    });
  });

  document.getElementById("btn-close-pagina06")?.addEventListener("click", () => {
    const referrer = document.referrer || "";
    if (referrer.includes("/USERFORM/")) {
      window.history.back();
      return;
    }
    window.location.href = "../index.html";
  });
})();
