(function () {
  const statusNode = document.getElementById("indice-status");
  const captionNode = document.getElementById("indice-caption");

  const setStatus = (text) => {
    if (statusNode) {
      statusNode.innerHTML = `<strong>Stato:</strong> ${text}`;
    }
  };

  if (captionNode) {
    captionNode.textContent = "DJ'S BORDERO' - 2025 [DJ LUCAS BERRY]";
  }

  const sheetMain = document.getElementById("btn-sheet-main");
  const sheetGid = document.getElementById("btn-sheet-gid");

  if (sheetMain) {
    sheetMain.href = "https://docs.google.com/spreadsheets/d/1LfaAi0A5Hfws8sYO_6gapiuQ2na9Lpu3f68slJ35CtE/edit?usp=sharing";
  }

  if (sheetGid) {
    sheetGid.href = "https://docs.google.com/spreadsheets/d/1LfaAi0A5Hfws8sYO_6gapiuQ2na9Lpu3f68slJ35CtE/edit?gid=1644446046#gid=1644446046";
  }

  const btnPpt = document.getElementById("btn-open-ppt");
  const btnWord = document.getElementById("btn-open-word");
  const btnClose = document.getElementById("btn-close-indice");

  if (btnPpt) {
    btnPpt.addEventListener("click", () => {
      setStatus("azione VBA rilevata: aprire show_LISTA ver 1.0.1.pptm nella cartella del file Excel.");
    });
  }

  if (btnWord) {
    btnWord.addEventListener("click", () => {
      setStatus("azione VBA rilevata: aprire show_slide_word.docx nella cartella del file Excel.");
    });
  }

  if (btnClose) {
    btnClose.addEventListener("click", () => {
      const referrer = document.referrer || "";
      if (referrer.includes("/USERFORM/") || referrer.endsWith("/USERFORM/index.html")) {
        window.history.back();
        return;
      }

      window.location.href = "../index.html";
    });
  }
})();
