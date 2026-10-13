function registerUiPreferencesHandlers({ ipcMain, store, getWindowRole, onChanged }) {
  const register = (channel, handler) => ipcMain.handle(channel, (event, payload) => {
    try {
      const url = new URL(event.senderFrame?.url || event.sender?.getURL() || '');
      if (!['http:', 'https:'].includes(url.protocol)
        || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
        || (event.senderFrame && event.sender?.mainFrame && event.senderFrame !== event.sender.mainFrame)) {
        throw new Error('Pagina locale non autorizzata.');
      }
      return handler(event, payload, url);
    } catch (error) { return { ok: false, error: error.message }; }
  });
  register('bordero-ui-preferences:get', (event) => ({ ok: true, ...store.read(), windowRole: getWindowRole(event.sender) }));
  register('bordero-ui-preferences:set', (event, payload, url) => {
    if (getWindowRole(event.sender) !== 'primary'
      || !/^\/(?:public\/)?bordero\/pages\/admin\.html$/i.test(url.pathname)) {
      throw new Error('Modifica disponibile in ADMIN sul monitor principale.');
    }
    const result = { ok: true, ...store.save(payload?.primaryTheme), windowRole: 'primary' };
    onChanged?.(result);
    return result;
  });
}

module.exports = { registerUiPreferencesHandlers };
