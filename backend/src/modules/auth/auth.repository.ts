import { db } from '../../db/connection';
import type { UsuarioRow } from './auth.types';

const COLUMNAS = 'id, nombre, usuario, password_hash, rol, activo, grupo_id';

export function buscarPorUsuario(usuario: string): UsuarioRow | undefined {
  return db
    .prepare(`SELECT ${COLUMNAS} FROM usuarios WHERE usuario = ?`)
    .get(usuario) as UsuarioRow | undefined;
}

export function buscarPorId(id: number): UsuarioRow | undefined {
  return db
    .prepare(`SELECT ${COLUMNAS} FROM usuarios WHERE id = ?`)
    .get(id) as UsuarioRow | undefined;
}