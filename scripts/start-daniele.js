#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');

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

  console.log('[avviodaniele] Avvio del server standard unified-server.js.');
  require(path.join(projectRoot, 'unified-server.js'));

  await waitForServer(SERVER_URL, 120000);
  startElectron();
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
