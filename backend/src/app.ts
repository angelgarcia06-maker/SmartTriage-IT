import express from 'express';
import cors from 'cors';
import { db } from './db/connection';
import { authRouterCompleto } from './modules/auth/auth.routes';
import { usuariosRouter } from './modules/auth/usuarios.routes';
import { csrfProtection, csrfTokenProtection } from './modules/auth/csrf';
import { loginRequired, roleRequired } from './modules/auth/auth.middleware';
import { sessionMiddleware } from './modules/auth/session';
import { crearRutasTriaje } from './modules/triaje/rutas';
import { sugerir } from './modules/triaje/sugerir';
import { crearRutasTickets } from './modules/tickets/tickets.routes';
import { catalogosRouter } from './modules/admin/catalogos.routes';
import { crearCatalogosCrudRouter } from './modules/admin/catalogos.crud.routes';
import { crearDiccionarioRouter } from './modules/admin/diccionario.routes';
import { crearMetricasRouter } from './modules/admin/metricas.routes';

export const app = express();

// En producción, detrás de un proxy inverso, respetar X-Forwarded-* para que
// `secure: 'auto'` de la cookie de sesión funcione sobre HTTPS.
if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1);

app.disable('x-powered-by');
app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '20kb' }));
app.use(sessionMiddleware);
app.get('/api/health', (_req, res) => {
  try {
    db.prepare('SELECT COUNT(*) AS total FROM categorias').get();
    res.json({ status: 'ok', application: 'SmartTriage IT', version: '0.1.0', database: 'SQLite conectada' });
  } catch {
    res.status(503).json({ status: 'error', message: 'Inicializa la base de datos con npm run db:init y npm run db:seed' });
  }
});

// AUTH-02/AUTH-03: login, logout, sesión y consulta de usuarios (solo administrador).
app.use('/api/auth', csrfProtection, authRouterCompleto);
// AUTH-04: administración de usuarios (solo administrador).
app.use('/api/usuarios', csrfProtection, usuariosRouter);

// ADM-01: catálogos de lectura para cualquier usuario autenticado (Tickets/Triaje).
app.use('/api/catalogos', loginRequired, catalogosRouter);
// ADM-02: altas, ediciones y desactivaciones solo para administradores.
app.use('/api/catalogos', csrfProtection, crearCatalogosCrudRouter({
  requiereAutenticacion: loginRequired,
  requiereAdministrador: roleRequired('administrador'),
}));
// ADM-03/04: administración del diccionario y métricas, solo para administradores.
app.use('/api/admin', csrfProtection, crearDiccionarioRouter({
  requiereAutenticacion: loginRequired,
  requiereAdministrador: roleRequired('administrador'),
}));
app.use('/api/admin', csrfProtection, crearMetricasRouter({
  requiereAutenticacion: loginRequired,
  requiereAdministrador: roleRequired('administrador'),
}));

// TICK: comparte sesión y sugeridor con Triaje; las escrituras usan el token AUTH-05.
app.use('/api/tickets', csrfProtection, crearRutasTickets({
  requiereAutenticacion: loginRequired,
  protegerEscrituras: csrfTokenProtection,
  sugerir: (datos, conexion) => sugerir(datos, conexion),
}));

// TRI: proteger origen antes de rutas; autorización y token CSRF en cada escritura.
app.use('/api', csrfProtection, crearRutasTriaje({
  requiereRol: roleRequired,
  protegerEscrituras: csrfTokenProtection,
}));
