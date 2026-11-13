import { API } from '../../../../shared/contracts/api.contract';
import type { DatosTicket, EstadoTicket, Impacto, Prioridad, SugerenciaTriaje, Urgencia } from '../../../../shared/types/triaje.types';
import { obtenerTokenCsrf } from '../auth/csrf';

export interface TicketCreado {
  id: number;
  sugerencia: SugerenciaTriaje | null;
}

export interface TicketResumen {
  id: number;
  titulo: string;
  estado: EstadoTicket;
  categoria_sugerida_id: number | null;
  categoria_sugerida: string | null;
  prioridad_sugerida: Prioridad | null;
  tecnico_id: number | null;
  tecnico: string | null;
  fecha_creacion: string;
}

export interface TicketDetalle extends TicketResumen {
  solicitante: string;
  descripcion: string;
  impacto: Impacto;
  urgencia: Urgencia;
}

export interface FiltrosTickets {
  busqueda?: string;
  estado?: EstadoTicket;
  categoria_id?: number;
  prioridad?: Prioridad;
  tecnico_id?: number;
}

export interface EventoHistorial {
  id: number;
  ticket_id: number;
  usuario_id: number;
  usuario: string;
  accion: string;
  valor_anterior: string | null;
  valor_nuevo: string | null;
  fecha: string;
}

async function consultar<T>(url: string): Promise<T> {
  const respuesta = await fetch(url, { credentials: 'include' });
  const cuerpo = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) {
    const error = cuerpo as { message?: string };
    throw new Error(error.message ?? `No se pudo consultar el ticket (${respuesta.status}).`);
  }
  return cuerpo as T;
}

export async function registrarTicket(datos: DatosTicket): Promise<TicketCreado> {
  const tokenCsrf = await obtenerTokenCsrf();
  const respuesta = await fetch(API.tickets.create, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': tokenCsrf },
    body: JSON.stringify(datos),
  });
  const cuerpo = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) {
    const error = cuerpo as { message?: string };
    throw new Error(error.message ?? `No se pudo registrar el ticket (${respuesta.status}).`);
  }
  return cuerpo as TicketCreado;
}

export async function listarTickets(filtros: FiltrosTickets = {}): Promise<TicketResumen[]> {
  const parametros = new URLSearchParams();
  if (filtros.busqueda) parametros.set('busqueda', filtros.busqueda);
  if (filtros.estado) parametros.set('estado', filtros.estado);
  if (filtros.categoria_id !== undefined) parametros.set('categoria_id', String(filtros.categoria_id));
  if (filtros.prioridad) parametros.set('prioridad', filtros.prioridad);
  if (filtros.tecnico_id !== undefined) parametros.set('tecnico_id', String(filtros.tecnico_id));
  const query = parametros.toString();
  const url = query ? `${API.tickets.list}?${query}` : API.tickets.list;
  const respuesta = await consultar<{ tickets: TicketResumen[] }>(url);
  return respuesta.tickets;
}

export function obtenerTicket(id: number): Promise<TicketDetalle> {
  return consultar<TicketDetalle>(API.tickets.detail(id));
}

export async function obtenerHistorial(id: number): Promise<EventoHistorial[]> {
  const respuesta = await consultar<{ historial: EventoHistorial[] }>(API.tickets.history(id));
  return respuesta.historial;
}

export async function actualizarEstadoTicket(
  id: number,
  estado: EstadoTicket,
  motivo?: string,
): Promise<{ ticket_id: number; estado: EstadoTicket; fecha: string }> {
  const tokenCsrf = await obtenerTokenCsrf();
  const respuesta = await fetch(API.tickets.state(id), {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': tokenCsrf },
    body: JSON.stringify(motivo ? { estado, motivo } : { estado }),
  });
  const cuerpo = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) {
    const error = cuerpo as { message?: string };
    throw new Error(error.message ?? `No se pudo cambiar el estado (${respuesta.status}).`);
  }
  return cuerpo as { ticket_id: number; estado: EstadoTicket; fecha: string };
}