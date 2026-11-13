import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app } from '../../app';
import { DATABASE_PATH, db, ES_BASE_EN_MEMORIA } from '../../db/connection';
import { CONDICION_DECISION_CONFIRMADA } from '../triaje/decision';

const CLAVE = 'Cambiar123!';

async function iniciarSesion(usuario: string) {
  const agente = request.agent(app);

  const csrf = await agente.get('/api/auth/csrf');
  expect(csrf.status).toBe(200);

  const respuesta = await agente
    .post('/api/auth/login')
    .set('X-CSRF-Token', csrf.body.csrfToken)
    .send({ usuario, password: CLAVE });
  expect(respuesta.status).toBe(200);
  return agente;
}

describe('Integración ADM con AUTH, Triaje y SQLite', () => {
  it('ejecuta las pruebas con una base aislada en memoria', () => {
    expect(ES_BASE_EN_MEMORIA).toBe(true);
    expect(DATABASE_PATH).toBe(':memory:');
  });

  it('protege lecturas, permite consultar catálogos con sesión y no acepta roles por encabezado', async () => {
    expect((await request(app).get('/api/catalogos/categorias')).status).toBe(401);
    expect((await request(app).get('/api/catalogos/grupos')).status).toBe(401);
    expect((await request(app).get('/api/admin/palabras-clave')).status).toBe(401);
    expect((await request(app).get('/api/admin/metricas')).status).toBe(401);

    const agente = await iniciarSesion('agente');
    const tecnico = await iniciarSesion('tecnico1');
    const admin = await iniciarSesion('admin');

    expect((await agente.get('/api/catalogos/categorias')).status).toBe(200);
    expect((await tecnico.get('/api/catalogos/grupos')).status).toBe(200);
    expect((await agente.get('/api/admin/palabras-clave')).status).toBe(403);
    expect((await tecnico.get('/api/admin/metricas')).status).toBe(403);
    expect((await admin.get('/api/catalogos/categorias')).status).toBe(200);

    const suplantacion = await request(app)
      .get('/api/admin/metricas')
      .set('x-rol', 'administrador')
      .set('x-usuario', 'admin');
    expect(suplantacion.status).toBe(401);

    const catalogos = await admin.get('/api/catalogos/categorias');
    const palabras = await admin.get('/api/admin/palabras-clave');
    const metricas = await admin.get('/api/admin/metricas');
    expect(catalogos.status).toBe(200);
    expect(palabras.status).toBe(200);
    expect(metricas.status).toBe(200);
    for (const respuesta of [catalogos, palabras, metricas]) {
      expect(JSON.stringify(respuesta.body)).not.toMatch(/password|hash/i);
    }
  });

  it('permite CRUD solo al administrador y rechaza escrituras cross-origin', async () => {
    const agente = await iniciarSesion('agente');
    const tecnico = await iniciarSesion('tecnico1');
    const admin = await iniciarSesion('admin');

    const grupo = { nombre: `ADM integración ${Date.now()}` };
    expect((await agente.post('/api/catalogos/grupos').send(grupo)).status).toBe(403);
    expect((await tecnico.post('/api/catalogos/grupos').send(grupo)).status).toBe(403);
    expect((await admin.post('/api/catalogos/grupos').set('Origin', 'http://malicioso.example').send(grupo)).status).toBe(403);
    expect((await admin.post('/api/admin/palabras-clave')
      .set('Origin', 'http://malicioso.example')
      .send({ palabra: 'integracionqa', categoria_id: 1 })).status).toBe(403);

    const creado = await admin.post('/api/catalogos/grupos').send(grupo);
    expect(creado.status).toBe(201);
    const categoria = await admin.post('/api/catalogos/categorias').send({
      nombre: `ADM categoría ${Date.now()}`,
      grupo_id: creado.body.id,
    });
    expect(categoria.status).toBe(201);
    expect((await admin.patch(`/api/catalogos/grupos/${creado.body.id}`).send({
      nombre: `${grupo.nombre} editado`,
    })).status).toBe(200);
  });

  it('las palabras nuevas cambian la clasificación inmediatamente, sin reiniciar', async () => {
    const admin = await iniciarSesion('admin');
    const categorias = await admin.get('/api/catalogos/categorias');
    const hardware = categorias.body.find((categoria: { nombre: string }) => categoria.nombre === 'Hardware');
    expect(hardware).toBeDefined();

    const frase = 'admqaactualizaciondinamica';
    const antes = await admin.post('/api/admin/probar-frase').send({ frase });
    expect(antes.status).toBe(200);
    expect(antes.body.categoria).toBe('Otros');

    const agregada = await admin.post('/api/admin/palabras-clave').send({
      palabra: frase,
      categoria_id: hardware.id,
    });
    expect(agregada.status).toBe(201);

    const despues = await admin.post('/api/admin/probar-frase').send({ frase });
    expect(despues.status).toBe(200);
    expect(despues.body).toMatchObject({
      categoria: 'Hardware',
      palabra_activadora: frase,
    });

    expect((await admin.delete(`/api/admin/palabras-clave/${agregada.body.id}`)).status).toBe(200);
    expect((await admin.post('/api/admin/probar-frase').send({ frase })).body.categoria).toBe('Otros');
  });

  it('el Dashboard devuelve conteos de SQLite y limita precisión a decisiones confirmadas', async () => {
    const admin = await iniciarSesion('admin');
    const respuesta = await admin.get('/api/admin/metricas');
    const tickets = (db.prepare('SELECT COUNT(*) AS total FROM tickets').get() as { total: number }).total;
    const decisiones = (db.prepare(`
      SELECT COUNT(*) AS total FROM tickets
      WHERE ${CONDICION_DECISION_CONFIRMADA}
    `).get() as { total: number }).total;

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.tickets.total).toBe(tickets);
    expect(respuesta.body.precision.global.total).toBe(decisiones);
  });
});
