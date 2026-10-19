#!/usr/bin/env node
'use strict';
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { start } = require('../src/server');
const pkg = require('../package.json');

const HELP = `Jotter ${pkg.version}: a notebook for writing documents, not running code.

Usage: jotter [folder] [options]

  folder            Folder to serve (default: the current directory)
  -p, --port N      Port to start from (default 8888; the next free one is used if busy)
      --host H      Address to listen on (default 127.0.0.1)
      --no-browser  Do not open a browser window
      --no-token    Turn off the access token (only on a machine you trust)
      --token T     Use your own access token
  -h, --help        Show this help
  -v, --version     Show the version
`;

const opt = { port: 8888, host: '127.0.0.1', open: true, token: crypto.randomBytes(24).toString('hex'), root: process.cwd() };
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  const val = () => { if (i + 1 >= argv.length) { console.error('Missing value for ' + a); process.exit(1); } return argv[++i]; };
  if (a === '-h' || a === '--help') { console.log(HELP); process.exit(0); }
  else if (a === '-v' || a === '--version') { console.log(pkg.version); process.exit(0); }
  else if (a === '-p' || a === '--port') opt.port = parseInt(val(), 10);
  else if (a.startsWith('--port=')) opt.port = parseInt(a.slice(7), 10);
  else if (a === '--host') opt.host = val();
  else if (a.startsWith('--host=')) opt.host = a.slice(7);
  else if (a === '--no-browser') opt.open = false;
  else if (a === '--no-token') opt.token = null;
  else if (a === '--token') opt.token = val();
  else if (a.startsWith('--token=')) opt.token = a.slice(8);
  else if (a.startsWith('-')) { console.error('Unknown option: ' + a + '\n\n' + HELP); process.exit(1); }
  else opt.root = path.resolve(a);
}
if (!Number.isInteger(opt.port) || opt.port < 1 || opt.port > 65535) { console.error('Invalid port.'); process.exit(1); }
if (!fs.existsSync(opt.root) || !fs.statSync(opt.root).isDirectory()) { console.error('Not a folder: ' + opt.root); process.exit(1); }

function openBrowser(url) {
  const [cmd, args] = process.platform === 'darwin' ? ['open', [url]]
    : process.platform === 'win32' ? ['cmd', ['/c', 'start', '""', url.replace(/&/g, '^&')]]
    : ['xdg-open', [url]];
  try {
    const child = spawn(cmd, args, { stdio: 'ignore', detached: true });
    child.on('error', () => {});
    child.unref();
  } catch (e) { /* the URL is printed anyway */ }
}

start(opt).then(({ server, port }) => {
  const shown = opt.host === '127.0.0.1' || opt.host === '::1' ? 'localhost' : opt.host === '0.0.0.0' ? 'localhost' : opt.host;
  const url = 'http://' + shown + ':' + port + '/' + (opt.token ? '?token=' + opt.token : '');
  console.log('\n  Jotter ' + pkg.version);
  console.log('  Serving notebooks from: ' + opt.root + '\n');
  console.log('  Open this link in your browser:\n\n      ' + url + '\n');
  if (!['127.0.0.1', 'localhost', '::1'].includes(opt.host)) console.log('  Warning: listening on ' + opt.host + '. Anyone on your network with the link can read and edit files in this folder.\n');
  if (!opt.token) console.log('  Warning: the access token is off.\n');
  console.log('  Press Ctrl+C to stop.\n');
  if (opt.open) openBrowser(url);
  const stop = () => { server.close(); setTimeout(() => process.exit(0), 200).unref(); };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}).catch((e) => { console.error('Could not start Jotter: ' + e.message); process.exit(1); });
