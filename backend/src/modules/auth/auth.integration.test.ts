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
      const r = await agente.post('/api/triaje/sugerir').send(solicitud);
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
    const impacto = await agente.post('/api/triaje/sugerir').send({ ...solicitud, impacto: 'Extremo' });
    const urgencia = await agente.post('/api/triaje/sugerir').send({ ...solicitud, urgencia: 'Inmediata' });
    const descripcion = await agente.post('/api/triaje/sugerir').send({ ...solicitud, descripcion: '  ' });
    expect(impacto.status).toBe(400);
    expect(urgencia.status).toBe(400);
    expect(descripcion.status).toBe(400);
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
