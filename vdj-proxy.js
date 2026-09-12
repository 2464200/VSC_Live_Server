const fs = require('node:fs');
const path = require('node:path');
const http = require('http');
const https = require('https');
const { execFile, spawn } = require('node:child_process');

function normalizeBaseUrl(baseUrl) {
    const raw = String(baseUrl || '').trim();
    if (!raw) {
        return 'http://localhost:8080';
    }

    return raw.replace(/\/+$/, '');
}

function findVirtualDjExecutable() {
    const envValue = String(process.env.VIRTUALDJ_EXE_PATH || '').trim();
    const candidates = [
        envValue,
        'C:\\Program Files\\VirtualDJ\\virtualdj.exe',
        'C:\\Program Files\\VirtualDJ\\VirtualDJ.exe',
        'C:\\Program Files (x86)\\VirtualDJ\\virtualdj.exe',
        'C:\\Program Files (x86)\\VirtualDJ\\VirtualDJ.exe',
        'C:\\VirtualDJ\\virtualdj.exe',
        'C:\\VirtualDJ\\VirtualDJ.exe'
    ].filter((value) => Boolean(value) && value !== 'null');

    for (const candidate of candidates) {
        if (!candidate) continue;
        try {
            if (fs.existsSync(candidate)) {
                return candidate;
            }
        } catch (_) {
            // ignore invalid path candidates
        }
    }

    return null;
}

function isVirtualDjProcessRunning() {
    if (process.platform !== 'win32') {
        return false;
    }

    return new Promise((resolve) => {
        execFile('tasklist', ['/FO', 'CSV', '/NH'], { windowsHide: true }, (error, stdout = '') => {
            if (error) {
                resolve(false);
                return;
            }

            const text = String(stdout || '');
            const matches = text.match(/virtualdj\.exe|VirtualDJ\.exe/gi) || [];
            resolve(matches.length > 0);
        });
    });
}

async function waitForVirtualDjStartup({ baseUrl, baseUrls, timeoutMs = 15000 } = {}) {
    const deadline = Date.now() + timeoutMs;
    const candidates = collectVirtualDjBaseUrls(baseUrl, baseUrls);

    while (Date.now() < deadline) {
        try {
            const response = await forwardVdjRequest({
                baseUrl,
                baseUrls: candidates,
                endpoint: '/query',
                script: 'get_clock',
                timeoutMs: 1500
            });

            if (response && response.statusCode >= 200 && response.statusCode < 400) {
                return { ok: true, baseUrl: candidates[0], response };
            }
        } catch (_) {
            // keep retrying until timeout
        }

        await new Promise((resolve) => setTimeout(resolve, 800));
    }

    throw new Error('VirtualDJ non risponde dopo l\'avvio.');
}

async function ensureVirtualDjRunning({ baseUrl, baseUrls, timeoutMs = 15000 } = {}) {
    const candidates = collectVirtualDjBaseUrls(baseUrl, baseUrls);

    try {
        const response = await forwardVdjRequest({
            baseUrl,
            baseUrls: candidates,
            endpoint: '/query',
            script: 'get_clock',
            timeoutMs: 2000
        });

        if (response && response.statusCode >= 200 && response.statusCode < 400) {
            return { started: false, baseUrl: candidates[0], executable: null, statusCode: response.statusCode };
        }
    } catch (_) {
        // VirtualDJ is not reachable yet; we'll try to launch it.
    }

    if (process.platform !== 'win32') {
        throw new Error('Avvio automatico di VirtualDJ supportato solo su Windows.');
    }

    if (await isVirtualDjProcessRunning()) {
        await waitForVirtualDjStartup({ baseUrl, baseUrls: candidates, timeoutMs: timeoutMs });
        return { started: false, baseUrl: candidates[0], executable: null, statusCode: 200 };
    }

    const executable = findVirtualDjExecutable();
    if (!executable) {
        throw new Error('VirtualDJ non trovato: nessun file eseguibile rilevato nei percorsi standard.');
    }

    const child = spawn(executable, {
        detached: true,
        windowsHide: true,
        stdio: 'ignore'
    });

    if (child && child.unref) {
        child.unref();
    }

    await waitForVirtualDjStartup({ baseUrl, baseUrls: candidates, timeoutMs: timeoutMs });
    return { started: true, baseUrl: candidates[0], executable };
}

function buildVirtualDjUrl(baseUrl, endpoint, script) {
    const normalizedBase = normalizeBaseUrl(baseUrl);
    const target = new URL(normalizedBase + endpoint);

    if (script !== undefined && script !== null) {
        target.searchParams.set('script', String(script));
    }

    return target;
}

function collectVirtualDjBaseUrls(baseUrl, baseUrls = []) {
    const sources = [];

    if (baseUrl) {
        sources.push(baseUrl);
    }

    for (const candidate of Array.isArray(baseUrls) ? baseUrls : []) {
        if (candidate && !sources.includes(candidate)) {
            sources.push(candidate);
        }
    }

    if (sources.length === 0) {
        sources.push('http://localhost:8080');
    }

    return sources.map((candidate) => normalizeBaseUrl(candidate));
}

function forwardVdjRequest({ baseUrl, baseUrls, endpoint, script, timeoutMs = 4000 }) {
    return new Promise((resolve, reject) => {
        const candidates = collectVirtualDjBaseUrls(baseUrl, baseUrls);
        let lastError = null;

        const tryNext = (index) => {
            if (index >= candidates.length) {
                reject(lastError || new Error('Nessun indirizzo VirtualDJ disponibile'));
                return;
            }

            const targetBaseUrl = candidates[index];
            const targetUrl = buildVirtualDjUrl(targetBaseUrl, endpoint, script);
            const transport = targetUrl.protocol === 'https:' ? https : http;
            const request = transport.get(targetUrl, {
                headers: {
                    Accept: 'text/plain'
                }
            }, (response) => {
                let body = '';
                response.setEncoding('utf8');
                response.on('data', (chunk) => {
                    body += chunk;
                });
                response.on('end', () => {
                    if (response.statusCode && response.statusCode >= 400) {
                        const error = new Error(`HTTP ${response.statusCode}`);
                        lastError = error;
                        tryNext(index + 1);
                        return;
                    }
                    resolve({
                        statusCode: response.statusCode || 0,
                        headers: response.headers,
                        body
                    });
                });
            });

            request.on('error', (error) => {
                lastError = error;
                tryNext(index + 1);
            });
            request.setTimeout(timeoutMs, () => {
                lastError = new Error(`Timeout dopo ${timeoutMs}ms`);
                request.destroy(lastError);
                tryNext(index + 1);
            });
        };

        tryNext(0);
    });
}

module.exports = {
    buildVirtualDjUrl,
    collectVirtualDjBaseUrls,
    ensureVirtualDjRunning,
    findVirtualDjExecutable,
    forwardVdjRequest,
    isVirtualDjProcessRunning,
    normalizeBaseUrl,
    waitForVirtualDjStartup
};
