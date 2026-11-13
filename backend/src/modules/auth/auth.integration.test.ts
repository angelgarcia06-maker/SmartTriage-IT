import { describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { app } from '../../app';
import { DATABASE_PATH, db, ES_BASE_EN_MEMORIA } from '../../db/connection';
import { authRouter } from './auth.routes';
import { loginRequired } from './auth.middleware';
import { sessionMiddleware } from './session';

/**
 * Pruebas de integración de AUTH sobre la app real (`app.ts`): rutas montadas,
 * sesión real, autorización por roles y protección CSRF.
 *
 * Gracias a `vitest.config.ts` + `src/test/setup.ts`, todo corre contra una base
 * SQLite EN MEMORIA: nunca se toca `data/smarttriage.db`.
 */

const CLAVE = 'Cambiar123!';

async function sesion(usuario: string) {
  const agente = request.agent(app);

  const csrf = await agente.get('/api/auth/csrf');
  expect(csrf.status).toBe(200);

  const r = await agente
    .post('/api/auth/login')
    .set('X-CSRF-Token', csrf.body.csrfToken)
    .send({ usuario, password: CLAVE });

  expect(r.status).toBe(200);
  return agente;
}

describe('Integración AUTH en app.ts', () => {
  it('las pruebas usan una base aislada, no data/smarttriage.db', () => {
    expect(ES_BASE_EN_MEMORIA).toBe(true);
    expect(DATABASE_PATH).toBe(':memory:');
    expect(DATABASE_PATH).not.toContain('smarttriage.db');
  });

  it('/api/health se conserva y responde con la base conectada', async () => {
    const r = await request(app).get('/api/health');
    expect(r.status).toBe(200);
    expect(r.body.database).toBe('SQLite conectada');
  });

  it('login real con el administrador de demostración y /me conserva la sesión', async () => {
    const a = await sesion('admin');
    const r = await a.get('/api/auth/me');
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ usuario: 'admin', rol: 'administrador' });
    expect(JSON.stringify(r.body)).not.toContain('hash');
  });

  it('gestión de usuarios: 401 sin sesión; 403 agente/técnico; 200 administrador', async () => {
    expect((await request(app).get('/api/usuarios')).status).toBe(401);

    const agente = await sesion('agente');
    const tecnico = await sesion('tecnico1');
    expect((await agente.get('/api/usuarios')).status).toBe(403);
    expect((await tecnico.get('/api/usuarios')).status).toBe(403);

    const admin = await sesion('admin');
    const r = await admin.get('/api/usuarios');
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body)).toBe(true);
    expect(JSON.stringify(r.body)).not.toContain('hash');
  });

  it('la gestión de usuarios ignora encabezados de identidad del cliente', async () => {
    const r = await request(app)
      .get('/api/usuarios')
      .set('x-usuario', 'admin')
      .set('x-rol', 'administrador')
      .set('authorization', 'Bearer admin');
    expect(r.status).toBe(401);
  });
});

describe('Integración Triaje con la sesión de AUTH', () => {
  const solicitud = {
    titulo: 'Sin conexión',
    descripcion: 'No me conecta el wifi',
    impacto: 'Alto',
    urgencia: 'Alta',
  };

  it('sugiere para agente y administrador con la sesión persistente', async () => {
    const ticketsAntes = (db.prepare('SELECT COUNT(*) AS total FROM tickets').get() as { total: number }).total;
    for (const [usuario, rol] of [['agente', 'agente'], ['admin', 'administrador']]) {
      const agente = await sesion(usuario);
      const token = (await agente.get('/api/auth/csrf')).body.csrfToken as string;
      const r = await agente.post('/api/triaje/sugerir').set('X-CSRF-Token', token).send(solicitud);
      expect(r.status).toBe(200);
      expect(r.body).toMatchObject({
        categoria: 'Red',
        prioridad: 'Crítica',
        grupo_id: expect.any(Number),
        tecnico_id: expect.any(Number),
      });
      expect((await agente.get('/api/auth/me')).body.rol).toBe(rol);
    }
    const ticketsDespues = (db.prepare('SELECT COUNT(*) AS total FROM tickets').get() as { total: number }).total;
    expect(ticketsDespues).toBe(ticketsAntes);
  });

  it('rechaza sin sesión (401), con rol técnico (403) y no acepta encabezados de identidad', async () => {
    expect((await request(app).post('/api/triaje/sugerir').send(solicitud)).status).toBe(401);
    const tecnico = await sesion('tecnico1');
    expect((await tecnico.post('/api/triaje/sugerir').send(solicitud)).status).toBe(403);
    const encabezados = await request(app)
      .post('/api/triaje/sugerir')
      .set('x-usuario', 'admin')
      .set('x-rol', 'administrador')
      .set('authorization', 'Bearer admin')
      .send(solicitud);
    expect(encabezados.status).toBe(401);
  });

  it('valida impacto, urgencia y descripción', async () => {
    const agente = await sesion('agente');
    const token = (await agente.get('/api/auth/csrf')).body.csrfToken as string;
    const impacto = await agente.post('/api/triaje/sugerir').set('X-CSRF-Token', token).send({ ...solicitud, impacto: 'Extremo' });
    const urgencia = await agente.post('/api/triaje/sugerir').set('X-CSRF-Token', token).send({ ...solicitud, urgencia: 'Inmediata' });
    const descripcion = await agente.post('/api/triaje/sugerir').set('X-CSRF-Token', token).send({ ...solicitud, descripcion: '  ' });
    expect(impacto.status).toBe(400);
    expect(urgencia.status).toBe(400);
    expect(descripcion.status).toBe(400);
  });
});

