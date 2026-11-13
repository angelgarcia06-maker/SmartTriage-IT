import type Database from 'better-sqlite3';
import { PRIORIDADES, type Prioridad } from './prioridad';

/** Igual a `DecisionTriaje` de shared/types/triaje.types.ts. */
export interface DecisionTriaje {
  categoria_final_id: number;
  prioridad_final: Prioridad;
  grupo_final_id: number | null;
  tecnico_id: number | null;
}

export interface ResultadoDecision {
  ticket_id: number;
  aceptada_sin_correccion: boolean;
  correcciones: { campo: CampoCorregible; valor_sugerido: string | null; valor_final: string }[];
  fecha_decision: string;
}

export interface SugerenciaPersistida {
  categoria_id: number | null;
  categoria: string | null;
  palabra_activadora: string | null;
  es_otros: boolean;
  prioridad: Prioridad | null;
  grupo_id: number | null;
  tecnico_id: number | null;
}

export interface DecisionTicketDetalle {
  ticket_id: number;
  pendiente: boolean;
  sugerencia: SugerenciaPersistida;
  decision: DecisionTriaje | null;
  aceptada_sin_correccion: boolean | null;
  fecha_decision: string | null;
}

export type CampoCorregible = 'categoria' | 'prioridad' | 'grupo' | 'tecnico';

/** Error con código HTTP, para que la ruta responda 400/404/409 sin adivinar. */
export class ErrorDecision extends Error {
  constructor(public readonly status: 400 | 404 | 409, mensaje: string) {
    super(mensaje);
    this.name = 'ErrorDecision';
  }
}

/**
 * Condición SQL para métricas (ADM-04): solo cuentan tickets con decisión confirmada.
 * Uso: `SELECT ... FROM tickets t WHERE ${CONDICION_DECISION_CONFIRMADA}`.
 */
export const CONDICION_DECISION_CONFIRMADA = 'fecha_decision IS NOT NULL AND aceptada_sin_correccion IS NOT NULL';

interface TicketSugerido {
  id: number;
  categoria_sugerida_id: number | null;
  prioridad_sugerida: Prioridad | null;
  grupo_sugerido_id: number | null;
  tecnico_id: number | null;
  fecha_decision: string | null;
}

function aTexto(valor: number | string | null): string | null {
  return valor == null ? null : String(valor);
}

function validarDecision(conexion: Database.Database, d: DecisionTriaje): void {
  if (d.grupo_final_id == null && d.tecnico_id != null) {
    throw new ErrorDecision(400, 'No se puede asignar un técnico sin grupo resolutor.');
  }
  const categoria = conexion.prepare('SELECT id FROM categorias WHERE id = ? AND activa = 1').get(d.categoria_final_id);
  if (!categoria) throw new ErrorDecision(400, 'La categoría final no existe o está inactiva.');
  if (!PRIORIDADES.includes(d.prioridad_final)) throw new ErrorDecision(400, 'Prioridad final inválida.');
  if (d.grupo_final_id != null) {
    const grupo = conexion.prepare('SELECT id FROM grupos WHERE id = ? AND activo = 1').get(d.grupo_final_id);
    if (!grupo) throw new ErrorDecision(400, 'El grupo final no existe o está inactivo.');
  }
  if (d.tecnico_id != null) {
    const tecnico = conexion
      .prepare("SELECT grupo_id FROM usuarios WHERE id = ? AND rol = 'tecnico' AND activo = 1")
      .get(d.tecnico_id) as { grupo_id: number | null } | undefined;
    if (!tecnico) throw new ErrorDecision(400, 'El técnico no existe, no es técnico o está inactivo.');
    if (d.grupo_final_id != null && tecnico.grupo_id !== d.grupo_final_id) {
      throw new ErrorDecision(400, 'El técnico no pertenece al grupo final.');
    }
  }
}

/**
 * Registra la decisión del agente sobre la sugerencia del triaje, en una transacción:
 *  - guarda categoría, prioridad, grupo y técnico finales en `tickets`,
 *  - conserva intactos los campos `*_sugerido*` (la sugerencia original),
 *  - inserta una fila en `correcciones` por cada campo distinto a lo sugerido,
 *  - marca `aceptada_sin_correccion` (1 si no hubo cambios) y `fecha_decision`,
 *  - añade una fila al `historial` (nunca lo sobrescribe).
 * Un ticket solo admite una decisión: un segundo intento devuelve 409.
 *
 * Nota: la tabla no tiene `tecnico_sugerido_id`; se toma `tickets.tecnico_id`
 * guardado al crear el ticket (TICK-01) como técnico sugerido.
 */
