const { spawn, spawnSync } = require('node:child_process');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const dbFile = path.join(root, 'data', 'demo', 'smarttriage-demo.db');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

if (process.env.DB_FILE) {
  console.error('Quita DB_FILE antes de usar dev:demo; este comando administra una base aislada.');
  process.exit(1);
}

function ejecutarNpm(args, env) {
  const resultado = spawnSync(npmCommand, args, {
    cwd: root,
    env,
    shell: process.platform === 'win32',
    stdio: 'inherit',
  });
  if (resultado.error) {
    console.error(`No se pudo ejecutar npm ${args.join(' ')}: ${resultado.error.message}`);
    return false;
  }
  return resultado.status === 0;
}

if (!ejecutarNpm(['run', 'db:seed:demo'], process.env)) process.exit(1);
if (!ejecutarNpm(['run', 'db:init'], { ...process.env, DB_FILE: dbFile })) process.exit(1);

const servidor = spawn(npmCommand, ['run', 'dev'], {
  cwd: root,
  env: { ...process.env, DB_FILE: dbFile },
  shell: process.platform === 'win32',
  stdio: 'inherit',
});

for (const senal of ['SIGINT', 'SIGTERM']) {
  process.on(senal, () => servidor.kill(senal));
}

servidor.on('error', (error) => {
  console.error(`No se pudo iniciar npm run dev: ${error.message}`);
  process.exitCode = 1;
});
servidor.on('exit', (codigo, senal) => {
  process.exitCode = codigo ?? (senal ? 1 : 0);
});
