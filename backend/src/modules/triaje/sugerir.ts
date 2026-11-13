import type Database from 'better-sqlite3';
import { clasificar } from './clasificador';
import { calcularPrioridad, type Impacto, type Prioridad, type Urgencia } from './prioridad';

/** Igual a `SugerenciaTriaje` de shared/types/triaje.types.ts (contrato congelado). */
export interface SugerenciaTriaje {
  categoria_id: number;
  categoria: string;
  palabra_activadora: string | null;
  es_otros: boolean;
  prioridad: Prioridad;
  grupo_id: number | null;
  tecnico_id: number | null;
}

/** Datos del ticket que necesita el triaje (subconjunto de `DatosTicket`). */
export interface TicketParaTriaje {
  titulo?: string;
  descripcion: string;
  impacto: Impacto;
  urgencia: Urgencia;
}

/** Estados que cuentan como carga de trabajo abierta de un técnico. */
export const ESTADOS_ABIERTOS = ['Nuevo', 'Asignado', 'En proceso'] as const;

function conexionPorDefecto(): Database.Database {
  return (require('../../db/connection') as typeof import('../../db/connection')).db;
}

/**
 * Técnico recomendado para un grupo: el técnico activo del grupo con menos
 * tickets abiertos (Nuevo, Asignado, En proceso). Empate → menor id.
 * Devuelve null si el grupo no tiene técnicos activos (nunca inventa uno).
 */
export function recomendarTecnico(grupoId: number | null, conexion: Database.Database = conexionPorDefecto()): number | null {
  if (grupoId == null) return null;
  const marcadores = ESTADOS_ABIERTOS.map(() => '?').join(',');
  const fila = conexion
    .prepare(
      `SELECT u.id, COUNT(t.id) AS abiertos
         FROM usuarios u
         LEFT JOIN tickets t ON t.tecnico_id = u.id AND t.estado IN (${marcadores})
        WHERE u.rol = 'tecnico' AND u.activo = 1 AND u.grupo_id = ?
        GROUP BY u.id
        ORDER BY abiertos ASC, u.id ASC
        LIMIT 1`,
    )
    .get(...ESTADOS_ABIERTOS, grupoId) as { id: number; abiertos: number } | undefined;
  return fila?.id ?? null;
}

/**
 * Sugerencia completa de triaje para un ticket nuevo:
 *  - categoría y palabra activadora con `clasificar` (título + descripción),
 *  - prioridad con `calcularPrioridad(impacto, urgencia)`,
 *  - grupo resolutor de la categoría (solo si el grupo está activo),
 *  - técnico activo del grupo con menos tickets abiertos, o null.
 */
export function sugerir(ticket: TicketParaTriaje, conexion: Database.Database = conexionPorDefecto()): SugerenciaTriaje {
  const texto = [ticket.titulo, ticket.descripcion].filter(Boolean).join('. ');
  const clasificacion = clasificar(texto, conexion);
  const prioridad = calcularPrioridad(ticket.impacto, ticket.urgencia);

  const grupo = conexion
    .prepare(
      `SELECT g.id FROM categorias c JOIN grupos g ON g.id = c.grupo_id
        WHERE c.id = ? AND g.activo = 1`,
    )
    .get(clasificacion.categoria_id) as { id: number } | undefined;
  const grupoId = grupo?.id ?? null;

  return {
    categoria_id: clasificacion.categoria_id,
    categoria: clasificacion.categoria,
    palabra_activadora: clasificacion.palabra_activadora,
    es_otros: clasificacion.es_otros,
    prioridad,
    grupo_id: grupoId,
    tecnico_id: recomendarTecnico(grupoId, conexion),
  };
}
