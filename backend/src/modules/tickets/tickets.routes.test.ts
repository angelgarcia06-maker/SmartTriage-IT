import Database from 'better-sqlite3';
import express, { type RequestHandler } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { crearRutasTickets } from './tickets.routes';
import { cambiarEstadoTicket } from './tickets.service';

let conexion: Database.Database;
const usuarioSesion = { id: 7, rol: 'agente' };
const cuerpo = {
  solicitante: 'Ana García',
  titulo: 'Sin conexión a la red',
  descripcion: 'No funciona la conexión wifi de la oficina.',
  impacto: 'Alto',
  urgencia: 'Alta',
};

function autenticarComo(usuario: { id: number; rol: string }): RequestHandler {
  return (_req, res, next) => {
    res.locals.usuario = usuario;
    next();
  };
}

function crearApp(conAutenticacion = true, usuario = usuarioSesion) {
  const app = express();
  app.use(express.json());
  app.use('/api/tickets', crearRutasTickets({
    conexion,
    requiereAutenticacion: conAutenticacion ? autenticarComo(usuario) : undefined,
  }));
  return app;
}

function insertarTicket(
  titulo: string,
  tecnicoId: number | null,
  opciones: { solicitante?: string; estado?: string; categoriaId?: number | null; prioridad?: string | null } = {},
): number {
  const resultado = conexion.prepare(`
    INSERT INTO tickets (
      solicitante, titulo, descripcion, impacto, urgencia, estado, creado_por,
      tecnico_id, categoria_sugerida_id, prioridad_sugerida
    ) VALUES (?, ?, 'Detalle de prueba', 'Alto', 'Alta', ?, 7, ?, ?, ?)
  `).run(
    opciones.solicitante ?? 'Ana',
    titulo,
    opciones.estado ?? 'Nuevo',
    tecnicoId,
    opciones.categoriaId === undefined ? 3 : opciones.categoriaId,
    opciones.prioridad === undefined ? 'Alta' : opciones.prioridad,
  );
  return Number(resultado.lastInsertRowid);
}

beforeEach(() => {
  conexion = new Database(':memory:');
  conexion.exec(`
    CREATE TABLE usuarios (id INTEGER PRIMARY KEY, nombre TEXT NOT NULL, rol TEXT NOT NULL);
    INSERT INTO usuarios (id, nombre, rol) VALUES (7, 'Agente de prueba', 'agente');
    INSERT INTO usuarios (id, nombre, rol) VALUES (9, 'Técnico de prueba', 'tecnico');
    INSERT INTO usuarios (id, nombre, rol) VALUES (11, 'Otro técnico', 'tecnico');
    CREATE TABLE categorias (id INTEGER PRIMARY KEY, nombre TEXT NOT NULL);
    INSERT INTO categorias (id, nombre) VALUES (3, 'Redes');
    INSERT INTO categorias (id, nombre) VALUES (4, 'Hardware');
    CREATE TABLE tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      solicitante TEXT NOT NULL,
      titulo TEXT NOT NULL,
      descripcion TEXT NOT NULL,
      impacto TEXT NOT NULL,
      urgencia TEXT NOT NULL,
      estado TEXT NOT NULL DEFAULT 'Nuevo',
      fecha_creacion TEXT NOT NULL DEFAULT '2026-11-13T00:00:00.000Z',
      creado_por INTEGER NOT NULL REFERENCES usuarios(id),
      tecnico_id INTEGER REFERENCES usuarios(id),
      categoria_sugerida_id INTEGER,
      prioridad_sugerida TEXT,
      grupo_sugerido_id INTEGER,
      palabra_activadora TEXT
    );
    CREATE TABLE historial (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id INTEGER NOT NULL REFERENCES tickets(id),
      usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
      accion TEXT NOT NULL,
      valor_anterior TEXT,
      valor_nuevo TEXT,
      fecha TEXT NOT NULL DEFAULT '2026-11-13T00:00:00.000Z'
    );
  `);
});

