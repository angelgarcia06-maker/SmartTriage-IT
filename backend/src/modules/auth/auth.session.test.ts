
import { afterAll, describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { db } from '../../db/connection';
import { authRouter } from './auth.routes';
import { SqliteSessionStore } from './sqlite-session-store';
import { sessionMiddleware } from './session';

const app = express();
app.use(express.json());
app.use(sessionMiddleware);
app.use('/api/auth', authRouter);

const CLAVE = 'Cambiar123!';

type TestAgent = ReturnType<typeof request.agent>;

/** Obtiene un token CSRF conservando la cookie de sesión del agente. */
async function obtenerTokenCsrf(agente: TestAgent): Promise<string> {
  const respuesta = await agente.get('/api/auth/csrf');

  expect(respuesta.status).toBe(200);
  expect(respuesta.headers['cache-control']).toBe('no-store');
  expect(respuesta.body.csrfToken).toMatch(/^[a-f0-9]{64}$/);

  return respuesta.body.csrfToken as string;
}

describe('AUTH-05: seguridad de sesiones y CSRF', () => {

  afterAll(() => {
    db.prepare("DELETE FROM usuarios WHERE usuario = 'inactivo_test'").run();
  });

  it('login válido devuelve DTO sin hash y cookie protegida', async () => {
    const agente = request.agent(app);
    const token = await obtenerTokenCsrf(agente);

    const r = await agente
      .post('/api/auth/login')
      .set('X-CSRF-Token', token)
      .send({ usuario: 'admin', password: CLAVE });

    expect(r.status).toBe(200);
    expect(r.body).toEqual({
      id: expect.any(Number),
      nombre: expect.any(String),
      usuario: 'admin',
      rol: 'administrador',
      grupo_id: null,
    });

    expect(JSON.stringify(r.body)).not.toContain('hash');

    const cookie = String(r.headers['set-cookie']);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
  });

  it('obtiene un token CSRF válido asociado a la sesión', async () => {
    const agente = request.agent(app);

    const token = await obtenerTokenCsrf(agente);

    expect(token).toHaveLength(64);
  });

  it('rechaza login cuando falta el token CSRF', async () => {
    const r = await request(app)
      .post('/api/auth/login')
      .send({ usuario: 'admin', password: CLAVE });

    expect(r.status).toBe(403);
    expect(r.body.error).toContain('CSRF');
  });

  it('rechaza login cuando el token CSRF es incorrecto', async () => {
    const agente = request.agent(app);
    await obtenerTokenCsrf(agente);

    const r = await agente
      .post('/api/auth/login')
      .set('X-CSRF-Token', '0'.repeat(64))
      .send({ usuario: 'admin', password: CLAVE });

    expect(r.status).toBe(403);
  });

  it('conserva la sesión: /me devuelve el usuario', async () => {
    const agente = request.agent(app);
    const token = await obtenerTokenCsrf(agente);

    const login = await agente
      .post('/api/auth/login')
      .set('X-CSRF-Token', token)
      .send({ usuario: 'admin', password: CLAVE });

    expect(login.status).toBe(200);

    const r = await agente.get('/api/auth/me');

    expect(r.status).toBe(200);
    expect(r.body.usuario).toBe('admin');
  });

  it('logout invalida la sesión y /me devuelve 401', async () => {
    const agente = request.agent(app);
    let token = await obtenerTokenCsrf(agente);

    const login = await agente
      .post('/api/auth/login')
      .set('X-CSRF-Token', token)
      .send({ usuario: 'admin', password: CLAVE });

    expect(login.status).toBe(200);

    // El login regenera la sesión, por eso obtenemos otro token.
    token = await obtenerTokenCsrf(agente);

    const salida = await agente
      .post('/api/auth/logout')
      .set('X-CSRF-Token', token);

    expect(salida.status).toBe(200);
    expect((await agente.get('/api/auth/me')).status).toBe(401);
  });

  it('rechaza logout cuando falta el token CSRF', async () => {
    const agente = request.agent(app);
    let token = await obtenerTokenCsrf(agente);

    await agente
      .post('/api/auth/login')
      .set('X-CSRF-Token', token)
      .send({ usuario: 'admin', password: CLAVE });

    const r = await agente.post('/api/auth/logout');

    expect(r.status).toBe(403);
  });

  it('sin login, /me devuelve 401', async () => {
    expect((await request(app).get('/api/auth/me')).status).toBe(401);
  });

  it('credenciales inválidas dan 401 sin filtrar información', async () => {
    const agente = request.agent(app);
    const token = await obtenerTokenCsrf(agente);

    const malaClave = await agente
      .post('/api/auth/login')
      .set('X-CSRF-Token', token)
      .send({ usuario: 'admin', password: 'incorrecta' });

    const noExiste = await agente
      .post('/api/auth/login')
      .set('X-CSRF-Token', token)
      .send({ usuario: 'fantasma', password: CLAVE });

    expect(malaClave.status).toBe(401);
    expect(noExiste.status).toBe(401);
    expect(malaClave.body).toEqual(noExiste.body);
  });

  it('rechaza usuarios inactivos (activo=0)', async () => {
    db.prepare(
      "INSERT OR REPLACE INTO usuarios (nombre,usuario,password_hash,rol,activo) VALUES (?,?,?,?,0)",
    ).run(
      'Inactivo Test',
      'inactivo_test',
      bcrypt.hashSync(CLAVE, 10),
      'agente',
    );

    const agente = request.agent(app);
    const token = await obtenerTokenCsrf(agente);

    const r = await agente
      .post('/api/auth/login')
      .set('X-CSRF-Token', token)
      .send({ usuario: 'inactivo_test', password: CLAVE });

    expect(r.status).toBe(401);
  });

  it('regenera el identificador de sesión al autenticar', async () => {
    const agente = request.agent(app);
    let token = await obtenerTokenCsrf(agente);

    const r1 = await agente
      .post('/api/auth/login')
      .set('X-CSRF-Token', token)
      .send({ usuario: 'admin', password: CLAVE });

    expect(r1.status).toBe(200);

    token = await obtenerTokenCsrf(agente);

    const r2 = await agente
      .post('/api/auth/login')
      .set('X-CSRF-Token', token)
      .send({ usuario: 'admin', password: CLAVE });

    expect(r2.status).toBe(200);
    expect(String(r1.headers['set-cookie'])).not.toEqual(
      String(r2.headers['set-cookie']),
    );
  });

  it('validación: body vacío da 400', async () => {
    const agente = request.agent(app);
    const token = await obtenerTokenCsrf(agente);

    const r = await agente
      .post('/api/auth/login')
      .set('X-CSRF-Token', token)
      .send({});

    expect(r.status).toBe(400);
  });

  it('elimina una sesión expirada del almacenamiento SQLite', async () => {
    const store = new SqliteSessionStore();
    const sid = 'auth05-sesion-expirada-test';

    db.prepare(
      'INSERT OR REPLACE INTO sessions (sid, sess, expire) VALUES (?, ?, ?)',
    ).run(sid, JSON.stringify({ cookie: {} }), Date.now() - 1000);

    const resultado = await new Promise<unknown>((resolve, reject) => {
      store.get(sid, (error, sesion) => {
        if (error) return reject(error);
        resolve(sesion ?? null);
      });
    });

    expect(resultado).toBeNull();

    const fila = db.prepare(
      'SELECT sid FROM sessions WHERE sid = ?',
    ).get(sid);

    expect(fila).toBeUndefined();
  });
});
