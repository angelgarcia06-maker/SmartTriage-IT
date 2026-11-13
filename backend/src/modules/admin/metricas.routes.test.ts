
import express, { type RequestHandler } from 'express';
import request from 'supertest';
import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { crearMetricasRouter } from './metricas.routes';
import { obtenerMetricas } from './metricas.service';

// Simulamos la conexión para no utilizar la BD real.
vi.mock('../../db/connection', () => ({
  db: {}
}));

// Simulamos el resultado del servicio de métricas.
vi.mock('./metricas.service', () => ({
  obtenerMetricas: vi.fn(() => ({
    tickets: {
      total: 10,
      porEstado: [
        { nombre: 'Nuevo', total: 6 },
        { nombre: 'Asignado', total: 4 }
      ],
      porCategoria: [],
      porPrioridad: []
    },
    precision: {
      global: {
        total: 10,
        aceptadas: 8,
        porcentaje: 80
      },
      porCampo: [],
      porCategoriaSugerida: []
    }
  }))
}));

// Autenticación simulada SOLO para las pruebas.
const autenticar: RequestHandler = (req, res, next) => {
  const rol = req.header('x-test-role');

  if (!rol) {
    res.status(401).json({
      error: 'Usuario no autenticado'
    });
    return;
  }

  next();
};

// Comprueba el rol de administrador.
const verificarAdministrador: RequestHandler =
  (req, res, next) => {
    if (req.header('x-test-role') !== 'administrador') {
      res.status(403).json({
        error: 'Acceso denegado'
      });
      return;
    }

    next();
  };

// Aplicación temporal para pruebas.
const app = express();

app.use(
  '/api/admin',
  crearMetricasRouter({
    requiereAutenticacion: autenticar,
    requiereAdministrador: verificarAdministrador
  })
);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ADM-04: Seguridad del Dashboard', () => {

  it('bloquea el acceso sin seguridad configurada', async () => {
    const appSinSeguridad = express();

    appSinSeguridad.use(
      '/api/admin',
      crearMetricasRouter()
    );

    const respuesta = await request(appSinSeguridad)
      .get('/api/admin/metricas');

    expect(respuesta.status).toBe(401);
  });

  it('rechaza usuarios no autenticados', async () => {
    const respuesta = await request(app)
      .get('/api/admin/metricas');

    expect(respuesta.status).toBe(401);
    expect(obtenerMetricas).not.toHaveBeenCalled();
  });

  it('rechaza usuarios con rol de agente', async () => {
    const respuesta = await request(app)
      .get('/api/admin/metricas')
      .set('x-test-role', 'agente');

    expect(respuesta.status).toBe(403);
    expect(obtenerMetricas).not.toHaveBeenCalled();
  });

  it('permite consultar métricas al administrador', async () => {
    const respuesta = await request(app)
      .get('/api/admin/metricas')
      .set('x-test-role', 'administrador');

    expect(respuesta.status).toBe(200);
    expect(obtenerMetricas).toHaveBeenCalledOnce();

    expect(respuesta.body.tickets.total).toBe(10);

    expect(respuesta.body.precision.global).toEqual({
      total: 10,
      aceptadas: 8,
      porcentaje: 80
    });
  });
});