describe('POST /api/tickets', () => {
  it('crea el ticket como Nuevo y usa el usuario autenticado', async () => {
    const sugerencia = {
      categoria_id: 3,
      categoria: 'Redes',
      es_otros: false,
      prioridad: 'Crítica' as const,
      grupo_id: 2,
      tecnico_id: 9,
      palabra_activadora: 'wifi',
    };
    const app = express();
    app.use(express.json());
    app.use('/api/tickets', crearRutasTickets({
      conexion,
      requiereAutenticacion: autenticarComo(usuarioSesion),
      sugerir: () => sugerencia,
    }));

    const respuesta = await request(app).post('/api/tickets').send(cuerpo);

    expect(respuesta.status).toBe(201);
    expect(respuesta.body).toEqual({ id: 1, sugerencia });
    expect(conexion.prepare('SELECT * FROM tickets WHERE id = ?').get(respuesta.body.id)).toMatchObject({
      ...cuerpo,
      estado: 'Nuevo',
      creado_por: usuarioSesion.id,
      categoria_sugerida_id: sugerencia.categoria_id,
      prioridad_sugerida: sugerencia.prioridad,
      grupo_sugerido_id: sugerencia.grupo_id,
      tecnico_id: sugerencia.tecnico_id,
      palabra_activadora: sugerencia.palabra_activadora,
    });
  });

  it('responde 400 si faltan campos requeridos o hay campos adicionales', async () => {
    const app = crearApp();
    const vacio = await request(app).post('/api/tickets').send({});
    const extra = await request(app).post('/api/tickets').send({ ...cuerpo, estado: 'Cerrado' });

    expect(vacio.status).toBe(400);
    expect(extra.status).toBe(400);
    expect(conexion.prepare('SELECT COUNT(*) AS total FROM tickets').get()).toEqual({ total: 0 });
  });

  it('responde 401 sin autenticación', async () => {
    const respuesta = await request(crearApp(false)).post('/api/tickets').send(cuerpo);

    expect(respuesta.status).toBe(401);
    expect(conexion.prepare('SELECT COUNT(*) AS total FROM tickets').get()).toEqual({ total: 0 });
  });
});

