(function () {
  const statusNode = document.getElementById("pagina10-status");
  const chipDash = document.getElementById("chip-dash-state");
  const chipUi = document.getElementById("chip-ui-state");
  const textbox = document.getElementById("dash-textbox");
  const btnClose = document.getElementById("btn-close-pagina10");

  let dashRunning = false;
  let uiTimer = null;

  const setStatus = (msg) => {
    if (statusNode) {
      statusNode.innerHTML = `<strong>Stato:</strong> ${msg}`;
    }
  };

  const setDash = (state) => {
    dashRunning = state;
    if (chipDash) chipDash.textContent = `DASH: ${state ? "ON" : "OFF"}`;
  };

  const startUiTimer = () => {
    if (uiTimer) {
      return;
    }
    if (chipUi) chipUi.textContent = "UI TIMER: ON";
    uiTimer = window.setInterval(() => {
      if (textbox) {
        textbox.value = `Aggiornamento UI: ${new Date().toLocaleTimeString("it-IT")}`;
      }
    }, 1000);
    setStatus("StartTextBoxTimer: UI timer avviato.");
  };

  const stopUiTimer = () => {
    if (!uiTimer) {
      return;
    }
    window.clearInterval(uiTimer);
    uiTimer = null;
    if (chipUi) chipUi.textContent = "UI TIMER: OFF";
    if (textbox) textbox.value = "UI timer fermo.";
    setStatus("StopTextBoxTimer: UI timer fermato.");
  };

  document.getElementById("btn-dash-start")?.addEventListener("click", () => {
    setDash(true);
    setStatus("AvviaDashLoop eseguito (simulazione web). ");
  });

  document.getElementById("btn-dash-stop")?.addEventListener("click", () => {
    setDash(false);
    setStatus("FermaDashLoop eseguito (simulazione web). ");
  });

  document.getElementById("btn-ui-start")?.addEventListener("click", startUiTimer);
  document.getElementById("btn-ui-stop")?.addEventListener("click", stopUiTimer);

  if (btnClose) {
    btnClose.addEventListener("click", () => {
      stopUiTimer();
      setDash(false);
      const referrer = document.referrer || "";
      if (referrer.includes("/USERFORM/")) {
        window.history.back();
        return;
      }
      window.location.href = "../index.html";
    });
  }

  window.addEventListener("beforeunload", () => {
    stopUiTimer();
    setDash(false);
  });

  // UserForm_Initialize equivalent
  startUiTimer();
})();
