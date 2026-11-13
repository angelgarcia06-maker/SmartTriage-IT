import session from 'express-session';
import { SqliteSessionStore } from './sqlite-session-store';

export const COOKIE_NAME = 'smarttriage.sid';
/** Expiración de la sesión: 8 horas. */
export const DURACION_SESION_MS = 8 * 60 * 60 * 1000;

const secretoEntorno = process.env.SESSION_SECRET?.trim();
const esProduccion = process.env.NODE_ENV === 'production';

if (!secretoEntorno && esProduccion) {
  // En producción NO se admite un secreto por defecto: se falla al arrancar.
  throw new Error(
    '[auth] SESSION_SECRET es obligatorio en producción. Define un secreto largo y aleatorio en el entorno.',
  );
}
if (!secretoEntorno) {
  console.warn('[auth] SESSION_SECRET no definido: se usa un secreto SOLO para desarrollo. No usar en producción.');
}

export const sessionMiddleware = session({
  name: COOKIE_NAME,
  secret: secretoEntorno || 'dev-only-secret-cambiar-en-produccion',
  store: new SqliteSessionStore(),
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: 'auto', // true solo si la petición llega por HTTPS (requiere trust proxy en producción)
    maxAge: DURACION_SESION_MS,
    path: '/',
  },
});
