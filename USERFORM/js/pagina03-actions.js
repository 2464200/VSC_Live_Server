(function () {
  const captionNode = document.getElementById("pagina03-caption");
  const textD2 = document.getElementById("textbox-report-d2");
  const statusNode = document.getElementById("pagina03-status");
  const timerChip = document.getElementById("report-timer-chip");
  const btnTimer = document.getElementById("btn-toggle-report-timer");
  const btnClose = document.getElementById("btn-close-pagina03");

  const baseUrl = window.location.origin && window.location.origin !== "null"
    ? window.location.origin
    : "http://127.0.0.1:5500";

  let timerId = null;

  const setStatus = (msg) => {
    if (statusNode) {
      statusNode.innerHTML = `<strong>Stato:</strong> ${msg}`;
    }
  };

  if (captionNode) {
    captionNode.textContent = "DJ'S BORDERO' - 2025 [DJ LUCAS BERRY]";
  }

  const d2Key = "userform_pagina03_d2";
  if (textD2) {
    textD2.value = localStorage.getItem(d2Key) || "";
    textD2.style.fontSize = "24px";
    textD2.style.color = "rgb(255, 0, 0)";
    textD2.addEventListener("input", () => {
      localStorage.setItem(d2Key, textD2.value);
      setStatus("TextBox1_Change: aggiornato Publisher-Show!D2 (simulazione locale).");
    });
  }

  const openPath = (path) => {
    const full = `${baseUrl}${path}`;
    window.open(full, "_blank", "noopener,noreferrer");
    setStatus(`apertura richiesta: ${full}`);
  };

  document.getElementById("btn-report-default")?.addEventListener("click", () => openPath("/Prova/Report.html"));
  document.getElementById("btn-report-black")?.addEventListener("click", () => openPath("/Prova/Report_black.html"));
  document.getElementById("btn-report-white")?.addEventListener("click", () => openPath("/Prova/Report_white.html"));

  document.getElementById("btn-genera-report")?.addEventListener("click", () => {
    setStatus("CommandButton33: GeneraReportHTML eseguito (stub web). Prossima esecuzione disponibile via timer.");
  });

  document.getElementById("btn-genera-siae")?.addEventListener("click", () => {
    setStatus("CommandButton346: GeneraFileSIAE eseguito (stub web). ");
  });

  if (btnTimer) {
    btnTimer.addEventListener("click", () => {
      if (timerId) {
        clearInterval(timerId);
        timerId = null;
        if (timerChip) timerChip.textContent = "Timer report: OFF";
        setStatus("FermaTimerReport: timer disattivato.");
        return;
      }

      if (timerChip) timerChip.textContent = "Timer report: ON (3 min)";
      timerId = window.setInterval(() => {
        setStatus("AvviaTimerReport: trigger automatico AggiornaReportHTML (simulazione). ");
      }, 180000);
      setStatus("AvviaTimerReport: timer attivato ogni 3 minuti.");
    });
  }

  if (btnClose) {
    btnClose.addEventListener("click", () => {
      const referrer = document.referrer || "";
      if (referrer.includes("/USERFORM/")) {
        window.history.back();
        return;
      }
      window.location.href = "../index.html";
    });
  }
})();
