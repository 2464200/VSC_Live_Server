#!/usr/bin/env node
/**
 * Read-only preflight for the GitHub Actions Firebase Hosting deployment.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..');

function readJson(relativePath) {
  const absolutePath = path.join(repoRoot, relativePath);
  try {
    return JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
  } catch (error) {
    throw new Error(`Configurazione JSON non valida (${relativePath}): ${error.message}`);
  }
}

function requireValue(value, message) {
  if (!value) throw new Error(message);
}

function validateHosting() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const expectedBranch = process.env.EXPECTED_DEPLOY_BRANCH;
  const githubRef = process.env.GITHUB_REF;
  const compareRef = process.env.DEPLOY_COMPARE_REF;
  requireValue(projectId, 'FIREBASE_PROJECT_ID non impostato.');
  requireValue(expectedBranch, 'EXPECTED_DEPLOY_BRANCH non impostato.');
  requireValue(
    githubRef === `refs/heads/${expectedBranch}`,
    `Il workflow è atteso su refs/heads/${expectedBranch}, ricevuto un ref differente.`,
  );
  requireValue(compareRef, 'DEPLOY_COMPARE_REF non impostato.');

  const firebaseConfig = readJson('firebase.json');
  const firebaseRc = readJson('.firebaserc');
  const packageJson = readJson('package.json');

  requireValue(
    firebaseRc.projects?.default === projectId,
    'Il Project ID del workflow non coincide con il progetto Firebase predefinito in .firebaserc.',
  );

  const hosting = firebaseConfig.hosting;
  requireValue(hosting && typeof hosting.public === 'string', 'firebase.json non definisce hosting.public.');
  requireValue(
    Array.isArray(hosting.predeploy) && hosting.predeploy.includes('npm run sync:public'),
    'Manca l’hook predeploy previsto per sincronizzare l’output Hosting.',
  );
  requireValue(
    typeof packageJson.scripts?.['sync:public'] === 'string',
    'package.json non definisce lo script sync:public richiesto dal predeploy.',
  );

  const publicDir = path.resolve(repoRoot, hosting.public);
  requireValue(
    publicDir.startsWith(`${repoRoot}${path.sep}`),
    'La directory Hosting è esterna alla repository.',
  );
  requireValue(fs.existsSync(publicDir) && fs.statSync(publicDir).isDirectory(), 'La directory Hosting non esiste.');
  requireValue(fs.existsSync(path.join(publicDir, 'index.html')), 'Manca index.html nella directory Hosting.');

  const nodeEngine = packageJson.engines?.node || '';
  requireValue(
    /(?:^|[| ])(?:\^|>=?)?\s*20(?:\.|[ |]|$)/.test(nodeEngine),
    'package.json non dichiara Node.js 20 come runtime compatibile.',
  );

  execFileSync('git', ['rev-parse', '--verify', '--quiet', compareRef], {
    cwd: repoRoot,
    stdio: 'ignore',
  });
  const checkoutSha = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: repoRoot,
    encoding: 'utf8',
  }).trim();
  requireValue(
    checkoutSha.toLowerCase() === String(process.env.GITHUB_SHA || '').toLowerCase(),
    'Il checkout non corrisponde al commit GitHub richiesto.',
  );

  console.log(
    `Preflight Hosting OK: progetto esplicito, configurazione valida, output "${hosting.public}" presente, `
    + `Node.js compatibile e ref "${compareRef}" disponibile.`,
  );
}

if (require.main === module) {
  try {
    validateHosting();
  } catch (error) {
    console.error(`Preflight Firebase Hosting fallito: ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = { validateHosting };
