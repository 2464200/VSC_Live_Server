const videoElement = document.getElementById('electron-video');
const statusElement = document.getElementById('player-status');
let liveStream = null;

function setStatus(text) {
  if (statusElement) {
    statusElement.textContent = text;
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
      size: params.get('size') || ''
    };
  } catch (error) {
    return {
      mode: 'video',
      src: '',
      camera: '',
      fps: '',
      size: ''
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
    if (videoElement) {
      videoElement.pause();
      videoElement.currentTime = 0;
      videoElement.srcObject = null;
    }
    stopLiveTracks();
    setStatus('Video fermato.');
    window.close();
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

  if (isWebcamMode) {
    await startWebcamLivePlayback(params);
    return;
  }

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
    } catch (error) {
      // Ignored: the window will close anyway.
    }
    window.close();
  }, { once: true });

  videoElement.addEventListener('error', () => {
    setStatus('Errore nel caricamento del video.');
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
  });
});

window.addEventListener('beforeunload', () => {
  stopLiveTracks();
});