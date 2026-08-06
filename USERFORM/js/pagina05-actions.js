(function () {
  const cameraNode = document.getElementById("camera-name-05");
  const recListNode = document.getElementById("recording-list-05");
  const codecChip = document.getElementById("cam-codec-chip");
  const sizeChip = document.getElementById("cam-size-chip");
  const fpsChip = document.getElementById("cam-fps-chip");
  const vlcChip = document.getElementById("vlc-state-chip");
  const recChip = document.getElementById("rec-state-chip-05");
  const statusNode = document.getElementById("pagina05-status");

  let recording = false;
  let vlcRunning = false;
  let cameraProfiles = [];

  const setStatus = (msg) => {
    if (statusNode) {
      statusNode.innerHTML = `<strong>Stato:</strong> ${msg}`;
    }
  };

  const fetchJson = async (url, options = {}) => {
    const response = await fetch(url, {
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      ...options
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data?.ok === false || data?.success === false) {
      const err = data?.error || `HTTP ${response.status}`;
      throw new Error(err);
    }
    return data;
  };

  const refreshProfile = () => {
    const selected = cameraProfiles.find((c) => c.name === cameraNode?.value);
    if (!selected) {
      return;
    }
    if (codecChip) codecChip.textContent = `Codec: ${selected.codec}`;
    if (sizeChip) sizeChip.textContent = `Size: ${selected.size}`;
    if (fpsChip) fpsChip.textContent = `FPS: ${selected.fps}`;
    setStatus(`ComboBox2_Change: profilo camera applicato a ${selected.name}`);
  };

  const renderRecordingList = (mkv = []) => {
    if (!recListNode) return;
    recListNode.innerHTML = "";
    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = mkv.length ? "Seleziona file" : "Nessun file MKV";
    recListNode.appendChild(empty);
    mkv.forEach((item) => {
      const o = document.createElement("option");
      o.value = item.name;
      o.textContent = item.name;
      recListNode.appendChild(o);
    });
  };

  const syncState = async () => {
    const state = await fetchJson("/api/userform/pagina05/state");
    recording = Boolean(state?.recording?.recording);
    vlcRunning = Boolean(state?.liveVlc?.alive);
    if (recChip) recChip.textContent = recording ? "REC: ON" : "REC: OFF";
    if (vlcChip) vlcChip.textContent = vlcRunning ? "VLC: ON" : "VLC: OFF";
    return state;
  };

  const refreshRecList = async () => {
    const files = await fetchJson("/api/userform/pagina05/files");
    renderRecordingList(files?.mkvFiles || []);
    return files;
  };

  const loadCameraProfiles = async () => {
    const data = await fetchJson("/api/userform/pagina05/cameras");
    cameraProfiles = data?.cameras || [];

    if (!cameraNode) return;
    cameraNode.innerHTML = "";
    cameraProfiles.forEach((c) => {
      const opt = document.createElement("option");
      opt.value = c.name;
      opt.textContent = c.name;
      cameraNode.appendChild(opt);
    });

    if (cameraProfiles.length) {
      cameraNode.value = cameraProfiles[0].name;
    }
    refreshProfile();
  };

  const selectedProfilePayload = () => {
    const profile = cameraProfiles.find((c) => c.name === cameraNode?.value) || {};
    return {
      cameraName: cameraNode?.value || "",
      codec: profile.codec || "",
      size: profile.size || "",
      fps: profile.fps || ""
    };
  };

  if (cameraNode) {
    cameraNode.addEventListener("change", refreshProfile);
  }

  document.getElementById("btn-rec-start-05")?.addEventListener("click", async () => {
    try {
      if (recording) {
        setStatus("Registrazione gia attiva.");
        return;
      }
      const payload = selectedProfilePayload();
      const out = await fetchJson("/api/userform/pagina05/recording/start", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      recording = true;
      if (recChip) recChip.textContent = "REC: ON";
      await refreshRecList();
      setStatus(`StartRecording: avviata registrazione ${out.fileName}.`);
    } catch (error) {
      setStatus(`Errore StartRecording: ${error.message}`);
    }
  });

  document.getElementById("btn-rec-stop-05")?.addEventListener("click", async () => {
    try {
      const out = await fetchJson("/api/userform/pagina05/recording/stop", {
        method: "POST",
        body: JSON.stringify({})
      });
      recording = false;
      if (recChip) recChip.textContent = "REC: OFF";
      await refreshRecList();
      setStatus(out.stopped ? "StopRecording: registrazione terminata." : "Nessuna registrazione FFmpeg rilevata.");
    } catch (error) {
      setStatus(`Errore StopRecording: ${error.message}`);
    }
  });

  document.getElementById("btn-convert-play-05")?.addEventListener("click", async () => {
    try {
      const selected = recListNode?.value || "";
      if (!selected) {
        setStatus("Seleziona un file dal ComboBox1 prima di convertire.");
        return;
      }
      const out = await fetchJson("/api/userform/pagina05/convert-play", {
        method: "POST",
        body: JSON.stringify({ fileName: selected })
      });
      const outputName = out.outputFile?.split(/[\\/]/).pop() || out.outputFile;
      setStatus(`Conversione completata e riproduzione VLC avviata: ${outputName}`);
    } catch (error) {
      setStatus(`Errore ConvertAndPlay: ${error.message}`);
    }
  });

  document.getElementById("btn-vlc-start")?.addEventListener("click", async () => {
    try {
      if (vlcRunning) {
        setStatus("VLC gia in esecuzione.");
        return;
      }
      const payload = selectedProfilePayload();
      await fetchJson("/api/userform/pagina05/vlc/live/start", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      vlcRunning = true;
      if (vlcChip) vlcChip.textContent = "VLC: ON";
      setStatus("CommandButton4: anteprima VLC live avviata.");
    } catch (error) {
      setStatus(`Errore avvio VLC live: ${error.message}`);
    }
  });

  document.getElementById("btn-vlc-stop")?.addEventListener("click", async () => {
    try {
      await fetchJson("/api/userform/pagina05/vlc/live/stop", {
        method: "POST",
        body: JSON.stringify({})
      });
      vlcRunning = false;
      if (vlcChip) vlcChip.textContent = "VLC: OFF";
      setStatus("CommandButton5: anteprima VLC live fermata.");
    } catch (error) {
      setStatus(`Errore stop VLC live: ${error.message}`);
    }
  });

  document.getElementById("btn-autotest-tools")?.addEventListener("click", async () => {
    try {
      const out = await fetchJson("/api/userform/pagina05/autotest", {
        method: "POST",
        body: JSON.stringify({})
      });
      const checks = out?.checks || {};
      const summary = out?.summary || {};
      setStatus(
        `AutoTestTools OK - cam:${summary.cameras ?? 0}, mkv:${summary.mkvFiles ?? 0}, ffmpeg:${checks.ffmpegFound ? "OK" : "KO"}, vlc:${checks.vlcFound ? "OK" : "KO"}`
      );
      await syncState();
      await refreshRecList();
    } catch (error) {
      setStatus(`Errore AutoTestTools: ${error.message}`);
    }
  });

  document.getElementById("btn-close-pagina05")?.addEventListener("click", () => {
    const referrer = document.referrer || "";
    if (referrer.includes("/USERFORM/")) {
      window.history.back();
      return;
    }
    window.location.href = "../index.html";
  });

  const bootstrap = async () => {
    try {
      await loadCameraProfiles();
      await syncState();
      await refreshRecList();
      setStatus("PAGINA05 pronta: camera da CSV Bordero e runtime backend attivo.");
    } catch (error) {
      setStatus(`Errore inizializzazione PAGINA05: ${error.message}`);
    }
  };

  bootstrap();
})();
