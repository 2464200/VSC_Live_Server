'use strict';

const fs = require('fs');
const path = require('path');

const PUBLISHER_EMAILS = new Set([
  'lucafaby@gmail.com',
  'djdaniele1984@gmail.com',
  'azzurriditalia@yahoo.it'
]);
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

async function createPublisherCustomToken(email = 'lucafaby@gmail.com') {
  const normalizedEmail = String(email).trim().toLowerCase();
  if (!PUBLISHER_EMAILS.has(normalizedEmail)) {
    const error = new Error('Account Google non autorizzato per la pubblicazione.');
    error.code = 'PUBLISHER_EMAIL_NOT_ALLOWED';
    throw error;
  }
  const auth = require('firebase-admin/auth').getAuth(getAdminApp());
  const user = await auth.getUserByEmail(normalizedEmail);
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
    const email = String(req.query.email || 'lucafaby@gmail.com').trim().toLowerCase();
    if (!PUBLISHER_EMAILS.has(email)) {
      return res.status(400).json({ ok: false, error: 'Account Google non autorizzato per la pubblicazione.' });
    }
    try {
      res.set('Cache-Control', 'no-store');
      res.json({ ok: true, token: await createPublisherCustomToken(email) });
    } catch (error) {
      const status = error.code === 'SERVICE_ACCOUNT_MISSING' ? 404 : 500;
      res.status(status).json({ ok: false, error: error.message });
    }
  });
}

module.exports = { registerPublisherTokenRoute, createPublisherCustomToken, isLoopbackRequest };
