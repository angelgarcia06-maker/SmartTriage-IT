import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { authRouter, authRouterCompleto } from './auth.routes';
import { loginRequired, roleRequired } from './auth.middleware';
import { sessionMiddleware } from './session';

const CLAVE = 'Cambiar123!';

// Matriz de permisos de prueba (rutas simuladas, no son las de tickets).
const app = express();
app.use(express.json());
app.use(sessionMiddleware);
app.use('/api/auth', authRouter);
app.get('/api/_test/privada', loginRequired, (_req, res) => res.json({ ok: true }));
app.get('/api/_test/admin', roleRequired('administrador'), (_req, res) => res.json({ ok: true }));
app.get('/api/_test/tecnicos', roleRequired('tecnico', 'administrador'), (_req, res) => res.json({ ok: true }));
app.get('/api/_test/agentes', roleRequired('agente'), (_req, res) => res.json({ ok: true }));

// App con el router completo, para probar /usuarios con cada rol.
const appCompleta = express();
appCompleta.use(express.json());
appCompleta.use(sessionMiddleware);
appCompleta.use('/api/auth', authRouterCompleto);

async function sesionDe(a: express.Express, usuario: string) {
  const agente = request.agent(a);

  // Obtener token CSRF de la sesión inicial.
  const csrf = await agente.get('/api/auth/csrf');

  expect(csrf.status).toBe(200);

  // Iniciar sesión enviando el token.
  const r = await agente
    .post('/api/auth/login')
    .set('X-CSRF-Token', csrf.body.csrfToken)
    .send({ usuario, password: CLAVE });

  expect(r.status).toBe(200);
  return agente;
}

describe('AUTH-03: 401 sin sesión', () => {
  it('todas las rutas protegidas responden 401 sin login', async () => {
    for (const ruta of ['privada', 'admin', 'tecnicos', 'agentes']) {
      const r = await request(app).get(`/api/_test/${ruta}`);
      expect(r.status).toBe(401);
    }
  });

  it('/usuarios responde 401 sin sesión', async () => {
    expect((await request(appCompleta).get('/api/auth/usuarios/1')).status).toBe(401);
  });
});

describe('AUTH-03: matriz de roles', () => {
  it('administrador: accede a admin y técnicos, no a agentes', async () => {
    const a = await sesionDe(app, 'admin');
    expect((await a.get('/api/_test/privada')).status).toBe(200);
    expect((await a.get('/api/_test/admin')).status).toBe(200);
    expect((await a.get('/api/_test/tecnicos')).status).toBe(200);
    expect((await a.get('/api/_test/agentes')).status).toBe(403);
  });

  it('técnico: no puede acceder a operaciones de administrador (403)', async () => {
    const t = await sesionDe(app, 'tecnico1');
    expect((await t.get('/api/_test/privada')).status).toBe(200);
    expect((await t.get('/api/_test/tecnicos')).status).toBe(200);
    expect((await t.get('/api/_test/admin')).status).toBe(403);
    expect((await t.get('/api/_test/agentes')).status).toBe(403);
  });

  it('agente: solo accede a lo suyo, el resto da 403', async () => {
    const g = await sesionDe(app, 'agente');
    expect((await g.get('/api/_test/privada')).status).toBe(200);
    expect((await g.get('/api/_test/agentes')).status).toBe(200);
    expect((await g.get('/api/_test/admin')).status).toBe(403);
    expect((await g.get('/api/_test/tecnicos')).status).toBe(403);
  });
});

describe('AUTH-03: /usuarios con el router completo', () => {
  it('administrador puede consultar usuarios', async () => {
    const a = await sesionDe(appCompleta, 'admin');
    const r = await a.get('/api/auth/usuarios/1');
    expect(r.status).toBe(200);
    expect(r.body).not.toHaveProperty('password_hash');
  });

  it('un técnico llamando a la API recibe 403', async () => {
    const t = await sesionDe(appCompleta, 'tecnico1');
    expect((await t.get('/api/auth/usuarios/1')).status).toBe(403);
    expect((await t.get('/api/auth/usuarios/por-usuario/admin')).status).toBe(403);
  });

  it('un agente recibe 403', async () => {
    const g = await sesionDe(appCompleta, 'agente');
    expect((await g.get('/api/auth/usuarios/1')).status).toBe(403);
  });
});

describe('AUTH-03: seguridad del middleware', () => {
  it('no confía en encabezados enviados por el cliente', async () => {
    const r = await request(app)
      .get('/api/_test/admin')
      .set('x-rol', 'administrador')
      .set('authorization', 'Bearer admin');
    expect(r.status).toBe(401);
  });

  it('tras logout vuelve a dar 401', async () => {
  const a = await sesionDe(app, 'admin');

  // El login regeneró la sesión: obtener el token de la sesión actual.
  const csrf = await a.get('/api/auth/csrf');

  expect(csrf.status).toBe(200);

  const salida = await a
    .post('/api/auth/logout')
    .set('X-CSRF-Token', csrf.body.csrfToken);

  expect(salida.status).toBe(200);
  expect((await a.get('/api/_test/admin')).status).toBe(401);
});
});