
import type Database from 'better-sqlite3';
import {
  beforeEach,
  afterEach,
  describe,
  expect,
  it
} from 'vitest';

import { obtenerMetricas } from './metricas.service';

import { registrarDecision } from '../triaje/decision';

import {
  crearBaseDePrueba,
  crearTicket,
  idCategoria,
  idGrupo,
  idUsuario
} from '../triaje/fixture';

let bd: Database.Database;

beforeEach(() => {
  bd = crearBaseDePrueba();
});

afterEach(() => {
  bd.close();
});

describe('ADM-04: Dashboard y precisión', () => {

  it('devuelve cero cuando no existen tickets', () => {
    const metricas = obtenerMetricas(bd);

    expect(metricas.tickets.total).toBe(0);
    expect(metricas.precision.global.total).toBe(0);
    expect(metricas.precision.global.porcentaje).toBe(0);

    for (const campo of metricas.precision.porCampo) {
      expect(campo.total).toBe(0);
      expect(campo.porcentaje).toBe(0);
    }

    expect(metricas.precision.porCategoriaSugerida)
      .toEqual([]);
  });

  it('excluye tickets sin decisión del cálculo', () => {
    crearTicket(bd, {
      estado: 'Nuevo',
      categoria: 'Red',
      prioridad: 'Crítica'
    });

    const metricas = obtenerMetricas(bd);

    expect(metricas.tickets.total).toBe(1);
    expect(metricas.precision.global.total).toBe(0);
    expect(metricas.precision.global.aceptadas).toBe(0);
    expect(metricas.precision.global.porcentaje).toBe(0);

    expect(metricas.tickets.porEstado).toEqual([
      { nombre: 'Nuevo', total: 1 }
    ]);
  });

  it('calcula 80% con 10 decisiones y 8 aceptadas', () => {
    const agente = idUsuario(bd, 'agente');

    for (let i = 0; i < 10; i++) {
      const esRed = i < 6;

      const categoria = esRed ? 'Red' : 'Software';
      const grupo = esRed
        ? 'Redes y conectividad'
        : 'Aplicaciones';

      const prioridad = esRed ? 'Crítica' : 'Media';

      const ticketId = crearTicket(bd, {
        categoria,
        grupo,
        prioridad,
        estado: i % 2 === 0 ? 'Nuevo' : 'Asignado'
      });

      // El ticket 6 tendrá una corrección de categoría.
      const categoriaFinal = i === 5
        ? 'Hardware'
        : categoria;

      // El ticket 10 tendrá una corrección de prioridad.
      const prioridadFinal = i === 9
        ? 'Alta'
        : prioridad;

      registrarDecision(
        ticketId,
        {
          categoria_final_id: idCategoria(bd, categoriaFinal),
          prioridad_final: prioridadFinal,
          grupo_final_id: idGrupo(bd, grupo),
          tecnico_id: null
        },
        agente,
        bd
      );
    }

    // Dos tickets adicionales que no tienen decisión.
    crearTicket(bd, {
      categoria: 'Red',
      prioridad: 'Crítica'
    });

    crearTicket(bd, {
      categoria: 'Software',
      grupo: 'Aplicaciones',
      prioridad: 'Media'
    });

    const metricas = obtenerMetricas(bd);

    // Los 12 tickets cuentan en el Dashboard.
    expect(metricas.tickets.total).toBe(12);

    // Solo las 10 decisiones confirmadas cuentan.
    expect(metricas.precision.global).toEqual({
      total: 10,
      aceptadas: 8,
      porcentaje: 80
    });

    // Precisión por campo
    const campos = metricas.precision.porCampo;

    expect(
      campos.find(c => c.campo === 'categoria')?.porcentaje
    ).toBe(90);

    expect(
      campos.find(c => c.campo === 'prioridad')?.porcentaje
    ).toBe(90);

    expect(
      campos.find(c => c.campo === 'grupo')?.porcentaje
    ).toBe(100);

    expect(
      campos.find(c => c.campo === 'tecnico')?.porcentaje
    ).toBe(100);

    // Precisión según la categoría sugerida originalmente
    const categorias =
      metricas.precision.porCategoriaSugerida;

    expect(
      categorias.find(c => c.categoria === 'Red')
    ).toMatchObject({
      total: 6,
      aceptadas: 5,
      porcentaje: 83.33
    });

    expect(
      categorias.find(c => c.categoria === 'Software')
    ).toMatchObject({
      total: 4,
      aceptadas: 3,
      porcentaje: 75
    });

    // Hardware fue categoría final corregida,
    // no categoría sugerida.
    expect(
      categorias.some(c => c.categoria === 'Hardware')
    ).toBe(false);

    // Conteos de tickets por estado
    expect(metricas.tickets.porEstado).toEqual(
      expect.arrayContaining([
        { nombre: 'Nuevo', total: 7 },
        { nombre: 'Asignado', total: 5 }
      ])
    );

    // Conteos usando categoría final cuando existe
    expect(metricas.tickets.porCategoria).toEqual(
      expect.arrayContaining([
        { nombre: 'Red', total: 6 },
        { nombre: 'Software', total: 5 },
        { nombre: 'Hardware', total: 1 }
      ])
    );

    // Conteos por prioridad
    expect(metricas.tickets.porPrioridad).toEqual(
      expect.arrayContaining([
        { nombre: 'Crítica', total: 7 },
        { nombre: 'Media', total: 4 },
        { nombre: 'Alta', total: 1 }
      ])
    );
  });
});
