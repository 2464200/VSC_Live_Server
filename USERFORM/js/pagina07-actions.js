(function () {
  const webcam = document.getElementById("webcam-name");
  const resolution = document.getElementById("camera-resolution");
  const fps = document.getElementById("camera-fps");
  const bitrate = document.getElementById("camera-bitrate");
  const preview = document.getElementById("preview-box");
  const chipRec = document.getElementById("rec-state-chip");
  const chipTimer = document.getElementById("timer-chip");
  const statusNode = document.getElementById("pagina07-status");
  const btnClose = document.getElementById("btn-close-pagina07");

  let recording = false;
  let startTs = 0;
  let timerId = null;
  const recStoreKey = "userform_pagina07_recordings";

  const setStatus = (msg) => {
    if (statusNode) {
      statusNode.innerHTML = `<strong>Stato:</strong> ${msg}`;
    }
  };

  const fill = (node, items, selected) => {
    if (!node) return;
    node.innerHTML = "";
    items.forEach((item) => {
      const o = document.createElement("option");
      o.value = item;
      o.textContent = item;
      node.appendChild(o);
    });
    if (selected && items.includes(selected)) {
      node.value = selected;
    }
  };

  fill(webcam, ["CyberLink Webcam Splitter", "GRANDSTREAM GUV3100", "HP Display Camera", "USB Camera"]);
  fill(resolution, ["640x480", "800x600", "1280x720", "1920x1080"], "640x480");
  fill(fps, ["15", "25", "30"], "30");

  const refreshPreviewText = () => {
    if (!preview) return;
    preview.textContent = `Camera: ${webcam?.value || "-"} | Risoluzione: ${resolution?.value || "-"} | FPS: ${fps?.value || "-"} | Bitrate: ${bitrate?.value || "-"}`;
  };

  [webcam, resolution, fps, bitrate].forEach((el) => {
    el?.addEventListener("change", () => {
      refreshPreviewText();
      setStatus("Aggiornata configurazione preview camera.");
    });
  });

  const tick = () => {
    if (!recording) return;
    const sec = Math.max(0, Math.floor((Date.now() - startTs) / 1000));
    const hh = String(Math.floor(sec / 3600)).padStart(2, "0");
    const mm = String(Math.floor((sec % 3600) / 60)).padStart(2, "0");
    const ss = String(sec % 60).padStart(2, "0");
    if (chipTimer) chipTimer.textContent = `${hh}:${mm}:${ss}`;
  };

  const saveRecording = () => {
    const raw = localStorage.getItem(recStoreKey);
    const list = raw ? JSON.parse(raw) : [];
    const item = {
      name: `rec_${new Date().toISOString().replace(/[:.]/g, "-")}.mp4`,
      timestamp: Date.now(),
      webcam: webcam?.value || "",
      resolution: resolution?.value || "",
      fps: fps?.value || "",
      bitrate: bitrate?.value || ""
    };
    list.push(item);
    localStorage.setItem(recStoreKey, JSON.stringify(list));
    return item;
  };

  document.getElementById("btn-rec-start")?.addEventListener("click", () => {
    if (recording) return;
    recording = true;
    startTs = Date.now();
    timerId = window.setInterval(tick, 1000);
    if (chipRec) chipRec.textContent = "REC: ON";
    setStatus("StartRecording1000 avviato (simulazione web).");
  });

  document.getElementById("btn-rec-stop")?.addEventListener("click", () => {
    if (!recording) return;
    recording = false;
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
    }
    if (chipRec) chipRec.textContent = "REC: OFF";
    const item = saveRecording();
    setStatus(`StopRecording1000 completato. Salvato: ${item.name}`);
  });

  document.getElementById("btn-open-last-video")?.addEventListener("click", () => {
    const raw = localStorage.getItem(recStoreKey);
    const list = raw ? JSON.parse(raw) : [];
    if (!list.length) {
      setStatus("Nessun video trovato (storico locale vuoto).");
      return;
    }
    const last = list[list.length - 1];
    setStatus(`CommandButton1003: apertura ultimo video richiesta: ${last.name}`);
  });

  if (btnClose) {
    btnClose.addEventListener("click", () => {
      if (timerId) clearInterval(timerId);
      const referrer = document.referrer || "";
      if (referrer.includes("/USERFORM/")) {
        window.history.back();
        return;
      }
      window.location.href = "../index.html";
    });
  }

  refreshPreviewText();
})();
