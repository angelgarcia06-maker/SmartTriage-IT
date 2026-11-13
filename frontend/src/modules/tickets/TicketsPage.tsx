import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowUpRight, Plus, RefreshCw, Ticket } from 'lucide-react';
import TicketCreateForm from './TicketCreateForm';
import { listarTickets, obtenerTicket, type TicketDetalle, type TicketResumen } from './api';

type Vista = { tipo: 'lista' } | { tipo: 'nuevo' } | { tipo: 'detalle'; id: number };

function fechaLegible(fecha: string): string {
  const valor = new Date(fecha);
  return Number.isNaN(valor.getTime())
    ? fecha
    : new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(valor);
}

export default function TicketsPage() {
  const [vista, setVista] = useState<Vista>({ tipo: 'lista' });
  const [revision, setRevision] = useState(0);

  if (vista.tipo === 'nuevo') {
    return (
      <div className="page-section">
        <button type="button" className="btn btn-link px-0 mb-2" onClick={() => setVista({ tipo: 'lista' })}>
          <ArrowLeft size={17} className="me-1" aria-hidden="true" />Volver al listado
        </button>
        <TicketCreateForm onCreado={({ id }) => setVista({ tipo: 'detalle', id })} />
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
      onCrear={() => setVista({ tipo: 'nuevo' })}
      onAbrir={(id) => setVista({ tipo: 'detalle', id })}
      onActualizar={() => setRevision((actual) => actual + 1)}
    />
  );
}

interface ListadoProps {
  revision: number;
  onCrear: () => void;
  onAbrir: (id: number) => void;
  onActualizar: () => void;
}

function ListadoTickets({ revision, onCrear, onAbrir, onActualizar }: ListadoProps) {
  const [tickets, setTickets] = useState<TicketResumen[] | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    setError('');
    listarTickets()
      .then((resultado) => { if (vigente) setTickets(resultado); })
      .catch((err: unknown) => {
        if (vigente) setError(err instanceof Error ? err.message : 'No se pudieron cargar los tickets.');
      })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [revision]);

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
          <button type="button" className="btn btn-primary" onClick={onCrear}>
            <Plus size={17} className="me-1" aria-hidden="true" />Nuevo ticket
          </button>
        </div>
      </div>

      {cargando && <p role="status">Cargando tickets…</p>}
      {error && (
        <div className="alert alert-danger" role="alert">
          {error} <button type="button" className="btn btn-link p-0 ms-1" onClick={onActualizar}>Reintentar</button>
        </div>
      )}

      {!cargando && !error && tickets?.length === 0 && (
        <div className="empty-state">
          <h3 className="h6">Aún no hay tickets</h3>
          <p>Registra un ticket para iniciar el seguimiento.</p>
          <button type="button" className="btn btn-primary" onClick={onCrear}>
            <Plus size={17} className="me-1" aria-hidden="true" />Registrar ticket
          </button>
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
  const [ticket, setTicket] = useState<TicketDetalle | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    setError('');
    obtenerTicket(id)
      .then((resultado) => { if (vigente) setTicket(resultado); })
      .catch((err: unknown) => {
        if (vigente) setError(err instanceof Error ? err.message : 'No se pudo cargar el ticket.');
      })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [id]);

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
        </>
      )}
    </section>
  );
}