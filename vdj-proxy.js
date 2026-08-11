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

function forwardVdjRequest({ baseUrl, endpoint, script, timeoutMs = 4000 }) {
    return new Promise((resolve, reject) => {
        const targetUrl = buildVirtualDjUrl(baseUrl, endpoint, script);
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
                resolve({
                    statusCode: response.statusCode || 0,
                    headers: response.headers,
                    body
                });
            });
        });

        request.on('error', reject);
        request.setTimeout(timeoutMs, () => {
            request.destroy(new Error(`Timeout dopo ${timeoutMs}ms`));
        });
    });
}

module.exports = {
    buildVirtualDjUrl,
    forwardVdjRequest,
    normalizeBaseUrl
};
