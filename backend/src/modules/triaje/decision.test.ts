import type Database from 'better-sqlite3';
import { beforeEach, describe, expect, it } from 'vitest';
import { CONDICION_DECISION_CONFIRMADA, ErrorDecision, registrarDecision, type DecisionTriaje } from './decision';
import { crearBaseDePrueba, crearTicket, idCategoria, idGrupo, idUsuario } from './fixture';

let bd: Database.Database;
let agente: number;
let ticket: number;
let sugerida: DecisionTriaje;

beforeEach(() => {
  bd = crearBaseDePrueba();
  agente = idUsuario(bd, 'agente');
  ticket = crearTicket(bd, { tecnico_id: idUsuario(bd, 'tecnico2') });
  sugerida = {
    categoria_final_id: idCategoria(bd, 'Red'),
    prioridad_final: 'Crítica',
    grupo_final_id: idGrupo(bd, 'Redes y conectividad'),
    tecnico_id: idUsuario(bd, 'tecnico2'),
  };
});

const filas = (sql: string, ...p: unknown[]) => bd.prepare(sql).all(...p) as Record<string, unknown>[];
const fila = (sql: string, ...p: unknown[]) => bd.prepare(sql).get(...p) as Record<string, unknown>;

describe('registrarDecision — aceptar', () => {
  it('guarda la decisión sin filas en correcciones', () => {
    const r = registrarDecision(ticket, sugerida, agente, bd);
    expect(r).toMatchObject({ ticket_id: ticket, aceptada_sin_correccion: true, correcciones: [] });
    expect(filas('SELECT * FROM correcciones WHERE ticket_id = ?', ticket)).toHaveLength(0);
    expect(fila('SELECT * FROM tickets WHERE id = ?', ticket)).toMatchObject({
      categoria_final_id: sugerida.categoria_final_id,
      prioridad_final: 'Crítica',
      grupo_final_id: sugerida.grupo_final_id,
      aceptada_sin_correccion: 1,
      fecha_decision: r.fecha_decision,
    });
  });

  it('añade una fila al historial', () => {
    registrarDecision(ticket, sugerida, agente, bd);
    const h = filas('SELECT * FROM historial WHERE ticket_id = ?', ticket);
    expect(h).toHaveLength(1);
    expect(h[0]).toMatchObject({ usuario_id: agente, accion: 'Sugerencia de triaje aceptada' });
  });
});

describe('registrarDecision — corregir', () => {
  it('guarda una fila por campo corregido con sugerido y final', () => {
    const decision: DecisionTriaje = {
      categoria_final_id: idCategoria(bd, 'Hardware'),
      prioridad_final: 'Alta',
      grupo_final_id: idGrupo(bd, 'Soporte general'),
      tecnico_id: idUsuario(bd, 'tecnico1'),
    };
    const r = registrarDecision(ticket, decision, agente, bd);
    expect(r.aceptada_sin_correccion).toBe(false);
    const c = filas('SELECT campo, valor_sugerido, valor_final, usuario_id FROM correcciones WHERE ticket_id = ? ORDER BY id', ticket);
    expect(c).toEqual([
      { campo: 'categoria', valor_sugerido: String(idCategoria(bd, 'Red')), valor_final: String(idCategoria(bd, 'Hardware')), usuario_id: agente },
      { campo: 'prioridad', valor_sugerido: 'Crítica', valor_final: 'Alta', usuario_id: agente },
      { campo: 'grupo', valor_sugerido: String(idGrupo(bd, 'Redes y conectividad')), valor_final: String(idGrupo(bd, 'Soporte general')), usuario_id: agente },
      { campo: 'tecnico', valor_sugerido: String(idUsuario(bd, 'tecnico2')), valor_final: String(idUsuario(bd, 'tecnico1')), usuario_id: agente },
    ]);
    expect(fila('SELECT aceptada_sin_correccion FROM tickets WHERE id = ?', ticket)).toEqual({ aceptada_sin_correccion: 0 });
  });

  it('solo registra los campos que cambiaron', () => {
    registrarDecision(ticket, { ...sugerida, prioridad_final: 'Media' }, agente, bd);
    expect(filas('SELECT campo FROM correcciones WHERE ticket_id = ?', ticket)).toEqual([{ campo: 'prioridad' }]);
  });

  it('conserva la sugerencia original en el ticket', () => {
    registrarDecision(ticket, { ...sugerida, categoria_final_id: idCategoria(bd, 'Software'), grupo_final_id: null, tecnico_id: null }, agente, bd);
    expect(fila('SELECT categoria_sugerida_id, prioridad_sugerida, grupo_sugerido_id, palabra_activadora FROM tickets WHERE id = ?', ticket)).toEqual({
      categoria_sugerida_id: idCategoria(bd, 'Red'),
      prioridad_sugerida: 'Crítica',
      grupo_sugerido_id: idGrupo(bd, 'Redes y conectividad'),
      palabra_activadora: 'wifi',
    });
  });

  it('quitar el técnico sugerido se registra como "ninguno"', () => {
    registrarDecision(ticket, { ...sugerida, tecnico_id: null }, agente, bd);
    expect(filas('SELECT campo, valor_final FROM correcciones WHERE ticket_id = ?', ticket)).toEqual([{ campo: 'tecnico', valor_final: 'ninguno' }]);
  });
});

