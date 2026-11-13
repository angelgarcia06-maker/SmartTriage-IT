import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import * as service from './auth.service';
import { COOKIE_NAME } from './session';

export function getUsuarioPorId(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'id inválido' });
  }
  const usuario = service.obtenerUsuarioPorId(id);
  if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });
  return res.json(usuario);
}

export function getUsuarioPorNombre(req: Request, res: Response) {
  const nombre = String(req.params.usuario ?? '').trim();
  if (!nombre) return res.status(400).json({ error: 'usuario inválido' });
  const usuario = service.obtenerUsuarioPorUsuario(nombre);
  if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });
  return res.json(usuario);
}

const loginSchema = z.object({
  usuario: z.string().trim().min(1).max(60),
  password: z.string().min(1).max(200),
});

export function login(req: Request, res: Response, next: NextFunction) {
  const datos = loginSchema.safeParse(req.body);
  if (!datos.success) {
    return res.status(400).json({ error: 'Usuario y contraseña son obligatorios' });
  }
  const user = service.autenticar(datos.data.usuario, datos.data.password);
  if (!user) {
    // Mismo mensaje para usuario inexistente, contraseña errónea o usuario inactivo.
    return res.status(401).json({ error: 'Credenciales inválidas' });
  }
  // Regenera el id de sesión al autenticar (previene fijación de sesión).
  req.session.regenerate((err) => {
    if (err) return next(err);
    req.session.userId = user.id;
    req.session.save((err2) => {
      if (err2) return next(err2);
      return res.json(user);
    });
  });
}

export function logout(req: Request, res: Response, next: NextFunction) {
  req.session.destroy((err) => {
    if (err) return next(err);
    res.clearCookie(COOKIE_NAME);
    return res.json({ mensaje: 'Sesión cerrada' });
  });
}

export function me(req: Request, res: Response) {
  const id = req.session?.userId;
  const user = id ? service.usuarioDeSesion(id) : null;
  if (!user) return res.status(401).json({ error: 'No autenticado' });
  return res.json(user);
}