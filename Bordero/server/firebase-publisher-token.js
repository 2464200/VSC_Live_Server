'use strict';

const fs = require('fs');
const path = require('path');

const PUBLISHER_EMAIL = 'lucafaby@gmail.com';
const ROOT_DIR = path.join(__dirname, '..', '..');
const SERVICE_ACCOUNT_CANDIDATES = [
  process.env.FIREBASE_SERVICE_ACCOUNT_PATH,
  path.join(ROOT_DIR, '.firebase', 'service-account.json'),
  path.join(ROOT_DIR, 'firebase', 'service-account.json')
].filter(Boolean);
const SERVICE_ACCOUNT_PATH = SERVICE_ACCOUNT_CANDIDATES.find((p) => fs.existsSync(p))
  || SERVICE_ACCOUNT_CANDIDATES[0];

let adminApp = null;

function getAdminApp() {
  if (adminApp) {
    return adminApp;
  }
  if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
    const error = new Error(`Chiave account di servizio mancante: ${SERVICE_ACCOUNT_PATH}`);
    error.code = 'SERVICE_ACCOUNT_MISSING';
    throw error;
  }
  const { initializeApp, cert } = require('firebase-admin/app');
  const serviceAccount = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'));
  adminApp = initializeApp({ credential: cert(serviceAccount) }, 'publisher-token');
  return adminApp;
}

async function createPublisherCustomToken() {
  const auth = require('firebase-admin/auth').getAuth(getAdminApp());
  const user = await auth.getUserByEmail(PUBLISHER_EMAIL);
  return auth.createCustomToken(user.uid);
}

function isLoopbackRequest(req) {
  const address = req.socket?.remoteAddress || '';
  return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1';
}

function registerPublisherTokenRoute(app) {
  app.get('/api/firebase-publisher-token', async (req, res) => {
    if (!isLoopbackRequest(req)) {
      return res.status(403).json({ ok: false, error: 'Solo accesso locale.' });
    }
    try {
      res.set('Cache-Control', 'no-store');
      res.json({ ok: true, token: await createPublisherCustomToken() });
    } catch (error) {
      const status = error.code === 'SERVICE_ACCOUNT_MISSING' ? 404 : 500;
      res.status(status).json({ ok: false, error: error.message });
    }
  });
}

module.exports = { registerPublisherTokenRoute, createPublisherCustomToken, isLoopbackRequest };
