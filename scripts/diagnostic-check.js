#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const os = require('os');

const root = path.resolve(__dirname, '..');
const checks = [];

function addCheck(name, ok, detail) {
  checks.push({ name, ok, detail });
}

const required = [
  'package.json',
  'unified-server.js',
  'server.js',
  'config/config.js',
  'scripts/start-portable.js',
  'scripts/sync-public.js',
  'Bordero/server/firebase-cloud-sync.js',
  'Bordero/js/firebase-cloud-client.js'
];

for (const file of required) {
  const exists = fs.existsSync(path.join(root, file));
  addCheck(`File ${file}`, exists, exists ? 'presente' : 'mancante');
}

addCheck('Node.js', !!process.version, process.version);
addCheck('npm', !!process.env.npm_execpath, process.env.npm_execpath || 'non rilevato');
addCheck('Porta 5500', true, 'default portabile');
addCheck('Cartella progetto', fs.existsSync(root), root);
addCheck('Directory export', fs.existsSync(path.join(root, 'exports', 'siae')), 'configurabile');

const report = checks.map((item) => `${item.ok ? '[OK]' : '[WARN]'} ${item.name}: ${item.detail}`).join('\n');
console.log('========================================');
console.log('MONSTER COUNTRY DJ - DIAGNOSTICA');
console.log('========================================');
console.log(report);
console.log('========================================');
console.log('OS:', os.platform(), os.release());
console.log('Root:', root);
console.log('========================================');
