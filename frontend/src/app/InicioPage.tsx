import { useEffect, useState } from 'react';
import { BrainCircuit, ChartColumn, ClipboardCheck, Database, ShieldCheck, Ticket } from 'lucide-react';
import { useAuth } from '../modules/auth/useAuth';

type Health = { status: string; application: string; version: string; database: string };

const features = [
  { name: 'Autenticación y usuarios', owner: 'Integrante 1', icon: ShieldCheck, status: 'Integrado — AUTH' },
  { name: 'Tickets e historial', owner: 'Integrante 2', icon: Ticket, status: 'Pendiente — TICK' },
  { name: 'Triaje Nivel 1', owner: 'Integrante 3', icon: BrainCircuit, status: 'Integrado — TRI' },
  { name: 'Administración y métricas', owner: 'Integrante 4', icon: ChartColumn, status: 'Integrado — ADM' },
  { name: 'Pruebas e integración', owner: 'Integrante 5', icon: ClipboardCheck, status: 'En preparación — QA' },
];

const ETIQUETA_ROL: Record<string, string> = {
  administrador: 'Administrador',
  agente: 'Agente',
  tecnico: 'Técnico',
};

/** Pantalla de bienvenida autenticada (conserva el panel de arranque original). */
export default function InicioPage() {
  const { usuario } = useAuth();
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/health')
      .then(async (r) => {
        if (!r.ok) throw new Error('API no disponible');
        return r.json();
      })
      .then(setHealth)
      .catch(() => setError('No se puede conectar con Express en el puerto 3000.'));
  }, []);

  return (
    <>
      <h1 className="brand h2">Bienvenido, {usuario?.nombre}</h1>
      <p className="muted mb-4">
        Sesión iniciada como <b>@{usuario?.usuario}</b> · rol{' '}
        <b>{usuario ? (ETIQUETA_ROL[usuario.rol] ?? usuario.rol) : ''}        </b>. Panel de arranque de SmartTriage IT.
      </p>

      <div className="feature-card mb-4">
        <div className="d-flex gap-3 align-items-center">
          <Database color="#2563eb" />
          <div>
            <h2 className="h6 mb-1">Estado de la API y base de datos</h2>
            {health ? (
              <p className="mb-0">
                <span className="status-dot" />
                API conectada · {health.database} · {health.version}
              </p>
            ) : (
              <p className="text-danger mb-0">{error || 'Comprobando conexión...'}</p>
            )}
          </div>
        </div>
      </div>

      <div className="row g-3">
        {features.map((f) => (
          <div className="col-md-6 col-xl-4" key={f.name}>
            <div className="feature-card h-100">
              <f.icon color="#2563eb" size={26} />
              <h3 className="h6 mt-3">{f.name}</h3>
              <p className="small muted mb-2">{f.owner}</p>
              <span className="badge text-bg-light border">{f.status}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="alert alert-info mt-4 small">
        AUTH, Triaje y Administración están integrados. Los paneles administrativos están disponibles
        únicamente para administradores.
      </div>
    </>
  );
}
