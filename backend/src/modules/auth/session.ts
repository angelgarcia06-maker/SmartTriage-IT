
import { randomBytes } from 'node:crypto';
import session from 'express-session';
import { SqliteSessionStore } from './sqlite-session-store';

export const COOKIE_NAME = 'smarttriage.sid';

/** Expiración de la sesión: 8 horas. */
export const DURACION_SESION_MS = 8 * 60 * 60 * 1000;

// El secreto debe provenir del entorno en producción.
const configuredSecret = process.env.SESSION_SECRET?.trim();

if (process.env.NODE_ENV === 'production' && !configuredSecret) {
  throw new Error(
    '[auth] SESSION_SECRET es obligatorio en producción. Define un secreto largo y aleatorio en el entorno.',
  );
}

if (configuredSecret && configuredSecret.length < 32) {
  throw new Error(
    '[auth] SESSION_SECRET debe tener al menos 32 caracteres',
  );
}

// En desarrollo y pruebas se utiliza una clave aleatoria temporal,
// nunca una clave predeterminada conocida.
const secret = configuredSecret ?? randomBytes(48).toString('hex');

if (!configuredSecret && process.env.NODE_ENV !== 'test') {
  console.warn(
    '[auth] SESSION_SECRET no definido. Se utiliza una clave temporal; configura .env',
  );
}

export const sessionMiddleware = session({
  name: COOKIE_NAME,
  secret,
  store: new SqliteSessionStore(),
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: 'auto',
    maxAge: DURACION_SESION_MS,
    path: '/',
  },
});
