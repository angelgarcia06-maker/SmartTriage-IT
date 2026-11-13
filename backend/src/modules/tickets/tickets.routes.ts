import { Router, type RequestHandler } from 'express';
import type Database from 'better-sqlite3';
import { z } from 'zod';
import { db as conexionPredeterminada } from '../../db/connection';
import { crearTicket, type DatosTicket, type SugerenciaTicket } from './tickets.service';

const esquemaTicket = z.object({
  solicitante: z.string().trim().min(1).max(120),
  titulo: z.string().trim().min(1).max(200),
  descripcion: z.string().trim().min(1).max(5000),
  impacto: z.enum(['Alto', 'Medio', 'Bajo']),
  urgencia: z.enum(['Alta', 'Media', 'Baja']),
}).strict();

export interface OpcionesRutasTickets {
  conexion?: Database.Database;
  requiereAutenticacion?: RequestHandler;
  sugerir?: (datos: DatosTicket, conexion: Database.Database) => SugerenciaTicket;
}

const denegarSinAutenticacion: RequestHandler = (_req, res) => {
  res.status(401).json({ message: 'Inicia sesión para registrar un ticket.' });
};

/** Montar en /api/tickets; Auth proporciona el middleware y Triaje el sugeridor. */
export function crearRutasTickets(opciones: OpcionesRutasTickets = {}): Router {
  const router = Router();
  const conexion = opciones.conexion ?? conexionPredeterminada;
  const requiereAutenticacion = opciones.requiereAutenticacion ?? denegarSinAutenticacion;

  router.post('/', requiereAutenticacion, (req, res) => {
    const datos = esquemaTicket.safeParse(req.body);
    if (!datos.success) {
      res.status(400).json({
        message: 'Datos inválidos.',
        errores: datos.error.flatten().fieldErrors,
      });
      return;
    }

    const usuario = res.locals.usuario as { id?: number } | undefined;
    if (!usuario || typeof usuario.id !== 'number' || !Number.isInteger(usuario.id) || usuario.id <= 0) {
      res.status(401).json({ message: 'No se pudo identificar al usuario de la sesión.' });
      return;
    }

    const sugerencia = opciones.sugerir?.(datos.data, conexion) ?? null;
    const id = crearTicket(datos.data, usuario.id, conexion, sugerencia);
    res.status(201).json({ id });
  });

  return router;
}