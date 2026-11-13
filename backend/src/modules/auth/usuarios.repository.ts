import { db } from '../../db/connection';
import type { UsuarioRow } from './auth.types';

const COLUMNAS = 'id, nombre, usuario, password_hash, rol, activo, grupo_id';

export interface GrupoRow {
  id: number;
  nombre: string;
  activo: number;
}

export interface NuevoUsuario {
  nombre: string;
  usuario: string;
  password_hash: string;
  rol: UsuarioRow['rol'];
  activo: 0 | 1;
  grupo_id: number | null;
}

// Lista blanca fija: los nombres de columna nunca vienen del cliente.
const COLUMNAS_EDITABLES = ['nombre', 'usuario', 'password_hash', 'rol', 'activo', 'grupo_id'] as const;
export type CamposActualizables = Partial<Pick<UsuarioRow, (typeof COLUMNAS_EDITABLES)[number]>>;

export function listarUsuarios(): UsuarioRow[] {
  return db
    .prepare(`SELECT ${COLUMNAS} FROM usuarios ORDER BY nombre COLLATE NOCASE`)
    .all() as UsuarioRow[];
}

export function listarGruposActivos(): GrupoRow[] {
  return db
    .prepare('SELECT id, nombre, activo FROM grupos WHERE activo = 1 ORDER BY nombre')
    .all() as GrupoRow[];
}

export function buscarGrupo(id: number): GrupoRow | undefined {
  return db.prepare('SELECT id, nombre, activo FROM grupos WHERE id = ?').get(id) as GrupoRow | undefined;
}

/** Duplicado sin distinguir mayúsculas; `excluirId` evita chocar consigo mismo al editar. */
export function existeUsuario(usuario: string, excluirId = 0): boolean {
  return (
    db
      .prepare('SELECT 1 AS x FROM usuarios WHERE LOWER(usuario) = LOWER(?) AND id <> ?')
      .get(usuario, excluirId) !== undefined
  );
}

export function contarAdminsActivos(): number {
  const r = db
    .prepare("SELECT COUNT(*) AS n FROM usuarios WHERE rol = 'administrador' AND activo = 1")
    .get() as { n: number };
  return r.n;
}

export function insertarUsuario(u: NuevoUsuario): number {
  const r = db
    .prepare('INSERT INTO usuarios (nombre, usuario, password_hash, rol, activo, grupo_id) VALUES (?, ?, ?, ?, ?, ?)')
    .run(u.nombre, u.usuario, u.password_hash, u.rol, u.activo, u.grupo_id);
  return Number(r.lastInsertRowid);
}

export function actualizarUsuario(id: number, campos: CamposActualizables): void {
  const claves = COLUMNAS_EDITABLES.filter((k) => campos[k] !== undefined);
  if (claves.length === 0) return;
  const asignaciones = claves.map((k) => `${k} = ?`).join(', ');
  const valores = claves.map((k) => campos[k]);
  db.prepare(`UPDATE usuarios SET ${asignaciones} WHERE id = ?`).run(...valores, id);
}