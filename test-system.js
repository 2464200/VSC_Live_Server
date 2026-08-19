#!/usr/bin/env node
/**
 * Test di integrita del sistema automatizzato
 * Verifica il server unificato e le sue API integrate
 */

const http = require('http');

const BASE_URL = process.env.DIAGNOSTIC_BASE_URL || 'http://localhost:5500';
const tests = [
    { name: 'Unified Server', path: '/', expected: [200] },
    { name: 'Health API', path: '/api/health', expected: [200] },
    { name: 'Status API', path: '/api/status', expected: [200] },
    { name: 'PDF API', path: '/api/pdf-list', expected: [200] },
    { name: 'Eventi ping API', path: '/eventi/api/ping', expected: [200] },
    { name: 'Eventi status API', path: '/eventi/api/status', expected: [200] },
    { name: 'Eventi DJ API', path: '/eventi/api/dj', expected: [200] },
    { name: 'Eventi QR API', path: '/eventi/api/qr', expected: [200] },
    { name: 'Videoclip API', path: '/api/videoclip/list', expected: [200] },
    { name: 'Homepage', path: '/index.html', expected: [200] },
    { name: 'Diagnostica page', path: '/diagnostica.html', expected: [200] },
    { name: 'Bordero page', path: '/Bordero/pages/bordero.html', expected: [200] },
    { name: 'Mobile page', path: '/public/mobile1.html', expected: [200] }
].map((test) => ({ ...test, url: `${BASE_URL}${test.path}` }));

const csvTests = [
    'display.csv',
    'NextCoreo.csv',
    'servizio.csv',
    'Bordero/data/brani.csv',
    'Bordero/data/comuni_italia.csv',
    'Bordero/data/location.csv',
    'Bordero/data/location_popup_options.csv'
].map((path) => ({ name: `CSV ${path}`, path, url: `${BASE_URL}/${path}` }));

const borderoSyncTests = [
    '/api/bordero/sync-brani',
    '/api/bordero/sync-comuni',
    '/api/bordero/sync-location',
    '/api/bordero/sync-location-options',
    '/api/sync/brani',
    '/api/sync/comuni',
    '/api/sync/location',
    '/api/sync/location-options'
];

function request(test, options = {}) {
    return new Promise((resolve) => {
        const req = http.request(test.url, { timeout: 5000, ...options }, (res) => {
            res.resume();
            resolve({ ...test, status: res.statusCode, success: res.statusCode < 400 });
        });

        req.on('error', () => {
            resolve({ ...test, status: null, success: false });
        });

        req.on('timeout', () => {
            req.destroy();
            resolve({ ...test, status: null, success: false });
        });
        req.end(options.body || undefined);
    });
}

function testEndpoint(test) {
    return request(test);
}

async function runPortTests() {
    const active = await request({ name: 'Canonical port 5500', url: `${BASE_URL}/api/health` });
    const legacy = await request({ name: 'Legacy port 5501 disabled', url: 'http://localhost:5501/api/status' });
    return [
        { ...active, success: active.status === 200 },
        { ...legacy, success: legacy.status === null, status: legacy.status === null ? 'closed' : legacy.status }
    ];
}

async function runCsvTests() {
    return Promise.all(csvTests.map(async (test) => {
        const result = await request(test);
        return { ...result, success: result.status === 200 };
    }));
}

async function runBorderoSyncTests() {
    return Promise.all(borderoSyncTests.map(async (path) => {
        const result = await request({ name: `Sync route ${path}`, url: `${BASE_URL}${path}` }, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: '{}'
        });
        return { ...result, success: result.status === 400 };
    }));
}

async function runTests() {
    console.log('Test di integrita sistema automatizzato');
    console.log('='.repeat(50));

    const results = [
        ...(await Promise.all(tests.map(testEndpoint))),
        ...(await runPortTests()),
        ...(await runCsvTests()),
        ...(await runBorderoSyncTests())
    ];

    let allGood = true;
    results.forEach(result => {
        const status = result.success ? 'OK' : 'FAIL';
        const detail = result.status ? `(HTTP ${result.status})` : '(non raggiungibile)';
        console.log(`${status} ${result.name}: ${detail}`);
        if (!result.success) allGood = false;
    });

    console.log('='.repeat(50));
    if (allGood) {
        console.log(`Sistema completamente operativo (${results.length} controlli)`);
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
