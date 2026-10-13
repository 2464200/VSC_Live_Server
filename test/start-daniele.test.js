const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');

const repository = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(repository, 'package.json'), 'utf8'));
const lock = JSON.parse(fs.readFileSync(path.join(repository, 'package-lock.json'), 'utf8'));
const source = fs.readFileSync(path.join(repository, 'scripts/start-daniele.js'), 'utf8');

async function launch(options = {}) {
  const projectRoot = path.resolve('D:/Progetti DJ Daniel West/Bordero');
  const operations = [];
  const messages = [];
  let packagesInstalled = !options.outdatedPackages;
  let occupied = Boolean(options.occupied);
  const fakeProcess = {
    versions: { node: options.nodeVersion || '24.0.0' }, platform: 'win32',
    env: { ELECTRON_RUN_AS_NODE: '1', VSC_PROGRAMMA_DIR: '../VSC_PROGRAMMA' },
    on() {}, exit(code) { this.exitCode = code; }
  };
  const virtualFs = {
    existsSync: () => true,
    readFileSync(file) {
      if (file === path.join(projectRoot, 'package.json')) return JSON.stringify(manifest);
      if (file === path.join(projectRoot, 'package-lock.json')) return JSON.stringify(lock);
      const relative = path.relative(path.join(projectRoot, 'node_modules'), file).replace(/\\/g, '/').replace(/\/package\.json$/, '');
      const version = lock.packages[`node_modules/${relative}`]?.version;
      if (!version) throw new Error(`Unexpected package ${relative}`);
      return JSON.stringify({ version: !packagesInstalled && relative === 'electron' ? '0.0.0' : version });
    }
  };
  const localRequire = (name) => {
    if (name === 'node:fs') return virtualFs;
    if (name === 'node:net') return {
      createConnection() {
        const socket = new EventEmitter();
        socket.setTimeout = () => socket;
        socket.destroy = () => {};
        queueMicrotask(() => socket.emit(occupied ? 'connect' : 'error'));
        return socket;
      }
    };
    if (name === 'node:http') return {
      get(url, callback) {
        operations.push({ type: 'ready', url });
        const request = new EventEmitter();
        request.setTimeout = () => request;
        queueMicrotask(() => callback({ resume() {} }));
        return request;
      }
    };
    if (name === 'node:child_process') return {
      execFileSync(executable, args) {
        operations.push({ type: 'command', executable, args });
        if (executable === 'powershell.exe') return JSON.stringify(options.foreignListener
          ? [{ pid: 123, name: 'other.exe', commandLine: 'D:/OtherApplication/server.exe' }]
          : [{ pid: 456, name: 'node.exe', commandLine: `node "${path.join(projectRoot, 'scripts/start-daniele.js')}"` }]);
        if (executable === 'taskkill.exe') occupied = false;
        return '';
      },
      spawn(executable, args, configuration) {
        operations.push({ type: 'spawn', executable, args, configuration });
        const child = new EventEmitter();
        child.kill = () => {};
        if (executable === 'npm.cmd') {
          packagesInstalled = true;
          queueMicrotask(() => child.emit('close', 0));
        }
        return child;
      }
    };
    if (name === path.join(projectRoot, 'unified-server.js')) {
      operations.push({ type: 'server', file: name });
      return {};
    }
    if (name === path.join(projectRoot, 'node_modules/electron')) return path.join(projectRoot, 'node_modules/electron/dist/electron.exe');
    return require(name);
  };
  localRequire.resolve = (name) => path.join(projectRoot, 'node_modules', name, 'index.js');
  const context = {
    require: localRequire, __dirname: path.join(projectRoot, 'scripts'),
    process: fakeProcess, Buffer, setTimeout,
    console: { log: (message) => messages.push(message), error: (message) => messages.push(message) }
  };
  vm.runInNewContext(source.replace('main().catch(', 'globalThis.launchCompleted = main().catch('), context);
  await context.launchCompleted;
  return { projectRoot, operations, messages, process: fakeProcess };
}

test('avviodaniele loads current server and Electron from the collaborator workspace, including paths with spaces', async () => {
  const result = await launch();
  const types = result.operations.map((operation) => operation.type);
  assert.deepEqual(types, ['server', 'ready', 'spawn']);
  const electron = result.operations.at(-1);
  assert.equal(electron.args[0], path.join(result.projectRoot, 'electron/main.js'));
  assert.equal(electron.configuration.cwd, result.projectRoot);
  assert.equal(electron.configuration.env.ELECTRON_RUN_AS_NODE, undefined);
  assert.equal(electron.configuration.env.VSC_PROGRAMMA_DIR, '../VSC_PROGRAMMA');
  assert.equal(result.process.exitCode, undefined);
});

test('avviodaniele installs locked dependencies before starting the updated runtime', async () => {
  const result = await launch({ outdatedPackages: true });
  const installation = result.operations[0];
  assert.equal(installation.executable, 'npm.cmd');
  assert.deepEqual(Array.from(installation.args), ['ci', '--no-audit', '--no-fund']);
  assert.equal(result.operations[1].type, 'server');
  assert.equal(result.operations.at(-1).type, 'spawn');
  assert.equal(result.process.exitCode, undefined);
});

test('avviodaniele restarts only the previous project instance before loading current modules', async () => {
  const result = await launch({ occupied: true });
  const stop = result.operations.find((operation) => operation.executable === 'taskkill.exe');
  assert.deepEqual(Array.from(stop.args), ['/PID', '456', '/T', '/F']);
  assert.ok(result.operations.indexOf(stop) < result.operations.findIndex((operation) => operation.type === 'server'));
  assert.equal(result.process.exitCode, undefined);
});

test('avviodaniele leaves an unrelated listener untouched and reports the conflict', async () => {
  const result = await launch({ occupied: true, foreignListener: true });
  assert.equal(result.process.exitCode, 1);
  assert.equal(result.operations.some((operation) => operation.executable === 'taskkill.exe'), false);
  assert.equal(result.operations.some((operation) => ['server', 'spawn'].includes(operation.type)), false);
  assert.ok(result.messages.some((message) => message.includes('non lo termino')));
});

test('avviodaniele reports unsupported Node versions before changing processes or dependencies', async () => {
  const result = await launch({ nodeVersion: '18.0.0' });
  assert.equal(result.process.exitCode, 1);
  assert.equal(result.operations.length, 0);
  assert.ok(result.messages.some((message) => message.includes('non supportata')));
});
