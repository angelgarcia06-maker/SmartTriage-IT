import session from 'express-session';
import { db } from '../../db/connection';

const DIA_MS = 24 * 60 * 60 * 1000;

/** Store de sesiones en SQLite (better-sqlite3). Reemplaza a MemoryStore. */
export class SqliteSessionStore extends session.Store {
  constructor() {
    super();
    // La tabla la crea el propio módulo; no se modifica schema.sql.
    db.exec(`CREATE TABLE IF NOT EXISTS sessions (
      sid TEXT PRIMARY KEY,
      sess TEXT NOT NULL,
      expire INTEGER NOT NULL
    )`);
    db.exec('CREATE INDEX IF NOT EXISTS idx_sessions_expire ON sessions(expire)');
    db.prepare('DELETE FROM sessions WHERE expire < ?').run(Date.now());
  }

  private calcularExpira(sess: session.SessionData): number {
    const e = sess.cookie?.expires;
    return e ? new Date(e).getTime() : Date.now() + DIA_MS;
  }

  get(sid: string, cb: (err: unknown, sess?: session.SessionData | null) => void): void {
    try {
      const row = db
        .prepare('SELECT sess, expire FROM sessions WHERE sid = ?')
        .get(sid) as { sess: string; expire: number } | undefined;
      if (!row) return cb(null, null);
      if (row.expire < Date.now()) {
        db.prepare('DELETE FROM sessions WHERE sid = ?').run(sid);
        return cb(null, null);
      }
      cb(null, JSON.parse(row.sess) as session.SessionData);
    } catch (e) {
      cb(e);
    }
  }

  set(sid: string, sess: session.SessionData, cb?: (err?: unknown) => void): void {
    try {
      db.prepare('INSERT OR REPLACE INTO sessions (sid, sess, expire) VALUES (?, ?, ?)').run(
        sid,
        JSON.stringify(sess),
        this.calcularExpira(sess),
      );
      cb?.();
    } catch (e) {
      cb?.(e);
    }
  }

  touch(sid: string, sess: session.SessionData, cb?: (err?: unknown) => void): void {
    try {
      db.prepare('UPDATE sessions SET expire = ? WHERE sid = ?').run(this.calcularExpira(sess), sid);
      cb?.();
    } catch (e) {
      cb?.(e);
    }
  }

  destroy(sid: string, cb?: (err?: unknown) => void): void {
    try {
      db.prepare('DELETE FROM sessions WHERE sid = ?').run(sid);
      cb?.();
    } catch (e) {
      cb?.(e);
    }
  }
}