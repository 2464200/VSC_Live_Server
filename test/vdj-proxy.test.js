const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const { forwardVdjRequest } = require('../vdj-proxy');

test('forwards VirtualDJ requests through a local proxy', async () => {
  const server = http.createServer((req, res) => {
    assert.equal(req.url, '/query?script=get_clock');
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('OK');
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

  try {
    const address = server.address();
    const response = await forwardVdjRequest({
      baseUrl: `http://127.0.0.1:${address.port}`,
      endpoint: '/query',
      script: 'get_clock'
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.body, 'OK');
  } finally {
    await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
});

test('tries the next candidate base URL when the first one fails', async () => {
  const server = http.createServer((req, res) => {
    assert.equal(req.url, '/query?script=get_clock');
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('FALLBACK_OK');
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

  try {
    const address = server.address();
    const response = await forwardVdjRequest({
      baseUrl: 'http://127.0.0.1:1',
      baseUrls: [`http://127.0.0.1:${address.port}`],
      endpoint: '/query',
      script: 'get_clock',
      timeoutMs: 200
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.body, 'FALLBACK_OK');
  } finally {
    await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
});
