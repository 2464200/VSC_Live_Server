#!/usr/bin/env node
/**
 * Server Node.js per la gestione dei file PDF
 * Fornisce API REST per:
 * - Ottenere la lista dei PDF da C:\SCRIPT_PDF
 * - Aprire i PDF in Chrome (modalità Kiosk)
 * - Chiudere la sessione Chrome
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync, spawn } = require('child_process');
const app = express();
const PORT = 8765;

const PDF_FOLDER = 'C:\\SCRIPT_PDF';
const PROVA_FOLDER = path.join(__dirname, 'Prova');

app.use(express.json());
app.use(express.static(__dirname));

// Middleware per CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// Variabile globale per memorizzare il processo Chrome
let chromeProcess = null;

/**
 * Funzione per ottenere informazioni sui monitor disponibili
 * Ritorna un oggetto con x, y, width, height del monitor secondario
 */
function getSecondaryMonitorInfo() {
    try {
        // Usa PowerShell per interrogare Windows via WMI
        const psCommand = `
            $monitors = Get-WmiObject -Class Win32_DesktopMonitor
            $screens = [System.Windows.Forms.Screen]::AllScreens
            
            if ($screens.Count -gt 1) {
                # Ordina gli schermi per posizione X (secondario è generalmente a destra)
                $sortedScreens = $screens | Sort-Object { $_.Bounds.X }
                $secondary = $sortedScreens[-1]  # Prendi l'ultimo (più a destra)
                
                Write-Host "$($secondary.Bounds.X),$($secondary.Bounds.Y),$($secondary.Bounds.Width),$($secondary.Bounds.Height)"
            } else {
                # Fallback: posiziona a destra (tipica configurazione secondary monitor)
                Write-Host "1920,0,1920,1080"
            }
        `;
        
        // Aggiungi l'assembly Windows Forms per accedere agli schermi
        const fullCommand = `
            Add-Type -AssemblyName System.Windows.Forms
            ${psCommand}
        `;
        
        const result = execSync(`powershell -NoProfile -Command "${fullCommand}"`, { 
            encoding: 'utf8',
            stdio: ['pipe', 'pipe', 'ignore'],
            timeout: 5000
        }).trim();
        
        const coords = result.split(',');
        if (coords.length === 4) {
            const monitor = {
                x: parseInt(coords[0]),
                y: parseInt(coords[1]),
                width: parseInt(coords[2]),
                height: parseInt(coords[3])
            };
            console.log(`✅ Monitor secondario rilevato: ${JSON.stringify(monitor)}`);
            return monitor;
        }
    } catch (e) {
        console.warn(`⚠️  Errore nel rilevamento monitor: ${e.message}`);
    }
    
    // Fallback: posiziona a destra (tipica configurazione secondary monitor)
    console.log('ℹ️  Usando configurazione di fallback per monitor');
    return {
        x: 1920,
        y: 0,
        width: 1920,
        height: 1080
    };
}

/**
 * GET /api/pdf-list
 * Ritorna la lista dei file PDF da C:\SCRIPT_PDF
 */
app.get('/api/pdf-list', (req, res) => {
    try {
        // Verifica se la cartella esiste
        if (!fs.existsSync(PDF_FOLDER)) {
            return res.json({
                success: false,
                error: `La cartella ${PDF_FOLDER} non esiste`,
                files: []
            });
        }

        // Leggi i file PDF
        const files = fs.readdirSync(PDF_FOLDER)
            .filter(file => file.toLowerCase().endsWith('.pdf'))
            .sort()
            .map(file => {
                const filePath = path.join(PDF_FOLDER, file);
                const stats = fs.statSync(filePath);
                return {
                    name: file,
                    path: filePath,
                    size: (stats.size / 1024 / 1024).toFixed(2) + ' MB',
                    created: stats.birthtime.toLocaleString('it-IT')
                };
            });

        res.json({
            success: true,
            timestamp: new Date().toLocaleString('it-IT'),
            folderPath: PDF_FOLDER,
            totalFiles: files.length,
            files: files
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
            files: []
        });
    }
});

/**
 * POST /api/open-pdf
 * Apre un file PDF in Chrome (modalità Kiosk)
 */
