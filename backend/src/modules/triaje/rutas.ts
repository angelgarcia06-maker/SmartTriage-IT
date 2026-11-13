import { Router, type Request, type RequestHandler } from 'express';
import type Database from 'better-sqlite3';
import { z } from 'zod';
import { ErrorDecision, registrarDecision } from './decision';
import { sugerir } from './sugerir';

type Rol = 'agente' | 'tecnico' | 'administrador';
interface UsuarioSesion { id: number; rol: Rol }

/** Lee el usuario de la sesión. AUTH-02 guarda `req.session.usuario`; ajustar aquí si cambia. */
export function usuarioDeSesion(req: Request): UsuarioSesion | undefined {
  return (req as unknown as { session?: { usuario?: UsuarioSesion } }).session?.usuario;
}

/**
 * Guardia de rol provisional mientras llega `roleRequired` de AUTH-03.
 * 401 sin sesión, 403 si el rol no está permitido.
 */
export function rolRequeridoProvisional(...roles: Rol[]): RequestHandler {
  return (req, res, next) => {
    const usuario = usuarioDeSesion(req);
    if (!usuario) {
      res.status(401).json({ message: 'Inicia sesión para continuar.' });
      return;
    }
    if (!roles.includes(usuario.rol)) {
      res.status(403).json({ message: 'Tu rol no tiene permiso para esta acción.' });
      return;
    }
    next();
  };
}

const esquemaSugerir = z.object({
  titulo: z.string().trim().max(200).optional(),
  descripcion: z.string().trim().min(1, 'La descripción es obligatoria.').max(5000),
  impacto: z.enum(['Alto', 'Medio', 'Bajo']),
  urgencia: z.enum(['Alta', 'Media', 'Baja']),
}).passthrough(); // acepta el DatosTicket completo (solicitante, etc.)

const esquemaDecision = z.object({
  categoria_final_id: z.number().int().positive(),
  prioridad_final: z.enum(['Crítica', 'Alta', 'Media', 'Baja']),
  grupo_final_id: z.number().int().positive().nullable(),
  tecnico_id: z.number().int().positive().nullable(),
});

export interface OpcionesRutasTriaje {
  /** Base de datos (los tests usan SQLite en memoria). Por defecto, la del proyecto. */
  conexion?: Database.Database;
  /** Inyectar `roleRequired` de AUTH-03 cuando esté listo. */
  requiereRol?: (...roles: Rol[]) => RequestHandler;
}

/**
 * Rutas del triaje. Montar en app.ts (QA-01 / Integrante 5):
 *   app.use('/api', crearRutasTriaje({ requiereRol: roleRequired }));
 * Expone:
 *   POST /api/triaje/sugerir          (agente, administrador)
 *   POST /api/tickets/:id/decision    (agente, administrador)
 */
export function crearRutasTriaje(opciones: OpcionesRutasTriaje = {}): Router {
  const requiereRol = opciones.requiereRol ?? rolRequeridoProvisional;
  const bd = () => opciones.conexion ?? (require('../../db/connection') as typeof import('../../db/connection')).db;
  const router = Router();

  router.post('/triaje/sugerir', requiereRol('agente', 'administrador'), (req, res) => {
    const datos = esquemaSugerir.safeParse(req.body);
    if (!datos.success) {
      res.status(400).json({ message: 'Datos inválidos.', errores: datos.error.flatten().fieldErrors });
      return;
    }
    const { titulo, descripcion, impacto, urgencia } = datos.data;
    res.json(sugerir({ titulo, descripcion, impacto, urgencia }, bd()));
  });

  router.post('/tickets/:id/decision', requiereRol('agente', 'administrador'), (req, res) => {
    const ticketId = Number(req.params.id);
    if (!Number.isInteger(ticketId) || ticketId <= 0) {
      res.status(400).json({ message: 'Id de ticket inválido.' });
      return;
    }
    const datos = esquemaDecision.safeParse(req.body);
    if (!datos.success) {
      res.status(400).json({ message: 'Decisión inválida.', errores: datos.error.flatten().fieldErrors });
      return;
    }
    try {
      const usuario = usuarioDeSesion(req);
      if (!usuario) {
        res.status(401).json({ message: 'Inicia sesión para continuar.' });
        return;
      }
      res.status(201).json(registrarDecision(ticketId, datos.data, usuario.id, bd()));
    } catch (error) {
      if (error instanceof ErrorDecision) {
        res.status(error.status).json({ message: error.message });
        return;
      }
      throw error;
    }
  });

  return router;
}
