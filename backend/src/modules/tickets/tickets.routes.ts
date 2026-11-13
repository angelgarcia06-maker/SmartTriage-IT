import { Router, type RequestHandler } from 'express';
import type Database from 'better-sqlite3';
import { z } from 'zod';
import { db as conexionPredeterminada } from '../../db/connection';
import {
  cambiarEstadoTicket,
  crearTicket,
  ErrorEstadoTicket,
  listarTickets,
  obtenerHistorial,
  obtenerTicket,
  type DatosTicket,
  type FiltrosTickets,
  type SugerenciaTicket,
} from './tickets.service';

const ESTADOS_TICKET = ['Nuevo', 'Asignado', 'En proceso', 'Resuelto', 'Cerrado'] as const;
const PRIORIDADES_TICKET = ['Crítica', 'Alta', 'Media', 'Baja'] as const;
const idFiltro = z.string().regex(/^[1-9]\d*$/).transform(Number).refine(Number.isSafeInteger);

const esquemaTicket = z.object({
  solicitante: z.string().trim().min(1).max(120),
  titulo: z.string().trim().min(1).max(200),
  descripcion: z.string().trim().min(1).max(5000),
  impacto: z.enum(['Alto', 'Medio', 'Bajo']),
  urgencia: z.enum(['Alta', 'Media', 'Baja']),
}).strict();

const esquemaFiltros = z.object({
  busqueda: z.string().trim().min(1).max(120).optional(),
  estado: z.enum(ESTADOS_TICKET).optional(),
  categoria_id: idFiltro.optional(),
  prioridad: z.enum(PRIORIDADES_TICKET).optional(),
  tecnico_id: idFiltro.optional(),
}).strict();

const esquemaCambioEstado = z.object({
  estado: z.enum(ESTADOS_TICKET),
  motivo: z.string().trim().min(1).max(500).optional(),
}).strict();

export interface OpcionesRutasTickets {
  conexion?: Database.Database;
  requiereAutenticacion?: RequestHandler;
  protegerEscrituras?: RequestHandler;
  sugerir?: (datos: DatosTicket, conexion: Database.Database) => SugerenciaTicket;
}

const denegarSinAutenticacion: RequestHandler = (_req, res) => {
  res.status(401).json({ message: 'Inicia sesión para registrar un ticket.' });
};
const continuar: RequestHandler = (_req, _res, next) => next();

function usuarioDeSesion(res: Parameters<RequestHandler>[1]): { id: number; rol: string } | null {
  const usuario = res.locals.usuario as { id?: number; rol?: string } | undefined;
  if (!usuario || typeof usuario.id !== 'number' || !Number.isInteger(usuario.id) || usuario.id <= 0) {
    return null;
  }
  return { id: usuario.id, rol: usuario.rol ?? '' };
}

function rolPuedeConsultar(rol: string): boolean {
  return rol === 'agente' || rol === 'administrador' || rol === 'tecnico';
}

