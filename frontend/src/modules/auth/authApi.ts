export interface UsuarioSesion {
  id: number;
  nombre: string;
  usuario: string;
  rol: 'agente' | 'tecnico' | 'administrador';
  grupo_id: number | null;
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

export const authApi = {
  login: (usuario: string, password: string) =>
    pedir<UsuarioSesion>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ usuario, password }),
    }),
  logout: () => pedir<{ mensaje: string }>('/api/auth/logout', { method: 'POST' }),
  me: () => pedir<UsuarioSesion>('/api/auth/me'),
};