const videoElement = document.getElementById('electron-video');
const statusElement = document.getElementById('player-status');
const diagnosticsElement = document.getElementById('player-diagnostics');
const liveDisclaimerElement = document.getElementById('live-disclaimer');
let liveStream = null;
let diagnosticsTimer = null;
let bufferingCount = 0;
let stalledCount = 0;

function setStatus(text) {
  if (statusElement) {
    statusElement.textContent = text;
  }
}

function setWebcamLiveMode(active) {
  document.body.classList.toggle('webcam-live-mode', Boolean(active));
  if (liveDisclaimerElement) {
    liveDisclaimerElement.hidden = !active;
  }
}

function getPlayerParams() {
  try {
    const params = new URLSearchParams(window.location.search);
    return {
      mode: params.get('mode') || 'video',
      src: params.get('src') || '',
      camera: params.get('camera') || '',
      fps: params.get('fps') || '',
      size: params.get('size') || '',
      diagnostics: params.get('diagnostics') === '1'
    };
  } catch (error) {
    return {
      mode: 'video',
      src: '',
      camera: '',
      fps: '',
      size: '',
      diagnostics: false
    };
  }
}

function stopLiveTracks() {
  if (!liveStream) {
    return;
  }
  liveStream.getTracks().forEach((track) => {
    try {
      track.stop();
    } catch (_) {
      // Ignore track stop errors.
    }
  });
  liveStream = null;
}

function parseSize(sizeText = '') {
  const raw = String(sizeText || '').trim();
  const match = raw.match(/^(\d{2,5})x(\d{2,5})$/i);
  if (!match) {
    return {};
  }
  return {
    width: Number(match[1]),
    height: Number(match[2])
  };
}

async function pickWebcamDeviceId(cameraLabelHint = '') {
  const devices = await navigator.mediaDevices.enumerateDevices();
  const videos = devices.filter((item) => item.kind === 'videoinput');
  if (!videos.length) {
    return '';
  }

  const hint = String(cameraLabelHint || '').trim().toLowerCase();
  if (!hint) {
    return videos[0].deviceId;
  }

  const strictMatch = videos.find((item) => String(item.label || '').trim().toLowerCase() === hint);
  if (strictMatch) {
    return strictMatch.deviceId;
  }

  const looseMatch = videos.find((item) => String(item.label || '').toLowerCase().includes(hint));
  return looseMatch?.deviceId || videos[0].deviceId;
}

async function startWebcamLivePlayback(params) {
  if (!videoElement || !navigator.mediaDevices?.getUserMedia) {
    setStatus('Webcam live non supportata in questo runtime.');
    return;
  }

  setStatus('Attivazione webcam live...');
  setWebcamLiveMode(true);
  stopLiveTracks();

  const fpsValue = Number(String(params.fps || '').trim());
  const safeFps = Number.isFinite(fpsValue) && fpsValue > 0 ? Math.min(120, fpsValue) : 30;
  const size = parseSize(params.size);

  // Primo accesso per garantire labels dispositivi disponibili su Electron/Chromium.
  const warmup = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
  warmup.getTracks().forEach((track) => track.stop());

  const preferredDeviceId = await pickWebcamDeviceId(params.camera);
  const constraints = {
    audio: false,
    video: {
      frameRate: { ideal: safeFps },
      ...(size.width ? { width: { ideal: size.width } } : {}),
      ...(size.height ? { height: { ideal: size.height } } : {}),
      ...(preferredDeviceId ? { deviceId: { exact: preferredDeviceId } } : {})
    }
  };

  liveStream = await navigator.mediaDevices.getUserMedia(constraints);
  videoElement.srcObject = liveStream;
  videoElement.muted = true;
  videoElement.playsInline = true;
  try {
    await videoElement.play();
    setStatus(`Webcam live attiva${params.camera ? `: ${params.camera}` : ''}.`);
  } catch (error) {
    setStatus('Webcam live avviata ma autoplay bloccato.');
  }
}

function bindElectronCommands() {
  if (!window.electronAPI || !window.electronAPI.videoPlayerWindow) {
    setStatus('Electron non disponibile per questo player.');
    return;
  }

  window.electronAPI.videoPlayerWindow.onPause(() => {
    if (videoElement) {
      if (videoElement.srcObject) {
        setStatus('Webcam live attiva (pausa non applicabile).');
        return;
      }
      videoElement.pause();
    }
    setStatus('Video in pausa.');
  });

  window.electronAPI.videoPlayerWindow.onStop(() => {
    stopDiagnosticsSampling();
    if (videoElement) {
      videoElement.pause();
      videoElement.currentTime = 0;
      videoElement.srcObject = null;
    }
    window.electronAPI.videoPlayerWindow.reportPlaybackState?.({ isPlaying: false });
    stopLiveTracks();
    setWebcamLiveMode(false);
    setStatus('Video fermato.');
    window.close();
  });
}

