const express = require('express');

function createUiPreferencesRouter(store) {
  const router = express.Router();
  router.use((req, res, next) => {
    const address = String(req.socket.remoteAddress || '').replace(/^::ffff:/, '');
    let host;
    try { host = new URL(`http://${req.get('Host')}`).hostname; } catch { host = ''; }
    const origin = req.get('Origin');
    if (!['127.0.0.1', '::1'].includes(address)
      || !['localhost', '127.0.0.1', '[::1]'].includes(host)
      || req.get('Sec-Fetch-Site') === 'cross-site'
      || (origin && origin !== `${req.protocol}://${req.get('Host')}`)) {
      return res.status(403).json({ ok: false, error: 'Impostazione disponibile sulla macchina locale.' });
    }
    res.set('Cache-Control', 'no-store');
    next();
  });
  router.get('/', (_req, res, next) => {
    try { res.json({ ok: true, ...store.read() }); } catch (error) { next(error); }
  });
  router.post('/', (req, res, next) => {
    if (!req.is('application/json')) return res.status(415).json({ ok: false, error: 'Formato JSON richiesto.' });
    try { res.json({ ok: true, ...store.save(req.body?.primaryTheme) }); } catch (error) { next(error); }
  });
  router.use((error, _req, res, _next) => {
    res.status(error.status || 500).json({ ok: false, error: error.message });
  });
  return router;
}

module.exports = { createUiPreferencesRouter };
