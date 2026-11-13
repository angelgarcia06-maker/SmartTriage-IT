import { Router, type RequestHandler } from 'express';
import { getUsuarioPorId, getUsuarioPorNombre } from './auth.controller';

/**
 * Middlewares que AUTH-02/AUTH-03 deben inyectar al montar el router.
 * AUTH-01 no implementa sesiones ni roles: solo prepara el punto de unión.
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
 * Crea el router de consulta de usuarios. Las rutas solo se habilitan cuando
 * ambos middlewares se inyectan; sin ellos responden 401 (nunca quedan públicas).
 *
 * Ejemplo de integración (AUTH-02 + AUTH-03, sin montar aquí):
 * ```ts
 * app.use('/api/auth', crearAuthRouter({
 *   requiereAutenticacion: loginRequired,
 *   requiereAutorizacion: roleRequired('administrador'),
 * }));
 * ```
 */
export function crearAuthRouter(opciones: OpcionesAuthRouter = {}): Router {
  const router = Router();
  const proteger: RequestHandler[] =
    opciones.requiereAutenticacion && opciones.requiereAutorizacion
      ? [opciones.requiereAutenticacion, opciones.requiereAutorizacion]
      : [denegarSinAutenticacion];

  // La ruta con prefijo fijo va antes de /usuarios/:id para que no la capture.
  router.get('/usuarios/por-usuario/:usuario', ...proteger, getUsuarioPorNombre);
  router.get('/usuarios/:id', ...proteger, getUsuarioPorId);
  return router;
}

/**
 * Router por defecto SIN middlewares inyectados: falla cerrado con 401.
 * No montar en `app.ts` hasta que AUTH-02 y AUTH-03 estén disponibles.
 */
export const authRouter = crearAuthRouter();
