
import { Router, type RequestHandler } from 'express';
import {
  getUsuarioPorId,
  getUsuarioPorNombre,
  login,
  logout,
  me,
} from './auth.controller';
import { loginRequired, roleRequired } from './auth.middleware';
import {
  csrfTokenProtection,
  obtenerTokenCsrf,
} from './csrf';

/**
 * Middlewares que se inyectan al montar el router de consulta de usuarios.
 */
export interface OpcionesAuthRouter {
  /** AUTH-02: middleware de sesión (`loginRequired`). */
  requiereAutenticacion?: RequestHandler;
  /** AUTH-03: middleware de autorización configurado con los roles permitidos. */
  requiereAutorizacion?: RequestHandler;
}

/** Respuesta fail-closed mientras la autenticación real no esté conectada. */
const denegarSinAutenticacion: RequestHandler = (_req, res) => {
  res.status(401).json({ error: 'No autenticado' });
};

/**
 * Crea el router de autenticación.
 * La sesión se configura globalmente en app.ts antes de montar este router.
 */
export function crearAuthRouter(opciones: OpcionesAuthRouter = {}): Router {
  const router = Router();

  // Obtención del token CSRF asociado a la sesión actual.
  router.get('/csrf', obtenerTokenCsrf);

  // Operaciones de autenticación protegidas mediante token CSRF.
  router.post('/login', csrfTokenProtection, login);
  router.post('/logout', csrfTokenProtection, logout);

  router.get('/me', me);

  const proteger: RequestHandler[] =
    opciones.requiereAutenticacion && opciones.requiereAutorizacion
      ? [
          opciones.requiereAutenticacion,
          opciones.requiereAutorizacion,
        ]
      : [denegarSinAutenticacion];

  // La ruta con prefijo fijo va antes de /usuarios/:id.
  router.get(
    '/usuarios/por-usuario/:usuario',
    ...proteger,
    getUsuarioPorNombre,
  );

  router.get('/usuarios/:id', ...proteger, getUsuarioPorId);

  return router;
}

/** Router por defecto: consultas de usuarios protegidas mediante fail-closed. */
export const authRouter = crearAuthRouter();

/**
 * Router completo para montar en app.ts.
 * Requiere que sessionMiddleware se monte antes de este router.
 */
export const authRouterCompleto = crearAuthRouter({
  requiereAutenticacion: loginRequired,
  requiereAutorizacion: roleRequired('administrador'),
});
