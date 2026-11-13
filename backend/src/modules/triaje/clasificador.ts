import type Database from 'better-sqlite3';
import { contieneFraseCompleta, normalizarTexto } from './normalizar';

/** Nombre de la categoría de respaldo cuando ninguna palabra clave coincide. */
export const CATEGORIA_OTROS = 'Otros';

/** Resultado de `clasificar` (campos de clasificación de `SugerenciaTriaje` en shared/types). */
export interface ResultadoClasificacion {
  categoria_id: number;
  categoria: string;
  palabra_activadora: string | null;
  es_otros: boolean;
  /** Motivo legible de la clasificación, útil para la pantalla de Admin y para el agente. */
  explicacion: string;
}

/** Una palabra o frase clave del diccionario, tal como está en SQLite. */
export interface EntradaDiccionario {
  palabra_id: number;
  palabra: string;
  categoria_id: number;
  categoria: string;
}

export interface Diccionario {
  entradas: EntradaDiccionario[];
  otros: { id: number; nombre: string };
}

/**
 * Lee el diccionario desde SQLite: palabras clave de categorías activas
 * y la categoría "Otros". Nada está escrito en el código.
 */
export function cargarDiccionario(conexion: Database.Database): Diccionario {
  const entradas = conexion
    .prepare(
      `SELECT p.id AS palabra_id, p.palabra, c.id AS categoria_id, c.nombre AS categoria
         FROM palabras_clave p
         JOIN categorias c ON c.id = p.categoria_id
        WHERE c.activa = 1 AND c.nombre <> ?
        ORDER BY p.id`,
    )
    .all(CATEGORIA_OTROS) as EntradaDiccionario[];

  const otros = conexion
    .prepare('SELECT id, nombre FROM categorias WHERE nombre = ?')
    .get(CATEGORIA_OTROS) as { id: number; nombre: string } | undefined;
  if (!otros) {
    throw new Error(`No existe la categoría "${CATEGORIA_OTROS}". Ejecuta npm run db:seed.`);
  }
  return { entradas, otros };
}

interface Candidata {
  categoria_id: number;
  categoria: string;
  /** Palabra clave más larga que coincidió (la que se muestra como activadora). */
  activadora: string;
  activadoraLongitud: number;
  activadoraId: number;
  /** Cantidad de palabras clave distintas de la categoría que coincidieron. */
  coincidencias: number;
}

/**
 * Clasifica una descripción con un diccionario ya cargado (función pura).
 *
 * Reglas de desempate, en este orden (siempre da el mismo resultado):
 *  1. Gana la categoría cuya palabra/frase coincidente es más larga
 *     ("usuario bloqueado" gana a "usuario").
 *  2. Si empatan, gana la que tiene más palabras clave coincidentes.
 *  3. Si siguen empatadas, gana la categoría con menor id (orden estable).
 * Dentro de una categoría, la activadora es la frase más larga; a igual
 * longitud, la de menor id.
 */
export function clasificarConDiccionario(descripcion: string, diccionario: Diccionario): ResultadoClasificacion {
  const texto = normalizarTexto(descripcion ?? '');
  const candidatas = new Map<number, Candidata>();

  for (const entrada of diccionario.entradas) {
    const frase = normalizarTexto(entrada.palabra);
    if (!contieneFraseCompleta(texto, frase)) continue;

    const actual = candidatas.get(entrada.categoria_id);
    if (!actual) {
      candidatas.set(entrada.categoria_id, {
        categoria_id: entrada.categoria_id,
        categoria: entrada.categoria,
        activadora: entrada.palabra,
        activadoraLongitud: frase.length,
        activadoraId: entrada.palabra_id,
        coincidencias: 1,
      });
      continue;
    }
    actual.coincidencias += 1;
    const esMejor =
      frase.length > actual.activadoraLongitud ||
      (frase.length === actual.activadoraLongitud && entrada.palabra_id < actual.activadoraId);
    if (esMejor) {
      actual.activadora = entrada.palabra;
      actual.activadoraLongitud = frase.length;
      actual.activadoraId = entrada.palabra_id;
    }
  }

  const ganadora = [...candidatas.values()].sort(
    (a, b) =>
      b.activadoraLongitud - a.activadoraLongitud ||
      b.coincidencias - a.coincidencias ||
      a.categoria_id - b.categoria_id,
  )[0];

  if (!ganadora) {
    return {
      categoria_id: diccionario.otros.id,
      categoria: diccionario.otros.nombre,
      palabra_activadora: null,
      es_otros: true,
      explicacion: 'Ninguna palabra clave del diccionario coincide con la descripción; se asigna "Otros" para revisión manual.',
    };
  }

  return {
    categoria_id: ganadora.categoria_id,
    categoria: ganadora.categoria,
    palabra_activadora: ganadora.activadora,
    es_otros: false,
    explicacion:
      ganadora.coincidencias > 1
        ? `Coincide con "${ganadora.activadora}" y ${ganadora.coincidencias - 1} palabra(s) clave más de ${ganadora.categoria}.`
        : `Coincide con la palabra clave "${ganadora.activadora}" de ${ganadora.categoria}.`,
  };
}

/**
 * Clasificador Nivel 1: lee el diccionario actual desde SQLite y clasifica
 * la descripción. Lo usan `sugerir()` (TRI-03), Tickets y Admin ("probar frase").
 * Si no se pasa conexión, usa la base de datos del proyecto.
 */
export function clasificar(descripcion: string, conexion?: Database.Database): ResultadoClasificacion {
  // Import diferido: así los tests pueden usar una base en memoria sin abrir data/smarttriage.db.
  const bd = conexion ?? (require('../../db/connection') as typeof import('../../db/connection')).db;
  return clasificarConDiccionario(descripcion, cargarDiccionario(bd));
}