describe('GET /api/tickets', () => {
  it('lista los tickets con categoría, prioridad, técnico y fecha', async () => {
    const asignadoId = insertarTicket('Sin conexión', 9);
    insertarTicket('Sin asignar', null);

    const respuesta = await request(crearApp()).get('/api/tickets');

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.tickets).toHaveLength(2);
    expect(respuesta.body.tickets).toContainEqual(expect.objectContaining({
      id: asignadoId,
      titulo: 'Sin conexión',
      estado: 'Nuevo',
      categoria_sugerida: 'Redes',
      prioridad_sugerida: 'Alta',
      tecnico: 'Técnico de prueba',
      fecha_creacion: '2026-11-13T00:00:00.000Z',
    }));
  });

  it('limita al técnico a sus tickets asignados', async () => {
    const asignadoId = insertarTicket('Asignado a técnico', 9);
    insertarTicket('Asignado a otro', 7);
    insertarTicket('Sin asignar', null);

    const respuesta = await request(crearApp(true, { id: 9, rol: 'tecnico' })).get('/api/tickets');

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.tickets.map((ticket: { id: number }) => ticket.id)).toEqual([asignadoId]);
  });

  it('combina búsqueda y todos los filtros en una misma consulta', async () => {
    const objetivo = insertarTicket('Intermitencia de red', 9, { solicitante: 'Ana López' });
    insertarTicket('Mismo solicitante, estado distinto', 9, { solicitante: 'Ana López', estado: 'Asignado' });
    insertarTicket('Otra categoría', 9, { solicitante: 'Ana López', categoriaId: 4 });
    insertarTicket('Otra prioridad', 9, { solicitante: 'Ana López', prioridad: 'Crítica' });
    insertarTicket('Otro técnico', 11, { solicitante: 'Ana López' });

    const respuesta = await request(crearApp()).get('/api/tickets').query({
      busqueda: 'Ana López',
      estado: 'Nuevo',
      categoria_id: '3',
      prioridad: 'Alta',
      tecnico_id: '9',
    });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.tickets.map((ticket: { id: number }) => ticket.id)).toEqual([objetivo]);
  });

  it('busca por ID, título o solicitante', async () => {
    const ticketId = insertarTicket('Conexión intermitente', 9, { solicitante: 'María Torres' });

    const porId = await request(crearApp()).get('/api/tickets').query({ busqueda: String(ticketId) });
    const porTitulo = await request(crearApp()).get('/api/tickets').query({ busqueda: 'intermitente' });
    const porSolicitante = await request(crearApp()).get('/api/tickets').query({ busqueda: 'María' });

    expect(porId.body.tickets.map((ticket: { id: number }) => ticket.id)).toEqual([ticketId]);
    expect(porTitulo.body.tickets.map((ticket: { id: number }) => ticket.id)).toEqual([ticketId]);
    expect(porSolicitante.body.tickets.map((ticket: { id: number }) => ticket.id)).toEqual([ticketId]);
  });

  it('rechaza parámetros inválidos y no permite ampliar el alcance del técnico', async () => {
    const ticketId = insertarTicket('Asignado a técnico', 9);
    const app = crearApp();
    const tecnico = crearApp(true, { id: 9, rol: 'tecnico' });
    const estadosInvalidos = await Promise.all([
      request(app).get('/api/tickets').query({ estado: 'En espera' }),
      request(app).get('/api/tickets').query({ categoria_id: 'abc' }),
      request(app).get('/api/tickets').query({ prioridad: 'Urgente' }),
      request(app).get('/api/tickets').query({ tecnico_id: '-9' }),
      request(app).get('/api/tickets').query({ desconocido: 'valor' }),
    ]);
    const fueraDeAlcance = await request(tecnico).get('/api/tickets').query({ tecnico_id: '11' });
    const propio = await request(tecnico).get('/api/tickets').query({ tecnico_id: '9' });

    expect(estadosInvalidos.map((respuesta) => respuesta.status)).toEqual([400, 400, 400, 400, 400]);
    expect(fueraDeAlcance.body.tickets).toEqual([]);
    expect(propio.body.tickets.map((ticket: { id: number }) => ticket.id)).toEqual([ticketId]);
  });

  it('responde 401 sin sesión y 403 con rol no autorizado', async () => {
    const sinSesion = await request(crearApp(false)).get('/api/tickets');
    const rolInvalido = await request(crearApp(true, { id: 7, rol: 'observador' })).get('/api/tickets');

    expect(sinSesion.status).toBe(401);
    expect(rolInvalido.status).toBe(403);
  });
});

describe('GET /api/tickets/:id', () => {
  it('devuelve los datos del detalle al agente y al técnico asignado', async () => {
    const ticketId = insertarTicket('Detalle de red', 9);
    const agente = await request(crearApp()).get(`/api/tickets/${ticketId}`);
    const tecnico = await request(crearApp(true, { id: 9, rol: 'tecnico' })).get(`/api/tickets/${ticketId}`);

    expect(agente.status).toBe(200);
    expect(agente.body).toMatchObject({
      id: ticketId,
      titulo: 'Detalle de red',
      solicitante: 'Ana',
      descripcion: 'Detalle de prueba',
      impacto: 'Alto',
      urgencia: 'Alta',
      categoria_sugerida: 'Redes',
      prioridad_sugerida: 'Alta',
      tecnico: 'Técnico de prueba',
    });
    expect(tecnico.status).toBe(200);
    expect(tecnico.body.id).toBe(ticketId);
  });

  it('oculta al técnico los tickets no asignados a su usuario', async () => {
    const ticketAjeno = insertarTicket('Otro ticket', 7);
    const respuesta = await request(crearApp(true, { id: 9, rol: 'tecnico' }))
      .get(`/api/tickets/${ticketAjeno}`);

    expect(respuesta.status).toBe(404);
  });

  it('valida el ID y devuelve 404 cuando no existe', async () => {
    const app = crearApp();

    expect((await request(app).get('/api/tickets/no-valido')).status).toBe(400);
    expect((await request(app).get('/api/tickets/999')).status).toBe(404);
  });
});

