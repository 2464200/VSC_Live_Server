#!/usr/bin/env node
'use strict';

const { spawn } = require('child_process');
const path = require('path');

const root = path.resolve(__dirname, '..');
const startupScript = path.join(__dirname, 'start-unattended.ps1');
const powershell = process.platform === 'win32' ? 'powershell.exe' : 'pwsh';
const child = spawn(powershell, [
  '-NoProfile',
  '-ExecutionPolicy', 'Bypass',
  '-File', startupScript,
  '-NoBrowser'
], {
  cwd: root,
  stdio: 'inherit'
});

child.on('error', (error) => {
  console.error(`[start:portable] Impossibile avviare PowerShell: ${error.message}`);
  process.exitCode = 1;
});

child.on('exit', (code, signal) => {
  if (signal) {
    console.error(`[start:portable] Avvio interrotto dal segnale ${signal}`);
    process.exitCode = 1;
    return;
  }
  process.exitCode = code ?? 1;
});
