const videoElement = document.getElementById('electron-video');
const statusElement = document.getElementById('player-status');

function setStatus(text) {
  if (statusElement) {
    statusElement.textContent = text;
  }
}

function getSourceUrl() {
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get('src') || '';
  } catch (error) {
    return '';
  }
}

function bindElectronCommands() {
  if (!window.electronAPI || !window.electronAPI.videoPlayerWindow) {
    setStatus('Electron non disponibile per questo player.');
    return;
  }

  window.electronAPI.videoPlayerWindow.onPause(() => {
    if (videoElement && !videoElement.paused) {
      videoElement.pause();
      setStatus('Video in pausa.');
    }
  });

  window.electronAPI.videoPlayerWindow.onStop(() => {
    if (videoElement) {
      videoElement.pause();
      videoElement.currentTime = 0;
    }
    setStatus('Video fermato.');
    window.close();
  });
}

async function startPlayback() {
  const sourceUrl = getSourceUrl();
  if (!videoElement || !sourceUrl) {
    setStatus('Nessun video selezionato.');
    return;
  }

  bindElectronCommands();

  videoElement.src = sourceUrl;
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