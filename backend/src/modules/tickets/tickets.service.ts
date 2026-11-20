import type Database from 'better-sqlite3';
function obtenerConexionPredeterminada(): Database.Database {
  return (require('../../db/connection') as typeof import('../../db/connection')).db;
}

export type ImpactoTicket = 'Alto' | 'Medio' | 'Bajo';
export type UrgenciaTicket = 'Alta' | 'Media' | 'Baja';
export type EstadoTicket = 'Nuevo' | 'Asignado' | 'En proceso' | 'Resuelto' | 'Cerrado';

export interface DatosTicket {
  solicitante: string;
  titulo: string;
  descripcion: string;
  impacto: ImpactoTicket;
  urgencia: UrgenciaTicket;
}

export interface SugerenciaTicket {
  categoria_id: number;
  categoria: string;
  es_otros: boolean;
  prioridad: 'Crítica' | 'Alta' | 'Media' | 'Baja';
  grupo_id: number | null;
  tecnico_id: number | null;
  palabra_activadora: string | null;
}

export interface TicketResumen {
  id: number;
  titulo: string;
  estado: EstadoTicket;
  categoria_sugerida_id: number | null;
  categoria_sugerida: string | null;
  prioridad_sugerida: string | null;
  categoria_final_id: number | null;
  categoria_final: string | null;
  prioridad_final: string | null;
  categoria_id: number | null;
  categoria: string | null;
  prioridad: string | null;
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

export interface PaginaTickets {
  tickets: TicketResumen[];
  total: number;
  pagina: number;
  limite: number;
  totalPaginas: number;
  categorias: Array<{ id: number; nombre: string }>;
  tecnicos: Array<{ id: number; nombre: string }>;
}

export interface TicketDetalle extends TicketResumen {
  solicitante: string;
  descripcion: string;
  impacto: ImpactoTicket;
  urgencia: UrgenciaTicket;
}

export interface UsuarioTicket {
  id: number;
  rol: string;
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

export interface ResultadoCambioEstado {
  ticket_id: number;
  estado: EstadoTicket;
  fecha: string;
}

export class ErrorEstadoTicket extends Error {
  constructor(readonly status: 400 | 403 | 404 | 409, message: string) {
    super(message);
    this.name = 'ErrorEstadoTicket';
  }
}

const TRANSICIONES_ESTADO: Record<EstadoTicket, readonly EstadoTicket[]> = {
  Nuevo: ['Asignado'],
  Asignado: ['En proceso'],
  'En proceso': ['Resuelto'],
  Resuelto: ['En proceso', 'Cerrado'],
  Cerrado: [],
};

const joinsTicket = `
  FROM tickets t
  LEFT JOIN categorias cs ON cs.id = t.categoria_sugerida_id
  LEFT JOIN categorias cf ON cf.id = t.categoria_final_id
  LEFT JOIN usuarios tecnico ON tecnico.id = t.tecnico_id`;
const camposResumen = `
  t.id, t.titulo, t.estado,
  t.categoria_sugerida_id,
  cs.nombre AS categoria_sugerida,
  t.prioridad_sugerida,
  t.categoria_final_id,
  cf.nombre AS categoria_final,
  t.prioridad_final,
  COALESCE(t.categoria_final_id, t.categoria_sugerida_id) AS categoria_id,
  COALESCE(cf.nombre, cs.nombre) AS categoria,
  COALESCE(t.prioridad_final, t.prioridad_sugerida) AS prioridad,
  t.tecnico_id,
  tecnico.nombre AS tecnico,
  t.fecha_creacion`;

function construirCondiciones(
  tecnicoSesionId?: number,
  filtros: FiltrosTickets = {},
): { where: string; parametros: (string | number)[] } {
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
    condiciones.push('COALESCE(t.categoria_final_id, t.categoria_sugerida_id) = ?');
    parametros.push(filtros.categoriaId);
  }
  if (filtros.prioridad !== undefined) {
    condiciones.push('COALESCE(t.prioridad_final, t.prioridad_sugerida) = ?');
    parametros.push(filtros.prioridad);
  }
  if (filtros.tecnicoId !== undefined) {
    condiciones.push('t.tecnico_id = ?');
    parametros.push(filtros.tecnicoId);
  }
  const where = condiciones.length ? ` WHERE ${condiciones.join(' AND ')}` : '';
  return { where, parametros };
}

export function listarTickets(
  conexion: Database.Database,
  tecnicoSesionId?: number,
  filtros: FiltrosTickets = {},
): TicketResumen[] {
  const { where, parametros } = construirCondiciones(tecnicoSesionId, filtros);
  const orden = ' ORDER BY t.fecha_creacion DESC, t.id DESC';
  const consulta = conexion.prepare(`SELECT ${camposResumen}${joinsTicket}${where}${orden}`);
  return consulta.all(...parametros) as TicketResumen[];
}

export function listarTicketsPaginado(
  conexion: Database.Database,
  tecnicoSesionId: number | undefined,
  filtros: FiltrosTickets,
  paginaSolicitada: number,
  limite: number,
): PaginaTickets {
  const { where, parametros } = construirCondiciones(tecnicoSesionId, filtros);
  const conteo = conexion.prepare(`SELECT COUNT(*) AS total FROM tickets t${where}`)
    .get(...parametros) as { total: number };
  const totalPaginas = Math.ceil(conteo.total / limite);
  const pagina = totalPaginas === 0
    ? 1
    : Math.min(paginaSolicitada, totalPaginas);
  const tickets = conexion.prepare(`
    SELECT ${camposResumen}${joinsTicket}${where}
    ORDER BY t.fecha_creacion DESC, t.id DESC
    LIMIT ? OFFSET ?
  `).all(...parametros, limite, (pagina - 1) * limite) as TicketResumen[];

  const parametrosTecnico = tecnicoSesionId === undefined ? [] : [tecnicoSesionId];
  const categorias = conexion.prepare(`
    SELECT DISTINCT COALESCE(cf.id, cs.id) AS id, COALESCE(cf.nombre, cs.nombre) AS nombre
    FROM tickets t
    LEFT JOIN categorias cs ON cs.id = t.categoria_sugerida_id
    LEFT JOIN categorias cf ON cf.id = t.categoria_final_id
    WHERE COALESCE(cf.id, cs.id) IS NOT NULL${tecnicoSesionId === undefined ? '' : ' AND t.tecnico_id = ?'}
    ORDER BY nombre
  `).all(...parametrosTecnico) as Array<{ id: number; nombre: string }>;
  const tecnicos = conexion.prepare(`
    SELECT DISTINCT u.id, u.nombre
    FROM tickets t
    JOIN usuarios u ON u.id = t.tecnico_id
    ${tecnicoSesionId === undefined ? '' : ' WHERE t.tecnico_id = ?'}
    ORDER BY u.nombre
  `).all(...parametrosTecnico) as Array<{ id: number; nombre: string }>;

  return {
    tickets,
    total: conteo.total,
    pagina,
    limite,
    totalPaginas,
    categorias,
    tecnicos,
  };
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

export function obtenerHistorial(ticketId: number, conexion: Database.Database): EventoHistorial[] {
  return conexion.prepare(`
    SELECT h.id, h.ticket_id, h.usuario_id, u.nombre AS usuario, h.accion,
           h.valor_anterior, h.valor_nuevo, h.fecha
    FROM historial h
    JOIN usuarios u ON u.id = h.usuario_id
    WHERE h.ticket_id = ?
    ORDER BY h.fecha ASC, h.id ASC
  `).all(ticketId) as EventoHistorial[];
}

export function registrarHistorial(
  ticketId: number,
  usuarioId: number,
  accion: string,
  anterior: string | null,
  nuevo: string | null,
  conexion: Database.Database = obtenerConexionPredeterminada(),
): number {
  const resultado = conexion.prepare(`
    INSERT INTO historial (ticket_id, usuario_id, accion, valor_anterior, valor_nuevo)
    VALUES (?, ?, ?, ?, ?)
  `).run(ticketId, usuarioId, accion, anterior, nuevo);
  return Number(resultado.lastInsertRowid);
}

export function cambiarEstadoTicket(
  ticketId: number,
  estadoNuevo: EstadoTicket,
  usuario: UsuarioTicket,
  motivo: string | undefined,
  conexion: Database.Database = obtenerConexionPredeterminada(),
): ResultadoCambioEstado {
  const transaccion = conexion.transaction(() => {
    const ticket = conexion.prepare('SELECT estado, tecnico_id FROM tickets WHERE id = ?').get(ticketId) as
      { estado: EstadoTicket; tecnico_id: number | null } | undefined;
    if (!ticket) throw new ErrorEstadoTicket(404, 'Ticket no encontrado.');
    if (!['agente', 'administrador', 'tecnico'].includes(usuario.rol)) {
      throw new ErrorEstadoTicket(403, 'No tienes permiso para cambiar el estado.');
    }
    if (usuario.rol === 'tecnico' && ticket.tecnico_id !== usuario.id) {
      throw new ErrorEstadoTicket(403, 'Solo puedes cambiar el estado de tickets asignados a ti.');
    }

    const reapertura = ticket.estado === 'Resuelto' && estadoNuevo === 'En proceso';
    const motivoLimpio = motivo?.trim();
    if (reapertura && !motivoLimpio) {
      throw new ErrorEstadoTicket(400, 'Indica el motivo para reabrir el ticket.');
    }
    if (!TRANSICIONES_ESTADO[ticket.estado].includes(estadoNuevo)) {
      throw new ErrorEstadoTicket(409, `Transición no permitida: ${ticket.estado} → ${estadoNuevo}.`);
    }

    conexion.prepare('UPDATE tickets SET estado = ? WHERE id = ?').run(estadoNuevo, ticketId);
    const accion = reapertura ? `Reapertura: ${motivoLimpio}` : 'Cambio de estado';
    const historialId = registrarHistorial(ticketId, usuario.id, accion, ticket.estado, estadoNuevo, conexion);
    const registro = conexion.prepare('SELECT fecha FROM historial WHERE id = ?').get(historialId) as { fecha: string };
    return { ticket_id: ticketId, estado: estadoNuevo, fecha: registro.fecha };
  });

  return transaccion.immediate();
}

export function crearTicket(
  datos: DatosTicket,
  usuarioId: number,
  conexion: Database.Database = obtenerConexionPredeterminada(),
  sugerencia: SugerenciaTicket | null = null,
): number {
  const resultado = conexion.prepare(
    `INSERT INTO tickets (
      solicitante, titulo, descripcion, impacto, urgencia, estado, creado_por, tecnico_id, tecnico_sugerido_id,
      categoria_sugerida_id, prioridad_sugerida, grupo_sugerido_id, palabra_activadora
    ) VALUES (?, ?, ?, ?, ?, 'Nuevo', ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    datos.solicitante,
    datos.titulo,
    datos.descripcion,
    datos.impacto,
    datos.urgencia,
    usuarioId,
    sugerencia?.tecnico_id ?? null,
    sugerencia?.tecnico_id ?? null,
    sugerencia?.categoria_id ?? null,
    sugerencia?.prioridad ?? null,
    sugerencia?.grupo_id ?? null,
    sugerencia?.palabra_activadora ?? null,
  );

  return Number(resultado.lastInsertRowid);
}
