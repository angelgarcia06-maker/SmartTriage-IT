import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  BookOpen,
  BrainCircuit,
  ChartColumn,
  House,
  LogOut,
  Menu,
  Settings2,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../modules/auth/useAuth';

const ETIQUETA_ROL: Record<string, string> = {
  administrador: 'Administrador',
  agente: 'Agente',
  tecnico: 'Técnico',
};

const TITULOS: Record<string, string> = {
  '/': 'Inicio',
  '/triaje': 'Triaje inteligente',
  '/usuarios': 'Gestión de usuarios',
  '/admin/dashboard': 'Dashboard',
  '/admin/catalogos': 'Catálogos',
  '/admin/diccionario': 'Diccionario',
};

function iniciales(nombre: string | undefined): string {
  if (!nombre) return '?';
  return nombre
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((parte) => parte[0]?.toLocaleUpperCase() ?? '')
    .join('');
}

/** Marco autenticado: navegación responsive, identidad de sesión y cierre de sesión. */
export default function Layout() {
  const { usuario, logout } = useAuth();
  const navegar = useNavigate();
  const ubicacion = useLocation();
  const [saliendo, setSaliendo] = useState(false);
  const [menuAbierto, setMenuAbierto] = useState(false);

  useEffect(() => {
    setMenuAbierto(false);
  }, [ubicacion.pathname]);

  useEffect(() => {
    if (!menuAbierto) return;
    function cerrarConEscape(evento: KeyboardEvent) {
      if (evento.key === 'Escape') setMenuAbierto(false);
    }
    window.addEventListener('keydown', cerrarConEscape);
    return () => window.removeEventListener('keydown', cerrarConEscape);
  }, [menuAbierto]);

  async function cerrarSesion() {
    setSaliendo(true);
    try {
      await logout();
      navegar('/login', { replace: true });
    } finally {
      setSaliendo(false);
      setMenuAbierto(false);
    }
  }

  function enlaceActivo(isActive: boolean) {
    return `sidebar-link${isActive ? ' is-active' : ''}`;
  }

  const etiquetaRol = usuario ? (ETIQUETA_ROL[usuario.rol] ?? usuario.rol) : '';

  return (
    <div className="app-shell">
      {menuAbierto && (
        <button
          type="button"
          className="mobile-sidebar-backdrop"
          aria-label="Cerrar menú de navegación"
          onClick={() => setMenuAbierto(false)}
        />
      )}

      <aside className={`app-sidebar${menuAbierto ? ' is-open' : ''}`} aria-label="Navegación principal">
        <div className="sidebar-brand">
          <span className="brand-mark" aria-hidden="true"><ShieldCheck size={23} /></span>
          <span>
            <span className="sidebar-brand-name">SmartTriage IT</span>
            <span className="sidebar-brand-caption">Gestión de servicios TI</span>
          </span>
          <button
            type="button"
            className="sidebar-close"
            aria-label="Cerrar menú"
            onClick={() => setMenuAbierto(false)}
          >
            <X size={19} />
          </button>
        </div>

        <div className="sidebar-group-label">Espacio de trabajo</div>
        <nav className="sidebar-nav" aria-label="Espacio de trabajo">
          <NavLink to="/" end className={({ isActive }) => enlaceActivo(isActive)} onClick={() => setMenuAbierto(false)}>
            <House size={18} aria-hidden="true" /> Inicio
          </NavLink>
          {(usuario?.rol === 'agente' || usuario?.rol === 'administrador') && (
            <NavLink to="/triaje" className={({ isActive }) => enlaceActivo(isActive)} onClick={() => setMenuAbierto(false)}>
              <BrainCircuit size={18} aria-hidden="true" /> Triaje
            </NavLink>
          )}
        </nav>

        {usuario?.rol === 'administrador' && (
          <>
            <div className="sidebar-group-label">Administración</div>
            <nav className="sidebar-nav" aria-label="Administración">
              <NavLink to="/admin/dashboard" className={({ isActive }) => enlaceActivo(isActive)} onClick={() => setMenuAbierto(false)}>
                <ChartColumn size={18} aria-hidden="true" /> Dashboard
              </NavLink>
              <NavLink to="/usuarios" className={({ isActive }) => enlaceActivo(isActive)} onClick={() => setMenuAbierto(false)}>
                <Users size={18} aria-hidden="true" /> Usuarios
              </NavLink>
              <NavLink to="/admin/catalogos" className={({ isActive }) => enlaceActivo(isActive)} onClick={() => setMenuAbierto(false)}>
                <Settings2 size={18} aria-hidden="true" /> Catálogos
              </NavLink>
              <NavLink to="/admin/diccionario" className={({ isActive }) => enlaceActivo(isActive)} onClick={() => setMenuAbierto(false)}>
                <BookOpen size={18} aria-hidden="true" /> Diccionario
              </NavLink>
            </nav>
          </>
        )}

        <div className="sidebar-bottom">
          <div className="sidebar-profile">
            <span className="profile-avatar" aria-hidden="true">{iniciales(usuario?.nombre)}</span>
            <span className="profile-copy">
              <span className="profile-name">{usuario?.nombre}</span>
              <span className="profile-role">{etiquetaRol}</span>
            </span>
          </div>
          <button
            type="button"
            className="sidebar-logout"
            onClick={() => void cerrarSesion()}
            disabled={saliendo}
          >
            <LogOut size={17} aria-hidden="true" />
            {saliendo ? 'Cerrando sesión…' : 'Cerrar sesión'}
          </button>
        </div>
      </aside>

      <div className="app-main">
        <header className="app-topbar">
          <div className="topbar-start">
            <button
              type="button"
              className="mobile-menu-button"
              aria-label={menuAbierto ? 'Cerrar menú' : 'Abrir menú'}
              aria-expanded={menuAbierto}
              onClick={() => setMenuAbierto((abierto) => !abierto)}
            >
              {menuAbierto ? <X size={19} /> : <Menu size={19} />}
            </button>
            <div className="screen-heading" aria-live="polite">
              <h1>{TITULOS[ubicacion.pathname] ?? 'SmartTriage IT'}</h1>
              <p>Plataforma de gestión de servicios TI</p>
            </div>
          </div>
          <div className="topbar-end">
            <div className="topbar-user">
              <div className="topbar-user-copy">
                <div className="topbar-user-name">{usuario?.nombre}</div>
                <div className="topbar-user-role">{etiquetaRol}</div>
              </div>
              <span className="profile-avatar" aria-hidden="true">{iniciales(usuario?.nombre)}</span>
            </div>
          </div>
        </header>
        <main className="app-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
