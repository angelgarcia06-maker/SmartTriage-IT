const { spawn, spawnSync } = require('node:child_process');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const npmCli = process.env.npm_execpath;
const databasePath = path.join(root, 'data', 'demo', 'smarttriage-demo.db');

const seedEnv = { ...process.env };
delete seedEnv.DB_FILE;

const seed = spawnSync(process.execPath, [npmCli, '--workspace=backend', 'run', 'db:seed:demo', '--', '--reusar'], {
  cwd: root,
  env: seedEnv,
  stdio: 'inherit',
});

if (seed.error) console.error(seed.error.message);
if (seed.status !== 0) process.exit(seed.status ?? 1);

const server = spawn(process.execPath, [npmCli, 'run', 'dev'], {
  cwd: root,
  env: {
    ...process.env,
    DB_FILE: databasePath,
    PORT: '3000',
    SMARTTRIAGE_DEMO: '1',
  },
  stdio: 'inherit',
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.kill(signal));
}

server.on('error', (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
server.on('exit', (code, signal) => {
  process.exitCode = code ?? (signal === 'SIGINT' ? 130 : 1);
});
