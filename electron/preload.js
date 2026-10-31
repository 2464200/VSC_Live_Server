const { contextBridge, ipcRenderer } = require('electron');

window.addEventListener('DOMContentLoaded', () => {
  // Covers every local page loaded in either app window, including pages without navigation.
  if (['http:', 'https:'].includes(window.location.protocol)
    && ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname)
    && !document.querySelector('script[data-machine-ui-theme], script[src*="machine-ui-theme.js"]')) {
    const script = document.createElement('script');
    script.src = '/Bordero/js/machine-ui-theme.js';
    script.dataset.machineUiTheme = 'true';
    document.head.appendChild(script);
  }
  const replaceText = (selector, text) => {
    const element = document.getElementById(selector);
    if (element) {
      element.innerText = text;
    }
  };

  for (const dependency of ['chrome', 'node', 'electron']) {
    replaceText(`${dependency}-version`, process.versions[dependency]);
  }
});

function createSubscription(channel, callback) {
  const listener = (_event, payload) => callback(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

contextBridge.exposeInMainWorld('electronAPI', {
  runtime: {
    isElectron: true,
    versions: process.versions
  },
  windowManager: {
    openPrimaryPage: (payload) => ipcRenderer.invoke('bordero-window:open-primary', payload),
    openSecondaryPage: (payload) => ipcRenderer.invoke('bordero-window:open-secondary', payload),
    stopServicePublication: () => ipcRenderer.invoke('bordero-window:stop-service-publication'),
    restoreSecondaryPage: () => ipcRenderer.invoke('bordero-window:restore-secondary')
  },
  monitorPolicy: {
    getLastRoute: () => ipcRenderer.invoke('bordero-monitor-policy:last-event'),
    onRouted: (callback) => createSubscription('bordero-monitor-policy:routed', callback)
  },
  videoPlayer: {
    play: (payload) => ipcRenderer.invoke('bordero-video-player:play', payload),
    pause: () => ipcRenderer.invoke('bordero-video-player:pause'),
    stop: () => ipcRenderer.invoke('bordero-video-player:stop'),
    onEnded: (callback) => createSubscription('bordero-video-player:ended', callback)
  },
  videoPlayerWindow: {
    onPause: (callback) => createSubscription('bordero-video-player:pause', callback),
    onStop: (callback) => createSubscription('bordero-video-player:stop', callback),
    reportPlaybackState: (payload) => ipcRenderer.send('bordero-video-player:playback-state', payload),
    complete: (payload) => ipcRenderer.send('bordero-video-player:ended', payload)
  },
  filePicker: {
    pickDirectory: () => ipcRenderer.invoke('bordero-file-picker:pick-directory'),
    listDirectory: (targetPath) => ipcRenderer.invoke('bordero-file-picker:list-directory', targetPath)
  },
  app: {
    shutdown: () => ipcRenderer.invoke('bordero-app:shutdown')
  },
  courseProgramFiles: {
    getDirectory: () => ipcRenderer.invoke('bordero-course-files:directory'),
    openCsv: () => ipcRenderer.invoke('bordero-course-files:open-csv'),
    saveCsv: (payload) => ipcRenderer.invoke('bordero-course-files:save-csv', payload)
  },
  uiPreferences: {
    get: () => ipcRenderer.invoke('bordero-ui-preferences:get'),
    set: (payload) => ipcRenderer.invoke('bordero-ui-preferences:set', payload),
    onChanged: (callback) => createSubscription('bordero-ui-preferences:changed', callback)
  }
});
