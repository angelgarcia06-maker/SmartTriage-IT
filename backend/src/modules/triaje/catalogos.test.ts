import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app } from '../../app';
import { db } from '../../db/connection';

const CLAVE = 'Cambiar123!';

async function sesion(usuario: string) {
  const agente = request.agent(app);
  const login = await agente.post('/api/auth/login').send({ usuario, password: CLAVE });
  expect(login.status).toBe(200);
  return agente;
}

describe('GET /api/triaje/catalogos', () => {
  it('requiere sesión y solo permite agentes o administradores', async () => {
    expect((await request(app).get('/api/triaje/catalogos')).status).toBe(401);
    expect((await (await sesion('tecnico1')).get('/api/triaje/catalogos')).status).toBe(403);
    expect((await (await sesion('agente')).get('/api/triaje/catalogos')).status).toBe(200);
    expect((await (await sesion('admin')).get('/api/triaje/catalogos')).status).toBe(200);
  });

  it('devuelve los catálogos activos de SQLite con los campos que consume PanelSugerencia', async () => {
    const r = await (await sesion('agente')).get('/api/triaje/catalogos');
    const categorias = db.prepare('SELECT id, nombre FROM categorias WHERE activa = 1 ORDER BY nombre').all();
    const grupos = db.prepare('SELECT id, nombre FROM grupos WHERE activo = 1 ORDER BY nombre').all();
    const tecnicos = db
      .prepare("SELECT id, nombre, grupo_id FROM usuarios WHERE rol = 'tecnico' AND activo = 1 ORDER BY nombre")
      .all();

    expect(r.body).toEqual({ categorias, grupos, tecnicos });
    expect(r.body.categorias.length).toBeGreaterThan(0);
    expect(r.body.grupos.length).toBeGreaterThan(0);
    expect(r.body.tecnicos.length).toBeGreaterThan(0);
  });
});
