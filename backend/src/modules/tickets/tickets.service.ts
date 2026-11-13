import type Database from 'better-sqlite3';
import { db as conexionPredeterminada } from '../../db/connection';

export type ImpactoTicket = 'Alto' | 'Medio' | 'Bajo';
export type UrgenciaTicket = 'Alta' | 'Media' | 'Baja';

export interface DatosTicket {
  solicitante: string;
  titulo: string;
  descripcion: string;
  impacto: ImpactoTicket;
  urgencia: UrgenciaTicket;
}

export interface SugerenciaTicket {
  categoria_id: number;
  prioridad: 'Crítica' | 'Alta' | 'Media' | 'Baja';
  grupo_id: number | null;
  tecnico_id: number | null;
  palabra_activadora: string | null;
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
  impacto: ImpactoTicket;
  urgencia: UrgenciaTicket;
}

const joinsTicket = `
  FROM tickets t
  LEFT JOIN categorias c ON c.id = t.categoria_sugerida_id
  LEFT JOIN usuarios tecnico ON tecnico.id = t.tecnico_id`;
const camposResumen = `
  t.id, t.titulo, t.estado,
  c.nombre AS categoria_sugerida,
  t.prioridad_sugerida,
  tecnico.nombre AS tecnico,
  t.fecha_creacion`;

export function listarTickets(conexion: Database.Database, tecnicoId?: number): TicketResumen[] {
  const filtroTecnico = tecnicoId === undefined ? '' : ' WHERE t.tecnico_id = ?';
  const orden = ' ORDER BY t.fecha_creacion DESC, t.id DESC';
  const consulta = conexion.prepare(`SELECT ${camposResumen}${joinsTicket}${filtroTecnico}${orden}`);
  return (tecnicoId === undefined ? consulta.all() : consulta.all(tecnicoId)) as TicketResumen[];
}

export function obtenerTicket(
  id: number,
  conexion: Database.Database,
  tecnicoId?: number,
): TicketDetalle | undefined {
  const filtroTecnico = tecnicoId === undefined ? '' : ' AND t.tecnico_id = ?';
  const consulta = conexion.prepare(
    `SELECT ${camposResumen}, t.solicitante, t.descripcion, t.impacto, t.urgencia
     ${joinsTicket} WHERE t.id = ?${filtroTecnico}`,
  );
  const resultado = tecnicoId === undefined
    ? consulta.get(id)
    : consulta.get(id, tecnicoId);
  return resultado as TicketDetalle | undefined;
}

export function crearTicket(
  datos: DatosTicket,
  usuarioId: number,
  conexion: Database.Database = conexionPredeterminada,
  sugerencia: SugerenciaTicket | null = null,
): number {
  const resultado = conexion.prepare(
    `INSERT INTO tickets (
      solicitante, titulo, descripcion, impacto, urgencia, estado, creado_por, tecnico_id,
      categoria_sugerida_id, prioridad_sugerida, grupo_sugerido_id, palabra_activadora
    ) VALUES (?, ?, ?, ?, ?, 'Nuevo', ?, ?, ?, ?, ?, ?)`,
  ).run(
    datos.solicitante,
    datos.titulo,
    datos.descripcion,
    datos.impacto,
    datos.urgencia,
    usuarioId,
    sugerencia?.tecnico_id ?? null,
    sugerencia?.categoria_id ?? null,
    sugerencia?.prioridad ?? null,
    sugerencia?.grupo_id ?? null,
    sugerencia?.palabra_activadora ?? null,
  );

  return Number(resultado.lastInsertRowid);
}