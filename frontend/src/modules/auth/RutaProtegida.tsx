import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './useAuth';
import type { UsuarioSesion } from './authApi';

interface Props {
  /** Roles permitidos. Si se omite, basta con tener sesión. */
  roles?: UsuarioSesion['rol'][];
  children: ReactNode;
}

/**
 * Guard de UI. La protección real está en el backend (loginRequired/roleRequired);
 * esto solo evita mostrar pantallas a quien no corresponde.
 */
export default function RutaProtegida({ roles, children }: Props) {
  const { usuario, cargando } = useAuth();
  const ubicacion = useLocation();

  if (cargando) return <p className="p-4">Cargando...</p>;

  if (!usuario) {
    return <Navigate to="/login" replace state={{ desde: ubicacion.pathname }} />;
  }

  if (roles && !roles.includes(usuario.rol)) {
    return (
      <div className="container py-5" style={{ maxWidth: 520 }}>
        <div className="alert alert-warning" role="alert">
          <h2 className="h5">Acceso denegado</h2>
          <p className="mb-0">Tu rol (<b>{usuario.rol}</b>) no tiene permiso para ver esta sección.</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}