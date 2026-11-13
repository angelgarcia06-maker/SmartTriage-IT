import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { authApi, type UsuarioSesion } from './authApi';

interface AuthCtx {
  usuario: UsuarioSesion | null;
  cargando: boolean;
  login: (usuario: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<UsuarioSesion | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    authApi
      .me()
      .then(setUsuario)
      .catch(() => setUsuario(null))
      .finally(() => setCargando(false));
  }, []);

  const login = useCallback(async (u: string, p: string) => {
    setUsuario(await authApi.login(u, p));
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout().catch(() => undefined);
    setUsuario(null);
  }, []);

  return <Ctx.Provider value={{ usuario, cargando, login, logout }}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return c;
}