describe('Integración Tickets con AUTH-05', () => {
  const nuevoTicket = {
    solicitante: 'Prueba de integración',
    titulo: 'Conexión WiFi intermitente',
    descripcion: 'La conexión wifi se pierde en la sala de reuniones.',
    impacto: 'Alto',
    urgencia: 'Alta',
  };

  it('requiere sesión y token CSRF, y registra la sugerencia real de Triaje', async () => {
    expect((await request(app).post('/api/tickets').send(nuevoTicket)).status).toBe(401);

    const agente = await sesion('agente');
    expect((await agente.post('/api/tickets').send(nuevoTicket)).status).toBe(403);

    const csrf = await agente.get('/api/auth/csrf');
    expect(csrf.status).toBe(200);
    const creado = await agente
      .post('/api/tickets')
      .set('X-CSRF-Token', csrf.body.csrfToken)
      .send(nuevoTicket);

    expect(creado.status).toBe(201);
    expect(creado.body).toMatchObject({
      id: expect.any(Number),
      sugerencia: {
        categoria: 'Red',
        prioridad: 'Crítica',
        grupo_id: expect.any(Number),
        tecnico_id: expect.any(Number),
      },
    });
    const detalle = await agente.get(`/api/tickets/${creado.body.id}`);
    expect(detalle.status).toBe(200);
    expect(detalle.body).toMatchObject({
      titulo: nuevoTicket.titulo,
      estado: 'Nuevo',
      categoria_sugerida: 'Red',
    });
    const sinToken = await agente
      .patch(`/api/tickets/${creado.body.id}/estado`)
      .send({ estado: 'Asignado' });
    const conToken = await agente
      .patch(`/api/tickets/${creado.body.id}/estado`)
      .set('X-CSRF-Token', csrf.body.csrfToken)
      .send({ estado: 'Asignado' });
    expect(sinToken.status).toBe(403);
    expect(conToken.status).toBe(200);
  });

  it('recupera, confirma y audita la decisión sin permitir duplicados', async () => {
    const agente = await sesion('agente');
    const token = (await agente.get('/api/auth/csrf')).body.csrfToken as string;
    const alta = await agente
      .post('/api/tickets')
      .set('X-CSRF-Token', token)
      .send(nuevoTicket);
    expect(alta.status).toBe(201);
    const ticketId = alta.body.id as number;
    const sugerencia = alta.body.sugerencia;
    expect(sugerencia.tecnico_id).toBeTruthy();

    const tecnico = await sesion('tecnico2');
    const detalleTecnico = await tecnico.get(`/api/tickets/${ticketId}/decision`);
    expect(detalleTecnico.status).toBe(200);
    expect(detalleTecnico.body).toMatchObject({
      pendiente: true,
      sugerencia: { tecnico_id: sugerencia.tecnico_id },
    });
    expect((await tecnico.get('/api/triaje/catalogos')).status).toBe(403);

    const decision = {
      categoria_final_id: sugerencia.categoria_id,
      prioridad_final: sugerencia.prioridad,
      grupo_final_id: sugerencia.grupo_id,
      tecnico_id: null,
    };
    const pendiente = await agente.get(`/api/tickets/${ticketId}/decision`);
    expect(pendiente.body.pendiente).toBe(true);

    const sinToken = await agente.post(`/api/tickets/${ticketId}/decision`).send(decision);
    expect(sinToken.status).toBe(403);
    const confirmada = await agente
      .post(`/api/tickets/${ticketId}/decision`)
      .set('X-CSRF-Token', token)
      .send(decision);
    expect(confirmada.status).toBe(201);
    expect(confirmada.body.correcciones).toEqual([
      expect.objectContaining({ campo: 'tecnico', valor_sugerido: String(sugerencia.tecnico_id), valor_final: 'ninguno' }),
    ]);

    const detalleFinal = await agente.get(`/api/tickets/${ticketId}/decision`);
    expect(detalleFinal.body).toMatchObject({
      pendiente: false,
      sugerencia: { tecnico_id: sugerencia.tecnico_id },
      decision: { tecnico_id: null },
    });
    const historial = await agente.get(`/api/tickets/${ticketId}/historial`);
    expect(historial.body.historial).toHaveLength(1);
    expect(historial.body.historial[0]).toMatchObject({
      accion: 'Sugerencia de triaje corregida',
      valor_nuevo: JSON.stringify(decision),
    });

    const segundaDecision = await agente
      .post(`/api/tickets/${ticketId}/decision`)
      .set('X-CSRF-Token', token)
      .send(decision);
    expect(segundaDecision.status).toBe(409);
    expect((await agente.get(`/api/tickets/${ticketId}/historial`)).body.historial).toHaveLength(1);
  });

  it('impide que técnicos creen tickets aunque tengan sesión y token', async () => {
    const tecnico = await sesion('tecnico1');
    const csrf = await tecnico.get('/api/auth/csrf');
    const respuesta = await tecnico
      .post('/api/tickets')
      .set('X-CSRF-Token', csrf.body.csrfToken)
      .send(nuevoTicket);
    expect(respuesta.status).toBe(403);
  });
});

