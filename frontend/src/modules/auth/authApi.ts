
import {
  obtenerTokenCsrf,
  invalidarTokenCsrf,
} from './csrf';

export interface UsuarioSesion {
  id: number;
  nombre: string;
  usuario: string;
  rol: 'agente' | 'tecnico' | 'administrador';
  grupo_id: number | null;
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

  const esModificacion = !['GET', 'HEAD', 'OPTIONS'].includes(metodo);

  if (esModificacion) {
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

export const authApi = {
  login: async (usuario: string, password: string) => {
    const resultado = await pedir<UsuarioSesion>(
      '/api/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({ usuario, password }),
      },
    );

    // El login regenera la sesión y, por tanto, cambia el token CSRF.
    invalidarTokenCsrf();

    return resultado;
  },

  logout: async () => {
    const resultado = await pedir<{ mensaje: string }>(
      '/api/auth/logout',
      { method: 'POST' },
    );

    invalidarTokenCsrf();

    return resultado;
  },

  me: () => pedir<UsuarioSesion>('/api/auth/me'),
};
