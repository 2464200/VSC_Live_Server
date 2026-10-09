(function () {
  const secondaryPresentation = new URLSearchParams(window.location.search).get("display") === "secondary";
  document.body.classList.toggle("qrcode-secondary-presentation", secondaryPresentation);

  // Feedback sul caricamento del PDF
  const pdfViewer = document.getElementById("pdf-viewer");
  if (pdfViewer) {
    pdfViewer.addEventListener("load", () => {
      console.log("✅ PDF caricato: Cartello-QR-CODE.pdf");
    });
    pdfViewer.addEventListener("error", () => {
      console.warn("⚠️ Errore nel caricamento del PDF");
    });
  }

  document.getElementById("btn-close-qrcode-bottom")?.addEventListener("click", () => {
    window.location.href = "../index.html";
  });
})();
