import { useEffect, useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowUpRight, ChevronLeft, ChevronRight, Plus, RefreshCw, Search, Ticket, X } from 'lucide-react';
import type { EstadoTicket, Prioridad } from '../../../../shared/types/triaje.types';
import TicketCreateForm from './TicketCreateForm';
import {
  actualizarAsignacionTicket,
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
import { obtenerCatalogos, obtenerDecisionTicket } from '../triaje/api';
import { PanelSugerencia, type CatalogosTriaje } from '../triaje/PanelSugerencia';

type Vista = { tipo: 'lista' } | { tipo: 'nuevo' } | { tipo: 'detalle'; id: number };
type CamposFiltro = { busqueda: string; estado: string; categoria_id: string; prioridad: string; tecnico_id: string };

const ESTADOS: EstadoTicket[] = ['Nuevo', 'Asignado', 'En proceso', 'Resuelto', 'Cerrado'];
const PRIORIDADES: Prioridad[] = ['Crítica', 'Alta', 'Media', 'Baja'];
const COLOR_ESTADO: Record<EstadoTicket, string> = {
  Nuevo: 'text-bg-info',
  Asignado: 'text-bg-primary',
  'En proceso': 'text-bg-warning',
  Resuelto: 'text-bg-success',
  Cerrado: 'text-bg-secondary',
};
const COLOR_PRIORIDAD: Record<Prioridad, string> = {
  Crítica: 'text-bg-danger',
  Alta: 'text-bg-warning',
  Media: 'text-bg-info',
  Baja: 'text-bg-secondary',
};
const TICKETS_POR_PAGINA = 10;
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
  const { usuario } = useAuth();
  const [tickets, setTickets] = useState<TicketResumen[] | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [criterios, setCriterios] = useState<FiltrosTickets>({});
  const [camposFiltro, setCamposFiltro] = useState<CamposFiltro>(CAMPOS_FILTRO_VACIOS);
  const [categorias, setCategorias] = useState<{ id: number; nombre: string }[]>([]);
  const [tecnicos, setTecnicos] = useState<{ id: number; nombre: string }[]>([]);
  const [pagina, setPagina] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPaginas, setTotalPaginas] = useState(0);
  const hayFiltros = Object.values(criterios).some((valor) => valor !== undefined);

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    setError('');
    listarTickets({ ...criterios, pagina, limite: TICKETS_POR_PAGINA })
      .then((resultado) => {
        if (!vigente) return;
        setTickets(resultado.tickets);
        setTotal(resultado.total);
        setTotalPaginas(resultado.totalPaginas);
        setPagina(resultado.pagina);
        setCategorias(resultado.categorias);
        setTecnicos(resultado.tecnicos);
      })
      .catch((err: unknown) => {
        if (vigente) setError(err instanceof Error ? err.message : 'No se pudieron cargar los tickets.');
      })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [criterios, pagina, revision]);

  function enviarFiltros(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const nuevos: FiltrosTickets = {};
    if (camposFiltro.busqueda.trim()) nuevos.busqueda = camposFiltro.busqueda.trim();
    if (camposFiltro.estado) nuevos.estado = camposFiltro.estado as EstadoTicket;
    if (camposFiltro.categoria_id) nuevos.categoria_id = Number(camposFiltro.categoria_id);
    if (camposFiltro.prioridad) nuevos.prioridad = camposFiltro.prioridad as Prioridad;
    if (camposFiltro.tecnico_id) nuevos.tecnico_id = Number(camposFiltro.tecnico_id);
    setCriterios(nuevos);
    setPagina(1);
  }

  function limpiarFiltros() {
    setCamposFiltro(CAMPOS_FILTRO_VACIOS);
    setCriterios({});
    setPagina(1);
  }

  return (
    <section className="page-section" aria-labelledby="lista-tickets-titulo">
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <div className="d-flex align-items-center gap-2">
          <Ticket size={22} aria-hidden="true" />
          <h2 id="lista-tickets-titulo" className="h4 mb-0">{usuario?.rol === 'tecnico' ? 'Mis tickets asignados' : 'Bandeja de tickets'}</h2>
          {!cargando && tickets && <span className="badge text-bg-light border">{total}</span>}
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
      {usuario?.rol === 'tecnico' && <p className="text-body-secondary mb-3">Aquí aparecen los tickets asignados a tu cuenta. Abre uno para iniciar o actualizar la atención.</p>}

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
        <>
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
                    <td><span className={`badge ${COLOR_ESTADO[ticket.estado]}`}>{ticket.estado}</span></td>
                    <td>{ticket.categoria ?? 'Sin sugerencia'}</td>
                    <td>
                      {ticket.prioridad
                        ? <span className={`badge ${COLOR_PRIORIDAD[ticket.prioridad]}`}>{ticket.prioridad}</span>
                        : '—'}
                    </td>
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
          <div className="ticket-pagination">
            <p role="status">
              {total === 0
                ? 'Sin resultados'
                : `Mostrando ${(pagina - 1) * TICKETS_POR_PAGINA + 1}–${Math.min(pagina * TICKETS_POR_PAGINA, total)} de ${total} tickets`}
            </p>
            <nav aria-label="Paginación de tickets">
              <button type="button" className="btn btn-outline-secondary btn-sm" disabled={pagina <= 1 || cargando}
                onClick={() => setPagina((actual) => Math.max(1, actual - 1))}>
                <ChevronLeft size={16} aria-hidden="true" />Anterior
              </button>
              <span aria-current="page">Página {pagina} de {totalPaginas}</span>
              <button type="button" className="btn btn-outline-secondary btn-sm" disabled={pagina >= totalPaginas || cargando}
                onClick={() => setPagina((actual) => Math.min(totalPaginas, actual + 1))}>
                Siguiente<ChevronRight size={16} aria-hidden="true" />
              </button>
            </nav>
          </div>
        </>
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
  const puedeConsultarCatalogos = usuario?.rol === 'agente' || usuario?.rol === 'administrador';
  const [ticket, setTicket] = useState<TicketDetalle | null>(null);
  const [historial, setHistorial] = useState<EventoHistorial[]>([]);
  const [decision, setDecision] = useState<Awaited<ReturnType<typeof obtenerDecisionTicket>> | null>(null);
  const [catalogos, setCatalogos] = useState<CatalogosTriaje | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [errorEstado, setErrorEstado] = useState('');
  const [motivoReapertura, setMotivoReapertura] = useState('');
  const [notaResolucion, setNotaResolucion] = useState('');
  const [tecnicoSeleccionado, setTecnicoSeleccionado] = useState('');
  const [guardandoAsignacion, setGuardandoAsignacion] = useState(false);
  const [errorAsignacion, setErrorAsignacion] = useState('');
  const [actualizandoEstado, setActualizandoEstado] = useState(false);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    setError('');
    Promise.all([
      Promise.allSettled([obtenerTicket(id), obtenerHistorial(id), obtenerDecisionTicket(id)]),
      puedeConsultarCatalogos ? Promise.allSettled([obtenerCatalogos()]) : Promise.resolve(null),
    ])
      .then(([resultados, catalogosResultados]) => {
        if (!vigente) return;
        const ticketResultado = resultados[0];
        const historialResultado = resultados[1];
        const decisionResultado = resultados[2];
        const errores: string[] = [];

        if (ticketResultado.status === 'fulfilled') {
          setTicket(ticketResultado.value);
          setTecnicoSeleccionado(ticketResultado.value.tecnico_id === null ? '' : String(ticketResultado.value.tecnico_id));
        }
        else errores.push(ticketResultado.reason instanceof Error ? ticketResultado.reason.message : 'No se pudo cargar el ticket.');

        if (historialResultado.status === 'fulfilled') setHistorial(historialResultado.value);
        else errores.push(historialResultado.reason instanceof Error ? historialResultado.reason.message : 'No se pudo cargar el historial.');
        if (decisionResultado.status === 'fulfilled') setDecision(decisionResultado.value);
        else errores.push(decisionResultado.reason instanceof Error ? decisionResultado.reason.message : 'No se pudo cargar la decisión del ticket.');
        const catalogosResultado = catalogosResultados?.[0];
        if (catalogosResultado?.status === 'fulfilled') setCatalogos(catalogosResultado.value);
        else if (catalogosResultado?.status === 'rejected') {
          errores.push(catalogosResultado.reason instanceof Error ? catalogosResultado.reason.message : 'No se pudieron cargar los catálogos.');
        }
        setError(errores.join(' '));
      })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
    }, [id, revision, puedeConsultarCatalogos]);

    async function cambiarEstado(estado: EstadoTicket, motivo?: string, resolucion?: string) {
      setActualizandoEstado(true);
      setErrorEstado('');
      try {
        await actualizarEstadoTicket(id, estado, motivo, resolucion);
        setMotivoReapertura('');
        setNotaResolucion('');
        setRevision((actual) => actual + 1);
      } catch (err) {
        setErrorEstado(err instanceof Error ? err.message : 'No se pudo actualizar el estado.');
      } finally {
        setActualizandoEstado(false);
      }
    }

    async function guardarAsignacion(evento: FormEvent<HTMLFormElement>) {
      evento.preventDefault();
      setGuardandoAsignacion(true);
      setErrorAsignacion('');
      try {
        await actualizarAsignacionTicket(id, tecnicoSeleccionado ? Number(tecnicoSeleccionado) : null);
        setRevision((actual) => actual + 1);
      } catch (err) {
        setErrorAsignacion(err instanceof Error ? err.message : 'No se pudo guardar la asignación.');
      } finally {
        setGuardandoAsignacion(false);
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
            <span className={`badge ${COLOR_ESTADO[ticket.estado]} ms-sm-auto`}>{ticket.estado}</span>
          </div>
          <div className="feature-card">
            <dl className="row mb-0">
              <dt className="col-sm-3">Solicitante</dt><dd className="col-sm-9">{ticket.solicitante}</dd>
              <dt className="col-sm-3">Categoría actual</dt><dd className="col-sm-9">{ticket.categoria_final ?? ticket.categoria_sugerida ?? 'Sin sugerencia'}</dd>
              <dt className="col-sm-3">Prioridad actual</dt><dd className="col-sm-9">{ticket.prioridad_final ?? ticket.prioridad_sugerida ?? 'Sin sugerencia'}</dd>
              <dt className="col-sm-3">Técnico</dt><dd className="col-sm-9">{ticket.tecnico ?? 'Sin asignar'}</dd>
              <dt className="col-sm-3">Impacto</dt><dd className="col-sm-9">{ticket.impacto}</dd>
              <dt className="col-sm-3">Urgencia</dt><dd className="col-sm-9">{ticket.urgencia}</dd>
              <dt className="col-sm-3">Fecha de creación</dt><dd className="col-sm-9">{fechaLegible(ticket.fecha_creacion)}</dd>
              <dt className="col-sm-3">Descripción</dt><dd className="col-sm-9" style={{ whiteSpace: 'pre-wrap' }}>{ticket.descripcion}</dd>
              {ticket.resolucion && <><dt className="col-sm-3">Última solución registrada</dt><dd className="col-sm-9" style={{ whiteSpace: 'pre-wrap' }}>{ticket.resolucion}</dd></>}
            </dl>
          </div>
          {puedeConsultarCatalogos && catalogos && (
            <form className="feature-card mt-3" onSubmit={(evento) => void guardarAsignacion(evento)}>
              <h3 className="h6">Asignación del técnico</h3>
              <p className="small text-body-secondary">El técnico asignado podrá ver este ticket y actualizar su atención.</p>
              <div className="d-flex flex-column flex-sm-row gap-2">
                <select className="form-select" aria-label="Técnico asignado" value={tecnicoSeleccionado}
                  onChange={(evento) => setTecnicoSeleccionado(evento.target.value)}>
                  <option value="">Sin asignar</option>
                  {catalogos.tecnicos.map((tecnico) => <option key={tecnico.id} value={tecnico.id}>{tecnico.nombre}</option>)}
                </select>
                <button type="submit" className="btn btn-outline-primary text-nowrap" disabled={guardandoAsignacion || (tecnicoSeleccionado !== '' && Number(tecnicoSeleccionado) === ticket.tecnico_id)}>
                  {guardandoAsignacion ? 'Guardando…' : 'Guardar asignación'}
                </button>
              </div>
              {errorAsignacion && <div className="alert alert-danger mt-3 mb-0" role="alert">{errorAsignacion}</div>}
            </form>
          )}
          {decision && catalogos && decision.pendiente && puedeConsultarCatalogos && (
            <div className="mt-3">
              <PanelSugerencia
                ticketId={ticket.id}
                sugerencia={decision.sugerencia}
                catalogos={catalogos}
                onDecision={() => setRevision((actual) => actual + 1)}
              />
            </div>
          )}
          {decision?.pendiente && !puedeConsultarCatalogos && (
            <section className="feature-card mt-3" aria-labelledby="sugerencia-consulta-titulo">
              <h3 id="sugerencia-consulta-titulo" className="h6">Sugerencia original · solo consulta</h3>
              <dl className="row mb-0">
                <dt className="col-sm-3">Categoría</dt><dd className="col-sm-9">{decision.sugerencia.categoria ?? 'Sin sugerencia'}</dd>
                <dt className="col-sm-3">Prioridad</dt><dd className="col-sm-9">{decision.sugerencia.prioridad ?? 'Sin sugerencia'}</dd>
                <dt className="col-sm-3">Grupo sugerido</dt><dd className="col-sm-9">{decision.sugerencia.grupo_nombre ?? 'Sin asignar'}</dd>
                <dt className="col-sm-3">Técnico sugerido</dt><dd className="col-sm-9">{decision.sugerencia.tecnico_nombre ?? 'Sin asignar'}</dd>
              </dl>
              <p className="small muted mb-0">La decisión de aceptar o corregir corresponde a un agente o administrador.</p>
            </section>
          )}
          {decision && !decision.pendiente && decision.decision && (
            <section className="feature-card mt-3" aria-labelledby="decision-ticket-titulo">
              <h3 id="decision-ticket-titulo" className="h6">Decisión confirmada</h3>
              <p className="mb-2">
                {decision.aceptada_sin_correccion ? 'Sugerencia aceptada sin cambios.' : 'Sugerencia corregida por el agente.'}
              </p>
              <dl className="row mb-0 small">
                <dt className="col-sm-3">Categoría final</dt><dd className="col-sm-9">{decision.decision_nombres?.categoria ?? 'Sin asignar'}</dd>
                <dt className="col-sm-3">Prioridad final</dt><dd className="col-sm-9">{decision.decision?.prioridad_final ?? 'Sin asignar'}</dd>
                <dt className="col-sm-3">Grupo final</dt><dd className="col-sm-9">{decision.decision_nombres?.grupo ?? 'Sin asignar'}</dd>
                <dt className="col-sm-3">Técnico final</dt><dd className="col-sm-9">{decision.decision_nombres?.tecnico ?? 'Sin asignar'}</dd>
                <dt className="col-sm-3">Fecha</dt><dd className="col-sm-9">{decision.fecha_decision ? fechaLegible(decision.fecha_decision) : '—'}</dd>
              </dl>
            </section>
          )}
          <section className="feature-card mt-3" aria-labelledby="estado-ticket-titulo">
            <h3 id="estado-ticket-titulo" className="h6">Estado del ticket</h3>
            {siguiente && puedeCambiarEstado && (
              siguiente.estado === 'Resuelto' ? (
                <form onSubmit={(evento) => { evento.preventDefault(); void cambiarEstado('Resuelto', undefined, notaResolucion.trim()); }}>
                  <label htmlFor="nota-resolucion" className="form-label">¿Qué solución aplicaste?</label>
                  <textarea id="nota-resolucion" className="form-control mb-2" maxLength={5000} rows={3} required
                    value={notaResolucion} onChange={(evento) => setNotaResolucion(evento.target.value)} />
                  <button type="submit" className="btn btn-primary" disabled={actualizandoEstado || !notaResolucion.trim()}>
                    {actualizandoEstado ? 'Guardando solución…' : 'Registrar solución y marcar resuelto'}
                  </button>
                </form>
              ) : (siguiente.estado !== 'Cerrado' || usuario?.rol !== 'tecnico') && (
                <button type="button" className="btn btn-primary" disabled={actualizandoEstado}
                  onClick={() => void cambiarEstado(siguiente.estado)}>
                  {actualizandoEstado ? 'Actualizando…' : siguiente.etiqueta}
                </button>
              )
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