describe('PATCH /api/tickets/:id/estado y GET /api/tickets/:id/historial', () => {
  it('recorre el flujo, reabre con motivo y conserva cronología', async () => {
    const ticketId = insertarTicket('Ciclo de vida', 9);
    const agente = crearApp();
    const tecnico = crearApp(true, { id: 9, rol: 'tecnico' });

    const asignado = await request(agente).patch(`/api/tickets/${ticketId}/estado`).send({ estado: 'Asignado' });
    const enProceso = await request(tecnico).patch(`/api/tickets/${ticketId}/estado`).send({ estado: 'En proceso' });
    const resuelto = await request(tecnico).patch(`/api/tickets/${ticketId}/estado`).send({ estado: 'Resuelto' });
    const reaperturaInvalida = await request(tecnico).patch(`/api/tickets/${ticketId}/estado`).send({ estado: 'En proceso' });
    const reabierto = await request(tecnico).patch(`/api/tickets/${ticketId}/estado`).send({
      estado: 'En proceso',
      motivo: 'La falla volvió después de la solución.',
    });
    const resueltoDeNuevo = await request(tecnico).patch(`/api/tickets/${ticketId}/estado`).send({ estado: 'Resuelto' });
    const cerrado = await request(agente).patch(`/api/tickets/${ticketId}/estado`).send({ estado: 'Cerrado' });
    const historial = await request(agente).get(`/api/tickets/${ticketId}/historial`);

    expect([asignado.status, enProceso.status, resuelto.status]).toEqual([200, 200, 200]);
    expect(reaperturaInvalida.status).toBe(400);
    expect(reabierto.status).toBe(200);
    expect(resueltoDeNuevo.status).toBe(200);
    expect(cerrado.body.estado).toBe('Cerrado');
    expect(historial.status).toBe(200);
    expect(historial.body.historial.map((evento: { valor_nuevo: string }) => evento.valor_nuevo)).toEqual([
      'Asignado', 'En proceso', 'Resuelto', 'En proceso', 'Resuelto', 'Cerrado',
    ]);
    expect(historial.body.historial[3].accion).toContain('La falla volvió después de la solución.');
  });

  it('rechaza transiciones inválidas y respeta sesión, rol y asignación', async () => {
    const ticketId = insertarTicket('Permisos estado', 9);
    const agente = crearApp();
    const tecnicoAjeno = crearApp(true, { id: 11, rol: 'tecnico' });
    const rolInvalido = crearApp(true, { id: 7, rol: 'observador' });
    const sinSesion = crearApp(false);

    const transicionInvalida = await request(agente).patch(`/api/tickets/${ticketId}/estado`).send({ estado: 'Resuelto' });
    const asignacionAjena = await request(tecnicoAjeno).patch(`/api/tickets/${ticketId}/estado`).send({ estado: 'Asignado' });
    const rolDenegado = await request(rolInvalido).patch(`/api/tickets/${ticketId}/estado`).send({ estado: 'Asignado' });
    const noAutenticado = await request(sinSesion).patch(`/api/tickets/${ticketId}/estado`).send({ estado: 'Asignado' });
    const inexistente = await request(agente).patch('/api/tickets/999/estado').send({ estado: 'Asignado' });
    const historialAjeno = await request(tecnicoAjeno).get(`/api/tickets/${ticketId}/historial`);

    expect(transicionInvalida.status).toBe(409);
    expect(asignacionAjena.status).toBe(403);
    expect(rolDenegado.status).toBe(403);
    expect(noAutenticado.status).toBe(401);
    expect(inexistente.status).toBe(404);
    expect(historialAjeno.status).toBe(404);
    expect(conexion.prepare('SELECT estado FROM tickets WHERE id = ?').get(ticketId)).toEqual({ estado: 'Nuevo' });
    expect(conexion.prepare('SELECT COUNT(*) AS total FROM historial WHERE ticket_id = ?').get(ticketId)).toEqual({ total: 0 });
  });

  it('revierte el cambio si falla la inserción del historial', () => {
    const ticketId = insertarTicket('Atomicidad', 9);
    conexion.exec(`
      CREATE TRIGGER impedir_historial BEFORE INSERT ON historial
      BEGIN SELECT RAISE(ABORT, 'fallo de historial'); END;
    `);

    expect(() => cambiarEstadoTicket(ticketId, 'Asignado', usuarioSesion, undefined, conexion)).toThrow('fallo de historial');
    expect(conexion.prepare('SELECT estado FROM tickets WHERE id = ?').get(ticketId)).toEqual({ estado: 'Nuevo' });
    expect(conexion.prepare('SELECT COUNT(*) AS total FROM historial WHERE ticket_id = ?').get(ticketId)).toEqual({ total: 0 });
  });
});

