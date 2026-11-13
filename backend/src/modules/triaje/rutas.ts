import { Router, type RequestHandler } from 'express';
import type Database from 'better-sqlite3';
import { z } from 'zod';
import { db as conexionPredeterminada } from '../../db/connection';
import { roleRequired, usuarioDeRequest } from '../auth/auth.middleware';
import type { RolAuth } from '../auth/auth.types';
import { ErrorDecision, registrarDecision } from './decision';
import { sugerir } from './sugerir';

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
  /** Middleware de roles de AUTH. */
  requiereRol?: (...roles: RolAuth[]) => RequestHandler;
}

/**
 * Rutas del triaje. Montar en app.ts (QA-01 / Integrante 5):
 *   app.use('/api', crearRutasTriaje({ requiereRol: roleRequired }));
 * Expone:
 *   POST /api/triaje/sugerir          (agente, administrador)
 *   POST /api/tickets/:id/decision    (agente, administrador)
 */
export function crearRutasTriaje(opciones: OpcionesRutasTriaje = {}): Router {
  const requiereRol = opciones.requiereRol ?? roleRequired;
  const bd = () => opciones.conexion ?? conexionPredeterminada;
  const router = Router();

  router.get('/triaje/catalogos', requiereRol('agente', 'administrador'), (_req, res) => {
    const conexion = bd();
    const categorias = conexion
      .prepare('SELECT id, nombre FROM categorias WHERE activa = 1 ORDER BY nombre')
      .all();
    const grupos = conexion
      .prepare('SELECT id, nombre FROM grupos WHERE activo = 1 ORDER BY nombre')
      .all();
    const tecnicos = conexion
      .prepare("SELECT id, nombre, grupo_id FROM usuarios WHERE rol = 'tecnico' AND activo = 1 ORDER BY nombre")
      .all();
    res.json({ categorias, grupos, tecnicos });
  });

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
      const usuario = usuarioDeRequest(req);
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
