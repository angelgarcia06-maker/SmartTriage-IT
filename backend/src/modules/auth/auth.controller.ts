import type { Request, Response } from 'express';
import * as service from './auth.service';

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