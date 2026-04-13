#!/usr/bin/env node
/**
 * Test di integrita del sistema automatizzato
 * Verifica il server unificato e le sue API integrate
 */

const http = require('http');

const tests = [
    { name: 'Unified Server', url: 'http://localhost:5500/', port: 5500 },
    { name: 'Unified PDF API', url: 'http://localhost:5500/api/pdf-list', port: 5500 },
    { name: 'Unified Eventi API', url: 'http://localhost:5500/eventi/api/ping', port: 5500 },
    { name: 'Unified Eventi DJ API', url: 'http://localhost:5500/eventi/api/dj', port: 5500 }
];

function testEndpoint(test) {
    return new Promise((resolve) => {
        const req = http.get(test.url, { timeout: 5000 }, (res) => {
            resolve({ ...test, status: res.statusCode, success: res.statusCode < 400 });
        });

        req.on('error', () => {
            resolve({ ...test, status: null, success: false });
        });

        req.on('timeout', () => {
            req.destroy();
            resolve({ ...test, status: null, success: false });
        });
    });
}

async function runTests() {
    console.log('Test di integrita sistema automatizzato');
    console.log('='.repeat(50));

    const results = await Promise.all(tests.map(testEndpoint));

    let allGood = true;
    results.forEach(result => {
        const status = result.success ? 'OK' : 'FAIL';
        const detail = result.status ? `(HTTP ${result.status})` : '(non raggiungibile)';
        console.log(`${status} ${result.name}: ${detail}`);
        if (!result.success) allGood = false;
    });

    console.log('='.repeat(50));
    if (allGood) {
        console.log('Sistema completamente operativo');
        console.log('');
        console.log('URL di accesso:');
        console.log('  Homepage:    http://localhost:5500/index.html');
        console.log('  PDF:         http://localhost:5500/Prova/ScriptPDF1.html');
        console.log('  Eventi:      http://localhost:5500/eventi/eventi.html');
        console.log('  Visualizer:  http://localhost:5500/eventi/visualizer.html');
    } else {
        console.log('Il server unificato o una delle sue API non risponde correttamente.');
        console.log('Esegui il task VS Code "Start All Servers Manually" oppure riavvia unified-server.js');
    }

    process.exit(allGood ? 0 : 1);
}

runTests().catch(err => {
    console.error('Errore durante il test:', err);
    process.exit(1);
});
