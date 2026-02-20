#!/usr/bin/env node
/**
 * Server Manager - Gestisce il ciclo di vita di pdf-server
 * 
 * Rimane sempre in ascolto sulla porta 3000
 * Fornisce endpoint per avviare/fermare il server PDF automaticamente
 * 
 * Avvio: node server-manager.js
 */

const express = require('express');
const { spawn, exec } = require('child_process');
const path = require('path');
const os = require('os');

const app = express();
const PORT = process.env.MANAGER_PORT || 3000;

// ===== STATO GLOBALE =====
let pdfServerProcess = null;
let pdfServerPort = 8765;
let lastActivityTime = Date.now();
const INACTIVITY_TIMEOUT = 30000; // Spegni dopo 30 secondi di inattività
let inactivityTimer = null;

// ===== MIDDLEWARE =====
app.use(express.json());

// CORS per permettere fetch da qualsiasi origine
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});

// ===== FUNZIONI DI UTILITÀ =====

/**
 * Avvia il server PDF
 */
function startPdfServer() {
    return new Promise((resolve, reject) => {
        if (pdfServerProcess) {
            console.log('✅ Server PDF già in esecuzione (PID: ' + pdfServerProcess.pid + ')');
            return resolve(pdfServerPort);
        }

        console.log('🚀 Avvio server PDF sulla porta ' + pdfServerPort + '...');

        const pdfServerPath = path.join(__dirname, 'pdf-server.js');

        try {
            pdfServerProcess = spawn('node', [pdfServerPath], {
                env: {
                    ...process.env,
                    PDF_SERVER_PORT: pdfServerPort
                },
                stdio: ['ignore', 'pipe', 'pipe'],
                detached: false,
                cwd: __dirname
            });

            // Handlers per output
            pdfServerProcess.stdout.on('data', (data) => {
                const msg = data.toString().trim();
                if (msg) console.log('[PDF-SERVER] ' + msg);
            });

            pdfServerProcess.stderr.on('data', (data) => {
                const msg = data.toString().trim();
                if (msg) console.error('[PDF-SERVER-ERR] ' + msg);
            });

            // Handler per errore di spawn
            pdfServerProcess.on('error', (error) => {
                console.error('❌ Errore spawn PDF Server:', error);
                pdfServerProcess = null;
                reject(error);
            });

            // Handler per exit inaspettato
            pdfServerProcess.on('exit', (code, signal) => {
                console.log('🛑 Server PDF terminato (codice: ' + code + ', signal: ' + signal + ')');
                pdfServerProcess = null;
            });

            // Se arriviamo qui senza errore, il processo è stato creato
            // Attendi un momento per permettere l'avvio del server
            const checkInterval = setInterval(() => {
                if (pdfServerProcess === null) {
                    clearInterval(checkInterval);
                    console.warn('⚠️  Server PDF è rimasto chiuso poco dopo l\'avvio');
                    return reject(new Error('Server PDF crashed subito dopo avvio'));
                }
            }, 100);

            setTimeout(() => {
                clearInterval(checkInterval);
                if (pdfServerProcess) {
                    console.log('✅ Server PDF avviato con successo (PID: ' + pdfServerProcess.pid + ')');
                    resetInactivityTimer();
                    resolve(pdfServerPort);
                } else {
                    reject(new Error('Server PDF non è rimasto attivo'));
                }
            }, 2000);

        } catch (error) {
            console.error('❌ Errore durante spawn:', error);
            pdfServerProcess = null;
            reject(error);
        }
    });
}

/**
 * Ferma il server PDF
 */
function stopPdfServer() {
    return new Promise((resolve) => {
        if (!pdfServerProcess) {
            console.log('⚠️  Server PDF non in esecuzione');
            return resolve();
        }

        console.log('🛑 Arresto server PDF (PID: ' + pdfServerProcess.pid + ')...');

        // Registra il listener PRIMA di killare il processo
        const exitHandler = () => {
            clearTimeout(timeout);
            console.log('✅ Server PDF fermato');
            pdfServerProcess = null;
            resolve();
        };
        
        pdfServerProcess.once('exit', exitHandler);

        // Ora invia il segnale di terminazione
        pdfServerProcess.kill('SIGTERM');

        // Se non muore entro 3 secondi, forza il kill
        const timeout = setTimeout(() => {
            console.warn('⚠️  Server PDF non ha risposto a SIGTERM, forzo SIGKILL');
            if (pdfServerProcess) {
                pdfServerProcess.kill('SIGKILL');
            }
            // Se il listener non è stato chiamato, forza la risoluzione
            setTimeout(() => {
                pdfServerProcess = null;
                resolve();
            }, 500);
        }, 3000);
    });
}

/**
 * Verifica se il server PDF è in esecuzione
 */
