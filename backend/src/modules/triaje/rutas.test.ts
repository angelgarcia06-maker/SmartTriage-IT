import type Database from 'better-sqlite3';
import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { crearBaseDePrueba, crearTicket, idCategoria, idGrupo, idUsuario } from './fixture';
import { crearRutasTriaje } from './rutas';

let bd: Database.Database;

/** App de prueba: simula la sesión de AUTH con la cabecera x-test-usuario (id:rol). */
function crearApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    const cabecera = req.header('x-test-usuario');
    if (cabecera) {
      const [id, rol] = cabecera.split(':');
      (req as unknown as { session: unknown }).session = { usuario: { id: Number(id), rol } };
    }
    next();
  });
  app.use('/api', crearRutasTriaje({ conexion: bd }));
  return app;
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
    const r = await request(crearApp()).post('/api/triaje/sugerir').set('x-test-usuario', '3:tecnico').send(cuerpo);
    expect(r.status).toBe(403);
  });

  it('200 para agente con la sugerencia completa', async () => {
    const r = await request(crearApp()).post('/api/triaje/sugerir').set('x-test-usuario', '2:agente').send(cuerpo);
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

  it('400 con impacto inválido o sin descripción', async () => {
    const app = crearApp();
    const a = await request(app).post('/api/triaje/sugerir').set('x-test-usuario', '1:administrador').send({ ...cuerpo, impacto: 'Altísimo' });
    const b = await request(app).post('/api/triaje/sugerir').set('x-test-usuario', '1:administrador').send({ ...cuerpo, descripcion: '  ' });
    expect(a.status).toBe(400);
    expect(b.status).toBe(400);
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
    const app = crearApp();
    const r1 = await request(app).post(`/api/tickets/${ticket}/decision`).set('x-test-usuario', '2:agente').send(decision);
    expect(r1.status).toBe(201);
    expect(r1.body).toMatchObject({ aceptada_sin_correccion: true, correcciones: [] });
    const r2 = await request(app).post(`/api/tickets/${ticket}/decision`).set('x-test-usuario', '2:agente').send(decision);
    expect(r2.status).toBe(409);
  });

  it('404 si el ticket no existe, 400 si la decisión es inválida', async () => {
    const app = crearApp();
    const valida = { categoria_final_id: 1, prioridad_final: 'Alta', grupo_final_id: null, tecnico_id: null };
    expect((await request(app).post('/api/tickets/999/decision').set('x-test-usuario', '2:agente').send(valida)).status).toBe(404);
    expect((await request(app).post('/api/tickets/abc/decision').set('x-test-usuario', '2:agente').send(valida)).status).toBe(400);
    expect((await request(app).post('/api/tickets/1/decision').set('x-test-usuario', '2:agente').send({ ...valida, prioridad_final: 'Urgente' })).status).toBe(400);
  });

  it('403 para técnico', async () => {
    const ticket = crearTicket(bd);
    const r = await request(crearApp()).post(`/api/tickets/${ticket}/decision`).set('x-test-usuario', '3:tecnico').send({});
    expect(r.status).toBe(403);
  });
});
