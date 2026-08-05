const { contextBridge, ipcRenderer } = require('electron');

window.addEventListener('DOMContentLoaded', () => {
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
    openSecondaryPage: (payload) => ipcRenderer.invoke('bordero-window:open-secondary', payload)
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
    complete: (payload) => ipcRenderer.send('bordero-video-player:ended', payload)
  }
});
