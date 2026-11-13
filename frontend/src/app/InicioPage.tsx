import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen,
  BrainCircuit,
  ChartColumn,
  Database,
  Settings2,
  Users,
} from 'lucide-react';
import { useAuth } from '../modules/auth/useAuth';

type Health = { status: string; application: string; version: string; database: string };
type Acceso = {
  nombre: string;
  descripcion: string;
  destino: string;
  icono: typeof BrainCircuit;
};

const ETIQUETA_ROL: Record<string, string> = {
  administrador: 'administrador',
  agente: 'agente de soporte',
  tecnico: 'técnico de soporte',
};

const ACCESOS_ADMIN: Acceso[] = [
  { nombre: 'Dashboard', descripcion: 'Consulta las métricas y decisiones confirmadas.', destino: '/admin/dashboard', icono: ChartColumn },
  { nombre: 'Usuarios', descripcion: 'Administra cuentas, roles y grupos de soporte.', destino: '/usuarios', icono: Users },
  { nombre: 'Catálogos', descripcion: 'Gestiona categorías y grupos de soporte.', destino: '/admin/catalogos', icono: Settings2 },
  { nombre: 'Diccionario', descripcion: 'Mantén las palabras clave de clasificación.', destino: '/admin/diccionario', icono: BookOpen },
];

/** Inicio personalizado por rol, sin estadísticas ni actividad simuladas. */
export default function InicioPage() {
  const { usuario } = useAuth();
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState('');
  const rol = usuario?.rol;

  useEffect(() => {
    let vigente = true;
    fetch('/api/health')
      .then(async (respuesta) => {
        if (!respuesta.ok) throw new Error('El servicio no está disponible en este momento.');
        return respuesta.json() as Promise<Health>;
      })
      .then((estado) => {
        if (vigente) setHealth(estado);
      })
      .catch((err: unknown) => {
        if (vigente) {
          setError(err instanceof Error ? err.message : 'No se pudo consultar el estado del servicio.');
        }
      });
    return () => { vigente = false; };
  }, []);

  const accesos = rol === 'administrador'
    ? ACCESOS_ADMIN
    : rol === 'agente'
      ? [{
          nombre: 'Triaje inteligente',
          descripcion: 'Analiza una incidencia y consulta su categoría y asignación sugeridas.',
          destino: '/triaje',
          icono: BrainCircuit,
        }]
      : [];

  return (
    <div className="page-section">
      <div className="home-welcome">
        <h2>Bienvenido, {usuario?.nombre}</h2>
        <p>
          Tu espacio de trabajo como {rol ? (ETIQUETA_ROL[rol] ?? rol) : 'usuario'} en SmartTriage IT.
        </p>
      </div>

      {accesos.length > 0 ? (
        <section aria-label="Accesos disponibles">
          <div className="row g-3">
            {accesos.map(({ nombre, descripcion, destino, icono: Icono }) => (
              <div className="col-md-6 col-xl-4" key={destino}>
                <Link to={destino} className="quick-link-card">
                  <span className="quick-link-icon" aria-hidden="true"><Icono size={20} /></span>
                  <span className="quick-link-title">{nombre}</span>
                  <span className="quick-link-description">{descripcion}</span>
                </Link>
              </div>
            ))}
          </div>
        </section>
      ) : rol === 'tecnico' ? (
        <section className="empty-state" aria-labelledby="espacio-tecnico">
          <h2 id="espacio-tecnico">Espacio de trabajo</h2>
          <p>Las herramientas para las tareas de soporte estarán disponibles aquí.</p>
        </section>
      ) : null}

      <section className="health-card mt-4" aria-labelledby="estado-servicio">
        <span className={`health-icon${health?.status === 'ok' ? ' is-online' : error ? ' is-offline' : ''}`} aria-hidden="true">
          <Database size={20} />
        </span>
        <div>
          <h2 id="estado-servicio" className="health-title">Estado del servicio</h2>
          {health ? (
            <p className="health-detail">
              <span className="status-dot" />
              API {health.application} conectada · Base de datos {health.database} · Versión {health.version}
            </p>
          ) : error ? (
            <p className="health-detail" role="status">{error}</p>
          ) : (
            <p className="health-detail" role="status">Comprobando disponibilidad…</p>
          )}
        </div>
      </section>
    </div>
  );
}
