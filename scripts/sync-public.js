#!/usr/bin/env node
/**
 * SYNC PUBLIC - Sincronizza i file statici e Bordero nella cartella public/
 * Compatibile con Windows, Linux, macOS (Node.js nativo)
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..');
const borderoSrc = path.join(repoRoot, 'Bordero');
const publicBordero = path.join(repoRoot, 'public', 'Bordero');

function getDeferredPaths() {
  const deferred = new Set();
  const readPaths = (args) => {
    const output = execFileSync('git', args, {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return output.split(/\r?\n/).filter(Boolean).map((item) => item.replace(/\\/g, '/'));
  };

  try {
    const upstream = execFileSync('git', ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    for (const item of readPaths(['diff', '--name-only', 'HEAD', '--'])) deferred.add(item);
    for (const item of readPaths(['ls-files', '--others', '--exclude-standard'])) deferred.add(item);
    if (upstream) {
      for (const item of readPaths(['diff', '--name-only', 'HEAD', upstream, '--'])) deferred.add(item);
    }
  } catch {
    // If Git state cannot be inspected, keep the existing public copies intact.
    deferred.add('*');
  }

  return deferred;
}

function copyDirRecursive(srcDir, dstDir, repoRelativeDir, deferredPaths) {
  if (!fs.existsSync(srcDir)) return;
  if (!fs.existsSync(dstDir)) {
    fs.mkdirSync(dstDir, { recursive: true });
  }

  const entries = fs.readdirSync(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    const dstPath = path.join(dstDir, entry.name);
    const repoRelativePath = `${repoRelativeDir}/${entry.name}`.replace(/\\/g, '/');

    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, dstPath, repoRelativePath, deferredPaths);
    } else if (entry.isFile()) {
      if (deferredPaths.has('*') || deferredPaths.has(repoRelativePath)) continue;
      if (repoRelativePath === 'Bordero/data/music-archive-local-config.json'
          || repoRelativePath === 'Bordero/data/video-clip-local-config.json') continue;
      fs.copyFileSync(srcPath, dstPath);
    }
  }
}

function removeStaleFiles(srcDir, dstDir, repoRelativeDir, deferredPaths) {
  if (!fs.existsSync(dstDir)) return;
  for (const entry of fs.readdirSync(dstDir, { withFileTypes: true })) {
    const dstPath = path.join(dstDir, entry.name);
    const srcPath = path.join(srcDir, entry.name);
    const repoRelativePath = `${repoRelativeDir}/${entry.name}`.replace(/\\/g, '/');
    if (entry.isDirectory()) {
      removeStaleFiles(srcPath, dstPath, repoRelativePath, deferredPaths);
      if (!fs.existsSync(srcPath) && !deferredPaths.has('*')
          && !deferredPaths.has(repoRelativePath)
          && fs.readdirSync(dstPath).length === 0) {
        fs.rmdirSync(dstPath);
      }
    } else if (entry.isFile() && !fs.existsSync(srcPath)
        && !deferredPaths.has('*') && !deferredPaths.has(repoRelativePath)) {
      fs.rmSync(dstPath);
    }
  }
}

function syncPublic() {
  const deferredPaths = getDeferredPaths();
  if (deferredPaths.size > 0) {
    console.log(`File locali o non allineati rinviati: ${deferredPaths.size}`);
  }
  console.log('🔄 Sincronizzazione file Bordero in public/ per Firebase Hosting...');

  // 1. Sotto-cartelle Bordero
  const subfolders = ['pages', 'js', 'assets', 'data'];
  for (const folder of subfolders) {
    const src = path.join(borderoSrc, folder);
    const dst = path.join(publicBordero, folder);
    copyDirRecursive(src, dst, `Bordero/${folder}`, deferredPaths);
    removeStaleFiles(src, dst, `Bordero/${folder}`, deferredPaths);
    console.log(`  ✓ Copiato Bordero/${folder} -> public/Bordero/${folder}`);
  }

  // 2. File CSV radice
  const rootCsvs = ['NextCoreo.csv', 'display.csv', 'servizio.csv'];
  for (const csv of rootCsvs) {
    const src = path.join(repoRoot, csv);
    const dst = path.join(repoRoot, 'public', csv);
    if (fs.existsSync(src) && !deferredPaths.has(csv) && !deferredPaths.has('*')) {
      fs.copyFileSync(src, dst);
      console.log(`  ✓ Copiato ${csv} -> public/${csv}`);
    }
  }

  // These per-machine settings must never be published by Firebase Hosting.
  for (const file of ['music-archive-local-config.json', 'video-clip-local-config.json']) {
    fs.rmSync(path.join(publicBordero, 'data', file), { force: true });
  }

  console.log('✅ Sincronizzazione public/ completata con successo!');
}

if (require.main === module) {
  syncPublic();
}

module.exports = { syncPublic };
