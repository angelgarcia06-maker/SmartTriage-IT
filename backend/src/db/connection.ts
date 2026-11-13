import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
const repoRoot = path.resolve(__dirname, '../../..');
// DB_FILE=':memory:' permite bases de prueba aisladas sin tocar data/smarttriage.db.
const enMemoria = process.env.DB_FILE === ':memory:';
const finalPath = process.env.DB_FILE
  ? enMemoria
    ? ':memory:'
    : path.resolve(process.env.DB_FILE)
  : path.join(repoRoot, 'data', 'smarttriage.db');
if (!enMemoria) fs.mkdirSync(path.dirname(finalPath), { recursive:true });
export const db = new Database(finalPath);
db.pragma('foreign_keys = ON');
if (!enMemoria) db.pragma('journal_mode = WAL');
db.pragma('busy_timeout = 5000');
export const DATABASE_PATH = finalPath;
export const ES_BASE_EN_MEMORIA = enMemoria;
