import { API } from '../../../../shared/contracts/api.contract';
import type { DatosTicket, DecisionTriaje, SugerenciaTriaje } from '../../../../shared/types/triaje.types';
import type { CatalogosTriaje } from './PanelSugerencia';

export interface ResultadoDecision {
  ticket_id: number;
  aceptada_sin_correccion: boolean;
  correcciones: { campo: 'categoria' | 'prioridad' | 'grupo' | 'tecnico'; valor_sugerido: string | null; valor_final: string }[];
  fecha_decision: string;
}

export interface DetalleDecisionTicket {
  ticket_id: number;
  pendiente: boolean;
  sugerencia: SugerenciaTriaje;
  decision: DecisionTriaje | null;
  aceptada_sin_correccion: boolean | null;
  fecha_decision: string | null;
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

async function consultar<T>(url: string): Promise<T> {
  const r = await fetch(url, { credentials: 'include' });
  const datos = await r.json().catch(() => ({}));
  if (!r.ok) {
    const error = datos as { error?: string; message?: string };
    throw new Error(error.message ?? error.error ?? `Error ${r.status}`);
  }
  return datos as T;
}

/** GET /api/triaje/catalogos — catálogos activos de SQLite para agentes y administradores. */
export function obtenerCatalogos(): Promise<CatalogosTriaje> {
  return consultar(API.triaje.catalogs);
}

/** POST /api/triaje/sugerir — lo usa el formulario de TICK-01 antes de guardar. */
export function pedirSugerencia(ticket: Pick<DatosTicket, 'titulo' | 'descripcion' | 'impacto' | 'urgencia'>): Promise<SugerenciaTriaje> {
  return enviar(API.triaje.suggest, ticket);
}

/** GET /api/tickets/:id/decision — recupera la sugerencia original y su decisión confirmada. */
export function obtenerDecisionTicket(ticketId: number): Promise<DetalleDecisionTicket> {
  return consultar(API.tickets.decisionDetail(ticketId));
}

/** POST /api/tickets/:id/decision — aceptar o corregir la sugerencia. */
export function enviarDecision(ticketId: number, decision: DecisionTriaje): Promise<ResultadoDecision> {
  return enviar(API.tickets.decision(ticketId), decision);
}