export function obtenerDetalleDecision(
  ticketId: number,
  conexion: Database.Database = (require('../../db/connection') as typeof import('../../db/connection')).db,
): DecisionTicketDetalle | undefined {
  const fila = conexion
    .prepare(
      `SELECT t.id AS ticket_id,
              t.categoria_sugerida_id,
              c.nombre AS categoria_sugerida,
              t.palabra_activadora,
              t.prioridad_sugerida,
              t.grupo_sugerido_id,
              t.tecnico_id,
              t.categoria_final_id,
              t.prioridad_final,
              t.grupo_final_id,
              t.aceptada_sin_correccion,
              t.fecha_decision
         FROM tickets t
         LEFT JOIN categorias c ON c.id = t.categoria_sugerida_id
         WHERE t.id = ?`,
    )
    .get(ticketId) as {
      ticket_id: number;
      categoria_sugerida_id: number | null;
      categoria_sugerida: string | null;
      palabra_activadora: string | null;
      prioridad_sugerida: Prioridad | null;
      grupo_sugerido_id: number | null;
      tecnico_id: number | null;
      categoria_final_id: number | null;
      prioridad_final: Prioridad | null;
      grupo_final_id: number | null;
      aceptada_sin_correccion: number | null;
      fecha_decision: string | null;
    } | undefined;

  if (!fila) return undefined;

  const sugerencia: SugerenciaPersistida = {
    categoria_id: fila.categoria_sugerida_id,
    categoria: fila.categoria_sugerida,
    palabra_activadora: fila.palabra_activadora,
    es_otros: fila.palabra_activadora == null,
    prioridad: fila.prioridad_sugerida,
    grupo_id: fila.grupo_sugerido_id,
    tecnico_id: fila.tecnico_id,
  };

  const decision: DecisionTriaje | null = fila.fecha_decision == null
    ? null
    : {
        categoria_final_id: fila.categoria_final_id ?? fila.categoria_sugerida_id ?? 0,
        prioridad_final: fila.prioridad_final ?? fila.prioridad_sugerida ?? 'Media',
        grupo_final_id: fila.grupo_final_id ?? fila.grupo_sugerido_id ?? null,
        tecnico_id: fila.tecnico_id ?? null,
      };

  return {
    ticket_id: fila.ticket_id,
    pendiente: fila.fecha_decision == null,
    sugerencia,
    decision,
    aceptada_sin_correccion: fila.aceptada_sin_correccion == null ? null : Boolean(fila.aceptada_sin_correccion),
    fecha_decision: fila.fecha_decision,
  };
}

export function registrarDecision(
  ticketId: number,
  decision: DecisionTriaje,
  usuarioId: number,
  conexion: Database.Database = (require('../../db/connection') as typeof import('../../db/connection')).db,
): ResultadoDecision {
  const ejecutar = conexion.transaction((): ResultadoDecision => {
    const ticket = conexion
      .prepare(
        `SELECT id, categoria_sugerida_id, prioridad_sugerida, grupo_sugerido_id, tecnico_id, fecha_decision
           FROM tickets WHERE id = ?`,
      )
      .get(ticketId) as TicketSugerido | undefined;
    if (!ticket) throw new ErrorDecision(404, `El ticket ${ticketId} no existe.`);
    if (ticket.fecha_decision) throw new ErrorDecision(409, `El ticket ${ticketId} ya tiene una decisión registrada.`);
    validarDecision(conexion, decision);

    const comparaciones: [CampoCorregible, number | string | null, number | string | null][] = [
      ['categoria', ticket.categoria_sugerida_id, decision.categoria_final_id],
      ['prioridad', ticket.prioridad_sugerida, decision.prioridad_final],
      ['grupo', ticket.grupo_sugerido_id, decision.grupo_final_id],
      ['tecnico', ticket.tecnico_id, decision.tecnico_id],
    ];
    const correcciones = comparaciones
      .filter(([, sugerido, final]) => aTexto(sugerido) !== aTexto(final))
      // valor_final es NOT NULL en el schema: quitar un técnico/grupo se guarda como 'ninguno'.
      .map(([campo, sugerido, final]) => ({ campo, valor_sugerido: aTexto(sugerido), valor_final: aTexto(final) ?? 'ninguno' }));

    const fecha = new Date().toISOString();
    const aceptada = correcciones.length === 0;

    // La condición fecha_decision IS NULL evita una segunda decisión aunque dos peticiones lleguen a la vez.
    const actualizado = conexion
      .prepare(
        `UPDATE tickets SET categoria_final_id = ?, prioridad_final = ?, grupo_final_id = ?, tecnico_id = ?,
                aceptada_sin_correccion = ?, fecha_decision = ?
          WHERE id = ? AND fecha_decision IS NULL`,
      )
      .run(decision.categoria_final_id, decision.prioridad_final, decision.grupo_final_id, decision.tecnico_id, aceptada ? 1 : 0, fecha, ticketId);
    if (actualizado.changes !== 1) throw new ErrorDecision(409, `El ticket ${ticketId} ya tiene una decisión registrada.`);

    const insertarCorreccion = conexion.prepare(
      'INSERT INTO correcciones(ticket_id, campo, valor_sugerido, valor_final, usuario_id, fecha) VALUES (?,?,?,?,?,?)',
    );
    for (const c of correcciones) insertarCorreccion.run(ticketId, c.campo, c.valor_sugerido, c.valor_final, usuarioId, fecha);

    conexion
      .prepare('INSERT INTO historial(ticket_id, usuario_id, accion, valor_anterior, valor_nuevo, fecha) VALUES (?,?,?,?,?,?)')
      .run(
        ticketId,
        usuarioId,
        aceptada ? 'Sugerencia de triaje aceptada' : 'Sugerencia de triaje corregida',
        JSON.stringify({
          categoria_id: ticket.categoria_sugerida_id,
          prioridad: ticket.prioridad_sugerida,
          grupo_id: ticket.grupo_sugerido_id,
          tecnico_id: ticket.tecnico_id,
        }),
        JSON.stringify(decision),
        fecha,
      );

    return { ticket_id: ticketId, aceptada_sin_correccion: aceptada, correcciones, fecha_decision: fecha };
  });
  return ejecutar();
}
