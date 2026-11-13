import bcrypt from 'bcryptjs';
import * as repo from './auth.repository';
import type { UsuarioPublico, UsuarioRow, UsuarioSesion } from './auth.types';

export function aDtoPublico(u: UsuarioRow): UsuarioPublico {
  return {
    id: u.id,
    nombre: u.nombre,
    usuario: u.usuario,
    rol: u.rol,
    activo: u.activo === 1,
    grupo_id: u.grupo_id,
  };
}

export function aDtoSesion(u: UsuarioRow): UsuarioSesion {
  return { id: u.id, nombre: u.nombre, usuario: u.usuario, rol: u.rol, grupo_id: u.grupo_id };
}

export function obtenerUsuarioPorUsuario(usuario: string): UsuarioPublico | null {
  const u = repo.buscarPorUsuario(usuario);
  return u ? aDtoPublico(u) : null;
}

export function obtenerUsuarioPorId(id: number): UsuarioPublico | null {
  const u = repo.buscarPorId(id);
  return u ? aDtoPublico(u) : null;
}

// Hash falso para comparar aunque el usuario no exista (evita revelar usuarios por tiempo de respuesta).
const HASH_FALSO = bcrypt.hashSync('contrasena-falsa-no-usar', 10);

/** Devuelve el usuario si las credenciales son válidas y está activo; si no, null. */
export function autenticar(usuario: string, password: string): UsuarioSesion | null {
  const u = repo.buscarPorUsuario(usuario);
  const coincide = bcrypt.compareSync(password, u?.password_hash ?? HASH_FALSO);
  if (!u || !coincide || u.activo !== 1) return null;
  return aDtoSesion(u);
}

/** Usuario de la sesión actual (null si no existe o fue desactivado). */
export function usuarioDeSesion(id: number): UsuarioSesion | null {
  const u = repo.buscarPorId(id);
  return u && u.activo === 1 ? aDtoSesion(u) : null;
}