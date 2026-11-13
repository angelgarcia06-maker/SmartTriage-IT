import type Database from 'better-sqlite3';
import { beforeEach, describe, expect, it } from 'vitest';
import { crearBaseDePrueba, crearTecnico, crearTicket, idCategoria, idGrupo, idUsuario } from './fixture';
import { recomendarTecnico, sugerir } from './sugerir';

let bd: Database.Database;
beforeEach(() => {
  bd = crearBaseDePrueba();
});

describe('sugerir(ticket)', () => {
  it('devuelve categoría, activadora, prioridad, grupo y técnico', () => {
    const r = sugerir({ titulo: 'Sin red', descripcion: 'No funciona el wifi', impacto: 'Alto', urgencia: 'Alta' }, bd);
    expect(r).toEqual({
      categoria_id: idCategoria(bd, 'Red'),
      categoria: 'Red',
      palabra_activadora: 'wifi',
      es_otros: false,
      prioridad: 'Crítica',
      grupo_id: idGrupo(bd, 'Redes y conectividad'),
      tecnico_id: idUsuario(bd, 'tecnico2'),
    });
  });

  it('la estructura es exactamente SugerenciaTriaje (sin campos extra)', () => {
    const r = sugerir({ descripcion: 'teclado roto', impacto: 'Bajo', urgencia: 'Baja' }, bd);
    expect(Object.keys(r).sort()).toEqual(
      ['categoria', 'categoria_id', 'es_otros', 'grupo_id', 'palabra_activadora', 'prioridad', 'tecnico_id'].sort(),
    );
  });

  it('también clasifica por el título', () => {
    expect(sugerir({ titulo: 'Problema con Outlook', descripcion: 'no abre', impacto: 'Medio', urgencia: 'Media' }, bd).categoria).toBe('Correo');
  });

  it('la prioridad sale solo de la matriz, no de la categoría', () => {
    const a = sugerir({ descripcion: 'no hay wifi', impacto: 'Bajo', urgencia: 'Baja' }, bd);
    const b = sugerir({ descripcion: 'la cafetera hace ruido', impacto: 'Alto', urgencia: 'Alta' }, bd);
    expect(a.prioridad).toBe('Baja');
    expect(b).toMatchObject({ es_otros: true, prioridad: 'Crítica' });
  });

  it('caso sin técnico: el grupo no tiene técnicos activos → tecnico_id null', () => {
    bd.prepare("UPDATE usuarios SET activo = 0 WHERE usuario = 'tecnico2'").run();
    const r = sugerir({ descripcion: 'no hay wifi', impacto: 'Alto', urgencia: 'Alta' }, bd);
    expect(r.grupo_id).toBe(idGrupo(bd, 'Redes y conectividad'));
    expect(r.tecnico_id).toBeNull();
  });

  it('grupo inactivo → grupo_id y tecnico_id null', () => {
    bd.prepare("UPDATE grupos SET activo = 0 WHERE nombre = 'Redes y conectividad'").run();
    expect(sugerir({ descripcion: 'no hay wifi', impacto: 'Alto', urgencia: 'Alta' }, bd)).toMatchObject({ grupo_id: null, tecnico_id: null });
  });
});

describe('recomendarTecnico(grupo)', () => {
  it('elige al técnico con menos tickets abiertos', () => {
    const t2 = idUsuario(bd, 'tecnico2');
    const t5 = crearTecnico(bd, 'tecnico5', 'Redes y conectividad');
    crearTicket(bd, { tecnico_id: t2, estado: 'Nuevo' });
    crearTicket(bd, { tecnico_id: t2, estado: 'En proceso' });
    crearTicket(bd, { tecnico_id: t5, estado: 'Asignado' });
    expect(recomendarTecnico(idGrupo(bd, 'Redes y conectividad'), bd)).toBe(t5);
  });

  it('no cuenta tickets Resueltos ni Cerrados', () => {
    const t2 = idUsuario(bd, 'tecnico2');
    const t5 = crearTecnico(bd, 'tecnico5', 'Redes y conectividad');
    crearTicket(bd, { tecnico_id: t2, estado: 'Resuelto' });
    crearTicket(bd, { tecnico_id: t2, estado: 'Cerrado' });
    crearTicket(bd, { tecnico_id: t5, estado: 'Nuevo' });
    expect(recomendarTecnico(idGrupo(bd, 'Redes y conectividad'), bd)).toBe(t2);
  });

  it('empate de carga → menor id', () => {
    crearTecnico(bd, 'tecnico5', 'Redes y conectividad');
    expect(recomendarTecnico(idGrupo(bd, 'Redes y conectividad'), bd)).toBe(idUsuario(bd, 'tecnico2'));
  });

  it('ignora técnicos de otros grupos y usuarios que no son técnicos', () => {
    bd.prepare("UPDATE usuarios SET grupo_id = ? WHERE usuario = 'agente'").run(idGrupo(bd, 'Aplicaciones'));
    expect(recomendarTecnico(idGrupo(bd, 'Aplicaciones'), bd)).toBe(idUsuario(bd, 'tecnico3'));
  });

  it('grupo null → null', () => {
    expect(recomendarTecnico(null, bd)).toBeNull();
  });
});
