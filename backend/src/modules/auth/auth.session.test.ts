import { afterAll, describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { db } from '../../db/connection';
import { authRouter } from './auth.routes';

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);

const CLAVE = 'Cambiar123!';

// Base en memoria (ver src/test/setup.ts): los usuarios de prueba se crean y
// eliminan aquí, sin afectar data/smarttriage.db.

describe('AUTH-02: login, logout y sesión', () => {
  afterAll(() => {
    db.prepare("DELETE FROM usuarios WHERE usuario = 'inactivo_test'").run();
  });

  it('login válido devuelve el DTO sin hash y fija cookie segura', async () => {
    const r = await request(app).post('/api/auth/login').send({ usuario: 'admin', password: CLAVE });
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

  it('conserva la sesión: /me devuelve el usuario', async () => {
    const agente = request.agent(app);
    await agente.post('/api/auth/login').send({ usuario: 'admin', password: CLAVE });
    const r = await agente.get('/api/auth/me');
    expect(r.status).toBe(200);
    expect(r.body.usuario).toBe('admin');
  });

  it('logout invalida la sesión y /me devuelve 401', async () => {
    const agente = request.agent(app);
    await agente.post('/api/auth/login').send({ usuario: 'admin', password: CLAVE });
    expect((await agente.post('/api/auth/logout')).status).toBe(200);
    expect((await agente.get('/api/auth/me')).status).toBe(401);
  });

  it('sin login, /me devuelve 401', async () => {
    expect((await request(app).get('/api/auth/me')).status).toBe(401);
  });

  it('credenciales inválidas dan 401 con el mismo mensaje (no filtra información)', async () => {
    const malaClave = await request(app).post('/api/auth/login').send({ usuario: 'admin', password: 'incorrecta' });
    const noExiste = await request(app).post('/api/auth/login').send({ usuario: 'fantasma', password: CLAVE });
    expect(malaClave.status).toBe(401);
    expect(noExiste.status).toBe(401);
    expect(malaClave.body).toEqual(noExiste.body);
  });

  it('rechaza usuarios inactivos (activo=0)', async () => {
    db.prepare("INSERT OR REPLACE INTO usuarios (nombre,usuario,password_hash,rol,activo) VALUES (?,?,?,?,0)")
      .run('Inactivo Test', 'inactivo_test', bcrypt.hashSync(CLAVE, 10), 'agente');
    const r = await request(app).post('/api/auth/login').send({ usuario: 'inactivo_test', password: CLAVE });
    expect(r.status).toBe(401);
  });

  it('regenera el id de sesión al autenticar', async () => {
    const agente = request.agent(app);
    const antes = await agente.get('/api/auth/me'); // sin login: no crea sesión
    expect(antes.status).toBe(401);
    const r1 = await agente.post('/api/auth/login').send({ usuario: 'admin', password: CLAVE });
    const r2 = await agente.post('/api/auth/login').send({ usuario: 'admin', password: CLAVE });
    expect(String(r1.headers['set-cookie'])).not.toEqual(String(r2.headers['set-cookie']));
  });

  it('validación: body vacío da 400', async () => {
    expect((await request(app).post('/api/auth/login').send({})).status).toBe(400);
  });
});