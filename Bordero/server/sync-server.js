#!/usr/bin/env node
/**
 * BORDERO SYNC SERVER
 * Riceve i dati da Excel e li sincronizza sui file CSV
 * 
 * Endpoint:
 * POST /api/sync/brani - Sincronizza brani.csv
 * POST /api/sync/comuni - Sincronizza comuni_italia.csv
 * POST /api/sync/dbase - Sincronizza dBase.csv
 * GET /api/status - Status del server
 */

const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');

const app = express();
const PORT = process.env.BORDERO_SYNC_PORT || 5501;

// Paths relativi al progetto Bordero
const BORDERO_DIR = path.join(__dirname, '..');
const DATA_DIR = path.join(BORDERO_DIR, 'data');
const CSV_BRANI = path.join(DATA_DIR, 'brani.csv');
const CSV_COMUNI = path.join(DATA_DIR, 'comuni_italia.csv');
const CSV_DBASE = path.join(DATA_DIR, 'dBase.csv');

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

/**
 * Converte un array di oggetti in CSV
 */
function jsonToCSV(data, headers = null) {
  if (!data || data.length === 0) {
    return '';
  }

  // Se headers non forniti, usa le chiavi del primo oggetto
  const cols = headers || Object.keys(data[0]);
  
  // Intestazione
  let csv = cols.join(',') + '\n';
  
  // Righe dati
  data.forEach(row => {
    const values = cols.map(col => {
      const value = row[col] || '';
      // Escapa le stringhe con virgole
      return typeof value === 'string' && value.includes(',')
        ? `"${value.replace(/"/g, '""')}"` 
        : value;
    });
    csv += values.join(',') + '\n';
  });

  return csv;
}

/**
 * POST /api/sync/brani
 * Sincronizza brani.csv
 */