/** Montar en /api/tickets; Auth proporciona el middleware y Triaje el sugeridor. */
export function crearRutasTickets(opciones: OpcionesRutasTickets = {}): Router {
  const router = Router();
  const conexion = opciones.conexion ?? conexionPredeterminada;
  const requiereAutenticacion = opciones.requiereAutenticacion ?? denegarSinAutenticacion;
  const protegerEscrituras = opciones.protegerEscrituras;

  router.get('/', requiereAutenticacion, (_req, res) => {
    const usuario = usuarioDeSesion(res);
    if (!usuario) {
      res.status(401).json({ message: 'No se pudo identificar al usuario de la sesión.' });
      return;
    }
    if (!rolPuedeConsultar(usuario.rol)) {
      res.status(403).json({ message: 'No tienes permiso para consultar tickets.' });
      return;
    }

    const parametros = esquemaFiltros.safeParse(_req.query);
    if (!parametros.success) {
      res.status(400).json({
        message: 'Filtros inválidos.',
        errores: parametros.error.flatten().fieldErrors,
      });
      return;
    }

    const tecnicoId = usuario.rol === 'tecnico' ? usuario.id : undefined;
    const filtros: FiltrosTickets = {
      busqueda: parametros.data.busqueda,
      estado: parametros.data.estado,
      categoriaId: parametros.data.categoria_id,
      prioridad: parametros.data.prioridad,
      tecnicoId: parametros.data.tecnico_id,
    };
    res.json({ tickets: listarTickets(conexion, tecnicoId, filtros) });
  });

  router.get('/:id', requiereAutenticacion, (req, res) => {
    const usuario = usuarioDeSesion(res);
    if (!usuario) {
      res.status(401).json({ message: 'No se pudo identificar al usuario de la sesión.' });
      return;
    }
    if (!rolPuedeConsultar(usuario.rol)) {
      res.status(403).json({ message: 'No tienes permiso para consultar tickets.' });
      return;
    }

    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ message: 'Id de ticket inválido.' });
      return;
    }

    const tecnicoId = usuario.rol === 'tecnico' ? usuario.id : undefined;
    const ticket = obtenerTicket(id, conexion, tecnicoId);
    if (!ticket) {
      res.status(404).json({ message: 'Ticket no encontrado.' });
      return;
    }
    res.json(ticket);
  });

  router.get('/:id/historial', requiereAutenticacion, (req, res) => {
    const usuario = usuarioDeSesion(res);
    if (!usuario) {
      res.status(401).json({ message: 'No se pudo identificar al usuario de la sesión.' });
      return;
    }
    if (!rolPuedeConsultar(usuario.rol)) {
      res.status(403).json({ message: 'No tienes permiso para consultar tickets.' });
      return;
    }

    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ message: 'Id de ticket inválido.' });
      return;
    }
    const tecnicoId = usuario.rol === 'tecnico' ? usuario.id : undefined;
    if (!obtenerTicket(id, conexion, tecnicoId)) {
      res.status(404).json({ message: 'Ticket no encontrado.' });
      return;
    }
    res.json({ historial: obtenerHistorial(id, conexion) });
  });

  router.patch('/:id/estado', requiereAutenticacion, protegerEscrituras ?? continuar, (req, res) => {
    const usuario = usuarioDeSesion(res);
    if (!usuario) {
      res.status(401).json({ message: 'No se pudo identificar al usuario de la sesión.' });
      return;
    }
    if (!['agente', 'administrador', 'tecnico'].includes(usuario.rol)) {
      res.status(403).json({ message: 'No tienes permiso para cambiar el estado.' });
      return;
    }

    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ message: 'Id de ticket inválido.' });
      return;
    }
    const datos = esquemaCambioEstado.safeParse(req.body);
    if (!datos.success) {
      res.status(400).json({ message: 'Cambio de estado inválido.', errores: datos.error.flatten().fieldErrors });
      return;
    }

    try {
      res.json(cambiarEstadoTicket(id, datos.data.estado, usuario, datos.data.motivo, conexion));
    } catch (error) {
      if (error instanceof ErrorEstadoTicket) {
        res.status(error.status).json({ message: error.message });
        return;
      }
      throw error;
    }
  });

  router.post('/', requiereAutenticacion, protegerEscrituras ?? continuar, (req, res) => {
    const usuario = usuarioDeSesion(res);
    if (!usuario) {
      res.status(401).json({ message: 'No se pudo identificar al usuario de la sesión.' });
      return;
    }
    if (!['agente', 'administrador'].includes(usuario.rol)) {
      res.status(403).json({ message: 'No tienes permiso para registrar tickets.' });
      return;
    }

    const datos = esquemaTicket.safeParse(req.body);
    if (!datos.success) {
      res.status(400).json({
        message: 'Datos inválidos.',
        errores: datos.error.flatten().fieldErrors,
      });
      return;
    }

    const sugerencia = opciones.sugerir?.(datos.data, conexion) ?? null;
    const id = crearTicket(datos.data, usuario.id, conexion, sugerencia);
    res.status(201).json({ id, sugerencia });
  });

  return router;
}