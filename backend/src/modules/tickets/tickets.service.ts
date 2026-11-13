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
  categoria_sugerida_id: number | null;
  categoria_sugerida: string | null;
  prioridad_sugerida: string | null;
  tecnico_id: number | null;
  tecnico: string | null;
  fecha_creacion: string;
}

export interface FiltrosTickets {
  busqueda?: string;
  estado?: string;
  categoriaId?: number;
  prioridad?: string;
  tecnicoId?: number;
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
  t.categoria_sugerida_id,
  c.nombre AS categoria_sugerida,
  t.prioridad_sugerida,
  t.tecnico_id,
  tecnico.nombre AS tecnico,
  t.fecha_creacion`;

export function listarTickets(
  conexion: Database.Database,
  tecnicoSesionId?: number,
  filtros: FiltrosTickets = {},
): TicketResumen[] {
  const condiciones: string[] = [];
  const parametros: (string | number)[] = [];
  if (tecnicoSesionId !== undefined) {
    condiciones.push('t.tecnico_id = ?');
    parametros.push(tecnicoSesionId);
  }
  if (filtros.busqueda !== undefined) {
    condiciones.push('(CAST(t.id AS TEXT) = ? OR t.titulo LIKE ? COLLATE NOCASE OR t.solicitante LIKE ? COLLATE NOCASE)');
    const termino = `%${filtros.busqueda}%`;
    parametros.push(filtros.busqueda, termino, termino);
  }
  if (filtros.estado !== undefined) {
    condiciones.push('t.estado = ?');
    parametros.push(filtros.estado);
  }
  if (filtros.categoriaId !== undefined) {
    condiciones.push('t.categoria_sugerida_id = ?');
    parametros.push(filtros.categoriaId);
  }
  if (filtros.prioridad !== undefined) {
    condiciones.push('t.prioridad_sugerida = ?');
    parametros.push(filtros.prioridad);
  }
  if (filtros.tecnicoId !== undefined) {
    condiciones.push('t.tecnico_id = ?');
    parametros.push(filtros.tecnicoId);
  }
  const where = condiciones.length ? ` WHERE ${condiciones.join(' AND ')}` : '';
  const orden = ' ORDER BY t.fecha_creacion DESC, t.id DESC';
  const consulta = conexion.prepare(`SELECT ${camposResumen}${joinsTicket}${where}${orden}`);
  return consulta.all(...parametros) as TicketResumen[];
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