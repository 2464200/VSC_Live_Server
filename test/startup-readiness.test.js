const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const http = require('node:http');
const { execFile } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const windowsOnly = { skip: process.platform !== 'win32', timeout: 90000 };

function execute(script, args = []) {
  return new Promise((resolve) => execFile('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script, ...args], {
    windowsHide: true, timeout: 80000
  }, (error, stdout, stderr) => resolve({ code: error?.code || 0, stdout, stderr })));
}
async function unusedPort() {
  const socket = net.createServer();
  await new Promise((resolve) => socket.listen(0, '127.0.0.1', resolve));
  const port = socket.address().port;
  await new Promise((resolve) => socket.close(resolve));
  return port <= 65515 ? port : unusedPort();
}
function running(pid) {
  try { process.kill(pid, 0); return true; } catch { return false; }
}
async function fixture(t, mode) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'Bordero startup with spaces-'));
  const pids = new Set();
  t.after(async () => {
    const marker = path.join(directory, 'fixture.pid');
    if (fs.existsSync(marker)) pids.add(Number(fs.readFileSync(marker, 'utf8')));
    const saved = path.join(directory, 'pids/startup-pids.json');
    if (fs.existsSync(saved)) {
      const values = JSON.parse(fs.readFileSync(saved, 'utf8').replace(/^\uFEFF/, ''));
      const processIds = Array.isArray(values) ? values : values.ProcessIds || values.processIds || [values];
      for (const pid of processIds) pids.add(Number(pid));
    }
    for (const pid of pids) if (Number.isInteger(pid) && running(pid)) {
      await new Promise((resolve) => execFile('taskkill.exe', ['/PID', String(pid), '/T', '/F'], { windowsHide: true }, resolve));
    }
    fs.rmSync(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });
  for (const file of ['startup.ps1', 'startup-retry.ps1', 'shutdown.ps1', 'run-unified-server.ps1', 'scripts/ps_helpers.ps1']) {
    fs.mkdirSync(path.dirname(path.join(directory, file)), { recursive: true });
    fs.copyFileSync(path.join(root, file), path.join(directory, file));
  }
  const cli = path.join(directory, 'node_modules/firebase-tools/lib/bin/firebase.js');
  fs.mkdirSync(path.dirname(cli), { recursive: true });
  fs.writeFileSync(cli, '');
  const port = await unusedPort();
  fs.writeFileSync(path.join(directory, '.env'), `UNIFIED_PORT=${port}\n`);
  fs.writeFileSync(path.join(directory, 'unified-server.js'), `
    const fs = require('node:fs'), http = require('node:http');
    fs.writeFileSync(__dirname + '/fixture.pid', String(process.pid));
    console.warn('Nonfatal fixture startup warning');
    const mode = ${JSON.stringify(mode)};
    if (mode === 'crash') process.exit(23);
    if (mode === 'never-ready') setInterval(() => {}, 1000);
    else {
      const started = Date.now();
      setTimeout(() => http.createServer((req, res) => {
        res.setHeader('Content-Type', 'application/json');
        if (req.url === '/eventi/api/ping' && mode === 'late-api' && Date.now() - started < 5000) {
          res.statusCode = 503; return res.end('{}');
        }
        res.end(JSON.stringify(req.url === '/api/health'
          ? { status: 'ok', server: 'unified-server', port: Number(process.env.UNIFIED_PORT) }
          : { ok: true, ping: 'pong' }));
      }).listen(Number(process.env.UNIFIED_PORT), '127.0.0.1'), mode === 'slow' ? 18000 : 0);
    }
  `);
  return { directory, port, pids, script: path.join(directory, 'startup.ps1'), retry: path.join(directory, 'startup-retry.ps1') };
}

test('a cold server ready after 18 seconds succeeds on the first retry-wrapper attempt, including paths with spaces', windowsOnly, async (t) => {
  const sample = await fixture(t, 'slow');
  const result = await execute(sample.retry, ['-NoWait', '-NoMonitor', '-MaxAttempts', '1']);
  assert.equal(result.code, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /successo al tentativo 1/);
  const response = await (await fetch(`http://127.0.0.1:${sample.port}/api/health`)).json();
  assert.equal(response.server, 'unified-server');
  assert.ok(fs.readFileSync(path.join(sample.directory, 'logs/startup-attempt-1.stdout.log'), 'utf8').includes('Avvio rapido completato'));
  assert.equal(fs.existsSync(path.join(sample.directory, 'logs/startup-attempt-2.stdout.log')), false);
});

test('a listening port is not considered ready until the Eventi API is also available', windowsOnly, async (t) => {
  const sample = await fixture(t, 'late-api');
  const result = await execute(sample.script, ['-NoWait', '-PortOverride', String(sample.port), '-ServerReadyTimeoutSeconds', '15']);
  assert.equal(result.code, 0, result.stdout + result.stderr);
  const response = await fetch(`http://127.0.0.1:${sample.port}/eventi/api/ping`);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).ok, true);
});

