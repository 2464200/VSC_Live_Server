(function () {
  const cameraNode = document.getElementById("camera-name-05");
  const recListNode = document.getElementById("recording-list-05");
  const playbackListNode = document.getElementById("recordings-play-list-05");
  const webcamShellNode = document.getElementById("webcam-shell-05");
  const webcamSlideNode = document.getElementById("webcam-slide-05");
  const webcamPreviewNode = document.getElementById("webcam-preview-05");
  const webcamSignalNode = document.getElementById("webcam-signal-05");
  const webcamSignalTextNode = document.getElementById("webcam-signal-text-05");
  const secondaryPlayerStateNode = document.getElementById("secondary-player-state-05");
  const codecChip = document.getElementById("cam-codec-chip");
  const sizeChip = document.getElementById("cam-size-chip");
  const fpsChip = document.getElementById("cam-fps-chip");
  const vlcChip = document.getElementById("vlc-state-chip");
  const recChip = document.getElementById("rec-state-chip-05");
  const statusNode = document.getElementById("pagina05-status");

  let recording = false;
  let vlcRunning = false;
  let cameraProfiles = [];
  let preferredCameraName = "";
  let availableRecordings = [];
  let selectedRecordingName = "";
  let localPreviewStream = null;
  let localPreviewCameraName = "";
  let previewSuspendedForLive = false;
  let secondaryPlayerPollTimer = null;
  let indicatorWarningReason = "";

  const setStatus = (msg) => {
    if (statusNode) {
      statusNode.innerHTML = `<strong>Stato:</strong> ${msg}`;
    }
  };

  const normalizeCell = (value) => String(value ?? "").replace(/^\uFEFF/, "").replace(/\s+/g, " ").trim();

  const setWebcamSignal = (state, text, warningReason = "") => {
    if (webcamSignalNode) {
      webcamSignalNode.dataset.state = state;
      webcamSignalNode.setAttribute("aria-label", `Spia stato webcam secondaria: ${text}`);
      if (warningReason) {
        webcamSignalNode.title = warningReason;
      } else {
        webcamSignalNode.removeAttribute("title");
      }
    }
    if (webcamSignalTextNode) {
      webcamSignalTextNode.textContent = text;
    }
    indicatorWarningReason = warningReason;
  };

  const refreshWebcamSignal = ({ warningReason = indicatorWarningReason } = {}) => {
    if (warningReason) {
      setWebcamSignal("warning", "Anomalia", warningReason);
      return;
    }

    if (vlcRunning) {
      setWebcamSignal("live", "Live monitor 2");
      return;
    }

    setWebcamSignal("idle", "Riposo");
  };

  const parseCsvRows = (text) => {
    const rows = [];
    let row = [];
    let cell = "";
    let inQuotes = false;

    for (let i = 0; i < text.length; i += 1) {
      const ch = text[i];
      const next = text[i + 1];

      if (ch === '"') {
        if (inQuotes && next === '"') {
          cell += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }

      if (ch === "," && !inQuotes) {
        row.push(cell);
        cell = "";
        continue;
      }

      if ((ch === "\n" || ch === "\r") && !inQuotes) {
        if (ch === "\r" && next === "\n") i += 1;
        row.push(cell);
        rows.push(row);
        row = [];
        cell = "";
        continue;
      }

      cell += ch;
    }

    if (cell.length || row.length) {
      row.push(cell);
      rows.push(row);
    }

    return rows;
  };

  const mapCameraCsvToProfiles = (csvText) => {
    const rows = parseCsvRows(csvText.replace(/^\uFEFF/, ""));
    if (!rows.length) return [];

    const headers = rows[0].map((h) => normalizeCell(h).toLowerCase());
    const byHeader = (source, names) => {
      for (const name of names) {
        const idx = headers.indexOf(name);
        if (idx >= 0) return normalizeCell(source[idx]);
      }
      return "";
    };

    return rows
      .slice(1)
      .map((source) => {
        const name = byHeader(source, ["value"]);
        if (!name) return null;

        const isDefaultRaw = byHeader(source, ["is-default", "isdefault"]);
        const isEnabledRaw = byHeader(source, ["is-enabled", "isenabled"]);
        const isEnabled = !["0", "false", "no", "n"].includes(normalizeCell(isEnabledRaw).toLowerCase());
        if (!isEnabled) return null;

        return {
          name,
          codec: byHeader(source, ["codifica", "codec", "last-codec"]),
          size: byHeader(source, ["dshow-size", "size", "dshowsize", "last-size"]),
          fps: byHeader(source, ["dshow-fps", "fps", "dshowfps", "last-fps"]),
          label: byHeader(source, ["elenco webcam", "label", "descrizione"]),
          isDefault: ["1", "true", "yes", "y", "si"].includes(normalizeCell(isDefaultRaw).toLowerCase())
        };
      })
      .filter(Boolean);
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

  const isElectronVideoPlayerAvailable = () => {
    return Boolean(window.electronAPI && window.electronAPI.videoPlayer && typeof window.electronAPI.videoPlayer.play === "function");
  };

  const setPreviewMode = (live) => {
    if (webcamShellNode) {
      webcamShellNode.classList.toggle("is-live", Boolean(live));
      webcamShellNode.classList.toggle("is-suspended", Boolean(previewSuspendedForLive));
    }
    if (webcamSlideNode) {
      webcamSlideNode.classList.toggle("p05-hidden", Boolean(live));
    }
    if (webcamPreviewNode) {
      webcamPreviewNode.classList.toggle("p05-hidden", !live);
    }
  };

  const stopLocalPreview = () => {
    if (localPreviewStream) {
      localPreviewStream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (_) {
          // Ignore track stop errors.
        }
      });
      localPreviewStream = null;
    }

    if (webcamPreviewNode) {
      webcamPreviewNode.pause();
      webcamPreviewNode.srcObject = null;
    }
    localPreviewCameraName = "";
    setPreviewMode(false);
    refreshWebcamSignal();
  };

  const suspendPreviewForElectronLive = () => {
    previewSuspendedForLive = true;
    stopLocalPreview();
    if (webcamShellNode) {
      webcamShellNode.classList.add("is-suspended");
    }
  };

  const resumePreviewAfterElectronLive = async () => {
    previewSuspendedForLive = false;
    if (webcamShellNode) {
      webcamShellNode.classList.remove("is-suspended");
    }
    return ensurePreviewForSelectedCamera({ silent: true });
  };

  const setSecondaryPlayerState = (text) => {
    if (!secondaryPlayerStateNode) return;
    secondaryPlayerStateNode.innerHTML = `<strong>Monitor secondario:</strong><br />${text}`;
  };

  const refreshSecondaryPlayerState = async () => {
    try {
      const out = await fetchJson("/api/userform/pagina05/electron/player/state");
      const playerState = out?.playerState || {};
      if (playerState.active) {
        const detail = playerState.mode === "webcam-live"
          ? `Live Electron attivo${playerState.cameraName ? ` (${playerState.cameraName})` : ""}.`
          : `Riproduzione file attiva${playerState.url ? ` (${String(playerState.url).split("/").pop()})` : ""}.`;
        setSecondaryPlayerState(detail);
        vlcRunning = playerState.mode === "webcam-live";
        refreshWebcamSignal({ warningReason: "" });
      } else if (playerState.lastEvent === "stop-requested") {
        setSecondaryPlayerState("Player Electron fermato correttamente.");
        vlcRunning = false;
        refreshWebcamSignal({ warningReason: "" });
      } else if (playerState.lastEvent === "ended") {
        setSecondaryPlayerState("Riproduzione su monitor secondario completata.");
        vlcRunning = false;
        refreshWebcamSignal({ warningReason: "" });
      } else {
        setSecondaryPlayerState("Stato player Electron in attesa.");
        vlcRunning = false;
        refreshWebcamSignal({ warningReason: "" });
      }
    } catch (error) {
      setSecondaryPlayerState("Player Electron non raggiungibile.");
      refreshWebcamSignal({ warningReason: error?.message || "Player Electron non raggiungibile" });
    }
  };

  const startSecondaryPlayerPolling = () => {
    if (secondaryPlayerPollTimer) {
      clearInterval(secondaryPlayerPollTimer);
    }
    secondaryPlayerPollTimer = setInterval(() => {
      refreshSecondaryPlayerState().catch(() => null);
    }, 2000);
  };

  const findMatchingVideoDevice = async (cameraName) => {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videos = devices.filter((item) => item.kind === "videoinput");
    if (!videos.length) {
      return "";
    }

    const normalized = normalizeCell(cameraName).toLowerCase();
    if (!normalized) {
      return videos[0].deviceId;
    }

    const exact = videos.find((item) => normalizeCell(item.label).toLowerCase() === normalized);
    if (exact) {
      return exact.deviceId;
    }

    const contains = videos.find((item) => normalizeCell(item.label).toLowerCase().includes(normalized));
    return contains?.deviceId || videos[0].deviceId;
  };

  const getUserMediaWithTimeout = async (constraints, timeoutMs = 5000) => {
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error("timeout accesso webcam"));
      }, timeoutMs);
    });
    return Promise.race([
      navigator.mediaDevices.getUserMedia(constraints),
      timeoutPromise
    ]);
  };

  const startLocalPreview = async (payload) => {
    if (!webcamPreviewNode || !navigator.mediaDevices?.getUserMedia) {
      throw new Error("Anteprima webcam non supportata in questo browser/runtime.");
    }

    stopLocalPreview();

    // Warmup permission ensures device labels are available for matching by name.
    const warmupStream = await getUserMediaWithTimeout({ video: true, audio: false });
    warmupStream.getTracks().forEach((track) => track.stop());

    const deviceId = await findMatchingVideoDevice(payload.cameraName);
    const constraints = {
      audio: false,
      video: {
        frameRate: { ideal: Number(payload.fps) || 30 },
        ...(deviceId ? { deviceId: { exact: deviceId } } : {})
      }
    };

    try {
      localPreviewStream = await getUserMediaWithTimeout(constraints);
    } catch (_) {
      // Fallback: if the named binding fails, try any available webcam so the preview still acts as a live indicator.
      localPreviewStream = await getUserMediaWithTimeout({
        audio: false,
        video: {
          frameRate: { ideal: Number(payload.fps) || 30 }
        }
      });
    }
    webcamPreviewNode.srcObject = localPreviewStream;
    await webcamPreviewNode.play().catch(() => null);
    localPreviewCameraName = normalizeCell(payload.cameraName);
    setPreviewMode(true);
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

  const markSelectedRecording = (fileName) => {
    selectedRecordingName = fileName || "";

    if (playbackListNode) {
      playbackListNode.querySelectorAll("li[data-name]").forEach((li) => {
        li.classList.toggle("is-active", li.dataset.name === selectedRecordingName);
      });
    }

    if (recListNode && selectedRecordingName) {
      const option = Array.from(recListNode.options).find((item) => item.value === selectedRecordingName);
      if (option) {
        recListNode.value = selectedRecordingName;
      }
    }
  };

  const playRecordingOnSecondary = async (fileName) => {
    const entry = availableRecordings.find((item) => item.name === fileName);
    if (!entry) {
      setStatus("File registrazione non trovato nella lista aggiornata.");
      return;
    }

    const fileUrl = entry.publicUrl
      ? `${window.location.origin}${entry.publicUrl}`
      : `${window.location.origin}/userform-recordings/${encodeURIComponent(entry.name)}`;

    const result = isElectronVideoPlayerAvailable()
      ? await window.electronAPI.videoPlayer.play({ url: fileUrl })
      : await fetchJson("/api/userform/pagina05/electron/player/play", {
          method: "POST",
          body: JSON.stringify({ url: fileUrl })
        });

    if (!result?.success) {
      throw new Error(result?.error || "Riproduzione Electron non riuscita");
    }
  };

  const renderPlaybackList = (files = []) => {
    if (!playbackListNode) return;

    playbackListNode.innerHTML = "";
    if (!files.length) {
      const li = document.createElement("li");
      li.textContent = "Nessuna registrazione disponibile";
      li.style.cursor = "default";
      playbackListNode.appendChild(li);
      return;
    }

    files.forEach((item) => {
      const li = document.createElement("li");
      li.dataset.name = item.name;
      const when = item.mtimeMs ? new Date(item.mtimeMs).toLocaleString("it-IT") : "";
      li.title = when ? `${item.name} | ${when}` : item.name;
      li.textContent = when ? `${item.name} - ${when}` : item.name;

      li.addEventListener("click", () => {
        markSelectedRecording(item.name);
      });

      li.addEventListener("dblclick", async () => {
        try {
          markSelectedRecording(item.name);
          await playRecordingOnSecondary(item.name);
          await refreshSecondaryPlayerState();
          setStatus(`Riproduzione su monitor secondario avviata: ${item.name}`);
        } catch (error) {
          setStatus(`Errore riproduzione secondaria: ${error.message}`);
        }
      });

      playbackListNode.appendChild(li);
    });

    const currentStillExists = files.some((item) => item.name === selectedRecordingName);
    if (!currentStillExists) {
      selectedRecordingName = files[0].name;
    }
    markSelectedRecording(selectedRecordingName);
  };

  const syncState = async () => {
    const state = await fetchJson("/api/userform/pagina05/state");
    recording = Boolean(state?.recording?.recording);
    vlcRunning = Boolean(state?.liveVlc?.alive);
    if (recChip) recChip.textContent = recording ? "REC: ON" : "REC: OFF";
    if (vlcChip) vlcChip.textContent = vlcRunning ? "VLC: ON" : "VLC: OFF";
    refreshWebcamSignal({ warningReason: "" });
    return state;
  };

  const refreshRecList = async () => {
    const files = await fetchJson("/api/userform/pagina05/files");
    renderRecordingList(files?.mkvFiles || []);
    availableRecordings = files?.allFiles || [];
    renderPlaybackList(availableRecordings);
    return files;
  };

  const loadCameraProfiles = async () => {
    let cameras = [];
    let defaultCameraName = "";

    try {
      const data = await fetchJson("/api/userform/pagina05/cameras");
      cameras = data?.cameras || [];
      defaultCameraName = normalizeCell(data?.defaultCameraName || "");
    } catch (_) {
      cameras = [];
      defaultCameraName = "";
    }

    if (!cameras.length) {
      const csvCandidates = [
        "/Bordero/data/get-camera-name.csv",
        "../../Bordero/data/get-camera-name.csv",
        "../Bordero/data/get-camera-name.csv"
      ];

      for (const csvUrl of csvCandidates) {
        try {
          const response = await fetch(`${csvUrl}?t=${Date.now()}`, { cache: "no-store" });
          if (!response.ok) continue;
          const csvText = await response.text();
          const parsed = mapCameraCsvToProfiles(csvText);
          if (parsed.length) {
            cameras = parsed;
            break;
          }
        } catch (_) {
          // Try next candidate path.
        }
      }
    }

    cameraProfiles = cameras;
    const csvDefault = cameraProfiles.find((item) => item.isDefault)?.name || "";
    preferredCameraName = defaultCameraName || csvDefault;

    if (!cameraNode) return;
    cameraNode.innerHTML = "";
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = cameraProfiles.length ? "Seleziona telecamera" : "Nessuna telecamera disponibile";
    cameraNode.appendChild(placeholder);

    cameraProfiles.forEach((c) => {
      const opt = document.createElement("option");
      opt.value = c.name;
      opt.textContent = c.label ? `${c.name} - ${c.label}` : c.name;
      cameraNode.appendChild(opt);
    });

    if (cameraProfiles.length) {
      const hasPreferred = preferredCameraName && cameraProfiles.some((item) => item.name === preferredCameraName);
      cameraNode.value = hasPreferred ? preferredCameraName : cameraProfiles[0].name;
    } else {
      cameraNode.value = "";
    }

    refreshProfile();

    if (!cameraProfiles.length) {
      setStatus("Impossibile caricare le webcam da API/CSV.");
      refreshWebcamSignal({ warningReason: "Nessuna webcam disponibile da API o CSV" });
    }
  };

  const selectedProfilePayload = () => {
    const profile = cameraProfiles.find((c) => c.name === cameraNode?.value) || {};
    return {
      cameraName: cameraNode?.value || "",
      codec: profile.codec || "",
      size: profile.size || "",
      fps: profile.fps || "",
      label: profile.label || "",
      // Default strategy: write MP4 directly. Backend supports native-then-MP4 if requested.
      recordingMode: "direct-mp4"
    };
  };

  const persistSelectedCameraProfile = async ({ asDefault = true, lastStatus = "selected" } = {}) => {
    const payload = selectedProfilePayload();
    if (!payload.cameraName) {
      return;
    }

    await fetchJson("/api/userform/pagina05/cameras/profile/save", {
      method: "POST",
      body: JSON.stringify({
        cameraName: payload.cameraName,
        codec: payload.codec,
        size: payload.size,
        fps: payload.fps,
        label: payload.label,
        isDefault: asDefault,
        lastMode: "preview",
        lastStatus,
        lastSize: payload.size,
        lastFps: payload.fps,
        lastCodec: payload.codec,
        touchNow: true
      })
    }).catch(() => ({}));
  };

  const ensurePreviewForSelectedCamera = async ({ silent = true } = {}) => {
    const payload = selectedProfilePayload();
    if (!payload.cameraName) {
      stopLocalPreview();
      refreshWebcamSignal({ warningReason: "" });
      return false;
    }

    const hasLiveTrack = Boolean(localPreviewStream?.getTracks?.().some((track) => track.readyState === "live"));
    const alreadyMatching = hasLiveTrack && normalizeCell(localPreviewCameraName) === normalizeCell(payload.cameraName);
    if (alreadyMatching) {
      setPreviewMode(true);
      if (!silent) {
        setStatus(`Preview webcam attiva: ${payload.cameraName}`);
      }
      refreshWebcamSignal({ warningReason: "" });
      return true;
    }

    try {
      await startLocalPreview(payload);
      if (!silent) {
        setStatus(`Preview webcam attiva: ${payload.cameraName}`);
      }
      refreshWebcamSignal({ warningReason: "" });
      return true;
    } catch (error) {
      if (!silent) {
        setStatus(`Preview webcam non disponibile per ${payload.cameraName}: ${error.message}`);
      }
      refreshWebcamSignal({ warningReason: `Preview webcam non disponibile: ${error.message}` });
      return false;
    }
  };

  const probeSelectedCameraLocally = async () => {
    const payload = selectedProfilePayload();
    if (!payload.cameraName) {
      return {
        ok: false,
        skipped: false,
        message: "nessuna webcam selezionata"
      };
    }

    if (previewSuspendedForLive || vlcRunning) {
      return {
        ok: true,
        skipped: true,
        message: "verifica camera saltata per non interferire con il live sul monitor 2"
      };
    }

    const hasLiveTrack = Boolean(localPreviewStream?.getTracks?.().some((track) => track.readyState === "live"));
    const alreadyMatching = hasLiveTrack && normalizeCell(localPreviewCameraName) === normalizeCell(payload.cameraName);
    if (alreadyMatching) {
      return {
        ok: true,
        skipped: false,
        message: `preview locale gia attiva su ${payload.cameraName}`
      };
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      return {
        ok: false,
        skipped: false,
        message: "getUserMedia non disponibile in questo runtime"
      };
    }

    const deviceId = await findMatchingVideoDevice(payload.cameraName);
    const constraints = {
      audio: false,
      video: {
        frameRate: { ideal: Number(payload.fps) || 30 },
        ...(deviceId ? { deviceId: { exact: deviceId } } : {})
      }
    };

    const probeStream = await getUserMediaWithTimeout(constraints, 3500);
    probeStream.getTracks().forEach((track) => {
      try {
        track.stop();
      } catch (_) {
        // Ignore track stop errors.
      }
    });

    return {
      ok: true,
      skipped: false,
      message: `accesso locale webcam OK (${payload.cameraName})`
    };
  };

  if (cameraNode) {
    cameraNode.addEventListener("change", async () => {
      refreshProfile();
      await ensurePreviewForSelectedCamera({ silent: false });
      await persistSelectedCameraProfile({ asDefault: true, lastStatus: "preview-active" });
    });
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
      const modeText = out.recordingMode === "native-then-mp4"
        ? "nativo con conversione automatica in MP4 allo stop"
        : "MP4 diretto";
      setStatus(`Registrazione avviata (${modeText}): ${out.fileName}. Destinazione: C:/VSC_WEBCAM`);
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
      if (out.stopped) {
        const finalPath = String(out.finalFilePath || out.filePath || out.targetFilePath || "");
        const savedName = String(out.finalFileName || finalPath.split(/[\\/]/).pop() || "file registrato");
        const sizeKb = Number(out.fileSizeBytes || 0) > 0 ? ` (${Math.max(1, Math.round(Number(out.fileSizeBytes || 0) / 1024))} KB)` : "";
        const verifyNote = out.verificationNote ? ` ${out.verificationNote}` : "";
        if (out.conversion?.ok && out.fileVerified) {
          setStatus(`Registrazione terminata. Convertito e salvato in MP4: ${savedName}${sizeKb} in ${finalPath}.${verifyNote}`);
        } else if (out.recordingMode === "direct-mp4" && out.fileVerified && out.graceful) {
          setStatus(`Registrazione terminata. File MP4 salvato: ${savedName}${sizeKb} in ${finalPath}.${verifyNote}`);
        } else if (out.recordingMode === "direct-mp4" && out.fileVerified && !out.graceful) {
          setStatus(`Registrazione fermata con stop forzato. File MP4 rilevato: ${savedName}${sizeKb} in ${finalPath}. Verificare integrita.${verifyNote}`);
        } else if (out.recordingMode === "native-then-mp4" && out.conversion?.ok === false) {
          const srcName = String(out.sourceFilePath || "").split(/[\\/]/).pop() || "file nativo";
          setStatus(`Registrazione fermata. Conversione MP4 non riuscita (${out.conversion.error}). Disponibile: ${srcName}`);
        } else if (!out.fileVerified) {
          setStatus(`Registrazione fermata ma file finale non verificato su disco: ${savedName || "file registrato"}. ${finalPath || "Percorso non disponibile."}${verifyNote}`);
        } else {
          setStatus(`Registrazione terminata. File salvato: ${savedName}${sizeKb} in ${finalPath}.${verifyNote}`);
        }
      } else {
        setStatus("Nessuna registrazione FFmpeg rilevata.");
      }
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
        setStatus("Ripresa video gia in esecuzione.");
        return;
      }

      const payload = selectedProfilePayload();

      if (!payload.cameraName) {
        setStatus("Seleziona una telecamera prima di avviare la ripresa live.");
        return;
      }

      suspendPreviewForElectronLive();
      await persistSelectedCameraProfile({ asDefault: true, lastStatus: "live-start" });

      const result = isElectronVideoPlayerAvailable()
        ? await window.electronAPI.videoPlayer.play({
            mode: "webcam-live",
            cameraName: payload.cameraName,
            size: payload.size,
            fps: payload.fps
          })
        : await fetchJson("/api/userform/pagina05/electron/live/start", {
            method: "POST",
            body: JSON.stringify({
              cameraName: payload.cameraName,
              size: payload.size,
              fps: payload.fps
            })
          });

      if (!result?.success) {
        throw new Error(result?.error || "Avvio live Electron non riuscito");
      }

      vlcRunning = true;
      if (vlcChip) vlcChip.textContent = "LIVE: ON (ELECTRON)";
      refreshWebcamSignal({ warningReason: "" });
      await refreshSecondaryPlayerState();
      setStatus("Ripresa attiva: preview locale sospesa per evitare conflitti hardware, fullscreen live su monitor secondario (Electron).");
    } catch (error) {
      setStatus(`Errore avvio ripresa live: ${error.message}`);
      refreshWebcamSignal({ warningReason: `Errore avvio live: ${error.message}` });
      await resumePreviewAfterElectronLive();
    }
  });

  document.getElementById("btn-vlc-stop")?.addEventListener("click", async () => {
    let stopElectronError = null;
    try {
      if (isElectronVideoPlayerAvailable()) {
        try {
          await window.electronAPI.videoPlayer.stop();
        } catch (error) {
          stopElectronError = error;
        }
      } else {
        try {
          await fetchJson("/api/userform/pagina05/electron/live/stop", {
            method: "POST",
            body: JSON.stringify({})
          });
        } catch (error) {
          stopElectronError = error;
        }
      }

      // Stop VLC as well, so old live sessions are always terminated.
      await fetchJson("/api/userform/pagina05/vlc/live/stop", {
        method: "POST",
        body: JSON.stringify({})
      }).catch(() => ({}));

      vlcRunning = false;
      if (vlcChip) vlcChip.textContent = "LIVE: OFF";
      refreshWebcamSignal({ warningReason: stopElectronError ? String(stopElectronError.message || stopElectronError) : "" });
      await refreshSecondaryPlayerState();
      if (stopElectronError) {
        setStatus(`Ripresa live locale fermata, ma stop Electron ha restituito errore: ${stopElectronError.message || stopElectronError}`);
      } else {
        setStatus("Ripresa video in diretta fermata. Riattivazione preview locale webcam.");
      }
    } catch (error) {
      setStatus(`Errore stop ripresa live: ${error.message}`);
    } finally {
      await resumePreviewAfterElectronLive();
      await persistSelectedCameraProfile({ asDefault: true, lastStatus: "live-stop" });
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
      const liveOnSecondary = Boolean(summary?.liveVlcState?.alive) || previewSuspendedForLive || vlcRunning;
      const localProbe = liveOnSecondary
        ? {
            ok: true,
            skipped: true,
            message: "verifica camera locale saltata per non mostrare nulla sul monitor secondario"
          }
        : await probeSelectedCameraLocally();

      if (!localProbe.ok && !localProbe.skipped) {
        refreshWebcamSignal({ warningReason: `AutoTest webcam locale: ${localProbe.message}` });
      } else {
        refreshWebcamSignal({ warningReason: "" });
      }

      setStatus(
        `AutoTestTools OK - cam:${summary.cameras ?? 0}, mkv:${summary.mkvFiles ?? 0}, ffmpeg:${checks.ffmpegFound ? "OK" : "KO"}, vlc:${checks.vlcFound ? "OK" : "KO"}, preview locale:${localProbe.ok ? "OK" : "KO"}${localProbe.skipped ? " (SKIP SICURO)" : ""}. ${localProbe.message}. Monitor 2 non toccato.`
      );
      await syncState();
      await refreshRecList();
      await refreshSecondaryPlayerState();
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
      stopLocalPreview();
      await loadCameraProfiles();
      await syncState();
      await refreshRecList();
      await refreshSecondaryPlayerState();
      startSecondaryPlayerPolling();
      const previewActive = await ensurePreviewForSelectedCamera({ silent: false });
      await persistSelectedCameraProfile({ asDefault: true, lastStatus: "bootstrap-preview" });
      if (previewActive) {
        setStatus("PAGINA05 pronta: preview webcam attiva e runtime backend attivo.");
      } else {
        setStatus("PAGINA05 pronta: preview webcam non disponibile (usa la combo per verificare altre telecamere).");
      }
    } catch (error) {
      setStatus(`Errore inizializzazione PAGINA05: ${error.message}`);
      refreshWebcamSignal({ warningReason: `Errore inizializzazione: ${error.message}` });
    }
  };

  bootstrap();
})();
