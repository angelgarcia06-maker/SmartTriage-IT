import * as repo from './auth.repository';
import type { UsuarioPublico, UsuarioRow } from './auth.types';

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

export function obtenerUsuarioPorUsuario(usuario: string): UsuarioPublico | null {
  const u = repo.buscarPorUsuario(usuario);
  return u ? aDtoPublico(u) : null;
}

export function obtenerUsuarioPorId(id: number): UsuarioPublico | null {
  const u = repo.buscarPorId(id);
  return u ? aDtoPublico(u) : null;
}