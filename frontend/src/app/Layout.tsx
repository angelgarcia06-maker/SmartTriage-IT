import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Home, LogOut, ShieldCheck, Users } from 'lucide-react';
import { useAuth } from '../modules/auth/useAuth';

const ETIQUETA_ROL: Record<string, string> = {
  administrador: 'Administrador',
  agente: 'Agente',
  tecnico: 'Técnico',
};

const claseNav = ({ isActive }: { isActive: boolean }) =>
  `nav-link d-flex align-items-center gap-2 ${isActive ? 'text-white fw-semibold' : 'text-white-50'}`;

/** Marco autenticado: barra lateral, identidad de la sesión y cierre de sesión. */
export default function Layout() {
  const { usuario, logout } = useAuth();
  const navegar = useNavigate();
  const [saliendo, setSaliendo] = useState(false);

  async function cerrarSesion() {
    setSaliendo(true);
    try {
      await logout();
      navegar('/login', { replace: true });
    } finally {
      setSaliendo(false);
    }
  }

  return (
    <div className="container-fluid">
      <div className="row">
        <aside className="col-lg-3 col-xl-2 sidebar p-4 d-flex flex-column">
          <div className="d-flex align-items-center gap-2 mb-4">
            <ShieldCheck size={29} />
            <span className="brand fs-4">SmartTriage IT</span>
          </div>
          <p className="text-white-50 small">Mesa de ayuda · Gestión del Servicio TI</p>
          <hr className="border-secondary" />

          <nav className="nav flex-column gap-1">
            <NavLink to="/" end className={claseNav}>
              <Home size={18} /> Inicio
            </NavLink>
            {usuario?.rol === 'administrador' && (
              <NavLink to="/usuarios" className={claseNav}>
                <Users size={18} /> Gestión de usuarios
              </NavLink>
            )}
          </nav>

          <div className="mt-auto pt-3">
            <div className="small text-white-50">Sesión iniciada</div>
            <div className="text-white">{usuario?.nombre}</div>
            <div className="small text-white-50 mb-2">
              @{usuario?.usuario} · {usuario ? (ETIQUETA_ROL[usuario.rol] ?? usuario.rol) : ''}
            </div>
            <button
              type="button"
              className="btn btn-sm btn-outline-light w-100"
              onClick={() => void cerrarSesion()}
              disabled={saliendo}
            >
              <LogOut size={16} className="me-1" />
              {saliendo ? 'Cerrando...' : 'Cerrar sesión'}
            </button>
            <p className="small text-white-50 mt-3 mb-0">Prototipo académico · v0.1.0</p>
          </div>
        </aside>

        <main className="col-lg-9 col-xl-10 p-4 p-lg-5">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
