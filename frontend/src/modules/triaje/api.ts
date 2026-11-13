import { API } from '../../../../shared/contracts/api.contract';
import type { DatosTicket, DecisionTriaje, SugerenciaTriaje } from '../../../../shared/types/triaje.types';

export interface ResultadoDecision {
  ticket_id: number;
  aceptada_sin_correccion: boolean;
  correcciones: { campo: 'categoria' | 'prioridad' | 'grupo' | 'tecnico'; valor_sugerido: string | null; valor_final: string }[];
  fecha_decision: string;
}

async function enviar<T>(url: string, cuerpo: unknown): Promise<T> {
  const r = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo),
  });
  const datos = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((datos as { message?: string }).message ?? `Error ${r.status}`);
  return datos as T;
}

/** POST /api/triaje/sugerir — lo usa el formulario de TICK-01 antes de guardar. */
export function pedirSugerencia(ticket: DatosTicket): Promise<SugerenciaTriaje> {
  return enviar(API.triaje.suggest, ticket);
}

/** POST /api/tickets/:id/decision — aceptar o corregir la sugerencia. */
export function enviarDecision(ticketId: number, decision: DecisionTriaje): Promise<ResultadoDecision> {
  return enviar(API.tickets.decision(ticketId), decision);
}
