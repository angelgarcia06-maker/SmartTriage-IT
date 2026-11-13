
import express, { type RequestHandler } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// SQLite temporal: no modifica smarttriage.db
vi.mock('../../db/connection', async () => {
  const { default: Database } = await import('better-sqlite3');
  const db = new Database(':memory:');

  db.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE grupos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL UNIQUE,
      activo INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE categorias (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL UNIQUE,
      grupo_id INTEGER REFERENCES grupos(id),
      activa INTEGER NOT NULL DEFAULT 1
    );
  `);

  return { db };
});

import { db } from '../../db/connection';
import { crearCatalogosCrudRouter } from './catalogos.crud.routes';

// Middleware simulado SOLO para pruebas
const autenticar: RequestHandler = (req, res, next) => {
  if (!req.header('x-test-role')) {
    res.status(401).json({ error: 'No autenticado' });
    return;
  }
  next();
};

const verificarAdministrador: RequestHandler = (req, res, next) => {
  if (req.header('x-test-role') !== 'administrador') {
    res.status(403).json({ error: 'Acceso denegado' });
    return;
  }
  next();
};

const app = express();
app.use(express.json());
app.use('/api/catalogos', crearCatalogosCrudRouter({
  requiereAutenticacion: autenticar,
  requiereAdministrador: verificarAdministrador
}));

const admin = (metodo: 'post' | 'patch', ruta: string) =>
  request(app)[metodo](ruta)
    .set('x-test-role', 'administrador');

beforeEach(() => {
  db.exec(`
    DELETE FROM categorias;
    DELETE FROM grupos;

    INSERT INTO grupos (id, nombre, activo) VALUES
      (1, 'Soporte general', 1),
      (2, 'Aplicaciones', 1),
      (3, 'Grupo inactivo', 0),
      (4, 'Laboratorio', 1);

    INSERT INTO categorias (id, nombre, grupo_id, activa)
    VALUES
      (1, 'Hardware', 1, 1),
      (2, 'Software', 2, 1);
  `);
});

describe('ADM-02: Seguridad administrativa', () => {
  it('bloquea operaciones si no hay middleware', async () => {
    const sinSeguridad = express();
    sinSeguridad.use(express.json());
    sinSeguridad.use(
      '/api/catalogos',
      crearCatalogosCrudRouter()
    );

    const respuesta = await request(sinSeguridad)
      .post('/api/catalogos/grupos')
      .send({ nombre: 'Nuevo grupo' });

    expect(respuesta.status).toBe(401);
  });

  it('rechaza usuarios no autenticados', async () => {
    const respuesta = await request(app)
      .post('/api/catalogos/grupos')
      .send({ nombre: 'Nuevo grupo' });

    expect(respuesta.status).toBe(401);
  });

  it('rechaza modificaciones de un agente', async () => {
    const operaciones = [
      request(app).post('/api/catalogos/grupos')
        .set('x-test-role', 'agente')
        .send({ nombre: 'Grupo nuevo' }),
      request(app).patch('/api/catalogos/grupos/1')
        .set('x-test-role', 'agente')
        .send({ nombre: 'Grupo cambiado' }),
      request(app).patch('/api/catalogos/categorias/1/desactivar')
        .set('x-test-role', 'agente')
    ];

    const respuestas = await Promise.all(operaciones);

    respuestas.forEach(respuesta => {
      expect(respuesta.status).toBe(403);
    });

    const categoria = db.prepare(
      'SELECT activa FROM categorias WHERE id = 1'
    ).get() as { activa: number };

    expect(categoria.activa).toBe(1);
  });
});

describe('ADM-02: CRUD de grupos', () => {
  it('permite crear grupos como administrador', async () => {
    const respuesta = await admin(
      'post', '/api/catalogos/grupos'
    ).send({ nombre: 'Infraestructura' });

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.nombre).toBe('Infraestructura');
  });

  it('rechaza nombres duplicados', async () => {
    const respuesta = await admin(
      'post', '/api/catalogos/grupos'
    ).send({ nombre: 'soporte GENERAL' });

    expect(respuesta.status).toBe(409);
  });

  it('permite editar un grupo activo', async () => {
    const respuesta = await admin(
      'patch', '/api/catalogos/grupos/4'
    ).send({ nombre: 'Soporte especializado' });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.nombre).toBe('Soporte especializado');
  });

  it('desactiva sin eliminar registros', async () => {
    const respuesta = await admin(
      'patch', '/api/catalogos/grupos/4/desactivar'
    );

    expect(respuesta.status).toBe(200);

    const grupo = db.prepare(
      'SELECT activo FROM grupos WHERE id = 4'
    ).get() as { activo: number };

    expect(grupo.activo).toBe(0);
  });

  it('impide desactivar grupos con categorías activas', async () => {
    const respuesta = await admin(
      'patch', '/api/catalogos/grupos/1/desactivar'
    );

    expect(respuesta.status).toBe(409);
  });
});

describe('ADM-02: CRUD de categorías', () => {
  it('permite crear una categoría válida', async () => {
    const respuesta = await admin(
      'post', '/api/catalogos/categorias'
    ).send({
      nombre: 'Impresoras',
      grupo_id: 1
    });

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.nombre).toBe('Impresoras');
  });

  it('rechaza categorías duplicadas', async () => {
    const respuesta = await admin(
      'post', '/api/catalogos/categorias'
    ).send({
      nombre: 'hardware',
      grupo_id: 1
    });

    expect(respuesta.status).toBe(409);
  });

  it('rechaza grupos inactivos', async () => {
    const respuesta = await admin(
      'post', '/api/catalogos/categorias'
    ).send({
      nombre: 'Seguridad',
      grupo_id: 3
    });

    expect(respuesta.status).toBe(400);
  });

  it('permite editar nombre y grupo', async () => {
    const respuesta = await admin(
      'patch', '/api/catalogos/categorias/1'
    ).send({
      nombre: 'Equipos informáticos',
      grupo_id: 2
    });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.grupo_id).toBe(2);
  });

  it('desactiva una categoría sin borrarla', async () => {
    const respuesta = await admin(
      'patch', '/api/catalogos/categorias/1/desactivar'
    );

    expect(respuesta.status).toBe(200);

    const categoria = db.prepare(
      'SELECT activa FROM categorias WHERE id = 1'
    ).get() as { activa: number };

    expect(categoria.activa).toBe(0);
  });
});
