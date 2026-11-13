
import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

// Base SQLite temporal para no modificar los datos del proyecto
vi.mock('../../db/connection', async () => {
  const { default: Database } = await import('better-sqlite3');
  const db = new Database(':memory:');

  db.exec(`
    CREATE TABLE grupos (
      id INTEGER PRIMARY KEY,
      nombre TEXT NOT NULL,
      activo INTEGER NOT NULL
    );

    CREATE TABLE categorias (
      id INTEGER PRIMARY KEY,
      nombre TEXT NOT NULL,
      grupo_id INTEGER,
      activa INTEGER NOT NULL
    );

    INSERT INTO grupos VALUES
      (1, 'Soporte general', 1),
      (2, 'Aplicaciones', 1),
      (3, 'Grupo inactivo', 0);

    INSERT INTO categorias VALUES
      (1, 'Hardware', 1, 1),
      (2, 'Software', 2, 1),
      (3, 'Red', 1, 0),
      (4, 'Correo', 3, 1);
  `);

  return { db };
});

import { catalogosRouter } from './catalogos.routes';

const app = express();
app.use('/api/catalogos', catalogosRouter);

describe('ADM-01: Catálogos iniciales', () => {
  it('devuelve categorías activas de grupos activos', async () => {
    const respuesta = await request(app)
      .get('/api/catalogos/categorias');

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.map((c: { nombre: string }) => c.nombre))
      .toEqual(['Hardware', 'Software']);
    expect(respuesta.body[0].grupo_nombre)
      .toBe('Soporte general');
  });

  it('devuelve únicamente grupos activos', async () => {
    const respuesta = await request(app)
      .get('/api/catalogos/grupos');

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.map((g: { nombre: string }) => g.nombre))
      .toEqual(['Aplicaciones', 'Soporte general']);
  });
});
