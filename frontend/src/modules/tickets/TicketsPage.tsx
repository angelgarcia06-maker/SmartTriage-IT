import { useEffect, useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowUpRight, Plus, RefreshCw, Search, Ticket, X } from 'lucide-react';
import type { EstadoTicket, Prioridad } from '../../../../shared/types/triaje.types';
import TicketCreateForm from './TicketCreateForm';
import {
  actualizarEstadoTicket,
  listarTickets,
  obtenerHistorial,
  obtenerTicket,
  type EventoHistorial,
  type FiltrosTickets,
  type TicketDetalle,
  type TicketResumen,
} from './api';
import { useAuth } from '../auth/useAuth';

type Vista = { tipo: 'lista' } | { tipo: 'nuevo' } | { tipo: 'detalle'; id: number };
type CamposFiltro = { busqueda: string; estado: string; categoria_id: string; prioridad: string; tecnico_id: string };

const ESTADOS: EstadoTicket[] = ['Nuevo', 'Asignado', 'En proceso', 'Resuelto', 'Cerrado'];
const PRIORIDADES: Prioridad[] = ['Crítica', 'Alta', 'Media', 'Baja'];
const CAMPOS_FILTRO_VACIOS: CamposFiltro = { busqueda: '', estado: '', categoria_id: '', prioridad: '', tecnico_id: '' };
const SIGUIENTE_ESTADO: Partial<Record<EstadoTicket, { estado: EstadoTicket; etiqueta: string }>> = {
  Nuevo: { estado: 'Asignado', etiqueta: 'Asignar' },
  Asignado: { estado: 'En proceso', etiqueta: 'Iniciar atención' },
  'En proceso': { estado: 'Resuelto', etiqueta: 'Marcar resuelto' },
  Resuelto: { estado: 'Cerrado', etiqueta: 'Cerrar ticket' },
};

function fechaLegible(fecha: string): string {
  const valor = new Date(fecha);
  return Number.isNaN(valor.getTime())
    ? fecha
    : new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(valor);
}

export default function TicketsPage() {
  const [vista, setVista] = useState<Vista>({ tipo: 'lista' });
  const [revision, setRevision] = useState(0);
  const { usuario } = useAuth();

  if (vista.tipo === 'nuevo') {
    return (
      <div className="page-section">
        <button type="button" className="btn btn-link px-0 mb-2" onClick={() => setVista({ tipo: 'lista' })}>
          <ArrowLeft size={17} className="me-1" aria-hidden="true" />Volver al listado
        </button>
        <TicketCreateForm
          onCreado={() => setRevision((actual) => actual + 1)}
          onAbrirTicket={(id) => setVista({ tipo: 'detalle', id })}
        />
      </div>
    );
  }

  if (vista.tipo === 'detalle') {
    return <DetalleTicket id={vista.id} onVolver={() => {
      setVista({ tipo: 'lista' });
      setRevision((actual) => actual + 1);
    }} />;
  }

  return (
    <ListadoTickets
      revision={revision}
      puedeCrear={usuario?.rol === 'agente' || usuario?.rol === 'administrador'}
      onCrear={() => setVista({ tipo: 'nuevo' })}
      onAbrir={(id) => setVista({ tipo: 'detalle', id })}
      onActualizar={() => setRevision((actual) => actual + 1)}
    />
  );
}

interface ListadoProps {
  revision: number;
  puedeCrear: boolean;
  onCrear: () => void;
  onAbrir: (id: number) => void;
  onActualizar: () => void;
}

