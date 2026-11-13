import express from 'express';
import cors from 'cors';
import { db } from './db/connection';
import { authRouterCompleto } from './modules/auth/auth.routes';
import { usuariosRouter } from './modules/auth/usuarios.routes';
import { csrfProtection } from './modules/auth/csrf';

export const app = express();

// En producción, detrás de un proxy inverso, respetar X-Forwarded-* para que
// `secure: 'auto'` de la cookie de sesión funcione sobre HTTPS.
if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1);

app.disable('x-powered-by');
app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '20kb' }));
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

// QA-01: montar aquí las rutas de tickets, triaje y admin cuando lleguen los PR.
