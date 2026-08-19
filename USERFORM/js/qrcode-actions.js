(function () {
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
})();
