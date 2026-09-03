#!/usr/bin/env node
/**
 * SYNC PUBLIC - Sincronizza i file statici e Bordero nella cartella public/
 * Compatibile con Windows, Linux, macOS (Node.js nativo)
 */

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const borderoSrc = path.join(repoRoot, 'Bordero');
const publicBordero = path.join(repoRoot, 'public', 'Bordero');

function copyDirRecursive(srcDir, dstDir) {
  if (!fs.existsSync(srcDir)) return;
  if (!fs.existsSync(dstDir)) {
    fs.mkdirSync(dstDir, { recursive: true });
  }

  const entries = fs.readdirSync(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    const dstPath = path.join(dstDir, entry.name);

    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, dstPath);
    } else if (entry.isFile()) {
      fs.copyFileSync(srcPath, dstPath);
    }
  }
}

function syncPublic() {
  console.log('🔄 Sincronizzazione file Bordero in public/ per Firebase Hosting...');

  // 1. Sotto-cartelle Bordero
  const subfolders = ['pages', 'js', 'assets', 'data'];
  for (const folder of subfolders) {
    const src = path.join(borderoSrc, folder);
    const dst = path.join(publicBordero, folder);
    copyDirRecursive(src, dst);
    console.log(`  ✓ Copiato Bordero/${folder} -> public/Bordero/${folder}`);
  }

  // 2. File CSV radice
  const rootCsvs = ['NextCoreo.csv', 'display.csv', 'servizio.csv'];
  for (const csv of rootCsvs) {
    const src = path.join(repoRoot, csv);
    const dst = path.join(repoRoot, 'public', csv);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dst);
      console.log(`  ✓ Copiato ${csv} -> public/${csv}`);
    }
  }

  console.log('✅ Sincronizzazione public/ completata con successo!');
}

if (require.main === module) {
  syncPublic();
}

module.exports = { syncPublic };
