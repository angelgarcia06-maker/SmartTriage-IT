import { API } from '../../../../shared/contracts/api.contract';
import type { DatosTicket } from '../../../../shared/types/triaje.types';

export interface TicketCreado {
  id: number;
}

export interface TicketResumen {
  id: number;
  titulo: string;
  estado: string;
  categoria_sugerida: string | null;
  prioridad_sugerida: string | null;
  tecnico: string | null;
  fecha_creacion: string;
}

export interface TicketDetalle extends TicketResumen {
  solicitante: string;
  descripcion: string;
  impacto: string;
  urgencia: string;
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

export async function listarTickets(): Promise<TicketResumen[]> {
  const respuesta = await consultar<{ tickets: TicketResumen[] }>(API.tickets.list);
  return respuesta.tickets;
}

export function obtenerTicket(id: number): Promise<TicketDetalle> {
  return consultar<TicketDetalle>(API.tickets.detail(id));
}