describe('registrarDecision — no duplica', () => {
  it('una segunda decisión devuelve 409 y no crea filas nuevas', () => {
    registrarDecision(ticket, { ...sugerida, prioridad_final: 'Media' }, agente, bd);
    let error: unknown;
    try {
      registrarDecision(ticket, { ...sugerida, prioridad_final: 'Baja' }, agente, bd);
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(ErrorDecision);
    expect((error as ErrorDecision).status).toBe(409);
    expect(filas('SELECT * FROM correcciones WHERE ticket_id = ?', ticket)).toHaveLength(1);
    expect(filas('SELECT * FROM historial WHERE ticket_id = ?', ticket)).toHaveLength(1);
    expect(fila('SELECT prioridad_final FROM tickets WHERE id = ?', ticket)).toEqual({ prioridad_final: 'Media' });
  });
});

describe('registrarDecision — validación (no deja datos a medias)', () => {
  const casos: [string, (d: DecisionTriaje) => DecisionTriaje, number, RegExp][] = [
    ['ticket inexistente', (d) => d, 404, /no existe/],
    ['categoría inexistente', (d) => ({ ...d, categoria_final_id: 999 }), 400, /categoría/],
    ['grupo inexistente', (d) => ({ ...d, grupo_final_id: 999 }), 400, /grupo/],
    ['técnico que no es técnico', (d) => ({ ...d, tecnico_id: 2 }), 400, /técnico/],
    ['técnico de otro grupo', (d) => ({ ...d, tecnico_id: 3 }), 400, /no pertenece/],
  ];
  it.each(casos)('%s', (nombre, cambiar, status, mensaje) => {
    const id = nombre === 'ticket inexistente' ? 999 : ticket;
    expect(() => registrarDecision(id, cambiar(sugerida), agente, bd)).toThrow(mensaje);
    try {
      registrarDecision(id, cambiar(sugerida), agente, bd);
    } catch (e) {
      expect((e as ErrorDecision).status).toBe(status);
    }
    expect(fila('SELECT fecha_decision FROM tickets WHERE id = ?', ticket)).toEqual({ fecha_decision: null });
    expect(filas('SELECT * FROM historial')).toHaveLength(0);
  });
});

describe('métricas: solo tickets con decisión confirmada', () => {
  it('CONDICION_DECISION_CONFIRMADA excluye tickets sin decisión', () => {
    const otro = crearTicket(bd);
    registrarDecision(ticket, sugerida, agente, bd);
    const ids = filas(`SELECT id FROM tickets WHERE ${CONDICION_DECISION_CONFIRMADA}`).map((f) => f.id);
    expect(ids).toEqual([ticket]);
    expect(ids).not.toContain(otro);
  });
});