function isPdfServerRunning() {
    return pdfServerProcess !== null && !pdfServerProcess.killed;
}

/**
 * Reset timer inattività
 */
function resetInactivityTimer() {
    lastActivityTime = Date.now();
    
    if (inactivityTimer) clearTimeout(inactivityTimer);
    
    inactivityTimer = setTimeout(() => {
        console.log('⏱️  Inattività rilevata - Arresto server PDF...');
        stopPdfServer().then(() => {
            console.log('✅ Server PDF spento per inattività');
        });
    }, INACTIVITY_TIMEOUT);
}

// ===== ENDPOINT API =====

/**
 * GET /api/manager/status
 * Verifica lo stato del manager e del server PDF
 */
app.get('/api/manager/status', (req, res) => {
    resetInactivityTimer();
    
    res.json({
        success: true,
        timestamp: new Date().toISOString(),
        manager: {
            port: PORT,
            status: 'online'
        },
        pdfServer: {
            running: isPdfServerRunning(),
            port: pdfServerPort,
            pid: pdfServerProcess ? pdfServerProcess.pid : null,
            startTime: pdfServerProcess ? new Date().toISOString() : null
        },
        inactivityTimeout: INACTIVITY_TIMEOUT
    });
});

/**
 * POST /api/manager/start
 * Avvia il server PDF
 */
app.post('/api/manager/start', async (req, res) => {
    try {
        console.log('📢 Richiesta avvio server PDF');
        resetInactivityTimer();
        
        const port = await startPdfServer();
        
        res.json({
            success: true,
            message: 'Server PDF avviato',
            port: port,
            pid: pdfServerProcess ? pdfServerProcess.pid : null
        });
    } catch (error) {
        console.error('❌ Errore avvio:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/manager/stop
 * Ferma il server PDF
 */
app.post('/api/manager/stop', async (req, res) => {
    try {
        console.log('📢 Richiesta arresto server PDF');
        
        if (inactivityTimer) clearTimeout(inactivityTimer);
        
        await stopPdfServer();
        
        res.json({
            success: true,
            message: 'Server PDF fermato'
        });
    } catch (error) {
        console.error('❌ Errore arresto:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/manager/activity
 * Segnala attività (resetta timer inattività)
 */
app.post('/api/manager/activity', (req, res) => {
    resetInactivityTimer();
    
    res.json({
        success: true,
        lastActivity: lastActivityTime,
        nextInactivityShutdown: lastActivityTime + INACTIVITY_TIMEOUT
    });
});

/**
 * GET /api/manager/health
 * Health check - sempre disponibile
 */
app.get('/api/manager/health', (req, res) => {
    res.json({
        status: 'ok',
        uptime: Math.floor(process.uptime()),
        memory: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB'
    });
});

/**
 * Health check del server PDF
 */
app.get('/api/pdf-server/health', (req, res) => {
    resetInactivityTimer();
    
    if (!isPdfServerRunning()) {
        return res.status(503).json({
            running: false,
            message: 'Server PDF non in esecuzione'
        });
    }
    
    // Usa la proprietà pid del processo per verificare che è vivo
    try {
        if (pdfServerProcess && pdfServerProcess.pid) {
            // Se il processo ha un PID valido, è probabilmente in esecuzione
            return res.json({
                running: true,
                port: pdfServerPort,
                pid: pdfServerProcess.pid,
                accessible: true,
                timestamp: new Date().toISOString()
            });
        }
    } catch (e) {
        console.error('Errore health check:', e.message);
    }
    
    res.status(503).json({
        running: false,
        message: 'Server PDF non risponde',
        accessible: false,
        timestamp: new Date().toISOString()
    });
});

// ===== GESTIONE CHIUSURA =====

process.on('SIGINT', async () => {
    console.log('\n🛑 Chiusura Manager...');
    await stopPdfServer();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 Chiusura Manager...');
    await stopPdfServer();
    process.exit(0);
});

// ===== AVVIO SERVER =====

app.listen(PORT, () => {
    console.log('\n' + '='.repeat(60));
    console.log('🎯 Server Manager avviato');
    console.log('='.repeat(60));
    console.log(`📍 Manager: http://localhost:${PORT}`);
    console.log(`📍 Endpoint: /api/manager/status`);
    console.log(`📍 Endpoint: POST /api/manager/start`);
    console.log(`📍 Endpoint: POST /api/manager/stop`);
    console.log(`📍 Endpoint: POST /api/manager/activity`);
    console.log(`⏱️  Inactivity timeout: ${INACTIVITY_TIMEOUT / 1000} secondi`);
    console.log('='.repeat(60) + '\n');
});

// Graceful shutdown
setTimeout(() => {
    console.log('💡 Server Manager rimane in ascolto...');
}, 100);
