import type { UsuarioSesion } from './authApi';

export interface UsuarioAdmin extends UsuarioSesion {
  activo: boolean;
}
export interface Grupo {
  id: number;
  nombre: string;
}
export interface DatosUsuario {
  nombre: string;
  usuario: string;
  password?: string;
  rol: UsuarioSesion['rol'];
  grupo_id: number | null;
  activo: boolean;
}

async function pedir<T>(url: string, opciones?: RequestInit): Promise<T> {
  const r = await fetch(url, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...opciones,
  });
  const cuerpo = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(cuerpo.error ?? 'Error de conexión');
  return cuerpo as T;
}

export const usuariosApi = {
  listar: () => pedir<UsuarioAdmin[]>('/api/usuarios'),
  grupos: () => pedir<Grupo[]>('/api/usuarios/grupos'),
  crear: (d: DatosUsuario) =>
    pedir<UsuarioAdmin>('/api/usuarios', { method: 'POST', body: JSON.stringify(d) }),
  actualizar: (id: number, d: Partial<DatosUsuario>) =>
    pedir<UsuarioAdmin>(`/api/usuarios/${id}`, { method: 'PATCH', body: JSON.stringify(d) }),
};