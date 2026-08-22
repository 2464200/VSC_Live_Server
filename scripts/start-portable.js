#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const root = path.resolve(__dirname, '..');
const envFile = path.join(root, '.env');
const exampleFile = path.join(root, '.env.example');
const requiredFiles = ['package.json', 'unified-server.js'];

function ensureEnvFile() {
  if (!fs.existsSync(envFile) && fs.existsSync(exampleFile)) {
    fs.copyFileSync(exampleFile, envFile);
    console.log('[setup] Creato .env dai valori di default');
  }
}

function loadLocalEnv() {
  const envPath = path.join(root, '.env');
  if (!fs.existsSync(envPath)) return {};
  const content = fs.readFileSync(envPath, 'utf8');
  const parsed = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    parsed[key] = value.replace(/^['"]|['"]$/g, '');
  }
  return parsed;
}

function ensureRootPaths() {
  const dirs = [
    'logs',
    'pids',
    'videos',
    'exports',
    'userform-recordings',
    'legacy-recordings',
    'pdf'
  ];

  for (const dir of dirs) {
    const absolute = path.join(root, dir);
    fs.mkdirSync(absolute, { recursive: true });
  }
}

function checkRequirements() {
  const issues = [];
  for (const file of requiredFiles) {
    if (!fs.existsSync(path.join(root, file))) {
      issues.push(`File mancante: ${file}`);
    }
  }

  if (!fs.existsSync(path.join(root, 'node_modules'))) {
    issues.push('Dipendenze non installate: eseguire npm install');
  }

  return issues;
}

function startServer() {
  const env = { ...process.env, ...loadLocalEnv() };
  const child = spawn(process.execPath, ['server.js'], {
    cwd: root,
    stdio: 'inherit',
    env
  });

  child.on('exit', (code) => {
    process.exit(code ?? 0);
  });
}

function main() {
  console.log('========================================');
  console.log('MONSTER COUNTRY DJ SYSTEM - START');
  console.log('========================================');

  ensureEnvFile();
  ensureRootPaths();

  const issues = checkRequirements();
  if (issues.length > 0) {
    console.log('\nProblemi rilevati:');
    for (const issue of issues) console.log(' - ' + issue);
    console.log('\nEsegui: npm install');
    process.exit(1);
  }

  console.log('[OK] Ambiente progetto verificato');
  console.log('[OK] Configurazione portabile pronta');
  console.log('[OK] Avvio server unificato');
  console.log('URL: http://localhost:5500');
  console.log('========================================\n');
  startServer();
}

main();
