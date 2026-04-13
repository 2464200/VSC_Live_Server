// C:\VSC_Live_Server\EVENTI\eventi-server.js
const express = require('express');
const fs = require('fs');
const path = require('path');
const { syncBraniJson, appendExtraBrano, updateExtraBrano, EXTRA_CSV_NAME } = require('./brani-utils');

const router = express.Router();

const pathBrani = path.join(__dirname, 'data', 'brani.json');
const pathLog   = path.join(__dirname, 'data', 'log.json');
const pathDj    = path.join(__dirname, 'data', 'dj.json');
const pathCsv   = path.join(__dirname, 'data', 'log.csv');

// Assicurati che i file esistano
function ensureFiles() {
  if (!fs.existsSync(path.join(__dirname, 'data'))) {
    fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
  }
  if (!fs.existsSync(pathBrani)) fs.writeFileSync(pathBrani, '[]');
  if (!fs.existsSync(pathLog)) fs.writeFileSync(pathLog, '[]');
  if (!fs.existsSync(pathDj)) fs.writeFileSync(pathDj, '[]');
}
ensureFiles();

// ============================
//        GET LISTA BRANI
// ============================
router.get('/brani', (req, res) => {
  try {
    const brani = JSON.parse(fs.readFileSync(pathBrani, 'utf-8'));
    res.json(brani);
  } catch (e) {
    res.status(500).json({ error: 'Impossibile leggere brani.json' });
  }
});

// ============================
//           GET LOG
// ============================
router.get('/log', (req, res) => {
  try {
    const log = JSON.parse(fs.readFileSync(pathLog, 'utf-8'));
    res.json(log);
  } catch (e) {
    res.status(500).json({ error: 'Impossibile leggere log.json' });
  }
});

// ============================
//         POST: SALVATAGGIO
// ============================
router.post('/log', (req, res) => {
  try {
    const { id, stato, timestamp, dj } = req.body;

    // Accetta gli stati stringa usati dal front-end:
    // 'prenotato', 'eseguito', 'disponibile', oppure il vecchio booleano true/false
    const validStates = ['prenotato', 'eseguito', 'disponibile'];
    const isBoolState = typeof stato === 'boolean';
    const isStringState = typeof stato === 'string' && validStates.includes(stato);

    if (!id || (!isBoolState && !isStringState)) {
      return res.status(400).json({ error: 'Payload non valido' });
    }

    // Per compatibilità, convertiamo il booleano in stato stringa
    const normalizedState = isBoolState ? (stato ? 'eseguito' : 'disponibile') : stato;

    const log = JSON.parse(fs.readFileSync(pathLog, 'utf-8'));
    log.push({ id, stato: normalizedState, timestamp: timestamp || new Date().toISOString(), dj: dj || null });
    fs.writeFileSync(pathLog, JSON.stringify(log, null, 2));
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Errore salvataggio log' });
  }
});

router.post('/brani-extra', (req, res) => {
  try {
    const result = appendExtraBrano(req.body, pathBrani);
    res.status(201).json({
      ok: true,
      entry: result.entry,
      count: result.stats.total,
      baseCount: result.stats.baseCount,
      extraCount: result.stats.extraCount,
      message: `Coreografia aggiunta in ${EXTRA_CSV_NAME}`
    });
  } catch (e) {
    res.status(400).json({ error: e.message || 'Errore inserimento coreografia extra' });
  }
});

// ============================
//   POST: AGGIORNA COREOGRAFIA
// ============================
router.post('/aggiuntive/update', (req, res) => {
  try {
    const { id, coreografia, brano, autore } = req.body;
    
    if (!id) {
      return res.status(400).json({ error: 'ID non fornito' });
    }
    
    const result = updateExtraBrano(id, { coreografia, brano, autore });
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message || 'Errore aggiornamento coreografia' });
  }
});

