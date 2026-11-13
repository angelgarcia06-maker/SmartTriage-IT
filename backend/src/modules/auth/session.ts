import session from 'express-session';
import { SqliteSessionStore } from './sqlite-session-store';

export const COOKIE_NAME = 'smarttriage.sid';

const secret = process.env.SESSION_SECRET || 'dev-only-secret-cambiar-en-produccion';
if (!process.env.SESSION_SECRET && process.env.NODE_ENV === 'production') {
  console.warn('[auth] SESSION_SECRET no definido: define uno en .env');
}

export const sessionMiddleware = session({
  name: COOKIE_NAME,
  secret,
  store: new SqliteSessionStore(),
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: 'auto', // true solo si la petición llega por HTTPS
    maxAge: 8 * 60 * 60 * 1000, // 8 horas
  },
});