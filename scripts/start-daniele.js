#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const projectRoot = path.resolve(__dirname, '..');
const packageFile = path.join(projectRoot, 'package.json');
const lockFile = path.join(projectRoot, 'package-lock.json');
let installProcess = null;
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

  return Object.keys(manifest.dependencies || {}).filter((packageName) => {
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
}

process.on('SIGINT', handleInterrupt);
process.on('SIGTERM', handleInterrupt);

main().catch((error) => {
  console.error(`[avviodaniele] Avvio non riuscito: ${error.message}`);
  process.exitCode = interrupted ? 130 : 1;
});