// ============================
//   POST: RESET DATE / ORARI
// ============================
router.post('/log/reset-times', (req, res) => {
  try {
    const log = JSON.parse(fs.readFileSync(pathLog, 'utf-8'));
    const archiveDir = path.join(__dirname, 'data', 'archive');

    if (!fs.existsSync(archiveDir)) {
      fs.mkdirSync(archiveDir, { recursive: true });
    }

    if (Array.isArray(log) && log.length > 0) {
      const archiveName = `log-reset-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      fs.writeFileSync(path.join(archiveDir, archiveName), JSON.stringify(log, null, 2));
    }

    fs.writeFileSync(pathLog, JSON.stringify([], null, 2));
    fs.writeFileSync(pathCsv, 'timestamp;id_brano;stato;dj\n');

    res.json({
      ok: true,
      cleared: Array.isArray(log) ? log.length : 0,
      message: 'Date e orari delle coreografie sono stati resettati. Il nuovo evento puo iniziare con cronologia pulita.'
    });
  } catch (e) {
    res.status(500).json({ error: 'Errore reset date e orari' });
  }
});

// ============================
//      GET: EXPORT CSV
// ============================
// Genera/aggiorna log.csv (separatori ; per Excel)
router.get('/export-csv', (req, res) => {
  try {
    const log = JSON.parse(fs.readFileSync(pathLog, 'utf-8'));
    const header = 'timestamp;id_brano;stato;dj\n';
    const rows = log.map(r => {
    let statoCsv = '0';
    if (r.stato === 'eseguito' || r.stato === true) statoCsv = '1';
    else if (r.stato === 'prenotato') statoCsv = '2';
    return `${r.timestamp};${r.id};${statoCsv};${r.dj ?? ''}`;
  }).join('\n');
    fs.writeFileSync(pathCsv, header + rows);
    res.json({ ok: true, csv: '/eventi/api/log.csv' });
  } catch (e) {
    res.status(500).json({ error: 'Errore export CSV' });
  }
});

// Download CSV
router.get('/log.csv', (req, res) => {
  if (!fs.existsSync(pathCsv)) return res.status(404).send('CSV non generato');
  res.sendFile(pathCsv);
});

// ============================
//   SYNC BRANI DA CSV
// ============================
// Legge il CSV e converte in JSON
router.get('/sync-brani', (req, res) => {
  try {
    const { stats } = syncBraniJson(pathBrani);

    res.json({
      ok: true,
      count: stats.total,
      baseCount: stats.baseCount,
      extraCount: stats.extraCount,
      skippedInvalid: stats.skippedInvalid,
      skippedDuplicates: stats.skippedDuplicates,
      extraFile: EXTRA_CSV_NAME,
      message: `Sincronizzati ${stats.total} brani da CSV`
    });
  } catch (e) {
    res.status(500).json({ error: 'Errore sincronizzazione brani: ' + e.message });
  }
});

// ============================
//        GET LISTA DJ
// ============================
router.get('/dj', (req, res) => {
  try {
    const dj = JSON.parse(fs.readFileSync(pathDj, 'utf-8'));
    res.json(dj);
  } catch (e) {
    res.status(500).json({ error: 'Impossibile leggere dj.json' });
  }
});

// ============================
//    POST: AGGIUNGI DJ
// ============================
router.post('/dj', (req, res) => {
  try {
    const { nome } = req.body;
    if (!nome || typeof nome !== 'string' || !nome.trim()) {
      return res.status(400).json({ error: 'Nome DJ non valido' });
    }
    
    const dj = JSON.parse(fs.readFileSync(pathDj, 'utf-8'));
    
    // Controlla duplicati
    if (dj.some(d => d.nome.toLowerCase() === nome.toLowerCase())) {
      return res.status(400).json({ error: 'DJ già esiste' });
    }
    
    const newDj = {
      id: 'dj-' + Date.now(),
      nome: nome.trim(),
      createdAt: new Date().toISOString()
    };
    
    dj.push(newDj);
    fs.writeFileSync(pathDj, JSON.stringify(dj, null, 2));
    res.json(newDj);
  } catch (e) {
    res.status(500).json({ error: 'Errore aggiunta DJ: ' + e.message });
  }
});

// ============================
//    DELETE: RIMUOVI DJ
// ============================
router.delete('/dj/:id', (req, res) => {
  try {
    const dj = JSON.parse(fs.readFileSync(pathDj, 'utf-8'));
    const filtered = dj.filter(d => d.id !== req.params.id);
    
    if (filtered.length === dj.length) {
      return res.status(404).json({ error: 'DJ non trovato' });
    }
    
    fs.writeFileSync(pathDj, JSON.stringify(filtered, null, 2));
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Errore rimozione DJ' });
  }
});

module.exports = router;
