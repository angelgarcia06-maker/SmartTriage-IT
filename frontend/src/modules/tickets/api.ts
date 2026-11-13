import { API } from '../../../../shared/contracts/api.contract';
import type { DatosTicket } from '../../../../shared/types/triaje.types';

export interface TicketCreado {
  id: number;
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