function ListadoTickets({ revision, puedeCrear, onCrear, onAbrir, onActualizar }: ListadoProps) {
  const [tickets, setTickets] = useState<TicketResumen[] | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [criterios, setCriterios] = useState<FiltrosTickets>({});
  const [camposFiltro, setCamposFiltro] = useState<CamposFiltro>(CAMPOS_FILTRO_VACIOS);
  const [categorias, setCategorias] = useState<{ id: number; nombre: string }[]>([]);
  const [tecnicos, setTecnicos] = useState<{ id: number; nombre: string }[]>([]);
  const hayFiltros = Object.values(criterios).some((valor) => valor !== undefined);

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    setError('');
    listarTickets(criterios)
      .then((resultado) => {
        if (!vigente) return;
        setTickets(resultado);
        if (!hayFiltros) {
          const opcionesCategoria = new Map<number, string>();
          const opcionesTecnico = new Map<number, string>();
          resultado.forEach((ticket) => {
            if (ticket.categoria_sugerida_id !== null && ticket.categoria_sugerida) {
              opcionesCategoria.set(ticket.categoria_sugerida_id, ticket.categoria_sugerida);
            }
            if (ticket.tecnico_id !== null && ticket.tecnico) {
              opcionesTecnico.set(ticket.tecnico_id, ticket.tecnico);
            }
          });
          setCategorias([...opcionesCategoria].map(([id, nombre]) => ({ id, nombre })).sort((a, b) => a.nombre.localeCompare(b.nombre)));
          setTecnicos([...opcionesTecnico].map(([id, nombre]) => ({ id, nombre })).sort((a, b) => a.nombre.localeCompare(b.nombre)));
        }
      })
      .catch((err: unknown) => {
        if (vigente) setError(err instanceof Error ? err.message : 'No se pudieron cargar los tickets.');
      })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [criterios, hayFiltros, revision]);

  function enviarFiltros(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const nuevos: FiltrosTickets = {};
    if (camposFiltro.busqueda.trim()) nuevos.busqueda = camposFiltro.busqueda.trim();
    if (camposFiltro.estado) nuevos.estado = camposFiltro.estado as EstadoTicket;
    if (camposFiltro.categoria_id) nuevos.categoria_id = Number(camposFiltro.categoria_id);
    if (camposFiltro.prioridad) nuevos.prioridad = camposFiltro.prioridad as Prioridad;
    if (camposFiltro.tecnico_id) nuevos.tecnico_id = Number(camposFiltro.tecnico_id);
    setCriterios(nuevos);
  }

  function limpiarFiltros() {
    setCamposFiltro(CAMPOS_FILTRO_VACIOS);
    setCriterios({});
  }

  return (
    <section className="page-section" aria-labelledby="lista-tickets-titulo">
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <div className="d-flex align-items-center gap-2">
          <Ticket size={22} aria-hidden="true" />
          <h2 id="lista-tickets-titulo" className="h4 mb-0">Tickets</h2>
          {!cargando && tickets && <span className="badge text-bg-light border">{tickets.length}</span>}
        </div>
        <div className="d-flex gap-2">
          <button type="button" className="btn btn-outline-secondary" onClick={onActualizar} title="Actualizar listado" aria-label="Actualizar listado">
            <RefreshCw size={17} aria-hidden="true" />
          </button>
          {puedeCrear && (
            <button type="button" className="btn btn-primary" onClick={onCrear}>
              <Plus size={17} className="me-1" aria-hidden="true" />Nuevo ticket
            </button>
          )}
        </div>
      </div>

      <form className="feature-card mb-3" onSubmit={enviarFiltros}>
        <div className="row g-3 align-items-end">
          <div className="col-md-4">
            <label htmlFor="tickets-busqueda" className="form-label">Buscar</label>
            <input
              id="tickets-busqueda"
              className="form-control"
              maxLength={120}
              placeholder="ID, título o solicitante"
              value={camposFiltro.busqueda}
              onChange={(evento) => setCamposFiltro({ ...camposFiltro, busqueda: evento.target.value })}
            />
          </div>
          <div className="col-sm-6 col-md-2">
            <label htmlFor="tickets-estado" className="form-label">Estado</label>
            <select id="tickets-estado" className="form-select" value={camposFiltro.estado}
              onChange={(evento) => setCamposFiltro({ ...camposFiltro, estado: evento.target.value })}>
              <option value="">Todos</option>
              {ESTADOS.map((estado) => <option key={estado} value={estado}>{estado}</option>)}
            </select>
          </div>
          <div className="col-sm-6 col-md-2">
            <label htmlFor="tickets-categoria" className="form-label">Categoría</label>
            <select id="tickets-categoria" className="form-select" value={camposFiltro.categoria_id}
              onChange={(evento) => setCamposFiltro({ ...camposFiltro, categoria_id: evento.target.value })}>
              <option value="">Todas</option>
              {categorias.map((categoria) => <option key={categoria.id} value={categoria.id}>{categoria.nombre}</option>)}
            </select>
          </div>
          <div className="col-sm-6 col-md-2">
            <label htmlFor="tickets-prioridad" className="form-label">Prioridad</label>
            <select id="tickets-prioridad" className="form-select" value={camposFiltro.prioridad}
              onChange={(evento) => setCamposFiltro({ ...camposFiltro, prioridad: evento.target.value })}>
              <option value="">Todas</option>
              {PRIORIDADES.map((prioridad) => <option key={prioridad} value={prioridad}>{prioridad}</option>)}
            </select>
          </div>
          <div className="col-sm-6 col-md-2">
            <label htmlFor="tickets-tecnico" className="form-label">Técnico</label>
            <select id="tickets-tecnico" className="form-select" value={camposFiltro.tecnico_id}
              onChange={(evento) => setCamposFiltro({ ...camposFiltro, tecnico_id: evento.target.value })}>
              <option value="">Todos</option>
              {tecnicos.map((tecnico) => <option key={tecnico.id} value={tecnico.id}>{tecnico.nombre}</option>)}
            </select>
          </div>
          <div className="col-12 d-flex justify-content-end gap-2">
            <button type="button" className="btn btn-outline-secondary" onClick={limpiarFiltros} disabled={!hayFiltros && Object.values(camposFiltro).every((valor) => !valor)}>
              <X size={16} className="me-1" aria-hidden="true" />Limpiar
            </button>
            <button type="submit" className="btn btn-primary">
              <Search size={16} className="me-1" aria-hidden="true" />Aplicar filtros
            </button>
          </div>
        </div>
      </form>

      {cargando && <p role="status">Cargando tickets…</p>}
      {error && (
        <div className="alert alert-danger" role="alert">
          {error} <button type="button" className="btn btn-link p-0 ms-1" onClick={onActualizar}>Reintentar</button>
        </div>
      )}

      {!cargando && !error && tickets?.length === 0 && (
        <div className="empty-state">
          <h3 className="h6">{hayFiltros ? 'Sin coincidencias' : 'Aún no hay tickets'}</h3>
          <p>{hayFiltros ? 'No hay tickets que coincidan con los filtros seleccionados.' : 'Registra un ticket para iniciar el seguimiento.'}</p>
          {hayFiltros ? (
            <button type="button" className="btn btn-outline-secondary" onClick={limpiarFiltros}>Limpiar filtros</button>
          ) : puedeCrear ? (
            <button type="button" className="btn btn-primary" onClick={onCrear}>
              <Plus size={17} className="me-1" aria-hidden="true" />Registrar ticket
            </button>
          ) : <p className="mb-0">No hay tickets disponibles para tu usuario.</p>}
        </div>
      )}

      {!cargando && !error && tickets && tickets.length > 0 && (
        <div className="feature-card table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead>
              <tr>
                <th scope="col">ID</th>
                <th scope="col">Título</th>
                <th scope="col">Estado</th>
                <th scope="col">Categoría</th>
                <th scope="col">Prioridad</th>
                <th scope="col">Técnico</th>
                <th scope="col">Creado</th>
                <th scope="col"><span className="visually-hidden">Abrir</span></th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((ticket) => (
                <tr key={ticket.id}>
                  <td>#{ticket.id}</td>
                  <th scope="row" className="fw-medium">{ticket.titulo}</th>
                  <td><span className="badge text-bg-light border">{ticket.estado}</span></td>
                  <td>{ticket.categoria_sugerida ?? 'Sin sugerencia'}</td>
                  <td>{ticket.prioridad_sugerida ?? '—'}</td>
                  <td>{ticket.tecnico ?? 'Sin asignar'}</td>
                  <td className="text-nowrap">{fechaLegible(ticket.fecha_creacion)}</td>
                  <td>
                    <button type="button" className="btn btn-sm btn-outline-secondary" title={`Ver ticket ${ticket.id}`} aria-label={`Ver ticket ${ticket.id}`} onClick={() => onAbrir(ticket.id)}>
                      <ArrowUpRight size={16} aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

interface DetalleProps {
  id: number;
  onVolver: () => void;
}

function DetalleTicket({ id, onVolver }: DetalleProps) {
  const { usuario } = useAuth();
  const [ticket, setTicket] = useState<TicketDetalle | null>(null);
  const [historial, setHistorial] = useState<EventoHistorial[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [errorEstado, setErrorEstado] = useState('');
  const [motivoReapertura, setMotivoReapertura] = useState('');
  const [actualizandoEstado, setActualizandoEstado] = useState(false);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    setError('');
    Promise.all([obtenerTicket(id), obtenerHistorial(id)])
      .then(([resultado, eventos]) => {
        if (!vigente) return;
        setTicket(resultado);
        setHistorial(eventos);
      })
      .catch((err: unknown) => {
        if (vigente) setError(err instanceof Error ? err.message : 'No se pudo cargar el ticket.');
      })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
    }, [id, revision]);

    async function cambiarEstado(estado: EstadoTicket, motivo?: string) {
      setActualizandoEstado(true);
      setErrorEstado('');
      try {
        await actualizarEstadoTicket(id, estado, motivo);
        setMotivoReapertura('');
        setRevision((actual) => actual + 1);
      } catch (err) {
        setErrorEstado(err instanceof Error ? err.message : 'No se pudo actualizar el estado.');
      } finally {
        setActualizandoEstado(false);
    }
    }

    function enviarReapertura(evento: FormEvent<HTMLFormElement>) {
      evento.preventDefault();
      void cambiarEstado('En proceso', motivoReapertura.trim());
    }

    const siguiente = ticket ? SIGUIENTE_ESTADO[ticket.estado] : undefined;
    const puedeCambiarEstado = ticket !== null
      && (usuario?.rol !== 'tecnico' || ticket.tecnico_id === usuario.id);

  return (
    <section className="page-section" aria-labelledby="detalle-ticket-titulo">
      <button type="button" className="btn btn-link px-0 mb-2" onClick={onVolver}>
        <ArrowLeft size={17} className="me-1" aria-hidden="true" />Volver al listado
      </button>
      {cargando && <p role="status">Cargando ticket…</p>}
      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      {ticket && !cargando && (
        <>
          <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
            <Ticket size={22} aria-hidden="true" />
            <h2 id="detalle-ticket-titulo" className="h4 mb-0">Ticket #{ticket.id}: {ticket.titulo}</h2>
            <span className="badge text-bg-light border ms-sm-auto">{ticket.estado}</span>
          </div>
          <div className="feature-card">
            <dl className="row mb-0">
              <dt className="col-sm-3">Solicitante</dt><dd className="col-sm-9">{ticket.solicitante}</dd>
              <dt className="col-sm-3">Categoría sugerida</dt><dd className="col-sm-9">{ticket.categoria_sugerida ?? 'Sin sugerencia'}</dd>
              <dt className="col-sm-3">Prioridad sugerida</dt><dd className="col-sm-9">{ticket.prioridad_sugerida ?? 'Sin sugerencia'}</dd>
              <dt className="col-sm-3">Técnico</dt><dd className="col-sm-9">{ticket.tecnico ?? 'Sin asignar'}</dd>
              <dt className="col-sm-3">Impacto</dt><dd className="col-sm-9">{ticket.impacto}</dd>
              <dt className="col-sm-3">Urgencia</dt><dd className="col-sm-9">{ticket.urgencia}</dd>
              <dt className="col-sm-3">Fecha de creación</dt><dd className="col-sm-9">{fechaLegible(ticket.fecha_creacion)}</dd>
              <dt className="col-sm-3">Descripción</dt><dd className="col-sm-9" style={{ whiteSpace: 'pre-wrap' }}>{ticket.descripcion}</dd>
            </dl>
          </div>
          <section className="feature-card mt-3" aria-labelledby="estado-ticket-titulo">
            <h3 id="estado-ticket-titulo" className="h6">Estado del ticket</h3>
            {siguiente && puedeCambiarEstado && (
              <button type="button" className="btn btn-primary" disabled={actualizandoEstado}
                onClick={() => void cambiarEstado(siguiente.estado)}>
                {actualizandoEstado ? 'Actualizando…' : siguiente.etiqueta}
              </button>
            )}
            {ticket.estado === 'Cerrado' && <p className="mb-0">Ticket cerrado. No admite más cambios de estado.</p>}
            {ticket.estado === 'Resuelto' && puedeCambiarEstado && (
              <form className="mt-3" onSubmit={enviarReapertura}>
                <label htmlFor="motivo-reapertura" className="form-label">Motivo de reapertura</label>
                <div className="d-flex flex-column flex-sm-row gap-2">
                  <input id="motivo-reapertura" className="form-control" maxLength={500} required
                    value={motivoReapertura} onChange={(evento) => setMotivoReapertura(evento.target.value)} />
                  <button type="submit" className="btn btn-outline-primary text-nowrap" disabled={actualizandoEstado || !motivoReapertura.trim()}>
                    Reabrir ticket
                  </button>
                </div>
              </form>
            )}
            {errorEstado && <div className="alert alert-danger mt-3 mb-0" role="alert">{errorEstado}</div>}
          </section>
          <section className="feature-card mt-3" aria-labelledby="historial-ticket-titulo">
            <h3 id="historial-ticket-titulo" className="h6">Historial</h3>
            {historial.length === 0 ? (
              <p className="mb-0">Aún no hay cambios de estado registrados.</p>
            ) : (
              <ol className="list-group list-group-flush">
                {historial.map((evento) => (
                  <li className="list-group-item px-0" key={evento.id}>
                    <div className="d-flex flex-wrap justify-content-between gap-1">
                      <strong>{evento.accion}</strong>
                      <time className="small muted" dateTime={evento.fecha}>{fechaLegible(evento.fecha)}</time>
                    </div>
                    <p className="small muted mb-0">
                      {evento.usuario} · {evento.valor_anterior ?? '—'} → {evento.valor_nuevo ?? '—'}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </>
      )}
    </section>
  );
}