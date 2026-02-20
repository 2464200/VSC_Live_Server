#!/usr/bin/env node
/**
 * Static File Server per COR ScriptPDF1.html
 * Porta 5500 - Serve file statis HTML/CSS/JS
 */

const express = require('express');
const path = require('path');
const app = express();
const PORT = 5500;

// CORS middleware
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});

// Serve file statis dalla root directory
app.use(express.static(path.join(__dirname)));

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        server: 'static-server',
        port: PORT,
        uptime: process.uptime()
    });
});

const server = app.listen(PORT, 'localhost', () => {
    console.log(`\n🌐 Static Server avviato`);
    console.log(`📡 Porta: ${PORT}`);
    console.log(`📂 Directory: ${__dirname}`);
    console.log(`✅ http://localhost:${PORT}/Prova/ScriptPDF1.html\n`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Arresto server...');
    server.close(() => {
        console.log('✅ Server fermato');
        process.exit(0);
    });
});

module.exports = server;
