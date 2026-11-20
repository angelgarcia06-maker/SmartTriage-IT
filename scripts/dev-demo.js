const { spawn, spawnSync } = require('node:child_process');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const npmCli = process.env.npm_execpath;
const databasePath = path.join(root, 'data', 'demo', 'smarttriage-demo.db');

const seedEnv = { ...process.env };
delete seedEnv.DB_FILE;

function prepararBase(args, env) {
  const resultado = spawnSync(process.execPath, [npmCli, '--workspace=backend', 'run', ...args], {
    cwd: root,
    env,
    stdio: 'inherit',
  });

  if (resultado.error) console.error(resultado.error.message);
  if (resultado.status !== 0) process.exit(resultado.status ?? 1);
}

const demoEnv = {
  ...process.env,
  DB_FILE: databasePath,
  PORT: '3000',
  SMARTTRIAGE_DEMO: '1',
};

prepararBase(['db:seed:demo', '--', '--reusar'], seedEnv);
prepararBase(['db:init'], demoEnv);

const server = spawn(process.execPath, [npmCli, 'run', 'dev'], {
  cwd: root,
  env: demoEnv,
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
