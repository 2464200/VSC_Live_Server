#!/usr/bin/env node
/**
 * UNIFIED SERVER - Server consolidato su porta 5500
 *
 * Combina tutte le funzionalità:
 * - Server statico per file HTML/CSS/JS
 * - API PDF (lista, apertura, chiusura viewer)
 * - API Eventi (brani, log, export)
 * - Gestione automatica ciclo di vita PDF
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const os = require('os');
const QRCodeLib = require('qrcode');
const { syncBraniJson, appendExtraBrano, updateExtraBrano, deleteExtraBrano, EXTRA_CSV_NAME, ensureExtraCsvFile } = require('./Eventi/brani-utils');

const app = express();
const PORT = process.env.UNIFIED_PORT || 5500;
const PDF_FOLDER = 'C:\\VSC_SCRIPT_PDF';

// ===== STATO GLOBALE =====
let chromeProcess = null;
// Mappa dei viewer avviati: pid -> { file, startedAt }
let openedViewers = {};
const OPENED_VIEWERS_FILE = path.join(__dirname, 'pdf', 'config', 'opened-viewers.json');

// ===== CONFIGURAZIONE SSE =====
const SSE_CONFIG = {
    heartbeatInterval: 15000,    // Heartbeat ogni 15 secondi
    clientTimeout: 60000,         // Timeout client inattivo 60 secondi
    maxClients: 50,                // Numero massimo di client connessi
    retryDelay: 3000              // Retry delay per il client (ms)
};

// SSE Eventi: client connessi per refresh in tempo reale
const eventiClients = [];
let eventiHeartbeatInterval = null;
let eventiCleanupInterval = null;

function registerEventiClient(res) {
    // Limita il numero massimo di client
    if (eventiClients.length >= SSE_CONFIG.maxClients) {
        console.warn(`Raggiunto limite massimo client (${SSE_CONFIG.maxClients}), rifiuto nuova connessione`);
        res.status(503).json({ error: 'Server sovraccarico, riprova più tardi' });
        return;
    }

    // Aggiungi timestamp per tracking
    res._connectedAt = Date.now();
    res._lastHeartbeat = Date.now();
    eventiClients.push(res);

    res.on('close', () => {
        const index = eventiClients.indexOf(res);
        if (index !== -1) {
            eventiClients.splice(index, 1);
            console.log(`Client SSE disconnesso. Client attivi: ${eventiClients.length}`);
        }
    });

    if (!eventiHeartbeatInterval) {
        eventiHeartbeatInterval = setInterval(() => {
            const heartbeat = `event: heartbeat\ndata: ${JSON.stringify({ 
                time: new Date().toISOString(), 
                clients: eventiClients.length,
                uptime: Math.floor(process.uptime())
            })}\n\n`;
            eventiClients.forEach(client => {
                try {
                    client._lastHeartbeat = Date.now();
                    client.write(heartbeat);
                } catch (err) {
                    console.warn('Errore SSE heartbeat Eventi:', err.message);
                }
            });
        }, SSE_CONFIG.heartbeatInterval);
    }

    // Avvia cleanup periodico per client inattivi
    if (!eventiCleanupInterval) {
        eventiCleanupInterval = setInterval(() => {
            const now = Date.now();
            const stale = eventiClients.filter(c => 
                c._lastHeartbeat && (now - c._lastHeartbeat > SSE_CONFIG.clientTimeout)
            );
            stale.forEach(c => {
                try { c.end(); } catch (e) {}
                const idx = eventiClients.indexOf(c);
                if (idx > -1) eventiClients.splice(idx, 1);
            });
            if (stale.length > 0) {
                console.log(`Rimossi ${stale.length} client SSE stale`);
            }
        }, SSE_CONFIG.clientTimeout / 2);
    }
}

function cleanupEventiHeartbeat() {
    if (eventiClients.length === 0 && eventiHeartbeatInterval) {
        clearInterval(eventiHeartbeatInterval);
        eventiHeartbeatInterval = null;
    }
}

function broadcastEventiUpdate(payload = { type: 'refresh' }) {
    const message = `event: refresh\ndata: ${JSON.stringify(payload)}\n\n`;
    for (const client of [...eventiClients]) {
        try {
            client.write(message);
        } catch (err) {
            console.warn('Errore broadcast SSE Eventi:', err.message);
        }
    }
    cleanupEventiHeartbeat();
}

// ===== PATHS EVENTI =====
const eventiDataDir = path.join(__dirname, 'Eventi', 'data');
const pathBrani = path.join(eventiDataDir, 'brani.json');
const pathLog = path.join(eventiDataDir, 'log.json');
const pathDj = path.join(eventiDataDir, 'dj.json');
const pathDjLimits = path.join(eventiDataDir, 'dj-limits.json');
const pathCsv = path.join(eventiDataDir, 'log.csv');

// ===== INIZIALIZZAZIONE =====
function initializeEventiFiles() {
    if (!fs.existsSync(eventiDataDir)) {
        fs.mkdirSync(eventiDataDir, { recursive: true });
    }
    if (!fs.existsSync(pathBrani)) fs.writeFileSync(pathBrani, '[]');
    if (!fs.existsSync(pathLog)) fs.writeFileSync(pathLog, '[]');
    if (!fs.existsSync(pathDj)) fs.writeFileSync(pathDj, '[]');
    if (!fs.existsSync(pathDjLimits)) fs.writeFileSync(pathDjLimits, '{}');
}

function loadOpenedViewersFromFile() {
    try {
        if (fs.existsSync(OPENED_VIEWERS_FILE)) {
            const raw = fs.readFileSync(OPENED_VIEWERS_FILE, 'utf8');
            const obj = JSON.parse(raw || '{}');
            if (obj && typeof obj === 'object') {
                openedViewers = obj;
                console.log(`[OK] openedViewers caricati da file (${Object.keys(openedViewers).length} entries)`);
                // Verify PIDs and remove stale entries
                let removed = 0;
                Object.keys(openedViewers).forEach(k => {
                    const pid = parseInt(k, 10);
                    if (isNaN(pid)) { delete openedViewers[k]; removed++; return; }
                    let alive = true;
                    try {
                        process.kill(pid, 0);
                    } catch (e) {
                        if (e.code === 'EPERM') alive = true; else alive = false;
                    }
                    if (!alive) { delete openedViewers[k]; removed++; }
                });
                if (removed > 0) {
                    console.log(`ℹ️ Rimosse ${removed} voci stale da openedViewers`);
                    saveOpenedViewersToFile();
                }
            }
        }
    } catch (err) {
        console.warn('⚠️ Impossibile caricare opened-viewers.json:', err.message);
    }
}

function saveOpenedViewersToFile() {
    try {
        const tmp = OPENED_VIEWERS_FILE + '.tmp';
        fs.writeFileSync(tmp, JSON.stringify(openedViewers, null, 2), { encoding: 'utf8' });
        fs.renameSync(tmp, OPENED_VIEWERS_FILE);
    } catch (err) {
        console.warn('⚠️ Impossibile salvare opened-viewers.json:', err.message);
    }
}

function isPidRunning(pid) {
    try {
        process.kill(pid, 0);
        return true;
    } catch (e) {
        return e && e.code === 'EPERM' ? true : false;
    }
}

function detectCsvDelimiter(line) {
    if (typeof line !== 'string' || line.trim() === '') {
        return ';';
    }
    const commaCount = (line.match(/,/g) || []).length;
    const semicolonCount = (line.match(/;/g) || []).length;
    if (commaCount === 0 && semicolonCount === 0) {
        return ',';
    }
    return commaCount >= semicolonCount ? ',' : ';';
}

function syncBraniOnStartupV2() {
    try {
        ensureExtraCsvFile();
        const { stats } = syncBraniJson(pathBrani);
        console.log(`Startup sync: ${stats.total} brani caricati dai CSV`);
        console.log(`   - Principale: ${stats.baseCount}`);
        console.log(`   - Aggiuntivo (${EXTRA_CSV_NAME}): ${stats.extraCount}`);
    } catch (e) {
        console.error('Errore sincronizzazione startup:', e);
    }
}

function syncBraniOnStartup() {
    try {
        const csvPath = path.join(__dirname, 'Eventi', 'display.csv');

        if (!fs.existsSync(csvPath)) {
            console.warn('⚠️  CSV non trovato, brani non sincronizzati');
            return;
        }

        const csvContent = fs.readFileSync(csvPath, 'utf-8');
        const lines = csvContent.replace(/\r/g, '').split('\n');
        const headerLine = lines.slice(3).find(l => l.trim()) || '';
        const delimiter = (headerLine.match(/,/g) || []).length >= (headerLine.match(/;/g) || []).length ? ',' : ';';
        const brani = [];

        for (let i = 3; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const cols = line.split(delimiter);
            const id = cols[1]?.trim();
            const titolo = cols[2]?.trim();
            const brano = cols[3]?.trim();
            const autore = cols[4]?.trim();

            if (id && titolo) {
                brani.push({ id, titolo, brano: brano || '', autore: autore || '' });
            }
        }

        fs.writeFileSync(pathBrani, JSON.stringify(brani, null, 2));
        console.log(`✅ Startup sync: ${brani.length} brani caricati da CSV`);
    } catch (e) {
        console.error('❌ Errore sincronizzazione startup:', e);
    }
}

// ===== MIDDLEWARE =====
app.use(express.json());

// CORS header per permettere connessioni da qualsiasi origin
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// Normalize uppercase /EVENTI paths to lowercase so static files and routes resolve.
app.use((req, res, next) => {
    if (/^\/eventi/i.test(req.url) && !req.url.startsWith('/eventi')) {
        req.url = req.url.replace(/^\/eventi/i, '/eventi');
    }
    next();
});

// Serve the Visualizer entry point directly before static middleware.
// This avoids redirect loops on Windows caused by case-insensitive path handling.
app.get('/eventi/visualizer.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'Eventi', 'public', 'visualizer.html'));
});

// Serve static files for Eventi before root static files.
app.use('/eventi', express.static(path.join(__dirname, 'Eventi', 'public')));

app.use(express.static(path.join(__dirname), {
    index: ['index.html'],
    extensions: ['html', 'htm']
}));

// Logging
app.use((req, res, next) => {
    console.log(`📡 ${req.method} ${req.path}`);
    next();
});

// ===== API PDF =====

// Lista PDF
app.get('/api/pdf-list', (req, res) => {
    try {
        console.log(`🔍 Lettura cartella: ${PDF_FOLDER}`);

        if (!fs.existsSync(PDF_FOLDER)) {
            console.warn(`⚠️  Cartella non esiste: ${PDF_FOLDER}`);
            return res.json({
                success: false,
                error: `Cartella non trovata: ${PDF_FOLDER}`,
                files: []
            });
        }

        const allFiles = fs.readdirSync(PDF_FOLDER);
        console.log(`   Trovati ${allFiles.length} file totali`);

        const pdfFiles = allFiles.filter(f => f.toLowerCase().endsWith('.pdf'));
        console.log(`   Di cui ${pdfFiles.length} sono PDF`);

        const files = pdfFiles
            .sort()
            .map(filename => {
                try {
                    const fullPath = path.join(PDF_FOLDER, filename);
                    const stats = fs.statSync(fullPath);

                    return {
                        name: filename,
                        path: fullPath,
                        size: (stats.size / 1024 / 1024).toFixed(2) + ' MB',
                        created: stats.birthtime.toLocaleString('it-IT')
                    };
                } catch (e) {
                    console.warn(`⚠️  Errore lettura file ${filename}: ${e.message}`);
                    return null;
                }
            })
            .filter(f => f !== null);

        console.log(`✅ Ritorno ${files.length} file PDF validi`);

        res.json({
            success: true,
            timestamp: new Date().toLocaleString('it-IT'),
            folder: PDF_FOLDER,
            totalCount: files.length,
            files: files
        });

    } catch (error) {
        console.error(`❌ Errore API /api/pdf-list: ${error.message}`);
        res.status(500).json({
            success: false,
            error: error.message,
            files: []
        });
    }
});

// Apri PDF
app.post('/api/open-pdf', (req, res) => {
    try {
        const { filePath } = req.body;

        if (!filePath) {
            return res.status(400).json({
                success: false,
                error: 'filePath non fornito'
            });
        }

        console.log(`📂 Richiesta apertura: ${filePath}`);

        if (!fs.existsSync(filePath)) {
            console.error(`❌ File non trovato: ${filePath}`);
            return res.status(404).json({
                success: false,
                error: `File non trovato: ${filePath}`
            });
        }

        console.log(`✅ File trovato, apertura in corso...`);
        console.log(`🌐 Apertura su monitor secondario`);

        const viewer = req.body.viewer || 'auto';
        const adobePath = req.body.adobePath || '';

        const scriptPath = path.join(__dirname, 'pdf', 'scripts', 'open-pdf-secondary.ps1');
        console.log(`   Script: ${scriptPath}`);
        console.log(`   File: ${filePath}`);
        console.log(`   Viewer: ${viewer} adobePath: ${adobePath}`);

        const args = [
            '-NoProfile',
            '-ExecutionPolicy', 'Bypass',
            '-File', scriptPath,
            '-FilePath', filePath,
            '-Viewer', viewer,
            '-AdobePath', adobePath
        ];

        const ps = spawn('powershell.exe', args, {
            stdio: ['ignore', 'pipe', 'pipe']
        });

        let stdout = '';
        let stderr = '';
        let responseSent = false;
        ps.stdout.on('data', d => { stdout += d.toString(); });
        ps.stderr.on('data', d => { stderr += d.toString(); });

        const timeout = setTimeout(() => {
            if (responseSent) return;
            try {
                responseSent = true;
                res.json({ success: true, message: 'Comando inviato (timeout)', file: filePath, debug: stdout || stderr });
            } catch (e) {}
        }, 4000);

        ps.on('close', code => {
            clearTimeout(timeout);
            console.log(`powershell exited code=${code}`);
            try {
                const out = stdout.trim();
                let parsed = null;
                if (out) {
                    const first = out.match(/\{[\s\S]*\}/);
                    if (first) parsed = JSON.parse(first[0]);
                }

                if (parsed && parsed.pid) {
                    const pid = parseInt(parsed.pid, 10);
                    if (!isNaN(pid)) {
                        openedViewers[pid] = { file: filePath, startedAt: Date.now() };
                        saveOpenedViewersToFile();
                        console.log(`✅ Viewer PID registrato: ${pid}`);
                        if (responseSent) return;
                        responseSent = true;
                        return res.json({ success: true, message: 'PDF aperto sul monitor secondario', file: filePath, pid });
                    }
                }

                if (responseSent) return;
                responseSent = true;
                return res.json({ success: true, message: 'Comando inviato', file: filePath, debug: out || stderr });
            } catch (err) {
                console.error('❌ Errore parsing output PS:', err.message);
                if (responseSent) return;
                responseSent = true;
                return res.json({ success: true, message: 'Comando inviato (no pid)', file: filePath, error: err.message });
            }
        });

    } catch (error) {
        console.error(`❌ Errore API /api/open-pdf: ${error.message}`);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Chiudi viewer
app.post('/api/close-chrome', (req, res) => {
    try {
        const pids = Object.keys(openedViewers).map(k => parseInt(k, 10)).filter(Boolean);
        const results = [];
        pids.forEach(pid => {
            try {
                process.kill(pid);
                results.push({ pid, status: 'killed' });
            } catch (e) {
                try {
                    spawn('taskkill', ['/PID', pid.toString(), '/T', '/F']);
                    results.push({ pid, status: 'taskkill_sent' });
                } catch (ee) {
                    results.push({ pid, status: 'error', error: ee.message });
                }
            }
        });

        // Clear the map and save
        openedViewers = {};
        saveOpenedViewersToFile();

        res.json({ success: true, results });
    } catch (error) {
        console.error(`❌ Errore API /api/close-chrome: ${error.message}`);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Lista viewer aperti
app.get('/api/opened-viewers', (req, res) => {
    try {
        const list = Object.keys(openedViewers).map(k => {
            const pid = parseInt(k, 10);
            const data = openedViewers[k];
            const alive = isPidRunning(pid);
            const startedAt = data && data.startedAt ? data.startedAt : null;
            const ageMs = startedAt ? (Date.now() - startedAt) : null;
            return { pid, file: data.file, startedAt, ageMs, alive };
        });
        res.json({ success: true, list });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Health check for PDF client compatibility
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        server: 'unified-server',
        port: PORT,
        pdfFolder: PDF_FOLDER,
        uptime: Math.floor(process.uptime())
    });
});

// Serve PDF files for embedded viewer
app.get('/api/serve-pdf', (req, res) => {
    try {
        const fileParam = req.query.file;
        if (!fileParam) {
            return res.status(400).send('Parametro file mancante');
        }

        const requestedPath = path.resolve(fileParam);
        const allowedRoot = path.resolve(PDF_FOLDER);
        if (requestedPath !== allowedRoot && !requestedPath.startsWith(allowedRoot + path.sep)) {
            return res.status(403).send('Accesso al file non consentito');
        }

        if (!fs.existsSync(requestedPath)) {
            return res.status(404).send('File non trovato');
        }

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'inline; filename="' + path.basename(requestedPath) + '"');
        const stream = fs.createReadStream(requestedPath);
        stream.pipe(res);
        stream.on('error', error => {
            console.error('❌ Errore serve-pdf:', error.message);
            if (!res.headersSent) {
                res.status(500).send('Errore interno server');
            }
        });
    } catch (err) {
        console.error('❌ Errore API /api/serve-pdf:', err.message);
        res.status(500).send(err.message);
    }
});

// ===== API EVENTI =====

// Router per eventi
const router = express.Router();

// Status eventi
app.get('/eventi/api/status', (req, res) => {
    res.json({ ok: true, name: 'EVENTI', port: PORT, uptime: process.uptime() });
});

app.get('/eventi/api/ping', (req, res) => {
    res.json({ ok: true, ping: 'pong' });
});

app.get('/eventi/api/host-ip', (req, res) => {
    const localIp = getLocalIP();
    if (!localIp) {
        return res.status(500).json({ ok: false, error: 'IP locale non trovato' });
    }
    res.json({ ok: true, ip: localIp, port: PORT });
});

app.get('/eventi/api/qr', async (req, res) => {
    try {
        const localIp = getLocalIP();
        if (!localIp) {
            return res.status(500).json({ ok: false, error: 'IP locale non trovato' });
        }
        const url = `http://${localIp}:${PORT}/eventi/eventi.html`;
        const dataUrl = await QRCodeLib.toDataURL(url, {
            errorCorrectionLevel: 'M',
            type: 'image/png',
            margin: 1,
            width: 300
        });
        res.json({ ok: true, url, dataUrl });
    } catch (err) {
        console.error('Errore generazione QR:', err);
        res.status(500).json({ ok: false, error: err.message || 'Errore generazione QR' });
    }
});

app.get('/eventi/api/stream', (req, res) => {
    res.set({
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'X-Accel-Buffering': 'no'  // Disabilita buffering nginx
    });

    if (typeof res.flushHeaders === 'function') {
        res.flushHeaders();
    }

    // Retry configurabile lato client
    res.write(`retry: ${SSE_CONFIG.retryDelay}\n\n`);
    registerEventiClient(res);
});

// Lista brani
router.get('/brani', (req, res) => {
    try {
        const brani = JSON.parse(fs.readFileSync(pathBrani, 'utf-8'));
        res.json(brani);
    } catch (e) {
        res.status(500).json({ error: 'Impossibile leggere brani.json' });
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
        broadcastEventiUpdate({ type: 'brano-added', entry: result.entry });
    } catch (e) {
        res.status(400).json({ error: e.message || 'Errore inserimento coreografia extra' });
    }
});

// Aggiorna coreografia aggiuntiva
router.post('/aggiuntive/update', (req, res) => {
    try {
        const { id, coreografia, brano, compositore, autore, durata } = req.body;
        
        if (!id) {
            return res.status(400).json({ error: 'ID non fornito' });
        }
        
        const result = updateExtraBrano(id, { coreografia, brano, compositore, autore, durata });
        res.json(result);
    } catch (e) {
        res.status(400).json({ error: e.message || 'Errore aggiornamento coreografia' });
    }
});

router.delete('/aggiuntive/:id', (req, res) => {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({ error: 'ID non fornito' });
        }

        const result = deleteExtraBrano(id);
        res.json(result);
        broadcastEventiUpdate({ type: 'brano-deleted', id });
    } catch (e) {
        res.status(400).json({ error: e.message || 'Errore eliminazione coreografia' });
    }
});

router.post('/aggiuntive/delete', (req, res) => {
    try {
        const { id } = req.body || {};

        if (!id) {
            return res.status(400).json({ error: 'ID non fornito' });
        }

        const result = deleteExtraBrano(id);
        res.json(result);
        broadcastEventiUpdate({ type: 'brano-deleted', id });
    } catch (e) {
        res.status(400).json({ error: e.message || 'Errore eliminazione coreografia' });
    }
});

// Log eventi
router.get('/log', (req, res) => {
    try {
        const log = JSON.parse(fs.readFileSync(pathLog, 'utf-8'));
        res.json(log);
    } catch (e) {
        res.status(500).json({ error: 'Impossibile leggere log.json' });
    }
});

// Salvataggio log
router.post('/log', (req, res) => {
    try {
        const { id, stato, timestamp, dj } = req.body;

        const validStates = ['prenotato', 'eseguito', 'disponibile'];
        const isBoolState = typeof stato === 'boolean';
        const isStringState = typeof stato === 'string' && validStates.includes(stato);

        if (!id || (!isBoolState && !isStringState)) {
            return res.status(400).json({ error: 'Payload non valido' });
        }

        const normalizedState = isBoolState ? (stato ? 'eseguito' : 'disponibile') : stato;

        const log = JSON.parse(fs.readFileSync(pathLog, 'utf-8'));
        log.push({ id, stato: normalizedState, timestamp: timestamp || new Date().toISOString(), dj: dj || null });
        fs.writeFileSync(pathLog, JSON.stringify(log, null, 2));
        res.json({ ok: true });
        broadcastEventiUpdate({ type: 'log-updated' });
    } catch (e) {
        res.status(500).json({ error: 'Errore salvataggio log' });
    }
});

router.post('/log/reset-times', (req, res) => {
    try {
        const log = JSON.parse(fs.readFileSync(pathLog, 'utf-8'));
        const archiveDir = path.join(eventiDataDir, 'archive');

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
        broadcastEventiUpdate({ type: 'log-reset' });
    } catch (e) {
        res.status(500).json({ error: 'Errore reset date e orari' });
    }
});

// Funzione helper per normalizzazione ordinamento (gestisce numeri, accentate, spazi, simboli)
function normalizeForSort(str) {
    if (!str) return '';
    return str.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // rimuove accenti
        .replace(/[^a-z0-9\s]/g, ''); // mantiene solo lettere, numeri, spazi
}

// Funzione per ottenere i dettagli di un brano dall'archivio
function getBraniDetails(id, braniJson, extraCsvPath) {
    // Cerca prima nei brani normali
    const brano = braniJson.find(b => b.id === id);
    if (brano) {
        return {
            titolo: brano.brano || brano.titolo || '',
            autore: brano.autore || '',
            compositore: '',
            performer: '',
            durata: ''
        };
    }
    
    // Cerca nelle coreografie aggiuntive
    if (fs.existsSync(extraCsvPath)) {
        const extraContent = fs.readFileSync(extraCsvPath, 'utf-8');
        const extraLines = extraContent.split('\n').slice(1); // skip header
        for (const line of extraLines) {
            if (!line.trim()) continue;
            const cols = line.split(',');
            if (cols.length >= 8 && cols[2] === id) {
                return {
                    titolo: cols[4] || '', // brano (colonna 5)
                    autore: cols[6] || '', // autore (colonna 7)
                    compositore: '',
                    performer: '',
                    durata: ''
                };
            }
        }
    }
    
    return null;
}

// Export CSV per SIAE
router.get('/export-csv', (req, res) => {
    try {
        const log = JSON.parse(fs.readFileSync(pathLog, 'utf-8'));
        
        // Filtra solo i brani eseguiti (una sola volta per ID)
        const eseguitiMap = new Map();
        for (const entry of log) {
            if (entry.stato === 'eseguito' || entry.stato === true) {
                if (!eseguitiMap.has(entry.id)) {
                    eseguitiMap.set(entry.id, entry);
                }
            }
        }
        const eseguiti = Array.from(eseguitiMap.values());
        
        // Leggi i brani dall'archivio
        const braniJson = JSON.parse(fs.readFileSync(pathBrani, 'utf-8'));
        const extraCsvPath = path.join(__dirname, 'Eventi', 'Coreografie_Aggiuntive.csv');
        
        // Costruisci i record con i dati disponibili
        const records = [];
        for (const entry of eseguiti) {
            const details = getBraniDetails(entry.id, braniJson, extraCsvPath);
            if (details) {
                records.push(details);
            } else {
                // Brano non trovato, inserisci con ID come titolo
                records.push({
                    titolo: entry.id,
                    autore: '',
                    compositore: '',
                    performer: '',
                    durata: ''
                });
            }
        }
        
        // Ordina alfabeticamente (gestisce numeri, accentate, spazi, simboli)
        records.sort((a, b) => {
            const normA = normalizeForSort(a.titolo);
            const normB = normalizeForSort(b.titolo);
            return normA.localeCompare(normB, 'it');
        });
        
        // Costruisci il CSV in formato SIAE
        const siaeHeader = 'Titolo,Autore,Compositore,Performer,Durata';
        const siaeRows = records.map(r => {
            // Funzione per escapare campi con virgole, virgolette, etc.
            const escapeCsv = (val) => {
                if (!val) return '';
                const str = String(val);
                if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                    return '"' + str.replace(/"/g, '""') + '"';
                }
                return str;
            };
            return [
                escapeCsv(r.titolo),
                escapeCsv(r.autore),
                escapeCsv(r.compositore),
                escapeCsv(r.performer),
                escapeCsv(r.durata)
            ].join(',');
        });
        
        const csvContent = [siaeHeader, ...siaeRows].join('\n');
        
        // Determina il nome del file CSV
        let csvPath;
        if (req.query.siae === '1') {
            // Formato GG-MM-AAAA-HHHH_SIAE_VSC.csv in c:\VSC_SIAE\
            const now = new Date();
            const gg = String(now.getDate()).padStart(2, '0');
            const mm = String(now.getMonth() + 1).padStart(2, '0');
            const aaaa = now.getFullYear();
            const hhhh = String(now.getHours()).padStart(2, '0') + String(now.getMinutes()).padStart(2, '0') + String(now.getSeconds()).padStart(2, '0');
            const siaeFileName = `${gg}-${mm}-${aaaa}-${hhhh}_SIAE_VSC.csv`;
            const siaeDir = 'c:\\VSC_SIAE';
            
            // Crea la cartella se non esiste
            if (!fs.existsSync(siaeDir)) {
                fs.mkdirSync(siaeDir, { recursive: true });
            }
            
            csvPath = path.join(siaeDir, siaeFileName);
        } else {
            csvPath = pathCsv;
        }
        
        // Scrivi in UTF-8
        fs.writeFileSync(csvPath, csvContent, 'utf-8');
        const downloadUrl = '/eventi/api/download-siae/' + encodeURIComponent(path.basename(csvPath)) + '?t=' + Date.now();
        res.json({ ok: true, csv: downloadUrl, count: records.length });
    } catch (e) {
        console.error('Errore export CSV SIAE:', e);
        res.status(500).json({ error: 'Errore export CSV: ' + e.message });
    }
});

// Download CSV (supporta sia log.csv che file SIAE)
router.get('/log.csv', (req, res) => {
    const siaeDir = 'c:\\VSC_SIAE';
    
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    
    // Se esiste il file log.csv originale, servilo
    if (fs.existsSync(pathCsv)) {
        return res.download(pathCsv);
    }
    // Altrimenti cerca l'ultimo file SIAE in c:\VSC_SIAE\
    if (fs.existsSync(siaeDir)) {
        const files = fs.readdirSync(siaeDir).filter(f => f.endsWith('_SIAE_VSC.csv'));
        if (files.length > 0) {
            files.sort();
            return res.download(path.join(siaeDir, files[files.length - 1]));
        }
    }
    return res.status(404).send('CSV non generato');
});

router.get('/download-siae/:fileName', (req, res) => {
    const siaeDir = 'c:\\\\VSC_SIAE';
    const fileName = path.basename(req.params.fileName || '');

    if (!fileName) {
        return res.status(400).send('Nome file non valido');
    }

    const filePath = path.join(siaeDir, fileName);
    if (!fs.existsSync(filePath)) {
        return res.status(404).send('File SIAE non trovato');
    }

    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');

    return res.download(filePath);
});

router.get('/sync-brani', (req, res) => {
    try {
        ensureExtraCsvFile();
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

// Sync brani da CSV
router.get('/sync-brani-legacy', (req, res) => {
    try {
        const csvPath = path.join(__dirname, 'Eventi', 'display.csv');

        if (!fs.existsSync(csvPath)) {
            return res.status(404).json({ error: 'CSV file not found' });
        }

        const csvContent = fs.readFileSync(csvPath, 'utf-8');
        const lines = csvContent.replace(/\r/g, '').split('\n');
        const headerLine = lines.slice(3).find(l => l.trim()) || '';
        const delimiter = (headerLine.match(/,/g) || []).length >= (headerLine.match(/;/g) || []).length ? ',' : ';';
        const brani = [];

        for (let i = 3; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const cols = line.split(delimiter);
            const id = cols[1]?.trim();
            const titolo = cols[2]?.trim();
            const brano = cols[3]?.trim();
            const autore = cols[4]?.trim();

            if (id && titolo) {
                brani.push({
                    id,
                    titolo,
                    brano: brano || '',
                    autore: autore || ''
                });
            }
        }

        fs.writeFileSync(pathBrani, JSON.stringify(brani, null, 2));
        res.json({
            ok: true,
            count: brani.length,
            message: `Sincronizzati ${brani.length} brani da CSV`
        });
    } catch (e) {
        res.status(500).json({ error: 'Errore sincronizzazione brani: ' + e.message });
    }
});

// Lista DJ
router.get('/dj', (req, res) => {
    try {
        const dj = JSON.parse(fs.readFileSync(pathDj, 'utf-8'));
        res.json(dj);
    } catch (e) {
        res.status(500).json({ error: 'Impossibile leggere dj.json' });
    }
});

// Aggiungi DJ
router.post('/dj', (req, res) => {
    try {
        const { nome } = req.body;
        if (!nome || typeof nome !== 'string' || !nome.trim()) {
            return res.status(400).json({ error: 'Nome DJ non valido' });
        }

        const dj = JSON.parse(fs.readFileSync(pathDj, 'utf-8'));
        if (dj.some(d => d.nome.toLowerCase() === nome.toLowerCase())) {
            return res.status(400).json({ error: 'DJ gia esiste' });
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

// Rimuovi DJ
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

// ============================
//    GET: LIMITI PRENOTAZIONI DJ
// ============================
router.get('/dj-limits', (req, res) => {
  try {
    let limits = {};
    if (fs.existsSync(pathDjLimits)) {
      limits = JSON.parse(fs.readFileSync(pathDjLimits, 'utf-8'));
    }

    const log = JSON.parse(fs.readFileSync(pathLog, 'utf-8'));
    const lastStateById = new Map();
    log.forEach((entry, index) => {
      const timestamp = new Date(entry.timestamp || 0).getTime();
      const previous = lastStateById.get(entry.id);
      if (!previous || timestamp > previous.timestamp || (timestamp === previous.timestamp && index > previous.__order)) {
        lastStateById.set(entry.id, { ...entry, timestamp, __order: index });
      }
    });

    const prenotazioniPerDJ = {};
    lastStateById.forEach(entry => {
      if (entry.stato === 'prenotato' && entry.dj) {
        prenotazioniPerDJ[entry.dj] = (prenotazioniPerDJ[entry.dj] || 0) + 1;
      }
    });

    const result = {};
    for (const dj of Object.keys(limits)) {
      result[dj] = {
        limite: limits[dj]?.limite ?? 0,
        prenotazioni: prenotazioniPerDJ[dj] || 0
      };
    }
    for (const dj of Object.keys(prenotazioniPerDJ)) {
      if (!result[dj]) {
        result[dj] = { limite: 0, prenotazioni: prenotazioniPerDJ[dj] };
      }
    }

    res.json(result);
  } catch (e) {
    res.status(500).json({ error: 'Impossibile leggere limiti DJ' });
  }
});

// ============================
//    POST: IMPOSTA LIMITE DJ
// ============================
router.post('/dj-limits', (req, res) => {
  try {
    const { dj, limite } = req.body;
    if (!dj || typeof dj !== 'string') {
      return res.status(400).json({ error: 'Nome DJ non valido' });
    }
    if (typeof limite !== 'number' || limite < 0) {
      return res.status(400).json({ error: 'Limite non valido' });
    }

    let limits = {};
    if (fs.existsSync(pathDjLimits)) {
      limits = JSON.parse(fs.readFileSync(pathDjLimits, 'utf-8'));
    }

    limits[dj] = { limite };
    fs.writeFileSync(pathDjLimits, JSON.stringify(limits, null, 2));

    res.json({ ok: true, dj, limite });
  } catch (e) {
    res.status(500).json({ error: 'Errore salvataggio limite DJ' });
  }
});

// ============================
//    POST: VERIFICA LIMITE PRENOTAZIONE
// ============================
router.post('/check-prenotazione-limit', (req, res) => {
  try {
    const { dj } = req.body;
    if (!dj) {
      return res.status(400).json({ error: 'DJ non specificato' });
    }

    let limits = {};
    if (fs.existsSync(pathDjLimits)) {
      limits = JSON.parse(fs.readFileSync(pathDjLimits, 'utf-8'));
    }

    const limite = limits[dj]?.limite ?? 0;
    const log = JSON.parse(fs.readFileSync(pathLog, 'utf-8'));
    const lastStateById = new Map();
    log.forEach((entry, index) => {
      const timestamp = new Date(entry.timestamp || 0).getTime();
      const previous = lastStateById.get(entry.id);
      if (!previous || timestamp > previous.timestamp || (timestamp === previous.timestamp && index > previous.__order)) {
        lastStateById.set(entry.id, { ...entry, timestamp, __order: index });
      }
    });
    const prenotazioni = Array.from(lastStateById.values()).filter(e => e.stato === 'prenotato' && e.dj === dj).length;
    const canPrenot = limite === 0 || prenotazioni < limite;

    res.json({
      canPrenot,
      dj,
      limite,
      prenotazioni,
      remaining: limite === 0 ? null : Math.max(0, limite - prenotazioni)
    });
  } catch (e) {
    res.status(500).json({ error: 'Errore verifica limite' });
  }
});

// Mount Eventi API router
app.use('/eventi/api', router);

loadOpenedViewersFromFile();
syncBraniOnStartupV2();

// ===== AVVIO SERVER =====
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

app.listen(PORT, () => {
    const localIP = getLocalIP();
    console.log('\n' + '='.repeat(80));
    console.log('🚀 UNIFIED SERVER - Server consolidato avviato');
    console.log('='.repeat(80));
    console.log(`📍 Server: http://localhost:${PORT}`);
    console.log(`📍 Rete:   http://${localIP}:${PORT}`);
    console.log(`\n📌 Accesso:`);
    console.log(`   🌐 Web:     http://localhost:${PORT}/`);
    console.log(`   📄 PDF API: http://localhost:${PORT}/api/pdf-list`);
    console.log(`   🎵 Eventi:  http://localhost:${PORT}/eventi/eventi.html`);
    console.log('='.repeat(80) + '\n');
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n[STOP] Unified Server fermato');
    process.exit(0);
});
