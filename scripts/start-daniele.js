#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const net = require('node:net');
const { execFileSync, spawn } = require('node:child_process');

const projectRoot = path.resolve(__dirname, '..');
const packageFile = path.join(projectRoot, 'package.json');
const lockFile = path.join(projectRoot, 'package-lock.json');
const SERVER_URL = 'http://127.0.0.1:5500';
let installProcess = null;
let electronProcess = null;
let interrupted = false;

function checkNodeVersion() {
  const [major] = process.versions.node.split('.').map(Number);
  if (major !== 20 && major !== 22 && major < 24) {
    throw new Error(
      `Versione Node.js ${process.versions.node} non supportata. ` +
      'Installare Node.js 20, 22 o 24+ e riavviare VS Code.'
    );
  }
}

function checkProjectFiles() {
  for (const file of [packageFile, lockFile, path.join(projectRoot, 'unified-server.js')]) {
    if (!fs.existsSync(file)) {
      throw new Error(`File richiesto mancante: ${path.relative(projectRoot, file)}`);
    }
  }
}

function getMissingPackages() {
  const manifest = JSON.parse(fs.readFileSync(packageFile, 'utf8'));
  const lock = JSON.parse(fs.readFileSync(lockFile, 'utf8'));

  const required = [
    ...Object.keys(manifest.dependencies || {}),
    ...(manifest.devDependencies?.electron ? ['electron'] : [])
  ];

  return required.filter((packageName) => {
    try {
      require.resolve(packageName, { paths: [projectRoot] });
      const packagePath = path.join(projectRoot, 'node_modules', ...packageName.split('/'), 'package.json');
      const installed = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      const lockedVersion = lock.packages?.[`node_modules/${packageName}`]?.version;
      return !lockedVersion || installed.version !== lockedVersion;
    } catch {
      return true;
    }
  });
}

function installDependencies() {
  console.log('[avviodaniele] Dipendenze runtime mancanti: eseguo npm ci dal lockfile.');
  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

  return new Promise((resolve, reject) => {
    installProcess = spawn(npmCommand, ['ci', '--no-audit', '--no-fund'], {
      cwd: projectRoot,
      stdio: 'inherit',
      shell: process.platform === 'win32'
    });

    installProcess.once('error', (error) => {
      installProcess = null;
      reject(new Error(`Impossibile avviare npm ci: ${error.message}`));
    });

    installProcess.once('close', (code) => {
      installProcess = null;
      if (interrupted) {
        reject(new Error("Installazione interrotta dall'utente."));
      } else if (code !== 0) {
        reject(new Error(`npm ci non riuscito (codice ${code ?? 'sconosciuto'}).`));
      } else {
        resolve();
      }
    });
  });
}

function handleInterrupt() {
  interrupted = true;
  if (installProcess) {
    installProcess.kill();
  } else {
    if (electronProcess) {
      electronProcess.kill();
    }
    process.exit(130);
  }
}

async function main() {
  checkNodeVersion();
  checkProjectFiles();

  const missingPackages = getMissingPackages();
  if (missingPackages.length > 0) {
    console.log(`[avviodaniele] Dipendenze mancanti o non allineate al lockfile: ${missingPackages.join(', ')}`);
    await installDependencies();
  } else {
    console.log('[avviodaniele] Dipendenze allineate al lockfile.');
  }

  const stillMissing = getMissingPackages();
  if (stillMissing.length > 0) {
    throw new Error(`Dipendenze non allineate dopo npm ci: ${stillMissing.join(', ')}`);
  }

  await restartExistingProjectServer();

  console.log('[avviodaniele] Avvio del server standard unified-server.js.');
  require(path.join(projectRoot, 'unified-server.js'));

  await waitForServer(SERVER_URL, 120000);
  startElectron();
}

