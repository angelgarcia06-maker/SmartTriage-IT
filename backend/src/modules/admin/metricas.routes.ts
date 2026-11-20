
import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import { db } from '../../db/connection';
import { obtenerMetricas } from './metricas.service';

const fechasDashboard = z.object({
  fecha_desde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  fecha_hasta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
}).strict().refine((rango) => {
  const fechas = [rango.fecha_desde, rango.fecha_hasta].filter(Boolean);
  return fechas.every((fecha) => !Number.isNaN(Date.parse(`${fecha}T00:00:00Z`))
      && new Date(`${fecha}T00:00:00Z`).toISOString().slice(0, 10) === fecha)
    && (!rango.fecha_desde || !rango.fecha_hasta || rango.fecha_desde <= rango.fecha_hasta);
}, 'El rango de fechas no es válido.');

interface SeguridadMetricas {
  requiereAutenticacion?: RequestHandler;
  requiereAdministrador?: RequestHandler;
}

// Bloquea el acceso si no hay seguridad configurada
const accesoDenegado: RequestHandler = (_req, res) => {
  res.status(401).json({
    error: 'Autenticación administrativa no configurada'
  });
};

export function crearMetricasRouter(
  seguridad: SeguridadMetricas = {}
): Router {
  const router = Router();

  const proteger: RequestHandler[] =
    seguridad.requiereAutenticacion &&
    seguridad.requiereAdministrador
      ? [
          seguridad.requiereAutenticacion,
          seguridad.requiereAdministrador
        ]
      : [accesoDenegado];

  // ADM-04: Consultar métricas del Dashboard
  router.get('/metricas', ...proteger, (req, res) => {
    try {
      const rango = fechasDashboard.safeParse(req.query);
      if (!rango.success) {
        res.status(400).json({ error: 'El rango de fechas no es válido.' });
        return;
      }
      const metricas = obtenerMetricas(db, rango.data);

      res.status(200).json(metricas);
    } catch (error) {
      console.error(
        'Error al consultar las métricas:',
        error
      );

      res.status(500).json({
        error: 'No se pudieron consultar las métricas'
      });
    }
  });

  return router;
}
