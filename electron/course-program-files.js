const path = require('node:path');
const { readCsvFile, writeCsvFile, validateCsvName } = require('../Bordero/server/choreo-program-files');

function isCourseProgramFileSender(event) {
  try {
    const url = new URL(event.senderFrame?.url || event.sender?.getURL() || '');
    return ['http:', 'https:'].includes(url.protocol)
      && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
      && /^\/(?:public\/)?bordero\/pages\/coreografie-corsi\.html$/i.test(url.pathname);
  } catch { return false; }
}

function registerCourseProgramFileHandlers({ ipcMain, dialog, BrowserWindow, store }) {
  const register = (channel, handler) => ipcMain.handle(channel, async (event, payload) => {
    if (!isCourseProgramFileSender(event)) return { ok: false, error: 'Accesso ai file del programma non autorizzato.' };
    try { return await handler(event, payload); } catch (error) { return { ok: false, error: error.message }; }
  });
  const showDialog = (method, event, options) => {
    const parent = BrowserWindow.fromWebContents(event.sender);
    return parent ? dialog[method](parent, options) : dialog[method](options);
  };
  register('bordero-course-files:directory', () => ({ ok: true, directory: store.getDirectory() }));
  register('bordero-course-files:open-csv', async (event) => {
    const directory = store.getDirectory();
    const result = await showDialog('showOpenDialog', event, {
      title: 'Carica programma coreografie', defaultPath: directory,
      filters: [{ name: 'Programma CSV', extensions: ['csv'] }], properties: ['openFile']
    });
    if (result.canceled || !result.filePaths?.[0]) return { ok: true, canceled: true };
    return { ok: true, directory, ...readCsvFile(result.filePaths[0]) };
  });
  register('bordero-course-files:save-csv', async (event, payload) => {
    const name = validateCsvName(payload?.name);
    if (typeof payload?.content !== 'string') throw new Error('Contenuto CSV non valido.');
    const directory = store.getDirectory();
    const result = await showDialog('showSaveDialog', event, {
      title: 'Salva programma coreografie', defaultPath: path.join(directory, name),
      filters: [{ name: 'Programma CSV', extensions: ['csv'] }],
      properties: ['createDirectory', 'showOverwriteConfirmation']
    });
    if (result.canceled || !result.filePath) return { ok: true, canceled: true };
    const target = /\.csv$/i.test(result.filePath) ? result.filePath : `${result.filePath}.csv`;
    return { ok: true, directory, ...writeCsvFile(target, payload.content, true) };
  });
}

module.exports = { registerCourseProgramFileHandlers, isCourseProgramFileSender };
