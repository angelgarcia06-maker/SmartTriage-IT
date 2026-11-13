// TODO(AUTH-01): reemplazar por `import type { Rol } from 'shared/types/triaje.types'`
// cuando el Integrante 5 ajuste el rootDir/paths del backend.
// Debe mantenerse idéntico a Rol en shared/types/triaje.types.ts.
export type RolAuth = 'agente' | 'tecnico' | 'administrador';

/** Fila tal como viene de la BD (uso interno, incluye el hash). */
export interface UsuarioRow {
  id: number;
  nombre: string;
  usuario: string;
  password_hash: string;
  rol: RolAuth;
  activo: number;
  grupo_id: number | null;
}

/** DTO público (AUTH-01): NUNCA incluye password_hash. */
export interface UsuarioPublico {
  id: number;
  nombre: string;
  usuario: string;
  rol: RolAuth;
  activo: boolean;
  grupo_id: number | null;
}

/** DTO de sesión (AUTH-02): { id, nombre, usuario, rol, grupo_id }. */
export type UsuarioSesion = Omit<UsuarioPublico, 'activo'>;

declare module 'express-session' {
  interface SessionData {
    userId?: number;
  }
}