describe('flujo completo de alta, consulta, atención y cierre', () => {
  it('conserva datos y registra el historial desde la creación hasta el cierre terminal', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/tickets', crearRutasTickets({
      conexion,
      requiereAutenticacion: autenticarComo(usuarioSesion),
      sugerir: () => ({
        categoria_id: 3,
        categoria: 'Redes',
        es_otros: false,
        prioridad: 'Crítica',
        grupo_id: 2,
        tecnico_id: 9,
        palabra_activadora: 'wifi',
      }),
    }));
    const tecnico = express();
    tecnico.use(express.json());
    tecnico.use('/api/tickets', crearRutasTickets({
      conexion,
      requiereAutenticacion: autenticarComo({ id: 9, rol: 'tecnico' }),
    }));

    const alta = await request(app).post('/api/tickets').send(cuerpo);
    const ticketId = alta.body.id as number;
    const lista = await request(app).get('/api/tickets').query({
      busqueda: String(ticketId),
      estado: 'Nuevo',
      categoria_id: '3',
      prioridad: 'Crítica',
      tecnico_id: '9',
    });
    const detalleInicial = await request(app).get(`/api/tickets/${ticketId}`);
    const asignado = await request(app).patch(`/api/tickets/${ticketId}/estado`).send({ estado: 'Asignado' });
    const enProceso = await request(tecnico).patch(`/api/tickets/${ticketId}/estado`).send({ estado: 'En proceso' });
    const resuelto = await request(tecnico).patch(`/api/tickets/${ticketId}/estado`).send({ estado: 'Resuelto' });
    const cerrado = await request(tecnico).patch(`/api/tickets/${ticketId}/estado`).send({ estado: 'Cerrado' });
    const transicionDesdeCerrado = await request(app)
      .patch(`/api/tickets/${ticketId}/estado`).send({ estado: 'En proceso' });
    const historial = await request(app).get(`/api/tickets/${ticketId}/historial`);
    const detalleFinal = await request(app).get(`/api/tickets/${ticketId}`);

    expect(alta.status).toBe(201);
    expect(lista.status).toBe(200);
    expect(lista.body.tickets.map((ticket: { id: number }) => ticket.id)).toEqual([ticketId]);
    expect(detalleInicial.body).toMatchObject({ id: ticketId, estado: 'Nuevo', titulo: cuerpo.titulo });
    expect([asignado.status, enProceso.status, resuelto.status, cerrado.status]).toEqual([200, 200, 200, 200]);
    expect(transicionDesdeCerrado.status).toBe(409);
    expect(detalleFinal.body.estado).toBe('Cerrado');
    expect(historial.body.historial.map((evento: { valor_nuevo: string }) => evento.valor_nuevo)).toEqual([
      'Asignado', 'En proceso', 'Resuelto', 'Cerrado',
    ]);
    expect(historial.body.historial).toHaveLength(4);
  });
});