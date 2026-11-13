import { API } from '../../../../shared/contracts/api.contract';
import type { DatosTicket, EstadoTicket, Impacto, Prioridad, Urgencia } from '../../../../shared/types/triaje.types';

export interface TicketCreado {
  id: number;
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
  const respuesta = await fetch(API.tickets.create, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
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