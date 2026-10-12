#!/usr/bin/env node
/** Build the dancer-facing Firebase Hosting site with DISPLAY as its only page. */

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const syncedPublic = path.join(repoRoot, 'public');
const outputDir = path.join(repoRoot, 'public-display');

function copyFile(relativePath) {
  const source = path.join(syncedPublic, relativePath);
  const destination = path.join(outputDir, relativePath);
  if (!fs.existsSync(source)) {
    throw new Error(`File richiesto per DISPLAY non trovato: public/${relativePath}`);
  }
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
}

function buildPublicDisplay() {
  if (path.resolve(outputDir) !== path.join(repoRoot, 'public-display')) {
    throw new Error('Percorso di output Hosting non valido.');
  }
  fs.rmSync(outputDir, { recursive: true, force: true });
  fs.mkdirSync(outputDir, { recursive: true });

  const files = [
    'Bordero/pages/display.html',
    'Bordero/pages/display.css',
    'Bordero/pages/display.js',
    'Bordero/assets/css/style.css',
    'Bordero/assets/css/bordero.css',
    'Bordero/assets/lib/xlsx.min.js',
    'Bordero/js/config.js',
    'Bordero/js/utils.js',
    'Bordero/js/excel-sync.js',
    'Bordero/js/data-loader.js',
    'Bordero/js/home-nav-guard.js',
    'Bordero/js/title-visibility-utils.js',
    'Bordero/js/video-only-brani.js',
    'Bordero/js/firebase-cloud-client.js',
    'Bordero/data/brani.csv',
    'display.csv',
  ];
  files.forEach(copyFile);

  const displayPath = path.join(outputDir, 'Bordero/pages/display.html');
  let html = fs.readFileSync(displayPath, 'utf8');
  html = html.replace(/\s*<nav class="nav-breadcrumb"[\s\S]*?<\/nav>\s*/i, '\n');
  html = html.replace(/\s*<script\s+src="\/nav\.js"><\/script>\s*/i, '\n');
  fs.writeFileSync(displayPath, html, 'utf8');

  fs.writeFileSync(
    path.join(outputDir, 'index.html'),
    '<!doctype html><html lang="it"><head><meta charset="utf-8"><meta http-equiv="refresh" content="0; url=/Bordero/pages/display.html"><title>DISPLAY</title></head><body><a href="/Bordero/pages/display.html">Apri DISPLAY</a></body></html>\n',
    'utf8',
  );
  fs.writeFileSync(
    path.join(outputDir, '404.html'),
    '<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Pagina non disponibile</title><style>body{margin:0;background:#111;color:#fff;font:18px sans-serif;display:grid;min-height:100vh;place-items:center}a{color:#ff8a00}</style></head><body><main><p>Questa pagina non è disponibile.</p><a href="/Bordero/pages/display.html">Vai a DISPLAY</a></main></body></html>\n',
    'utf8',
  );
  console.log('Hosting pubblico preparato: DISPLAY e file necessari.');
}

if (require.main === module) buildPublicDisplay();

module.exports = { buildPublicDisplay };
