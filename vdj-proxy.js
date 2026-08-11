const http = require('http');
const https = require('https');

function normalizeBaseUrl(baseUrl) {
    const raw = String(baseUrl || '').trim();
    if (!raw) {
        return 'http://localhost:8080';
    }

    return raw.replace(/\/+$/, '');
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
    forwardVdjRequest,
    normalizeBaseUrl
};