app.post('/api/sync/brani', async (req, res) => {
  try {
    const { data } = req.body;

    if (!data || !Array.isArray(data)) {
      return res.status(400).json({ 
        error: 'Dati non validi. Inviare array di oggetti in body.data' 
      });
    }

    if (data.length === 0) {
      return res.status(400).json({ 
        error: 'Nessun dato da sincronizzare' 
      });
    }

    // Converti a CSV
    const csv = jsonToCSV(data);

    // Scrivi sul file
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(CSV_BRANI, csv, 'utf-8');

    console.log(`✅ ${data.length} brani sincronizzati su ${CSV_BRANI}`);

    res.json({
      success: true,
      message: `✅ ${data.length} brani sincronizzati`,
      file: CSV_BRANI,
      rows: data.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Errore sync brani:', error);
    res.status(500).json({
      error: error.message,
      path: CSV_BRANI
    });
  }
});

/**
 * POST /api/sync/comuni
 * Sincronizza comuni_italia.csv
 */
app.post('/api/sync/comuni', async (req, res) => {
  try {
    const { data } = req.body;

    if (!data || !Array.isArray(data)) {
      return res.status(400).json({ 
        error: 'Dati non validi. Inviare array di oggetti in body.data' 
      });
    }

    if (data.length === 0) {
      return res.status(400).json({ 
        error: 'Nessun dato da sincronizzare' 
      });
    }

    // Converti a CSV
    const csv = jsonToCSV(data);

    // Scrivi sul file
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(CSV_COMUNI, csv, 'utf-8');

    console.log(`✅ ${data.length} comuni sincronizzati su ${CSV_COMUNI}`);

    res.json({
      success: true,
      message: `✅ ${data.length} comuni sincronizzati`,
      file: CSV_COMUNI,
      rows: data.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Errore sync comuni:', error);
    res.status(500).json({
      error: error.message,
      path: CSV_COMUNI
    });
  }
});

/**
 * POST /api/sync/dbase
 * Sincronizza dBase.csv
 */
app.post('/api/sync/dbase', async (req, res) => {
  try {
    const { data } = req.body;

    if (!data || !Array.isArray(data)) {
      return res.status(400).json({ 
        error: 'Dati non validi. Inviare array di oggetti in body.data' 
      });
    }

    if (data.length === 0) {
      return res.status(400).json({ 
        error: 'Nessun dato da sincronizzare' 
      });
    }

    // Converti a CSV
    const csv = jsonToCSV(data);

    // Scrivi sul file
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(CSV_DBASE, csv, 'utf-8');

    console.log(`✅ ${data.length} DJ sincronizzati su ${CSV_DBASE}`);

    res.json({
      success: true,
      message: `✅ ${data.length} DJ sincronizzati`,
      file: CSV_DBASE,
      rows: data.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Errore sync dBase:', error);
    res.status(500).json({
      error: error.message,
      path: CSV_DBASE
    });
  }
});

/**
 * POST /api/sync/google-sheets
 * Sincronizza i fogli Google Sheets e salva i CSV
 */
app.post('/api/sync/google-sheets', async (req, res) => {
  try {
    const SYNC_SCRIPT = path.join(__dirname, 'google-sheets-sync.js');
    const child = spawn(process.execPath, [SYNC_SCRIPT], {
      cwd: __dirname
    });

    let stdout = '';
    let stderr = '';
    let responded = false;

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (err) => {
      console.error('❌ Errore avviando google-sheets-sync:', err);
      if (!responded) {
        responded = true;
        res.status(500).json({ error: err.message, stderr });
      }
    });

    child.on('close', (code) => {
      if (responded) return;
      responded = true;
      if (code === 0) {
        res.json({ success: true, message: 'Google Sheets sync completato', output: stdout });
      } else {
        res.status(500).json({ error: `Google Sheets sync fallito con code ${code}`, stdout, stderr });
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/status
 * Status del server
 */
app.get('/api/status', async (req, res) => {
  try {
    const braniExists = await fs.stat(CSV_BRANI).then(() => true).catch(() => false);
    const comuniExists = await fs.stat(CSV_COMUNI).then(() => true).catch(() => false);
    const dbaseExists = await fs.stat(CSV_DBASE).then(() => true).catch(() => false);

    res.json({
      server: 'Bordero Sync Server',
      port: PORT,
      status: 'online',
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      dataDir: DATA_DIR,
      files: {
        brani: { exists: braniExists, path: CSV_BRANI },
        comuni: { exists: comuniExists, path: CSV_COMUNI },
        dbase: { exists: dbaseExists, path: CSV_DBASE }
      },
      endpoints: {
        'POST /api/sync/brani': 'Sincronizza brani.csv',
        'POST /api/sync/comuni': 'Sincronizza comuni_italia.csv',
        'POST /api/sync/dbase': 'Sincronizza dBase.csv',
        'POST /api/sync/google-sheets': 'Sincronizza Google Sheets e salva CSV',
        'GET /api/status': 'Status server'
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Avvia il server
 */
// Esegui una sincronizzazione iniziale una tantum all'avvio del server
const SYNC_SCRIPT = path.join(__dirname, 'google-sheets-sync.js');

function runInitialSync() {
  try {
    console.log('\n🔁 Eseguo sync iniziale (una tantum)...');
    const child = spawn(process.execPath, [SYNC_SCRIPT], {
      cwd: __dirname,
      stdio: 'inherit'
    });

    child.on('exit', (code, signal) => {
      if (code === 0) {
        console.log(`\n✅ Sync iniziale completata con successo (code=${code})`);
      } else {
        console.warn(`\n⚠️ Sync iniziale terminata con code=${code} signal=${signal}`);
      }
    });

    child.on('error', (err) => {
      console.error('❌ Errore avviando sync iniziale:', err);
    });
  } catch (err) {
    console.error('❌ Exception during initial sync:', err);
  }
}

// Avvia sync iniziale in background (non bloccante)
runInitialSync();

app.listen(PORT, () => {
  console.log('\n╔═══════════════════════════════════════════════╗');
  console.log('║  🚀 BORDERO SYNC SERVER                      ║');
  console.log(`║  Porta: ${PORT}`.padEnd(46) + '║');
  console.log(`║  Data Dir: ${DATA_DIR}`.substring(0, 44).padEnd(45) + '║');
  console.log('║                                               ║');
  console.log('║  Endpoint disponibili:                        ║');
  console.log('║  POST /api/sync/brani                         ║');
  console.log('║  POST /api/sync/comuni                        ║');
  console.log('║  POST /api/sync/dbase                         ║');
  console.log('║  POST /api/sync/google-sheets                 ║');
  console.log('║  GET  /api/status                             ║');
  console.log('╚═══════════════════════════════════════════════╝\n');
});

// Gestisci gli errori
process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled rejection:', err);
});

process.on('SIGINT', () => {
  console.log('\n✓ Server chiuso.');
  process.exit(0);
});
