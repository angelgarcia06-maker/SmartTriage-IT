import type Database from 'better-sqlite3';
import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { authRouter } from '../auth/auth.routes';
import { roleRequired } from '../auth/auth.middleware';
import { sessionMiddleware } from '../auth/session';
import { crearBaseDePrueba, crearTicket, idCategoria, idGrupo, idUsuario } from './fixture';
import { crearRutasTriaje } from './rutas';

let bd: Database.Database;

const CLAVE = 'Cambiar123!';

function crearApp() {
  const app = express();
  app.use(express.json());
  app.use(sessionMiddleware);
  app.use('/api/auth', authRouter);
  app.use('/api', crearRutasTriaje({ conexion: bd, requiereRol: roleRequired }));
  return app;
}

async function sesion(usuario: string) {
  const agente = request.agent(crearApp());
  const r = await agente.post('/api/auth/login').send({ usuario, password: CLAVE });
  expect(r.status).toBe(200);
  return agente;
}

beforeEach(() => {
  bd = crearBaseDePrueba();
});

const cuerpo = { solicitante: 'Ana', titulo: 'Sin red', descripcion: 'No funciona el wifi', impacto: 'Alto', urgencia: 'Alta' };

describe('POST /api/triaje/sugerir', () => {
  it('401 sin sesión', async () => {
    expect((await request(crearApp()).post('/api/triaje/sugerir').send(cuerpo)).status).toBe(401);
  });

  it('403 para técnico', async () => {
    const tecnico = await sesion('tecnico1');
    expect((await tecnico.post('/api/triaje/sugerir').send(cuerpo)).status).toBe(403);
  });

  it('200 para agente con la sugerencia completa', async () => {
    const agente = await sesion('agente');
    const r = await agente.post('/api/triaje/sugerir').send(cuerpo);
    expect(r.status).toBe(200);
    expect(r.body).toEqual({
      categoria_id: idCategoria(bd, 'Red'),
      categoria: 'Red',
      palabra_activadora: 'wifi',
      es_otros: false,
      prioridad: 'Crítica',
      grupo_id: idGrupo(bd, 'Redes y conectividad'),
      tecnico_id: idUsuario(bd, 'tecnico2'),
    });
  });

  it('200 para administrador', async () => {
    const admin = await sesion('admin');
    expect((await admin.post('/api/triaje/sugerir').send(cuerpo)).status).toBe(200);
  });

  it('400 con impacto, urgencia o descripción inválidos', async () => {
    const admin = await sesion('admin');
    const a = await admin.post('/api/triaje/sugerir').send({ ...cuerpo, impacto: 'Altísimo' });
    const b = await admin.post('/api/triaje/sugerir').send({ ...cuerpo, urgencia: 'Inmediata' });
    const c = await admin.post('/api/triaje/sugerir').send({ ...cuerpo, descripcion: '  ' });
    expect(a.status).toBe(400);
    expect(b.status).toBe(400);
    expect(c.status).toBe(400);
  });
});

describe('POST /api/tickets/:id/decision', () => {
  it('201 al aceptar y 409 al repetir', async () => {
    const ticket = crearTicket(bd, { tecnico_id: idUsuario(bd, 'tecnico2') });
    const decision = {
      categoria_final_id: idCategoria(bd, 'Red'),
      prioridad_final: 'Crítica',
      grupo_final_id: idGrupo(bd, 'Redes y conectividad'),
      tecnico_id: idUsuario(bd, 'tecnico2'),
    };
    const agente = await sesion('agente');
    const r1 = await agente.post(`/api/tickets/${ticket}/decision`).send(decision);
    expect(r1.status).toBe(201);
    expect(r1.body).toMatchObject({ aceptada_sin_correccion: true, correcciones: [] });
    const r2 = await agente.post(`/api/tickets/${ticket}/decision`).send(decision);
    expect(r2.status).toBe(409);
  });

  it('404 si el ticket no existe, 400 si la decisión es inválida', async () => {
    const agente = await sesion('agente');
    const valida = { categoria_final_id: 1, prioridad_final: 'Alta', grupo_final_id: null, tecnico_id: null };
    expect((await agente.post('/api/tickets/999/decision').send(valida)).status).toBe(404);
    expect((await agente.post('/api/tickets/abc/decision').send(valida)).status).toBe(400);
    expect((await agente.post('/api/tickets/1/decision').send({ ...valida, prioridad_final: 'Urgente' })).status).toBe(400);
  });

  it('400 al asignar un técnico con grupo_final_id null', async () => {
    const ticket = crearTicket(bd, { tecnico_id: idUsuario(bd, 'tecnico2') });
    const decision = {
      categoria_final_id: idCategoria(bd, 'Red'),
      prioridad_final: 'Crítica',
      grupo_final_id: null,
      tecnico_id: idUsuario(bd, 'tecnico2'),
    };
    const agente = await sesion('agente');
    const r = await agente.post(`/api/tickets/${ticket}/decision`).send(decision);
    expect(r.status).toBe(400);
    expect(r.body).toEqual({ message: 'No se puede asignar un técnico sin grupo resolutor.' });
  });

  it('403 para técnico', async () => {
    const ticket = crearTicket(bd);
    const tecnico = await sesion('tecnico1');
    const r = await tecnico.post(`/api/tickets/${ticket}/decision`).send({});
    expect(r.status).toBe(403);
  });
});
