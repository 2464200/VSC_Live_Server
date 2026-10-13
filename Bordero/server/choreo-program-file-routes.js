const express = require('express');

function createChoreoProgramFileRouter(store) {
  const router = express.Router();
  router.use((req, res, next) => {
    const address = String(req.socket.remoteAddress || '').replace(/^::ffff:/, '');
    if (!['127.0.0.1', '::1'].includes(address)) return res.status(403).json({ error: 'I file del programma sono disponibili sul PC locale.' });
    const origin = req.get('Origin');
    let host;
    try { host = new URL(`http://${req.get('Host')}`).hostname; } catch { host = ''; }
    if (!['localhost', '127.0.0.1', '[::1]'].includes(host)) return res.status(403).json({ error: 'Host locale non autorizzato.' });
    if (req.get('Sec-Fetch-Site') === 'cross-site' || (origin && origin !== `${req.protocol}://${req.get('Host')}`)) {
      return res.status(403).json({ error: 'Origine non autorizzata.' });
    }
    res.set('Cache-Control', 'no-store');
    next();
  });
  router.get('/', (_req, res, next) => {
    try { res.json({ ok: true, directory: store.getDirectory(), files: store.list() }); } catch (error) { next(error); }
  });
  router.get('/:name', (req, res, next) => {
    try { res.json({ ok: true, directory: store.getDirectory(), ...store.read(req.params.name) }); } catch (error) { next(error); }
  });
  router.post('/', (req, res, next) => {
    if (!req.is('application/json')) return res.status(415).json({ error: 'Invia il CSV in formato JSON.' });
    try {
      res.json({ ok: true, directory: store.getDirectory(), ...store.save(req.body?.name, req.body?.content, req.body?.overwrite === true) });
    } catch (error) { next(error); }
  });
  router.use((error, _req, res, _next) => {
    res.status(error.status || (error.code === 'ENOENT' ? 404 : 500)).json({ ok: false, error: error.message });
  });
  return router;
}

module.exports = { createChoreoProgramFileRouter };
