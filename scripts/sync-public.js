#!/usr/bin/env node
/**
 * SYNC PUBLIC - Sincronizza i file statici e Bordero nella cartella public/
 * Compatibile con Windows, Linux, macOS (Node.js nativo)
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { filterDeferredPaths, LOCAL_ONLY_CSV_PATHS } = require('./deploy-policy');

const repoRoot = path.resolve(__dirname, '..');
const borderoSrc = path.join(repoRoot, 'Bordero');
const publicBordero = path.join(repoRoot, 'public', 'Bordero');

function getDeferredPaths() {
  // Deploy esplicitamente autorizzato dall'utente: pubblica anche le modifiche
  // locali non ancora committate o non allineate al branch remoto.
  if (process.env.DEPLOY_INCLUDE_LOCAL_CHANGES === 'true') return new Set();

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
    for (const item of readPaths(['diff', '--name-only', 'HEAD', '--'])) deferred.add(item);
    for (const item of readPaths(['ls-files', '--others', '--exclude-standard'])) deferred.add(item);

    let compareRef = process.env.DEPLOY_COMPARE_REF || '';
    if (!compareRef) {
      try {
        compareRef = execFileSync('git', ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'], {
          cwd: repoRoot,
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'ignore'],
        }).trim();
      } catch {
        // GitHub checks out a commit in detached HEAD mode; the workflow supplies its ref.
        if (process.env.GITHUB_ACTIONS !== 'true') deferred.add('*');
      }
    }
    if (compareRef) {
      for (const item of readPaths(['diff', '--name-only', 'HEAD', compareRef, '--'])) deferred.add(item);
    }
  } catch (error) {
    if (process.env.GITHUB_ACTIONS === 'true') {
      throw new Error(
        `Impossibile determinare i file da sincronizzare per Firebase Hosting: ${error.message}`,
        { cause: error },
      );
    }
    // Locally, if Git state cannot be inspected, keep the existing public copies intact.
    deferred.add('*');
  }

  return filterDeferredPaths(deferred);
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

  // Keep the deployed entry points in sync as well as the Bordero subfolders.
  // These were previously omitted, leaving older HTML pages live after deploy.
  for (const [source, destination] of [
    [path.join(repoRoot, 'index.html'), path.join(repoRoot, 'public', 'index.html')],
    [path.join(borderoSrc, 'index.html'), path.join(publicBordero, 'index.html')],
  ]) {
    const repoRelativePath = path.relative(repoRoot, source).replace(/\\/g, '/');
    if (fs.existsSync(source) && !deferredPaths.has('*') && !deferredPaths.has(repoRelativePath)) {
      fs.copyFileSync(source, destination);
      console.log(`  ✓ Copiato ${repoRelativePath} -> ${path.relative(repoRoot, destination).replace(/\\/g, '/')}`);
    }
  }

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
  for (const file of LOCAL_ONLY_CSV_PATHS) {
    fs.rmSync(path.join(repoRoot, 'public', file), { force: true });
  }

  console.log('✅ Sincronizzazione public/ completata con successo!');
}

if (require.main === module) {
  syncPublic();
}

module.exports = { syncPublic };
