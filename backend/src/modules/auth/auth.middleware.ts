import type { NextFunction, Request, Response } from 'express';
import { usuarioDeSesion } from './auth.service';
import type { RolAuth } from './auth.types';

export function loginRequired(req: Request, res: Response, next: NextFunction) {
  const id = req.session?.userId;
  const usuario = id ? usuarioDeSesion(id) : null;
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