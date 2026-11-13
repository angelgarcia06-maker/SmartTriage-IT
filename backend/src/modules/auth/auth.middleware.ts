import type { NextFunction, Request, Response } from 'express';
import { usuarioDeSesion } from './auth.service';
import type { RolAuth, UsuarioSesion } from './auth.types';

/**
 * ÚNICA fuente de identidad del servidor: resuelve el usuario a partir de
 * `req.session.userId` (único dato guardado en la sesión) contra la base de
 * datos. La usan AUTH y cualquier otro módulo (Triaje, Tickets, Admin).
 *
 * Devuelve `null` si no hay sesión o si el usuario fue desactivado, así que un
 * cambio de rol o la desactivación surten efecto de inmediato (no hay copia
 * obsoleta del usuario dentro de la sesión).
 */
export function usuarioDeRequest(req: Request): UsuarioSesion | null {
  const id = req.session?.userId;
  return id ? usuarioDeSesion(id) : null;
}

export function loginRequired(req: Request, res: Response, next: NextFunction) {
  const usuario = usuarioDeRequest(req);
  if (!usuario) return res.status(401).json({ error: 'No autenticado' });
  res.locals.usuario = usuario;
  return next();
}

export function roleRequired(...roles: RolAuth[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    loginRequired(req, res, () => {
      if (!roles.includes(res.locals.usuario.rol)) {
        return res.status(403).json({ error: 'Sin permisos' });
      }
      return next();
    });
  };
}
