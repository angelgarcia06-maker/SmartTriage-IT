import Database from 'better-sqlite3';
import express, { type RequestHandler } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { crearRutasTickets } from './tickets.routes';

let conexion: Database.Database;
const usuarioSesion = { id: 7 };
const autenticar: RequestHandler = (_req, res, next) => {
  res.locals.usuario = usuarioSesion;
  next();
};
const cuerpo = {
  solicitante: 'Ana García',
  titulo: 'Sin conexión a la red',
  descripcion: 'No funciona la conexión wifi de la oficina.',
  impacto: 'Alto',
  urgencia: 'Alta',
};

function crearApp(conAutenticacion = true) {
  const app = express();
  app.use(express.json());
  app.use('/api/tickets', crearRutasTickets({
    conexion,
    requiereAutenticacion: conAutenticacion ? autenticar : undefined,
  }));
  return app;
}

beforeEach(() => {
  conexion = new Database(':memory:');
  conexion.exec(`
    CREATE TABLE usuarios (id INTEGER PRIMARY KEY);
    INSERT INTO usuarios (id) VALUES (7);
    CREATE TABLE tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      solicitante TEXT NOT NULL,
      titulo TEXT NOT NULL,
      descripcion TEXT NOT NULL,
      impacto TEXT NOT NULL,
      urgencia TEXT NOT NULL,
      estado TEXT NOT NULL DEFAULT 'Nuevo',
      fecha_creacion TEXT NOT NULL DEFAULT '2026-11-13T00:00:00.000Z',
      creado_por INTEGER NOT NULL REFERENCES usuarios(id),
      categoria_sugerida_id INTEGER,
      prioridad_sugerida TEXT,
      grupo_sugerido_id INTEGER,
      palabra_activadora TEXT
    );
  `);
});

describe('POST /api/tickets', () => {
  it('crea el ticket como Nuevo y usa el usuario autenticado', async () => {
    const sugerencia = {
      categoria_id: 3,
      prioridad: 'Crítica' as const,
      grupo_id: 2,
      tecnico_id: 9,
      palabra_activadora: 'wifi',
    };
    const app = express();
    app.use(express.json());
    app.use('/api/tickets', crearRutasTickets({
      conexion,
      requiereAutenticacion: autenticar,
      sugerir: () => sugerencia,
    }));

    const respuesta = await request(app).post('/api/tickets').send(cuerpo);

    expect(respuesta.status).toBe(201);
    expect(respuesta.body).toEqual({ id: 1 });
    expect(conexion.prepare('SELECT * FROM tickets WHERE id = ?').get(respuesta.body.id)).toMatchObject({
      ...cuerpo,
      estado: 'Nuevo',
      creado_por: usuarioSesion.id,
      categoria_sugerida_id: sugerencia.categoria_id,
      prioridad_sugerida: sugerencia.prioridad,
      grupo_sugerido_id: sugerencia.grupo_id,
      tecnico_id: sugerencia.tecnico_id,
      palabra_activadora: sugerencia.palabra_activadora,
    });
  });

  it('responde 400 si faltan campos requeridos o hay campos adicionales', async () => {
    const app = crearApp();
    const vacio = await request(app).post('/api/tickets').send({});
    const extra = await request(app).post('/api/tickets').send({ ...cuerpo, estado: 'Cerrado' });

    expect(vacio.status).toBe(400);
    expect(extra.status).toBe(400);
    expect(conexion.prepare('SELECT COUNT(*) AS total FROM tickets').get()).toEqual({ total: 0 });
  });

  it('responde 401 sin autenticación', async () => {
    const respuesta = await request(crearApp(false)).post('/api/tickets').send(cuerpo);

    expect(respuesta.status).toBe(401);
    expect(conexion.prepare('SELECT COUNT(*) AS total FROM tickets').get()).toEqual({ total: 0 });
  });
});