async function restartExistingProjectServer() {
  if (!(await isPortOpen(5500))) {
    console.log('[avviodaniele] Porta 5500 libera: nessun server precedente da riavviare.');
    return;
  }

  if (process.platform !== 'win32') {
    throw new Error('La porta 5500 è occupata; il riavvio automatico selettivo è disponibile su Windows.');
  }

  const encodedRoot = Buffer.from(projectRoot, 'utf8').toString('base64');
  const powershell = [
    "$ErrorActionPreference = 'Stop'",
    `$projectRoot = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${encodedRoot}'))`,
    "$electronMain = Join-Path $projectRoot 'electron\\main.js'",
    '$listenerIds = @(Get-NetTCPConnection -LocalPort 5500 -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique)',
    '$processes = @(Get-CimInstance Win32_Process | Where-Object { ($listenerIds -contains [int]$_.ProcessId) -or ($_.Name -ieq \'electron.exe\' -and $_.CommandLine -and $_.CommandLine.IndexOf($electronMain, [StringComparison]::OrdinalIgnoreCase) -ge 0) } | Select-Object @{Name=\'pid\';Expression={[int]$_.ProcessId}}, @{Name=\'name\';Expression={$_.Name}}, @{Name=\'commandLine\';Expression={$_.CommandLine}})',
    'ConvertTo-Json -InputObject $processes -Compress'
  ].join('; ');

  let processes;
  try {
    const output = execFileSync('powershell.exe', [
      '-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', powershell
    ], { cwd: projectRoot, encoding: 'utf8', windowsHide: true, timeout: 10000 }).trim();
    processes = output ? JSON.parse(output) : [];
    if (!Array.isArray(processes)) processes = [processes];
  } catch (error) {
    throw new Error(`Impossibile identificare con sicurezza il processo sulla porta 5500: ${error.message}`);
  }

  const serverPath = path.join(projectRoot, 'unified-server.js').toLowerCase();
  const launcherPath = path.join(projectRoot, 'scripts', 'start-daniele.js').toLowerCase();
  const normalizeCommandLine = (value) => String(value || '').replace(/\//g, '\\').toLowerCase();
  const listeners = processes.filter((entry) => Number.isInteger(Number(entry.pid))
    && !(String(entry.name || '').toLowerCase() === 'electron.exe'
      && normalizeCommandLine(entry.commandLine).includes(path.join(projectRoot, 'electron', 'main.js').toLowerCase())));

  const foreignListeners = listeners.filter((entry) => {
    const commandLine = normalizeCommandLine(entry.commandLine);
    return !commandLine.includes(serverPath) && !commandLine.includes(launcherPath);
  });
  if (foreignListeners.length > 0 || listeners.length === 0) {
    const owners = foreignListeners.map((entry) => `${entry.name || 'processo'} PID ${entry.pid}`).join(', ');
    throw new Error(`La porta 5500 è occupata da un processo non identificabile come Bordero${owners ? ` (${owners})` : ''}; non lo termino.`);
  }

  const electronMainPath = normalizeCommandLine(path.join(projectRoot, 'electron', 'main.js'));
  const oldElectronProcesses = processes.filter((entry) => String(entry.name || '').toLowerCase() === 'electron.exe'
    && normalizeCommandLine(entry.commandLine).includes(electronMainPath));
  const toStop = [...oldElectronProcesses, ...listeners];
  const stoppedPids = new Set();

  for (const entry of toStop) {
    const pid = Number(entry.pid);
    if (!Number.isInteger(pid) || stoppedPids.has(pid)) continue;
    stoppedPids.add(pid);
    console.log(`[avviodaniele] Riavvio istanza Bordero precedente: ${entry.name || 'processo'} PID ${pid}.`);
    try {
      execFileSync('taskkill.exe', ['/PID', String(pid), '/T', '/F'], {
        cwd: projectRoot,
        stdio: 'ignore',
        windowsHide: true,
        timeout: 10000
      });
    } catch (error) {
      if (await isPortOpen(5500)) {
        throw new Error(`Non è stato possibile arrestare il processo Bordero PID ${pid}: ${error.message}`);
      }
    }
  }

  await waitForPortClosed(5500, 15000);
  console.log('[avviodaniele] Server precedente arrestato; avvio una nuova istanza con la configurazione locale corrente.');
}

function isPortOpen(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: '127.0.0.1', port });
    socket.setTimeout(1000);
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('error', () => resolve(false));
  });
}

async function waitForPortClosed(port, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!(await isPortOpen(port))) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`La porta ${port} è ancora occupata dopo il riavvio del server.`);
}

function waitForServer(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const req = http.get(url, (res) => {
        res.resume();
        resolve();
      });
      req.setTimeout(2000, () => req.destroy());
      req.on('error', () => {
        if (interrupted) {
          reject(new Error('Attesa del server interrotta.'));
        } else if (Date.now() >= deadline) {
          reject(new Error(`Server non raggiungibile su ${url}.`));
        } else {
          setTimeout(attempt, 500);
        }
      });
    };
    attempt();
  });
}

// Electron apre BORDERO sul monitor principale e DISPLAY sul monitor secondario (electron/main.js).
function startElectron() {
  let electronPath;
  try {
    electronPath = require(path.join(projectRoot, 'node_modules', 'electron'));
  } catch (error) {
    console.error(`[avviodaniele] Electron non disponibile: ${error.message}`);
    return;
  }

  console.log('[avviodaniele] Avvio di Electron: BORDERO su monitor 1, DISPLAY su monitor 2.');
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;

  electronProcess = spawn(electronPath, [path.join(projectRoot, 'electron', 'main.js')], {
    cwd: projectRoot,
    env,
    stdio: 'inherit',
    windowsHide: false
  });
  electronProcess.once('error', (error) => {
    console.error(`[avviodaniele] Impossibile avviare Electron: ${error.message}`);
    electronProcess = null;
  });
  electronProcess.once('exit', (code) => {
    console.log(`[avviodaniele] Electron chiuso (codice ${code ?? 'sconosciuto'}).`);
    electronProcess = null;
  });
}

process.on('SIGINT', handleInterrupt);
process.on('SIGTERM', handleInterrupt);

main().catch((error) => {
  console.error(`[avviodaniele] Avvio non riuscito: ${error.message}`);
  process.exitCode = interrupted ? 130 : 1;
});