describe('Protección CSRF (verificación de origen)', () => {
  it('rechaza login desde un origen ajeno (403)', async () => {
    const r = await request(app)
      .post('/api/auth/login')
      .set('Origin', 'http://malicioso.example')
      .send({ usuario: 'admin', password: CLAVE });
    expect(r.status).toBe(403);
  });

  it('permite login desde el origen del frontend', async () => {
  const agente = request.agent(app);

  const csrf = await agente.get('/api/auth/csrf');
  expect(csrf.status).toBe(200);

  const r = await agente
    .post('/api/auth/login')
    .set('Origin', 'http://localhost:5173')
    .set('X-CSRF-Token', csrf.body.csrfToken)
    .send({ usuario: 'admin', password: CLAVE });

  expect(r.status).toBe(200);
});

  it('rechaza una escritura administrativa desde un origen ajeno (403)', async () => {
  const admin = await sesion('admin');

  const csrf = await admin.get('/api/auth/csrf');
  expect(csrf.status).toBe(200);

  const r = await admin
    .post('/api/usuarios')
    .set('X-CSRF-Token', csrf.body.csrfToken)
    .set('Origin', 'http://malicioso.example')
    .send({
      nombre: 'CSRF Test',
      usuario: 'zz_csrf_test',
      password: CLAVE,
      rol: 'agente',
    });

  expect(r.status).toBe(403);
});

  it('rechaza una sugerencia de triaje desde un origen ajeno (403)', async () => {
    const agente = await sesion('agente');
    const r = await agente
      .post('/api/triaje/sugerir')
      .set('Origin', 'http://malicioso.example')
      .send({ descripcion: 'No funciona wifi', impacto: 'Alto', urgencia: 'Alta' });
    expect(r.status).toBe(403);
  });

  it('los métodos seguros (GET) no exigen comprobación de origen', async () => {
    const r = await request(app).get('/api/health').set('Origin', 'http://malicioso.example');
    expect(r.status).toBe(200);
  });
});

describe('Contrato de identidad compartido (Triaje / Tickets / Admin)', () => {
  // Router que imita al de Triaje: obtiene la identidad desde la sesión del servidor.
  const appContrato = express();
  appContrato.use(express.json());
  appContrato.use(sessionMiddleware);
  appContrato.use('/api/auth', authRouter);
  appContrato.post('/api/triaje/sugerir', loginRequired, (req, res) => {
    res.json({
      id: res.locals.usuario.id,
      rol: res.locals.usuario.rol,
      // Evidencia de que NO se guarda una copia obsoleta del usuario en la sesión.
      estructuraAntigua: (req.session as unknown as { usuario?: unknown }).usuario ?? null,
    });
  });

  it('rechaza sin sesión (401)', async () => {
    expect((await request(appContrato).post('/api/triaje/sugerir').send({})).status).toBe(401);
  });

  it('resuelve el usuario desde req.session.userId, sin copia en la sesión', async () => {
    const agente = request.agent(appContrato);

const csrf = await agente.get('/api/auth/csrf');
expect(csrf.status).toBe(200);

const login = await agente
  .post('/api/auth/login')
  .set('X-CSRF-Token', csrf.body.csrfToken)
  .send({ usuario: 'agente', password: CLAVE });

expect(login.status).toBe(200);
    const r = await agente
      .post('/api/triaje/sugerir')
      .send({ descripcion: 'No me conecta el wifi', impacto: 'Alto', urgencia: 'Alta' });
    expect(r.status).toBe(200);
    expect(r.body.rol).toBe('agente');
    expect(r.body.estructuraAntigua).toBeNull();
  });

  it('no acepta encabezados de identidad del cliente en rutas de otros módulos', async () => {
    const r = await request(appContrato)
      .post('/api/triaje/sugerir')
      .set('x-usuario', 'admin')
      .set('x-rol', 'administrador')
      .set('authorization', 'Bearer admin')
      .send({ descripcion: 'x', impacto: 'Alto', urgencia: 'Alta' });
    expect(r.status).toBe(401);
  });
});
