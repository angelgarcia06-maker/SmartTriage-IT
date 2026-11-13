
import { Router, type RequestHandler } from 'express';
import { db } from '../../db/connection';
import { obtenerMetricas } from './metricas.service';

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
  router.get('/metricas', ...proteger, (_req, res) => {
    try {
      const metricas = obtenerMetricas(db);

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
