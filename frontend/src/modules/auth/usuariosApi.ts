
import type { UsuarioSesion } from './authApi';
import { obtenerTokenCsrf } from './csrf';

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

async function pedir<T>(
  url: string,
  opciones: RequestInit = {},
): Promise<T> {
  const metodo = (opciones.method ?? 'GET').toUpperCase();
  const headers = new Headers(opciones.headers);

  if (opciones.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (!['GET', 'HEAD', 'OPTIONS'].includes(metodo)) {
    headers.set('X-CSRF-Token', await obtenerTokenCsrf());
  }

  const respuesta = await fetch(url, {
    ...opciones,
    method: metodo,
    credentials: 'include',
    headers,
  });

  const cuerpo = await respuesta.json().catch(() => ({}));

  if (!respuesta.ok) {
    throw new Error(cuerpo.error ?? 'Error de conexión');
  }

  return cuerpo as T;
}

export const usuariosApi = {
  listar: () => pedir<UsuarioAdmin[]>('/api/usuarios'),

  grupos: () => pedir<Grupo[]>('/api/usuarios/grupos'),

  crear: (datos: DatosUsuario) =>
    pedir<UsuarioAdmin>('/api/usuarios', {
      method: 'POST',
      body: JSON.stringify(datos),
    }),

  actualizar: (id: number, datos: Partial<DatosUsuario>) =>
    pedir<UsuarioAdmin>(`/api/usuarios/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(datos),
    }),
};
