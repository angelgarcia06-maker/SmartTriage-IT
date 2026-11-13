import { Router, type RequestHandler } from 'express';
import { getUsuarioPorId, getUsuarioPorNombre, login, logout, me } from './auth.controller';
import { loginRequired, roleRequired } from './auth.middleware';
import { sessionMiddleware } from './session';

/**
 * Middlewares que se inyectan al montar el router de consulta de usuarios.
 */
export interface OpcionesAuthRouter {
  /** AUTH-02: middleware de sesión (`loginRequired`). */
  requiereAutenticacion?: RequestHandler;
  /** AUTH-03: middleware de autorización ya configurado con los roles permitidos. */
  requiereAutorizacion?: RequestHandler;
}

/** Respuesta fail-closed mientras la autenticación real no esté conectada. */
const denegarSinAutenticacion: RequestHandler = (_req, res) => {
  res.status(401).json({ error: 'No autenticado' });
};

/**
 * Crea el router de auth.
 * - /login, /logout y /me (AUTH-02) siempre disponibles, con sesión en SQLite.
 * - /usuarios/... (AUTH-01) solo se habilitan si se inyectan AMBOS middlewares;
 *   si no, responden 401 (nunca quedan públicas).
 */
export function crearAuthRouter(opciones: OpcionesAuthRouter = {}): Router {
  const router = Router();

  // La sesión vive dentro del módulo, antes de cualquier middleware que la use.
  router.use(sessionMiddleware);

  router.post('/login', login);
  router.post('/logout', logout);
  router.get('/me', me);

  const proteger: RequestHandler[] =
    opciones.requiereAutenticacion && opciones.requiereAutorizacion
      ? [opciones.requiereAutenticacion, opciones.requiereAutorizacion]
      : [denegarSinAutenticacion];

  // La ruta con prefijo fijo va antes de /usuarios/:id para que no la capture.
  router.get('/usuarios/por-usuario/:usuario', ...proteger, getUsuarioPorNombre);
  router.get('/usuarios/:id', ...proteger, getUsuarioPorId);
  return router;
}

/** Router por defecto: login/logout/me activos; /usuarios falla cerrado (401). */
export const authRouter = crearAuthRouter();

/**
 * Router listo para montar en app.ts:
 *   app.use('/api/auth', authRouterCompleto);
 * /usuarios/... exige sesión y rol administrador.
 */
export const authRouterCompleto = crearAuthRouter({
  requiereAutenticacion: loginRequired,
  requiereAutorizacion: roleRequired('administrador'),
});