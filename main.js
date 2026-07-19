const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const net = require('net');

const PORT = 8080;
const SRC_DIR = path.join(__dirname, 'src');
const DIST_DIR = path.join(__dirname, 'dist');
const TSC = path.join(__dirname, 'node_modules', 'typescript', 'lib', 'tsc.js');

let serverProcess = null;
let compiling = false;
let crashCount = 0;
let restarting = false;

function log(msg) {
  console.log(`\x1b[36m[pulse]\x1b[0m ${msg}`);
}

function compile() {
  if (compiling) return false;
  compiling = true;
  log('Compiling TypeScript...');
  const start = Date.now();
  try {
    execSync(`node "${TSC}"`, { cwd: __dirname, stdio: 'pipe' });
    log(`Compiled in ${Date.now() - start}ms`);
    compiling = false;
    return true;
  } catch (err) {
    const stderr = err.stderr ? err.stderr.toString() : '';
    console.error(stderr || err.message);
    log('Compile failed — keeping old build');
    compiling = false;
    return false;
  }
}

function killPort(port) {
  return new Promise((resolve) => {
    try {
      const { execSync: ex } = require('child_process');
      ex(`for /f "tokens=5" %a in ('netstat -aon ^| findstr :${port}') do taskkill /F /PID %a 2>nul`, { stdio: 'pipe' });
    } catch (_) {}
    setTimeout(resolve, 500);
  });
}

function waitForPortFree(port, maxWait) {
  return new Promise((resolve) => {
    const start = Date.now();
    function check() {
      const server = net.createServer();
      server.once('error', () => {
        if (Date.now() - start > maxWait) return resolve();
        setTimeout(check, 300);
      });
      server.once('listening', () => {
        server.close(() => resolve());
      });
      server.listen(port);
    }
    check();
  });
}

async function startServer() {
  if (restarting) return;
  restarting = true;

  if (serverProcess) {
    log('Stopping server...');
    try { serverProcess.kill('SIGTERM'); } catch (_) {}
    try { serverProcess.kill('SIGKILL'); } catch (_) {}
    serverProcess = null;
  }

  await killPort(PORT);
  await waitForPortFree(PORT, 5000);

  serverProcess = spawn('node', [path.join(DIST_DIR, 'index.js')], {
    cwd: __dirname,
    env: { ...process.env, PORT: String(PORT) },
    stdio: 'pipe'
  });

  serverProcess.stdout.pipe(process.stdout);
  serverProcess.stderr.pipe(process.stderr);

  serverProcess.on('exit', (code) => {
    restarting = false;
    if (code !== null && code !== 0 && code !== 'SIGTERM' && code !== 'SIGKILL') {
      crashCount++;
      if (crashCount > 5) {
        log('Too many crashes — stopping auto-restart. Fix errors and restart manually.');
        return;
      }
      log(`Server crashed (${code}), restarting in 2s... (attempt ${crashCount}/5)`);
      setTimeout(startServer, 2000);
    }
  });

  serverProcess.on('error', (err) => {
    restarting = false;
    log('Server error: ' + err.message);
  });

  log('Server started');
  restarting = false;
}

function initialCompile() {
  if (!fs.existsSync(DIST_DIR)) {
    log('No dist/ found — compiling...');
  } else {
    const distIndex = path.join(DIST_DIR, 'index.js');
    if (!fs.existsSync(distIndex)) {
      log('No dist/index.js — compiling...');
    } else {
      const distTime = fs.statSync(distIndex).mtimeMs;
      const srcFiles = getAllTsFiles(SRC_DIR);
      const newestSrc = srcFiles.reduce((max, f) => Math.max(max, fs.statSync(f).mtimeMs), 0);
      if (newestSrc > distTime) {
        log('Source changed since last build — recompiling...');
      } else {
        log('Build up to date');
        return;
      }
    }
  }
  compile();
}

function getAllTsFiles(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...getAllTsFiles(full));
    else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) results.push(full);
  }
  return results;
}

function watchSrc() {
  let debounce = null;
  fs.watch(SRC_DIR, { recursive: true }, (eventType, filename) => {
    if (!filename || !filename.endsWith('.ts')) return;
    if (compiling) return;
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      log(`Changed: ${filename}`);
      if (compile()) {
        crashCount = 0;
        startServer();
      }
    }, 500);
  });
  log('Watching src/ for changes...');
}

function shutdown() {
  console.log('');
  log('Shutting down...');
  if (serverProcess) try { serverProcess.kill('SIGTERM'); } catch (_) {}
  setTimeout(() => process.exit(0), 500);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

console.log('\x1b[1m\x1b[35m');
console.log('  ____  _          _ _ ');
console.log(' |  _ \\(_)_  _____| | |');
console.log(' | |_) | \\ \\/ / _ \\ | |');
console.log(' |  __/| |>  <  __/ |_|');
console.log(' |_|   |_/_/\\_\\___|_(_)');
console.log('\x1b[0m');
console.log('');

initialCompile();
startServer();
watchSrc();

log(`Running on http://localhost:${PORT}`);
log(`  dashboard.localhost:${PORT} → Dashboard`);
log(`  api.localhost:${PORT}       → API`);
