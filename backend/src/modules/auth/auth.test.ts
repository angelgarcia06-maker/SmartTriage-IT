import { describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { buscarPorId, buscarPorUsuario } from './auth.repository';
import { aDtoPublico } from './auth.service';
import { authRouter } from './auth.routes';

const app = express();
app.use('/api/auth', authRouter);

describe('AUTH-01: usuarios', () => {
  it('encuentra un usuario sembrado por nombre de usuario', () => {
    const u = buscarPorUsuario('admin');
    expect(u).toBeDefined();
    expect(u?.usuario).toBe('admin');
    expect(u?.rol).toBe('administrador');
  });

  it('encuentra el mismo usuario por id', () => {
    const porNombre = buscarPorUsuario('admin')!;
    const porId = buscarPorId(porNombre.id);
    expect(porId?.usuario).toBe('admin');
  });

  it('el DTO público no incluye password_hash', () => {
    const dto = aDtoPublico(buscarPorUsuario('admin')!);
    expect('password_hash' in dto).toBe(false);
  });

  it('la API devuelve el usuario sin password_hash', async () => {
    const id = buscarPorUsuario('admin')!.id;
    const r = await request(app).get(`/api/auth/usuarios/${id}`);
    expect(r.status).toBe(200);
    expect(r.body.usuario).toBe('admin');
    expect(r.body).not.toHaveProperty('password_hash');
    expect(JSON.stringify(r.body)).not.toContain('password');
  });

  it('devuelve 404 si el usuario no existe y 400 si el id es inválido', async () => {
    expect((await request(app).get('/api/auth/usuarios/999999')).status).toBe(404);
    expect((await request(app).get('/api/auth/usuarios/abc')).status).toBe(400);
  });

  it('una entrada maliciosa no rompe la consulta (parametrizada)', () => {
    expect(buscarPorUsuario("admin' OR '1'='1")).toBeUndefined();
  });
});