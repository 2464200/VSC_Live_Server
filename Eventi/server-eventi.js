// C:\VSC_Live_Server\Eventi\server-eventi.js
const express = require('express');
const path = require('path');
const os = require('os');
const QRCodeLib = require('qrcode');
const { syncBraniJson, EXTRA_CSV_NAME } = require('./brani-utils');

// Router API della sezione EVENTI
const eventiRouter = require('./eventi-server.js');

const app = express();
app.use(express.json());

app.use((req, res, next) => {
  if (/^\/eventi/i.test(req.url) && !req.url.startsWith('/eventi')) {
    req.url = req.url.replace(/^\/eventi/i, '/eventi');
  }
  next();
});

// CORS per permettere richieste dal Live Server e da altri client
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Static per le pagine EVENTI
app.use('/eventi', express.static(path.join(__dirname, 'public')));

// Health check e stato server
app.get('/eventi/api/status', (req, res) => {
  res.json({ ok: true, name: 'EVENTI', port: PORT, uptime: process.uptime() });
});

app.get('/eventi/api/ping', (req, res) => {
  res.json({ ok: true, ping: 'pong' });
});

// API EVENTI
app.get('/eventi/api/qr', async (req, res) => {
  try {
    const hostHeader = req.headers.host || `127.0.0.1:${PORT}`;
    const [requestedHost] = hostHeader.split(':');
    const effectiveHost = (requestedHost === 'localhost' || requestedHost === '127.0.0.1' || requestedHost === '::1')
      ? getLocalIP()
      : requestedHost;
    const targetUrl = `http://${effectiveHost}:${PORT}/eventi/eventi.html`;
    const dataUrl = await QRCodeLib.toDataURL(targetUrl, { margin: 2, width: 320 });

    res.json({ ok: true, url: targetUrl, dataUrl });
  } catch (error) {
    console.error('Errore generazione QR Eventi:', error);
    res.status(500).json({ ok: false, error: 'Impossibile generare il QR per Eventi' });
  }
});

app.use('/eventi/api', eventiRouter);

// Error handler globale
app.use((err, req, res, next) => {
  console.error('Express error:', err);
  res.status(500).json({ error: 'Errore interno del server Eventi' });
});

// Funzione di sincronizzazione brani al startup
function syncBraniOnStartup() {
  try {
    const { stats } = syncBraniJson();
    console.log(`Startup sync: ${stats.total} brani caricati dai CSV`);
    console.log(`  - Principale: ${stats.baseCount}`);
    console.log(`  - Aggiuntivo (${EXTRA_CSV_NAME}): ${stats.extraCount}`);
  } catch (error) {
    console.error('Errore sincronizzazione startup:', error);
  }
}

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

const PORT = process.env.EVENTI_PORT || 3010;
app.listen(PORT, 'localhost', () => {
  const localIP = getLocalIP();
  console.log('EVENTI server attivo su rete locale:');
  console.log(`  - Locale: http://localhost:${PORT}/eventi/eventi.html`);
  console.log(`  - Rete:   http://${localIP}:${PORT}/eventi/eventi.html`);
  console.log('Sincronizzazione brani al startup...');
  syncBraniOnStartup();
});

process.on('uncaughtException', err => {
  console.error('UNCAUGHT EXCEPTION:', err);
});

process.on('unhandledRejection', reason => {
  console.error('UNHANDLED REJECTION:', reason);
});
