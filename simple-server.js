#!/usr/bin/env node
/**
 * Simple Static Web Server - Servisce i file HTML su porta 5500
 */

const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.WEB_SERVER_PORT || 5500;

// Serve file statici dalla root e dalle sottocartelle
app.use(express.static(path.join(__dirname), { 
    index: ['index.html'],
    extensions: ['html', 'htm']
}));

// CORS header per permettere connessioni da qualsiasi origin
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// Fallback per SPA (ritorna index.html per path non trovati)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'), { 
        root: __dirname 
    }, (error) => {
        if (error) {
            res.status(404).send('File not found');
        }
    });
});

app.listen(PORT, () => {
    console.log('\n' + '='.repeat(60));
    console.log('🌐 Web Server avviato');
    console.log('='.repeat(60));
    console.log(`📍 Server: http://localhost:${PORT}`);
    console.log(`📍 File: ${__dirname}`);
    console.log(`\n📌 Accedi a:`);
    console.log(`   http://localhost:${PORT}/`);
    console.log(`   http://localhost:${PORT}/index.html`);
    console.log(`   http://localhost:${PORT}/servizio2.html`);
    console.log(`   http://localhost:${PORT}/Prova/ScriptPDF1.html`);
    console.log('='.repeat(60) + '\n');
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Web Server fermato');
    process.exit(0);
});
