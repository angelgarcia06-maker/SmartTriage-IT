import express, { type RequestHandler } from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { db } from '../../db/connection';
import { authRouter, crearAuthRouter } from './auth.routes';
import { buscarPorId, buscarPorUsuario } from './auth.repository';
import { aDtoPublico, obtenerUsuarioPorId, obtenerUsuarioPorUsuario } from './auth.service';

/**
 * Pruebas de AUTH-01.
 *
 * Corren contra una base SQLite EN MEMORIA con el seed aplicado
 * (`vitest.config.ts` + `src/test/setup.ts`). No usan ni modifican
 * `data/smarttriage.db`.
 */

/** Router por defecto: sin middlewares inyectados debe fallar cerrado. */
const appSinConfigurar = express();
appSinConfigurar.use('/api/auth', authRouter);

/** App de prueba con middlewares inyectados (simulan AUTH-02/AUTH-03). */
function crearAppProtegida(): express.Express {
  const app = express();
  const permitir: RequestHandler = (_req, _res, next) => next();
  app.use(
    '/api/auth',
    crearAuthRouter({ requiereAutenticacion: permitir, requiereAutorizacion: permitir }),
  );
  return app;
}

const app = crearAppProtegida();

afterEach(() => {
  vi.restoreAllMocks();
});

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

describe('AUTH-01: protección de rutas', () => {
  it('rechaza con 401 ambas rutas si no se inyectan middlewares', async () => {
    const porId = await request(appSinConfigurar).get('/api/auth/usuarios/1');
    const porNombre = await request(appSinConfigurar).get('/api/auth/usuarios/por-usuario/admin');
    expect(porId.status).toBe(401);
    expect(porNombre.status).toBe(401);
    expect(porId.body).toEqual({ error: 'No autenticado' });
  });

  it('no autentica con encabezados enviados por el cliente', async () => {
    const r = await request(appSinConfigurar)
      .get('/api/auth/usuarios/1')
      .set('authorization', 'Bearer admin')
      .set('x-usuario', 'admin')
      .set('x-test-usuario', '1:administrador');
    expect(r.status).toBe(401);
  });

  it('falla cerrado si solo se inyecta autenticación (falta autorización)', async () => {
    const permitir: RequestHandler = (_req, _res, next) => next();
    const soloAuth = express();
    soloAuth.use('/api/auth', crearAuthRouter({ requiereAutenticacion: permitir }));
    const r = await request(soloAuth).get('/api/auth/usuarios/1');
    expect(r.status).toBe(401);
  });

  it('permite el acceso cuando AUTH-02 y AUTH-03 están inyectados', async () => {
    const r = await request(app).get('/api/auth/usuarios/1');
    expect(r.status).toBe(200);
    expect(r.body.usuario).toBe('admin');
  });
});

describe('AUTH-01: búsquedas y contrato público', () => {
  it('la ruta por nombre devuelve 200 sin password_hash', async () => {
    const r = await request(app).get('/api/auth/usuarios/por-usuario/admin');
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ usuario: 'admin', rol: 'administrador', activo: true });
    expect(r.body).not.toHaveProperty('password_hash');
    expect(JSON.stringify(r.body)).not.toContain('password');
  });

  it('devuelve 404 para un usuario inexistente y 400 para un nombre vacío', async () => {
    expect((await request(app).get('/api/auth/usuarios/por-usuario/no-existe')).status).toBe(404);
    expect((await request(app).get('/api/auth/usuarios/por-usuario/%20')).status).toBe(400);
  });

  it('servicio y repositorio devuelven null/undefined ante búsquedas inexistentes', () => {
    expect(buscarPorId(999999)).toBeUndefined();
    expect(buscarPorUsuario('no-existe')).toBeUndefined();
    expect(obtenerUsuarioPorId(999999)).toBeNull();
    expect(obtenerUsuarioPorUsuario('no-existe')).toBeNull();
  });

  it('mantiene las consultas SQL parametrizadas (sin concatenar entrada)', () => {
    const sentencia = { get: vi.fn().mockReturnValue(undefined) };
    const spy = vi.spyOn(db, 'prepare').mockReturnValue(sentencia as unknown as ReturnType<typeof db.prepare>);
    const payload = "admin' OR '1'='1";

    expect(buscarPorUsuario(payload)).toBeUndefined();
    expect(buscarPorId(1)).toBeUndefined();

    expect(spy).toHaveBeenNthCalledWith(1, expect.stringContaining('WHERE usuario = ?'));
    expect(spy).toHaveBeenNthCalledWith(2, expect.stringContaining('WHERE id = ?'));
    expect(sentencia.get).toHaveBeenNthCalledWith(1, payload);
    expect(sentencia.get).toHaveBeenNthCalledWith(2, 1);
  });
});
