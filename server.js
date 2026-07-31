#!/usr/bin/env node
'use strict';

const { spawn } = require('child_process');
const path = require('path');

const serverScript = path.join(__dirname, 'unified-server.js');
const child = spawn(process.execPath, [serverScript], {
  cwd: __dirname,
  stdio: 'inherit',
  env: { ...process.env, UNIFIED_PORT: process.env.UNIFIED_PORT || '5500' }
});

child.on('exit', (code) => {
  process.exit(code ?? 0);
});
