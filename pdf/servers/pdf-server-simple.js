#!/usr/bin/env node
/**
 * SIMPLE PDF Server - Versione stabile e affidabile
 * 
 * Features:
 * - Legge PDF da C:\VSC_SCRIPT_PDF
 * - API REST per lista PDF
 * - Auto-detect monitor secondario
 * - Gestione corretta degli errori
 * - Logging dettagliato
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const app = express();
const PORT = process.env.PDF_SERVER_PORT || 8765;
const PDF_FOLDER = 'C:\\VSC_SCRIPT_PDF';

let chromeProcess = null;
// Mappa dei viewer avviati: pid -> { file, startedAt }
let openedViewers = {};
const OPENED_VIEWERS_FILE = path.join(__dirname, '..', 'config', 'opened-viewers.json');

function loadOpenedViewersFromFile() {
    try {
        if (fs.existsSync(OPENED_VIEWERS_FILE)) {
            const raw = fs.readFileSync(OPENED_VIEWERS_FILE, 'utf8');
            const obj = JSON.parse(raw || '{}');
            if (obj && typeof obj === 'object') {
                openedViewers = obj;
                console.log(`✅ openedViewers caricati da file (${Object.keys(openedViewers).length} entries)`);
                // Verify PIDs and remove stale entries
                let removed = 0;
                Object.keys(openedViewers).forEach(k => {
                    const pid = parseInt(k, 10);
                    if (isNaN(pid)) { delete openedViewers[k]; removed++; return; }
                    let alive = true;
                    try {
                        process.kill(pid, 0);
                    } catch (e) {
                        // If error is EPERM assume process exists but we lack permission; otherwise it's gone
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

// Helper to check process existence
function isPidRunning(pid) {
    try {
        process.kill(pid, 0);
        return true;
    } catch (e) {
        return e && e.code === 'EPERM' ? true : false;
    }
}

// Endpoint to list opened viewers
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

function saveOpenedViewersToFile() {
    try {
        const tmp = OPENED_VIEWERS_FILE + '.tmp';
        fs.writeFileSync(tmp, JSON.stringify(openedViewers, null, 2), { encoding: 'utf8' });
        fs.renameSync(tmp, OPENED_VIEWERS_FILE);
    } catch (err) {
        console.warn('⚠️ Impossibile salvare opened-viewers.json:', err.message);
    }
}

// ===== MIDDLEWARE =====
app.use(express.json());
app.use(express.static(__dirname));

// CORS - Permette fetch da qualsiasi origine
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});

// Logging
app.use((req, res, next) => {
    console.log(`📡 ${req.method} ${req.path}`);
    next();
});

// ===== API: Lista PDF =====
app.get('/api/pdf-list', (req, res) => {
    try {
        console.log(`🔍 Lettura cartella: ${PDF_FOLDER}`);
        
        // Verifica che la cartella esista
        if (!fs.existsSync(PDF_FOLDER)) {
            console.warn(`⚠️  Cartella non esiste: ${PDF_FOLDER}`);
            return res.json({
                success: false,
                error: `Cartella non trovata: ${PDF_FOLDER}`,
                files: []
            });
        }
        
        // Leggi i file
        const allFiles = fs.readdirSync(PDF_FOLDER);
        console.log(`   Trovati ${allFiles.length} file totali`);
        
        // Filtra solo PDF
        const pdfFiles = allFiles.filter(f => f.toLowerCase().endsWith('.pdf'));
        console.log(`   Di cui ${pdfFiles.length} sono PDF`);
        
        // Mappa i file con info
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

// ===== API: Apri PDF in Chrome =====
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
        
        // Verifica che il file esista
        if (!fs.existsSync(filePath)) {
            console.error(`❌ File non trovato: ${filePath}`);
            return res.status(404).json({
                success: false,
                error: `File non trovato: ${filePath}`
            });
        }
        
        console.log(`✅ File trovato, apertura in corso...`);
        console.log(`🌐 Apertura su monitor secondario`);
        
        // Viewer preference from client: 'auto' or 'adobe'
        const viewer = req.body.viewer || 'auto';
        const adobePath = req.body.adobePath || '';

        // Delegate opening + positioning to PowerShell script which will:
        // - if viewer==='adobe' -> try adobePath or known locations, start Acrobat
        // - otherwise -> Start default viewer and try to move/maximize
        const scriptPath = path.join(__dirname, '..', 'scripts', 'open-pdf-secondary.ps1');
        console.log(`   Script: ${scriptPath}`);
        console.log(`   File: ${filePath}`);
        console.log(`   Viewer: ${viewer} adobePath: ${adobePath}`);

        // Esegui PowerShell e cattura l'output JSON che fornisce il PID del viewer
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
        ps.stdout.on('data', d => { stdout += d.toString(); });
        ps.stderr.on('data', d => { stderr += d.toString(); });

        // Timeout fallback: se lo script non risponde entro 4s, rispondi comunque
        const timeout = setTimeout(() => {
            try {
                // Risposta parziale: non abbiamo PID ma il comando è stato inviato
                res.json({ success: true, message: 'Comando inviato (timeout)', file: filePath, debug: stdout || stderr });
            } catch (e) {}
        }, 4000);

        ps.on('close', code => {
            clearTimeout(timeout);
            console.log(`powershell exited code=${code}`);
            // Proviamo a parsare l'output per ottenere PID
            try {
                const out = stdout.trim();
                let parsed = null;
                if (out) {
                    // Cerca primo JSON nel flusso
                    const first = out.match(/\{[\s\S]*\}/);
                    if (first) parsed = JSON.parse(first[0]);
                }

                if (parsed && parsed.pid) {
                    const pid = parseInt(parsed.pid, 10);
                    if (!isNaN(pid)) {
                        openedViewers[pid] = { file: filePath, startedAt: Date.now() };
                        saveOpenedViewersToFile();
                        console.log(`✅ Viewer PID registrato: ${pid}`);
                        return res.json({ success: true, message: 'PDF aperto sul monitor secondario', file: filePath, pid });
                    }
                }

                // Se non abbiamo PID, rispondi successo comunque con debug
                return res.json({ success: true, message: 'Comando inviato', file: filePath, debug: out || stderr });
            } catch (err) {
                console.error('❌ Errore parsing output PS:', err.message);
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

// ===== API: Chiudi Chrome =====
app.post('/api/close-chrome', (req, res) => {
    try {
        const pids = Object.keys(openedViewers).map(k => parseInt(k, 10)).filter(Boolean);
        const results = [];
        pids.forEach(pid => {
            try {
                process.kill(pid);
                results.push({ pid, status: 'killed' });
            } catch (e) {
                // Fallback a taskkill
                try {
                    spawn('taskkill', ['/PID', pid.toString(), '/T', '/F']);
                    results.push({ pid, status: 'taskkill_sent' });
                } catch (ee) {
                    results.push({ pid, status: 'error', error: ee.message });
                }
            }
            delete openedViewers[pid];
        });
        // persist changes
        saveOpenedViewersToFile();
        res.json({ success: true, message: 'Close issued', details: results });
        
    } catch (error) {
        console.error(`❌ Errore API /api/close-chrome: ${error.message}`);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Close specific pid
app.post('/api/close-pid', (req, res) => {
    try {
        const pid = parseInt(req.body.pid, 10);
        if (!pid) return res.status(400).json({ success: false, error: 'pid missing' });

        try {
            process.kill(pid);
        } catch (e) {
            try { spawn('taskkill', ['/PID', pid.toString(), '/T', '/F']); } catch (ee) {}
        }

        if (openedViewers[pid]) delete openedViewers[pid];
        saveOpenedViewersToFile();
        res.json({ success: true, pid });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Endpoint per leggere le ultime righe del log di apertura PDF
app.get('/api/pdf-log-tail', (req, res) => {
    try {
        const logPath = path.join(__dirname, 'pdf-open.log');
        if (!fs.existsSync(logPath)) {
            return res.json({ success: false, error: 'Log non trovato', lines: [] });
        }
        const raw = fs.readFileSync(logPath, 'utf8');
        const lines = raw.trim().split(/\r?\n/);
        const tail = lines.slice(-50);
        res.json({ success: true, lines: tail });
    } catch (err) {
        console.error('❌ Errore API /api/pdf-log-tail:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ===== API: Serve PDF direttamente via browser (inline) =====
// Esempio: GET /pdf?file=nome.pdf
app.get('/pdf', (req, res) => {
    try {
        const name = req.query.file;
        if (!name) return res.status(400).send('file query missing');

        // Sanitize filename to prevent path traversal
        const safeName = path.basename(name);
        const filePath = path.join(PDF_FOLDER, safeName);

        if (!fs.existsSync(filePath)) {
            console.warn(`⚠️ PDF non trovato per download: ${filePath}`);
            return res.status(404).send('File not found');
        }

        // Supporto per Range requests (necessario per viewer browser: seek, open grandi file)
        const stat = fs.statSync(filePath);
        const total = stat.size;
        const range = req.headers.range;

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Content-Disposition', `inline; filename="${safeName}"`);

        if (range) {
            const parts = range.replace(/bytes=/, '').split('-');
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : total - 1;
            if (isNaN(start) || isNaN(end) || start > end || end >= total) {
                res.status(416).setHeader('Content-Range', `bytes */${total}`);
                return res.end();
            }

            const chunkSize = (end - start) + 1;
            res.status(206);
            res.setHeader('Content-Range', `bytes ${start}-${end}/${total}`);
            res.setHeader('Content-Length', chunkSize);

            const stream = fs.createReadStream(filePath, { start, end });
            stream.pipe(res);
            stream.on('error', (err) => {
                console.error('❌ Errore streaming PDF (range):', err.message);
                if (!res.headersSent) res.status(500).send('Stream error');
            });
        } else {
            // No range -- send entire file
            res.setHeader('Content-Length', total);
            const stream = fs.createReadStream(filePath);
            stream.pipe(res);
            stream.on('error', (err) => {
                console.error('❌ Errore streaming PDF:', err.message);
                if (!res.headersSent) res.status(500).send('Stream error');
            });
        }
    } catch (err) {
        console.error('❌ Errore /pdf:', err.message);
        res.status(500).send(err.message);
    }
});

// ===== Dashboard =====
app.get('/viewer-dashboard', (req, res) => {
    try {
        const filePath = path.join(__dirname, 'public', 'viewer-dashboard.html');
        if (fs.existsSync(filePath)) {
            return res.sendFile(filePath);
        }
        res.status(404).send('Dashboard not found');
    } catch (err) {
        res.status(500).send(`Error: ${err.message}`);
    }
});

// ===== API: Health check =====
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        server: 'pdf-server-simple',
        port: PORT,
        pdfFolder: PDF_FOLDER,
        folderExists: fs.existsSync(PDF_FOLDER),
        uptime: Math.floor(process.uptime())
    });
});

// ===== AVVIO SERVER =====
app.listen(PORT, 'localhost', () => {
    console.log('\n' + '='.repeat(60));
    console.log('✅ PDF Server Avviato');
    console.log('='.repeat(60));
    console.log(`📍 URL: http://localhost:${PORT}`);
    console.log(`📍 API List: http://localhost:${PORT}/api/pdf-list`);
    console.log(`📍 Health: http://localhost:${PORT}/api/health`);
    console.log(`📁 Cartella PDF: ${PDF_FOLDER}`);
    
    // Verifica cartella
    if (fs.existsSync(PDF_FOLDER)) {
        const count = fs.readdirSync(PDF_FOLDER).filter(f => f.toLowerCase().endsWith('.pdf')).length;
        console.log(`📊 PDF trovati: ${count}`);
    } else {
        console.warn(`⚠️  CARTELLA NON TROVATA: ${PDF_FOLDER}`);
        console.warn(`   Creare la cartella e aggiungere i PDF!`);
    }
    
    console.log('='.repeat(60));
    console.log('💡 Server pronto per ricevere richieste\n');
    // Carica eventuali opened viewers persistenti
    loadOpenedViewersFromFile();
});

// Shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Arresto server...');
    if (chromeProcess) chromeProcess.kill();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Arresto server...');
    if (chromeProcess) chromeProcess.kill();
    process.exit(0);
});
