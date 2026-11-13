
import express, { type RequestHandler } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Base de datos temporal: no modifica smarttriage.db
vi.mock('../../db/connection', async () => {
  const { default: Database } = await import('better-sqlite3');
  const db = new Database(':memory:');

  db.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE categorias (
      id INTEGER PRIMARY KEY,
      nombre TEXT NOT NULL UNIQUE,
      grupo_id INTEGER,
      activa INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE palabras_clave (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      categoria_id INTEGER NOT NULL REFERENCES categorias(id),
      palabra TEXT NOT NULL,
      UNIQUE(categoria_id, palabra)
    );
  `);

  return { db };
});

import { db } from '../../db/connection';
import { crearDiccionarioRouter } from './diccionario.routes';

// Autenticación simulada SOLO para pruebas
const autenticar: RequestHandler = (req, res, next) => {
  if (!req.header('x-test-role')) {
    res.status(401).json({ error: 'No autenticado' });
    return;
  }
  next();
};

const verificarAdmin: RequestHandler = (req, res, next) => {
  if (req.header('x-test-role') !== 'administrador') {
    res.status(403).json({ error: 'Acceso denegado' });
    return;
  }
  next();
};

const app = express();
app.use(express.json());
app.use('/api/admin', crearDiccionarioRouter({
  requiereAutenticacion: autenticar,
  requiereAdministrador: verificarAdmin
}));

const admin = (
  metodo: 'get' | 'post' | 'patch' | 'delete',
  ruta: string
) => request(app)[metodo](ruta)
  .set('x-test-role', 'administrador');

beforeEach(() => {
  db.exec(`
    DELETE FROM palabras_clave;
    DELETE FROM categorias;

    INSERT INTO categorias (id, nombre, activa) VALUES
      (1, 'Hardware', 1),
      (2, 'Software', 1),
      (3, 'Otros', 1),
      (4, 'Red', 0);

    INSERT INTO palabras_clave
      (id, categoria_id, palabra) VALUES
      (1, 1, 'teclado'),
      (2, 1, 'pantalla'),
      (3, 2, 'programa');
  `);
});

describe('ADM-03: Seguridad', () => {
  it('bloquea rutas sin middleware configurado', async () => {
    const otraApp = express();
    otraApp.use(express.json());
    otraApp.use('/api/admin', crearDiccionarioRouter());

    const respuesta = await request(otraApp)
      .post('/api/admin/palabras-clave')
      .send({ palabra: 'proyector', categoria_id: 1 });

    expect(respuesta.status).toBe(401);
  });

  it('rechaza usuarios no autenticados', async () => {
    const respuesta = await request(app)
      .post('/api/admin/palabras-clave')
      .send({ palabra: 'proyector', categoria_id: 1 });

    expect(respuesta.status).toBe(401);
  });

  it('rechaza agentes sin permiso', async () => {
    const respuesta = await request(app)
      .delete('/api/admin/palabras-clave/1')
      .set('x-test-role', 'agente');

    expect(respuesta.status).toBe(403);
  });
});

describe('ADM-03: Diccionario editable', () => {
  it('consulta las palabras registradas', async () => {
    const respuesta = await admin(
      'get', '/api/admin/palabras-clave'
    );

    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toHaveLength(3);
  });

  it('agrega una palabra clave', async () => {
    const respuesta = await admin(
      'post', '/api/admin/palabras-clave'
    ).send({
      palabra: 'proyector',
      categoria_id: 1
    });

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.categoria).toBe('Hardware');
  });

  it('impide duplicados con mayúsculas y tildes', async () => {
    const respuesta = await admin(
      'post', '/api/admin/palabras-clave'
    ).send({
      palabra: 'TÉCLADO',
      categoria_id: 1
    });

    expect(respuesta.status).toBe(409);
  });

  it('rechaza categorías inactivas y Otros', async () => {
    for (const categoriaId of [3, 4]) {
      const respuesta = await admin(
        'post', '/api/admin/palabras-clave'
      ).send({
        palabra: 'proyector',
        categoria_id: categoriaId
      });

      expect(respuesta.status).toBe(400);
    }
  });

  it('edita una palabra y su categoría', async () => {
    const respuesta = await admin(
      'patch', '/api/admin/palabras-clave/1'
    ).send({
      palabra: 'aplicacion',
      categoria_id: 2
    });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.categoria).toBe('Software');

    const registro = db.prepare(`
      SELECT palabra, categoria_id
      FROM palabras_clave WHERE id = 1
    `).get() as {
      palabra: string;
      categoria_id: number;
    };

    expect(registro.palabra).toBe('aplicacion');
    expect(registro.categoria_id).toBe(2);
  });

  it('impide duplicados al editar', async () => {
    const respuesta = await admin(
      'patch', '/api/admin/palabras-clave/2'
    ).send({
      palabra: 'TÉCLADO',
      categoria_id: 1
    });

    expect(respuesta.status).toBe(409);
  });

  it('elimina una palabra del diccionario', async () => {
    const respuesta = await admin(
      'delete', '/api/admin/palabras-clave/1'
    );

    expect(respuesta.status).toBe(200);

    const registro = db.prepare(`
      SELECT id FROM palabras_clave WHERE id = 1
    `).get();

    expect(registro).toBeUndefined();
  });

  it('devuelve 404 si la palabra no existe', async () => {
    const respuesta = await admin(
      'delete', '/api/admin/palabras-clave/999'
    );

    expect(respuesta.status).toBe(404);
  });
});

describe('ADM-03: Probar frase', () => {
  it('refleja inmediatamente cambios en SQLite', async () => {
    const frase = 'Mi proyector no enciende';

    // Antes de agregar la palabra
    const antes = await admin(
      'post', '/api/admin/probar-frase'
    ).send({ frase });

    expect(antes.status).toBe(200);
    expect(antes.body.categoria).toBe('Otros');

    // Agregar palabra a Hardware
    const agregado = await admin(
      'post', '/api/admin/palabras-clave'
    ).send({
      palabra: 'proyector',
      categoria_id: 1
    });

    expect(agregado.status).toBe(201);

    // Probar nuevamente sin reiniciar servidor
    const despues = await admin(
      'post', '/api/admin/probar-frase'
    ).send({ frase });

    expect(despues.status).toBe(200);
    expect(despues.body.categoria).toBe('Hardware');
    expect(despues.body.palabra_activadora)
      .toBe('proyector');

    // Quitar palabra agregada
    const eliminado = await admin(
      'delete',
      `/api/admin/palabras-clave/${agregado.body.id}`
    );

    expect(eliminado.status).toBe(200);

    // Debe volver a Otros
    const final = await admin(
      'post', '/api/admin/probar-frase'
    ).send({ frase });

    expect(final.status).toBe(200);
    expect(final.body.categoria).toBe('Otros');
  });

  it('rechaza frases vacías', async () => {
    const respuesta = await admin(
      'post', '/api/admin/probar-frase'
    ).send({ frase: '   ' });

    expect(respuesta.status).toBe(400);
  });
});
