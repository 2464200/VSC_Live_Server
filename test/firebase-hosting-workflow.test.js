const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');

const repoRoot = path.resolve(__dirname, '..');

test('merge workflow prepares the configured Hosting output before preflight and deploy', (t) => {
  const workflow = fs.readFileSync(path.join(repoRoot, '.github/workflows/firebase-hosting-merge.yml'), 'utf8');
  const commands = [...workflow.matchAll(/^\s+run: (.+)$/gm)].map((match) => match[1]);
  assert.deepEqual(commands, ['npm run sync:public', 'node scripts/validate-firebase-hosting.js']);
  assert.ok(workflow.indexOf('run: node scripts/validate-firebase-hosting.js')
    < workflow.indexOf('uses: FirebaseExtended/action-hosting-deploy@'));
  assert.match(workflow, /push:\s+branches:\s+- develop/);
  assert.match(workflow, /EXPECTED_DEPLOY_BRANCH: develop/);
  assert.match(workflow, /run: npm run sync:public\s+env:\s+DEPLOY_COMPARE_REF: origin\/develop/);

  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'firebase-hosting-workflow-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const relativePath of [
    'public', 'Bordero', 'index.html', 'display.csv', 'firebase.json', '.firebaserc',
    '.gitignore', 'package.json',
    'scripts/sync-public.js', 'scripts/build-public-display.js',
    'scripts/deploy-policy.js', 'scripts/validate-firebase-hosting.js',
  ]) {
    const destination = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.cpSync(path.join(repoRoot, relativePath), destination, { recursive: true });
  }
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git('init');
  git('add', '.');
  git('-c', 'user.name=Hosting Test', '-c', 'user.email=hosting-test@example.invalid', 'commit', '-m', 'Fixture');
  const sha = git('rev-parse', 'HEAD');
  git('update-ref', 'refs/remotes/origin/develop', sha);
  const env = {
    ...process.env,
    GITHUB_ACTIONS: 'true',
    GITHUB_REF: 'refs/heads/develop',
    GITHUB_SHA: sha,
    FIREBASE_PROJECT_ID: 'my-project-1525790600392',
    EXPECTED_DEPLOY_BRANCH: 'develop',
    DEPLOY_COMPARE_REF: 'origin/develop',
    DEPLOY_INCLUDE_LOCAL_CHANGES: 'false',
  };
  const options = { cwd: root, env, encoding: 'utf8' };
  const config = JSON.parse(fs.readFileSync(path.join(root, 'firebase.json'), 'utf8'));
  const output = path.join(root, config.hosting.public);
  assert.equal(fs.existsSync(output), false);
  const before = spawnSync(process.execPath, ['scripts/validate-firebase-hosting.js'], options);
  assert.equal(before.status, 1);
  assert.match(before.stderr, /La directory Hosting non esiste/);

  for (const command of commands) {
    const [executable, ...args] = command.split(' ');
    execFileSync(executable, args, options);
  }
  assert.equal(config.hosting.public, 'public-display');
  assert.ok(fs.statSync(path.join(output, 'index.html')).isFile());
  assert.ok(fs.statSync(path.join(output, 'Bordero/pages/display.html')).isFile());
  // Firebase runs the same predeploy hook again; the generated output must remain valid.
  for (const command of [...config.hosting.predeploy, commands[1]]) {
    const [executable, ...args] = command.split(' ');
    execFileSync(executable, args, options);
  }
  const wrongBranch = spawnSync(process.execPath, ['scripts/validate-firebase-hosting.js'], {
    ...options, env: { ...env, GITHUB_REF: 'refs/heads/main' },
  });
  assert.equal(wrongBranch.status, 1);
  assert.match(wrongBranch.stderr, /Il workflow è atteso su refs\/heads\/develop/);
});
