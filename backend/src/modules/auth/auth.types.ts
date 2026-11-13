/**
 * Rol local de AUTH-01.
 *
 * Decisión temporal (TS6059): el backend compila con `rootDir: "src"` y los
 * contratos compartidos viven en `shared/types`, fuera de esa carpeta. Importar
 * `Rol` desde `shared/types/triaje.types.ts` haría que TypeScript incluya un
 * archivo fuera de `rootDir` (TS6059) y cambiar `rootDir` alteraría el layout de
 * `dist` que usa `npm start`.
 *
 * Mientras el integrador no adopte una solución de monorepositorio (paquete
 * interno con declaraciones emitidas o project references), se mantiene este
 * alias. Sus valores DEBEN coincidir exactamente con `Rol` de
 * `shared/types/triaje.types.ts`.
 */
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

/** DTO público: NUNCA incluye password_hash. */
export interface UsuarioPublico {
  id: number;
  nombre: string;
  usuario: string;
  rol: RolAuth;
  activo: boolean;
  grupo_id: number | null;
}