app.post('/api/open-pdf', (req, res) => {
    try {
        const { filePath } = req.body;

        if (!filePath || !fs.existsSync(filePath)) {
            console.error(`❌ File PDF non trovato: ${filePath}`);
            return res.status(400).json({
                success: false,
                error: 'File PDF non trovato: ' + filePath
            });
        }

        console.log(`\n📄 Tentativo apertura PDF: ${filePath}`);

        // Chiudi Chrome precedente se aperto
        if (chromeProcess) {
            try {
                process.kill(-chromeProcess.pid);
            } catch (e) {
                console.log('⚠️  Chrome process già terminato');
            }
            chromeProcess = null;
        }

        // Cerca l'eseguibile di Chrome
        let chromePath = null;
        const possiblePaths = [
            'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
            'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
            process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe'
        ];

        for (const chromeBin of possiblePaths) {
            if (fs.existsSync(chromeBin)) {
                chromePath = chromeBin;
                console.log(`✓ Chrome trovato: ${chromePath}`);
                break;
            }
        }

        if (!chromePath) {
            console.error('❌ Chrome non trovato nel sistema');
            return res.status(500).json({
                success: false,
                error: 'Chrome non trovato nel sistema'
            });
        }

        // Conversione del percorso per file://
        const fileUrl = 'file:///' + filePath.replace(/\\/g, '/');
        console.log(`📂 URL: ${fileUrl}`);

        // Killer Chrome precedenti (fallback per assicurare definitivamente la chiusura)
        try {
            execSync('taskkill /F /IM chrome.exe /T 2>nul', { stdio: 'ignore' });
            console.log('🔪 Chrome precedenti terminati');
        } catch (e) {
            // Ignora errori
        }

        // Ottieni le coordinate del monitor secondario
        console.log('🖥️  Rilevamento monitor secondario...');
        const secondaryMonitor = getSecondaryMonitorInfo();
        console.log(`📺 Monitor secondario: X=${secondaryMonitor.x}, Y=${secondaryMonitor.y}, W=${secondaryMonitor.width}, H=${secondaryMonitor.height}`);

        // Opzioni Chrome per la modalità Kiosk
        const chromeArgs = [
            '--new-window',                     // Nuova finestra
            '--kiosk',                          // Modalità fullscreen
            `--window-position=${secondaryMonitor.x},${secondaryMonitor.y}`,  // Posiziona sul monitor secondario
            `--window-size=${secondaryMonitor.width},${secondaryMonitor.height}`, // Dimensione massima
            '--no-first-run',
            '--no-default-browser-check',
            '--disable-background-networking',
            '--disable-client-side-phishing-detection',
            '--disable-component-update',
            '--disable-sync',
            '--disable-default-apps',
            '--disable-prompt-on-repost',
            '--disable-hang-monitor',
            '--disable-extensions',
            '--disable-plugins',
            '--disable-java',
            fileUrl                             // URL del file PDF
        ];

        console.log(`🚀 Avvio Chrome con argomenti: ${chromeArgs.join(' ')}`);
        
        // Metodo 1: Usa spawn con proceedPath
        chromeProcess = spawn(chromePath, chromeArgs, {
            detached: true,
            stdio: 'ignore',
            shell: false
        });

        const pid = chromeProcess.pid;
        chromeProcess.unref();
        
        console.log(`✅ Chrome avviato con PID: ${pid}`);

        // Verifica che il processo sia effettivamente stato creato
        setTimeout(() => {
            try {
                const chromeProcessCheck = os.platform() === 'win32' 
                    ? execSync(`tasklist /FI "PID eq ${pid}"`, { encoding: 'utf8' })
                    : execSync(`ps -p ${pid}`, { encoding: 'utf8' });
                    
                if (chromeProcessCheck.includes(pid.toString())) {
                    console.log(`✅ Processo Chrome ${pid} confermato in esecuzione`);
                } else {
                    console.warn(`⚠️  Processo Chrome ${pid} non trovato in tasklist`);
                }
            } catch (e) {
                console.warn(`⚠️  Errore verifica processo: ${e.message}`);
            }
        }, 500);

        res.json({
            success: true,
            message: `Apertura di: ${path.basename(filePath)}`,
            filePath: filePath,
            url: fileUrl,
            pid: pid,
            monitor: secondaryMonitor
        });
    } catch (error) {
        console.error(`❌ Errore nell'apertura del PDF: ${error.message}`);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/monitor-info
 * Ritorna informazioni sui monitor disponibili
 */
app.get('/api/monitor-info', (req, res) => {
    try {
        const secondaryMonitor = getSecondaryMonitorInfo();
        res.json({
            success: true,
            primaryMonitor: {
                x: 0,
                y: 0,
                width: 1920,
                height: 1080
            },
            secondaryMonitor: secondaryMonitor,
            message: 'Monitor secondario rilevato correttamente'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/close-chrome
 * Chiude la sessione Chrome e torna ad Excel
 */
app.post('/api/close-chrome', (req, res) => {
    try {
        // Chiudi il processo Chrome
        if (chromeProcess) {
            try {
                process.kill(-chromeProcess.pid); // Kill process group
            } catch (e) {
                console.log('Errore nella chiusura di Chrome:', e.message);
            }
            chromeProcess = null;
        }

        // Uso di taskkill come fallback per assicurarti che Chrome sia chiuso
        try {
            execSync('taskkill /F /IM chrome.exe /T 2>nul', { stdio: 'ignore' });
        } catch (e) {
            // Ignora errori se Chrome già chiuso
        }

        res.json({
            success: true,
            message: 'Chrome chiuso. Tornando ad Excel...'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Rotta per servire la pagina ScriptPDF1.html
 */
app.get('/ScriptPDF1', (req, res) => {
    res.sendFile(path.join(PROVA_FOLDER, 'ScriptPDF1.html'));
});

/**
 * Avvia il server
 */
app.listen(PORT, () => {
    console.log(`\n========================================`);
    console.log(`Server PDF avviato su http://localhost:${PORT}`);
    console.log(`Pagina: http://localhost:${PORT}/Prova/ScriptPDF1.html`);
    console.log(`API: http://localhost:${PORT}/api/pdf-list`);
    console.log(`Cartella PDF: ${PDF_FOLDER}`);
    console.log(`========================================\n`);
    
    // Verifica che la cartella esista
    if (!fs.existsSync(PDF_FOLDER)) {
        console.log(`⚠ AVVISO: La cartella ${PDF_FOLDER} non esiste!`);
        console.log(`Crearla e aggiungere i file PDF.\n`);
    }
});

// Gestisci l'interruzione del server
process.on('SIGINT', () => {
    console.log('\nChiusura del server...');
    if (chromeProcess) {
        try {
            process.kill(-chromeProcess.pid);
        } catch (e) {}
    }
    process.exit(0);
});