function getPlaybackDiagnostics() {
  const quality = typeof videoElement?.getVideoPlaybackQuality === 'function'
    ? videoElement.getVideoPlaybackQuality()
    : null;
  const totalFrames = Number(quality?.totalVideoFrames ?? videoElement?.webkitDecodedFrameCount ?? 0);
  const droppedFrames = Number(quality?.droppedVideoFrames ?? videoElement?.webkitDroppedFrameCount ?? 0);
  const bufferedEnd = videoElement?.buffered?.length
    ? videoElement.buffered.end(videoElement.buffered.length - 1)
    : 0;
  const currentTime = Number(videoElement?.currentTime || 0);

  return {
    bufferingCount,
    stalledCount,
    totalFrames,
    droppedFrames,
    readyState: Number(videoElement?.readyState || 0),
    networkState: Number(videoElement?.networkState || 0),
    bufferedAheadSeconds: Math.max(0, Number((bufferedEnd - currentTime).toFixed(1))),
    errorCode: Number(videoElement?.error?.code || 0)
  };
}

function reportPlaybackState(isPlaying, event) {
  const payload = { isPlaying, event };
  if (event === 'error') {
    payload.errorCode = Number(videoElement?.error?.code || 0);
  }
  if (getPlayerParams().diagnostics) {
    payload.diagnostics = getPlaybackDiagnostics();
    if (diagnosticsElement) {
      const { bufferingCount: waits, stalledCount: stalls, totalFrames, droppedFrames, bufferedAheadSeconds } = payload.diagnostics;
      diagnosticsElement.textContent = `Buffer: ${waits} | stall: ${stalls} | frame persi: ${droppedFrames}/${totalFrames} | buffer: ${bufferedAheadSeconds}s`;
    }
  }
  window.electronAPI?.videoPlayerWindow?.reportPlaybackState?.(payload);
}

function stopDiagnosticsSampling() {
  if (diagnosticsTimer) {
    clearInterval(diagnosticsTimer);
    diagnosticsTimer = null;
  }
}

function startDiagnosticsSampling() {
  if (!getPlayerParams().diagnostics || diagnosticsTimer) return;
  diagnosticsTimer = setInterval(() => {
    reportPlaybackState(!videoElement.paused, 'diagnostics');
  }, 5000);
}

function bindPlaybackEvents(params) {
  if (!videoElement) return;
  if (diagnosticsElement) {
    diagnosticsElement.hidden = !params.diagnostics;
  }

  videoElement.addEventListener('playing', () => {
    setStatus(params.mode === 'webcam-live' ? 'Webcam live attiva.' : 'Riproduzione attiva.');
    reportPlaybackState(true, 'playing');
    startDiagnosticsSampling();
  });
  videoElement.addEventListener('pause', () => {
    stopDiagnosticsSampling();
    reportPlaybackState(false, 'paused');
  });
  videoElement.addEventListener('waiting', () => {
    bufferingCount += 1;
    setStatus('Buffering: in attesa dei dati video...');
    reportPlaybackState(false, 'waiting');
  });
  videoElement.addEventListener('stalled', () => {
    stalledCount += 1;
    setStatus('Trasferimento video interrotto; attendo la connessione...');
    reportPlaybackState(false, 'stalled');
  });
  videoElement.addEventListener('error', () => {
    stopDiagnosticsSampling();
    setStatus(`Errore video (codice ${videoElement.error?.code || 0}).`);
    reportPlaybackState(false, 'error');
  });
  videoElement.addEventListener('ended', () => {
    stopDiagnosticsSampling();
    reportPlaybackState(false, 'ended');
  });
}

async function startPlayback() {
  const params = getPlayerParams();
  const isWebcamMode = params.mode === 'webcam-live';
  const sourceUrl = params.src;

  if (!videoElement || (!sourceUrl && !isWebcamMode)) {
    setStatus('Nessun video selezionato.');
    return;
  }

  bindElectronCommands();
  bindPlaybackEvents(params);

  if (isWebcamMode) {
    await startWebcamLivePlayback(params);
    return;
  }

  setWebcamLiveMode(false);
  videoElement.src = sourceUrl;
  videoElement.srcObject = null;
  videoElement.load();
  setStatus('Caricamento video...');

  videoElement.addEventListener('ended', () => {
    try {
      window.electronAPI?.videoPlayerWindow?.complete({
        url: sourceUrl,
        fileName: decodeURIComponent(sourceUrl.split('/').pop() || '')
      });
    } catch {
      setStatus('Riproduzione terminata; notifica di completamento non inviata.');
      return;
    }
    setStatus('Riproduzione terminata.');
  }, { once: true });

  try {
    await videoElement.play();
    setStatus('Riproduzione attiva.');
  } catch (error) {
    setStatus('Autoplay non riuscito.');
  }
}

window.addEventListener('DOMContentLoaded', () => {
  startPlayback().catch((error) => {
    setStatus(`Errore player: ${error?.message || error}`);
    reportPlaybackState(false, 'error');
  });
});

window.addEventListener('beforeunload', () => {
  stopDiagnosticsSampling();
  setWebcamLiveMode(false);
  stopLiveTracks();
});