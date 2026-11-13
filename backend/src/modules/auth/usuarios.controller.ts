import type { Request, Response } from 'express';
import { z } from 'zod';
import * as service from './usuarios.service';

const sNombre = z.string().trim().min(1, 'El nombre es obligatorio').max(100);
const sUsuario = z
  .string()
  .trim()
  .min(3, 'El usuario debe tener al menos 3 caracteres')
  .max(40)
  .regex(/^[A-Za-z0-9._-]+$/, 'El usuario solo admite letras, números, punto, guion y guion bajo');
const sPassword = z.string().min(8, 'La contraseña debe tener al menos 8 caracteres').max(72);
const sRol = z.enum(['agente', 'tecnico', 'administrador']);
const sGrupo = z.number().int().positive().nullable();

// .strict(): rechaza campos desconocidos (password_hash, id, ...).
const crearSchema = z
  .object({
    nombre: sNombre,
    usuario: sUsuario,
    password: sPassword,
    rol: sRol,
    grupo_id: sGrupo.optional(),
    activo: z.boolean().optional(),
  })
  .strict();

const actualizarSchema = z
  .object({
    nombre: sNombre.optional(),
    usuario: sUsuario.optional(),
    password: sPassword.optional(),
    rol: sRol.optional(),
    grupo_id: sGrupo.optional(),
    activo: z.boolean().optional(),
  })
  .strict()
  .refine((o) => Object.keys(o).length > 0, { message: 'No hay nada que actualizar' });

function fallar(res: Response, e: unknown) {
  if (e instanceof service.ErrorNegocio) return res.status(e.status).json({ error: e.message });
  throw e;
}

export function listar(_req: Request, res: Response) {
  return res.json(service.listarUsuarios());
}

export function listarGrupos(_req: Request, res: Response) {
  return res.json(service.listarGrupos());
}

export function crear(req: Request, res: Response) {
  const datos = crearSchema.safeParse(req.body);
  if (!datos.success) {
    return res.status(400).json({ error: datos.error.issues[0]?.message ?? 'Datos inválidos' });
  }
  try {
    return res.status(201).json(service.crearUsuario(datos.data));
  } catch (e) {
    return fallar(res, e);
  }
}

export function actualizar(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'id inválido' });
  const datos = actualizarSchema.safeParse(req.body);
  if (!datos.success) {
    return res.status(400).json({ error: datos.error.issues[0]?.message ?? 'Datos inválidos' });
  }
  try {
    return res.json(service.actualizarUsuario(id, datos.data, res.locals.usuario.id));
  } catch (e) {
    return fallar(res, e);
  }
}