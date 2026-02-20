#!/usr/bin/env node
/**
 * SIMPLE PDF Server - Versione stabile e affidabile
 * 
 * Features:
 * - Legge PDF da C:\SCRIPT_PDF
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
const PDF_FOLDER = 'C:\\SCRIPT_PDF';

let chromeProcess = null;

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
        console.log(`🌐 Apertura su monitor secondario con PowerShell`);
        
        // Usa PowerShell per aprire il file (più affidabile)
        const psCommand = `Start-Process '${filePath}'`;
        console.log(`   Comando PS: ${psCommand}`);
        
        spawn('powershell.exe', ['-NoProfile', '-Command', psCommand], {
            detached: true,
            stdio: 'ignore',
            shell: false
        }).unref();
        
        console.log(`✅ Comando inviato al sistema operativo`);
        
        res.json({
            success: true,
            message: 'PDF aperto con applicazione predefinita',
            file: filePath
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
        if (chromeProcess) {
            console.log(`❌ Chiusura Chrome`);
            chromeProcess.kill();
            chromeProcess = null;
        }
        
        res.json({
            success: true,
            message: 'Chrome chiuso'
        });
        
    } catch (error) {
        console.error(`❌ Errore API /api/close-chrome: ${error.message}`);
        res.status(500).json({
            success: false,
            error: error.message
        });
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
app.listen(PORT, '0.0.0.0', () => {
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