test('a real process failure reports its exit code immediately and preserves the startup output', windowsOnly, async (t) => {
  const sample = await fixture(t, 'crash');
  const started = Date.now();
  const result = await execute(sample.retry, ['-NoWait', '-MaxAttempts', '1']);
  assert.equal(result.code, 1);
  assert.match(result.stdout, /codice 23/);
  assert.ok(Date.now() - started < 40000, 'Should stop before the 60-second readiness timeout');
  const log = fs.readFileSync(path.join(sample.directory, 'logs/startup-attempt-1.stdout.log'), 'utf8');
  assert.match(log, /codice 23/);
});

test('a readiness timeout stops its newly launched Node process instead of leaving an orphan for the next attempt', windowsOnly, async (t) => {
  const sample = await fixture(t, 'never-ready');
  const result = await execute(sample.script, ['-NoWait', '-PortOverride', String(sample.port), '-ServerReadyTimeoutSeconds', '15']);
  assert.equal(result.code, 1);
  assert.match(result.stdout, /non pronto entro 15 secondi/);
  const pid = Number(fs.readFileSync(path.join(sample.directory, 'fixture.pid'), 'utf8'));
  assert.equal(running(pid), false, 'Timed-out Node process must be terminated with its host');
});

test('an unrelated service is preserved and an already healthy project server is reused', windowsOnly, async (t) => {
  const sample = await fixture(t, 'normal');
  const foreign = http.createServer((_req, res) => { res.setHeader('Content-Type', 'application/json'); res.end('{"status":"ok","server":"another-app"}'); });
  await new Promise((resolve) => foreign.listen(sample.port, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => foreign.close(resolve)));
  const result = await execute(sample.script, ['-NoWait', '-PortOverride', String(sample.port)]);
  assert.equal(result.code, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /occupata da un altro servizio/);
  const marker = path.join(sample.directory, 'fixture.pid');
  const pid = fs.readFileSync(marker, 'utf8');
  const reused = await execute(sample.retry, ['-NoWait', '-MaxAttempts', '1']);
  assert.equal(reused.code, 0, reused.stdout + reused.stderr);
  assert.match(reused.stdout, /Nessuna azione necessaria/);
  assert.equal(fs.readFileSync(marker, 'utf8'), pid);
  assert.equal((await (await fetch(`http://127.0.0.1:${sample.port}/api/health`)).json()).server, 'another-app');
});

test('shutdown uses the recorded fallback port and stops the server child without touching the occupied port', windowsOnly, async (t) => {
  const sample = await fixture(t, 'normal');
  const unrelated = http.createServer((_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.end('{"status":"ok","server":"another-app"}');
  });
  await new Promise((resolve) => unrelated.listen(sample.port, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => unrelated.close(resolve)));

  const started = await execute(sample.script, ['-NoWait', '-PortOverride', String(sample.port)]);
  assert.equal(started.code, 0, started.stdout + started.stderr);
  const statePath = path.join(sample.directory, 'pids/startup-pids.json');
  const state = JSON.parse(fs.readFileSync(statePath, 'utf8').replace(/^\uFEFF/, ''));
  assert.equal(state.Port, sample.port + 1);
  const nodePid = Number(fs.readFileSync(path.join(sample.directory, 'fixture.pid'), 'utf8'));

  const stopped = await execute(path.join(sample.directory, 'shutdown.ps1'));
  assert.equal(stopped.code, 0, stopped.stdout + stopped.stderr);
  assert.equal(running(nodePid), false, 'Shutdown must stop the runner tree including its Node child');
  assert.equal((await (await fetch(`http://127.0.0.1:${sample.port}/api/health`)).json()).server, 'another-app');
});

test('supervisor reads and probes the active server port instead of hard-coding 5500', () => {
  const source = fs.readFileSync(path.join(root, 'scripts/project-supervisor.ps1'), 'utf8');
  assert.match(source, /Port = \[int\]\$script:serverPort/);
  assert.match(source, /Test-UnifiedServerPort -Port \$script:serverPort/);
  assert.doesNotMatch(source, /127\.0\.0\.1:5500\/api\/health/);
});

test('the standard VS Code startup flags also complete on their first attempt', windowsOnly, async (t) => {
  const sample = await fixture(t, 'normal');
  fs.writeFileSync(path.join(sample.directory, 'generate_report_data.py'), 'print("Fixture report ready")\n');
  const result = await execute(sample.retry, ['-NoMonitor', '-MaxAttempts', '1']);
  assert.equal(result.code, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /successo al tentativo 1/);
  assert.match(result.stdout, /SISTEMA COMPLETAMENTE OPERATIVO/);
});
