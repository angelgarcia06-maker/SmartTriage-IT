import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { db } from '../../db/connection';
import { authRouter } from './auth.routes';
import { usuariosRouter } from './usuarios.routes';

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);
app.use('/api/usuarios', usuariosRouter);

const CLAVE = 'Cambiar123!';
type Agente = ReturnType<typeof request.agent>;

const limpiar = () => db.prepare("DELETE FROM usuarios WHERE usuario LIKE 'zz_test_%'").run();
let contador = 0;
const nuevoNombre = () => `zz_test_${Date.now().toString(36)}_${contador++}`;

async function sesion(usuario: string, password = CLAVE) {
  const a: Agente = request.agent(app);

  const csrf = await a.get('/api/auth/csrf');

  const r = await a
    .post('/api/auth/login')
    .set('X-CSRF-Token', csrf.body.csrfToken)
    .send({ usuario, password });

  return { a, status: r.status };
}

describe('AUTH-04: administrar usuarios', { timeout: 20000 }, () => {
  let admin: Agente;
  let grupoId: number;
  let adminToken: string;

function postAdmin(url: string, datos: Record<string, unknown>) {
  return admin
    .post(url)
    .set('X-CSRF-Token', adminToken)
    .send(datos);
}

function patchAdmin(url: string, datos: Record<string, unknown>) {
  return admin
    .patch(url)
    .set('X-CSRF-Token', adminToken)
    .send(datos);
}
function deleteAdmin(url: string) {
  return admin
    .delete(url)
    .set('X-CSRF-Token', adminToken);
}
  async function crear(extra: Record<string, unknown> = {}) {
  const usuario = nuevoNombre();

  const r = await postAdmin('/api/usuarios', {
    nombre: 'Usuario Test',
    usuario,
    password: CLAVE,
    rol: 'agente',
    ...extra,
  });

  return { usuario, r };
}

  beforeAll(async () => {
  limpiar();

  const resultado = await sesion('admin');

  expect(resultado.status).toBe(200);
  admin = resultado.a;

  // Obtener un token nuevo después de regenerar la sesión en el login.
  const csrf = await admin.get('/api/auth/csrf');

  expect(csrf.status).toBe(200);
  adminToken = csrf.body.csrfToken as string;

  const grupos = (await admin.get('/api/usuarios/grupos')).body as {
    id: number;
  }[];

  expect(grupos.length).toBeGreaterThan(0);
  grupoId = grupos[0]!.id;
});

  afterAll(() => {
    limpiar();
  });

  it('sin sesión da 401 y un técnico recibe 403', async () => {
    expect((await request(app).get('/api/usuarios')).status).toBe(401);
    const t = await sesion('tecnico1');
    expect((await t.a.get('/api/usuarios')).status).toBe(403);
    expect((await t.a.post('/api/usuarios').send({})).status).toBe(403);
  });

  it('el administrador lista usuarios sin password_hash', async () => {
    const r = await admin.get('/api/usuarios');
    expect(r.status).toBe(200);
    expect(r.body.length).toBeGreaterThan(0);
    expect(JSON.stringify(r.body)).not.toContain('hash');
  });

  it('alta: crea el usuario, guarda hash bcrypt y puede iniciar sesión', async () => {
    const { usuario, r } = await crear();
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ usuario, rol: 'agente', activo: true, grupo_id: null });
    expect(JSON.stringify(r.body)).not.toContain('hash');

    const fila = db.prepare('SELECT password_hash FROM usuarios WHERE usuario = ?').get(usuario) as {
      password_hash: string;
    };
    expect(fila.password_hash).toMatch(/^\$2[aby]\$/);
    expect(fila.password_hash).not.toBe(CLAVE);
    expect((await sesion(usuario)).status).toBe(200);
  });

  it('rechaza usuarios duplicados (también con otras mayúsculas)', async () => {
  const { usuario } = await crear();

  const igual = await postAdmin('/api/usuarios', {
    nombre: 'X',
    usuario,
    password: CLAVE,
    rol: 'agente',
  });

  const mayus = await postAdmin('/api/usuarios', {
    nombre: 'X',
    usuario: usuario.toUpperCase(),
    password: CLAVE,
    rol: 'agente',
  });

  expect(igual.status).toBe(409);
  expect(mayus.status).toBe(409);
});

  it('valida los datos: contraseña corta, rol inválido y campos no permitidos', async () => {
  const base = {
    nombre: 'X',
    usuario: nuevoNombre(),
    password: CLAVE,
    rol: 'agente',
  };

  expect(
    (await postAdmin('/api/usuarios', {
      ...base,
      password: 'corta',
    })).status,
  ).toBe(400);

  expect(
    (await postAdmin('/api/usuarios', {
      ...base,
      rol: 'root',
    })).status,
  ).toBe(400);

  expect(
    (await postAdmin('/api/usuarios', {
      ...base,
      password_hash: 'x',
    })).status,
  ).toBe(400);

  expect(
    (await postAdmin('/api/usuarios', {
      ...base,
      usuario: 'a b',
    })).status,
  ).toBe(400);
});

  it('solo los técnicos pertenecen a un grupo activo y existente', async () => {
    expect((await crear({ rol: 'tecnico' })).r.status).toBe(400); // técnico sin grupo
    expect((await crear({ rol: 'tecnico', grupo_id: 999999 })).r.status).toBe(400); // grupo inexistente
    expect((await crear({ rol: 'agente', grupo_id: grupoId })).r.status).toBe(400); // agente con grupo
    const ok = await crear({ rol: 'tecnico', grupo_id: grupoId });
    expect(ok.r.status).toBe(201);
    expect(ok.r.body.grupo_id).toBe(grupoId);
  });

 it('actualización: cambia el nombre; 404 si no existe; 400 si el cuerpo está vacío', async () => {
  const { r } = await crear();
  const id = r.body.id as number;

  const up = await patchAdmin(`/api/usuarios/${id}`, {
    nombre: 'Nombre Nuevo',
  });

  expect(up.status).toBe(200);
  expect(up.body.nombre).toBe('Nombre Nuevo');

  expect(
    (await patchAdmin('/api/usuarios/999999', { nombre: 'X' })).status,
  ).toBe(404);

  expect(
    (await patchAdmin(`/api/usuarios/${id}`, {})).status,
  ).toBe(400);

  expect(
    (await patchAdmin('/api/usuarios/abc', { nombre: 'X' })).status,
  ).toBe(400);
});

  it('al dejar de ser técnico se limpia el grupo; no se puede repetir el usuario al editar', async () => {
  const tec = await crear({ rol: 'tecnico', grupo_id: grupoId });
  const otro = await crear();

  const aAgente = await patchAdmin(`/api/usuarios/${tec.r.body.id}`, {
    rol: 'agente',
  });

  expect(aAgente.status).toBe(200);
  expect(aAgente.body.grupo_id).toBeNull();

  const dup = await patchAdmin(`/api/usuarios/${otro.r.body.id}`, {
    usuario: tec.usuario,
  });

  expect(dup.status).toBe(409);
});

  it('restablecer contraseña: la nueva funciona y la anterior deja de servir', async () => {
  const { usuario, r } = await crear();

  const up = await patchAdmin(`/api/usuarios/${r.body.id}`, {
    password: 'NuevaClave456!',
  });

  expect(up.status).toBe(200);
  expect(JSON.stringify(up.body)).not.toContain('hash');

  expect((await sesion(usuario, 'NuevaClave456!')).status).toBe(200);
  expect((await sesion(usuario, CLAVE)).status).toBe(401);
});

  it('desactivar (activo=0) conserva la fila y el usuario ya no puede autenticarse', async () => {
    const { usuario, r } = await crear();
    const off = await patchAdmin(`/api/usuarios/${r.body.id}`, {
  activo: false,
});
    expect(off.status).toBe(200);
    expect(off.body.activo).toBe(false);

    const fila = db.prepare('SELECT activo FROM usuarios WHERE usuario = ?').get(usuario) as
      | { activo: number }
      | undefined;
    expect(fila?.activo).toBe(0); // sigue existiendo, solo inactivo
    expect((await sesion(usuario)).status).toBe(401);

    await patchAdmin(`/api/usuarios/${r.body.id}`, {
  activo: true,
});
    expect((await sesion(usuario)).status).toBe(200);
  });

  it('desactivar corta la sesión que ya estaba abierta', async () => {
    const { usuario, r } = await crear();
    const s = await sesion(usuario);
    expect((await s.a.get('/api/auth/me')).status).toBe(200);
    await patchAdmin(`/api/usuarios/${r.body.id}`, {
  activo: false,
});
    expect((await s.a.get('/api/auth/me')).status).toBe(401);
  });

  it('no existe DELETE y el administrador no puede desactivarse a sí mismo', async () => {
  const { r } = await crear();

  expect(
    (await deleteAdmin(`/api/usuarios/${r.body.id}`)).status,
  ).toBe(404);

  const yo = (await admin.get('/api/auth/me')).body.id as number;

  expect(
    (await patchAdmin(`/api/usuarios/${yo}`, { activo: false })).status,
  ).toBe(409);

  expect(
    (await patchAdmin(`/api/usuarios/${yo}`, { rol: 'agente' })).status,
  ).toBe(409);
});
});