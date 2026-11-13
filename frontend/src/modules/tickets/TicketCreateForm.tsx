import { useEffect, useState, type FormEvent } from 'react';
import { CheckCircle2, LoaderCircle, TicketPlus } from 'lucide-react';
import type { DatosTicket, Impacto, Urgencia } from '../../../../shared/types/triaje.types';
import { obtenerCatalogos } from '../triaje/api';
import { PanelSugerencia, type CatalogosTriaje } from '../triaje/PanelSugerencia';
import { registrarTicket, type TicketCreado } from './api';

const IMPACTOS: Impacto[] = ['Alto', 'Medio', 'Bajo'];
const URGENCIAS: Urgencia[] = ['Alta', 'Media', 'Baja'];

interface Props {
  onCreado?: (ticket: TicketCreado) => void;
  onAbrirTicket?: (id: number) => void;
  registrar?: typeof registrarTicket;
}

const formularioInicial: DatosTicket = {
  solicitante: '',
  titulo: '',
  descripcion: '',
  impacto: 'Medio',
  urgencia: 'Media',
};

export default function TicketCreateForm({ onCreado, onAbrirTicket, registrar = registrarTicket }: Props) {
  const [datos, setDatos] = useState<DatosTicket>(formularioInicial);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [ticketCreado, setTicketCreado] = useState<TicketCreado | null>(null);
  const [catalogos, setCatalogos] = useState<CatalogosTriaje | null>(null);
  const [cargandoCatalogos, setCargandoCatalogos] = useState(true);
  const [errorCatalogos, setErrorCatalogos] = useState('');
  const [intentoCatalogos, setIntentoCatalogos] = useState(0);
  const [decisionGuardada, setDecisionGuardada] = useState(false);

  useEffect(() => {
    let vigente = true;
    setCargandoCatalogos(true);
    setErrorCatalogos('');
    obtenerCatalogos()
      .then((resultado) => { if (vigente) setCatalogos(resultado); })
      .catch((err: unknown) => {
        if (vigente) setErrorCatalogos(err instanceof Error ? err.message : 'No se pudieron cargar los catálogos.');
      })
      .finally(() => { if (vigente) setCargandoCatalogos(false); });
    return () => { vigente = false; };
  }, [intentoCatalogos]);

  function actualizar<K extends keyof DatosTicket>(campo: K, valor: DatosTicket[K]) {
    setDatos((actuales) => ({ ...actuales, [campo]: valor }));
    setTicketCreado(null);
  }

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setError('');
    setEnviando(true);
    try {
      const resultado = await registrar({
        ...datos,
        solicitante: datos.solicitante.trim(),
        titulo: datos.titulo.trim(),
        descripcion: datos.descripcion.trim(),
      });
      setTicketCreado(resultado);
      setDatos(formularioInicial);
      onCreado?.(resultado);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar el ticket.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section className="page-section" aria-labelledby="nuevo-ticket-titulo">
      <div className="d-flex align-items-center gap-2 mb-3">
        <TicketPlus size={22} aria-hidden="true" />
        <h2 id="nuevo-ticket-titulo" className="h4 mb-0">Registrar ticket</h2>
      </div>

      {ticketCreado && (
        <div className="alert alert-success d-flex align-items-center gap-2" role="status">
          <CheckCircle2 size={18} aria-hidden="true" />
          Ticket #{ticketCreado.id} registrado correctamente.
        </div>
      )}

      {cargandoCatalogos && <p role="status">Cargando catálogos del triaje…</p>}
      {errorCatalogos && (
        <div className="alert alert-danger" role="alert">
          {errorCatalogos}{' '}
          <button type="button" className="btn btn-link p-0" onClick={() => setIntentoCatalogos((actual) => actual + 1)}>
            Reintentar
          </button>
        </div>
      )}

      {ticketCreado?.sugerencia && catalogos && (
        <PanelSugerencia
          key={`ticket-${ticketCreado.id}`}
          ticketId={ticketCreado.id}
          sugerencia={ticketCreado.sugerencia}
          catalogos={catalogos}
          onDecision={() => setDecisionGuardada(true)}
        />
      )}
      {ticketCreado?.sugerencia && decisionGuardada && (
        <button type="button" className="btn btn-primary mt-3" onClick={() => onAbrirTicket?.(ticketCreado.id)}>
          Ver ticket y su historial
        </button>
      )}

      {ticketCreado && !ticketCreado.sugerencia && (
        <div className="alert alert-warning" role="alert">
          El ticket se creó, pero no recibió una sugerencia. Puedes consultar su detalle.
          <button type="button" className="btn btn-link" onClick={() => onAbrirTicket?.(ticketCreado.id)}>
            Ver ticket
          </button>
        </div>
      )}

      {ticketCreado?.sugerencia && !cargandoCatalogos && !catalogos && (
        <div className="alert alert-warning" role="alert">
          No se pudo cargar el panel de decisión. La sugerencia quedó guardada; reintenta los catálogos o consulta el ticket.
          <button type="button" className="btn btn-link" onClick={() => setIntentoCatalogos((actual) => actual + 1)}>
            Reintentar catálogos
          </button>
          <button type="button" className="btn btn-link" onClick={() => onAbrirTicket?.(ticketCreado.id)}>
            Ver ticket
          </button>
        </div>
      )}

      {!ticketCreado && <form className="feature-card" onSubmit={enviar}>
        <div className="mb-3">
          <label htmlFor="ticket-solicitante" className="form-label">Solicitante</label>
          <input
            id="ticket-solicitante"
            className="form-control"
            autoComplete="name"
            maxLength={120}
            required
            value={datos.solicitante}
            onChange={(evento) => actualizar('solicitante', evento.target.value)}
          />
        </div>

        <div className="mb-3">
          <label htmlFor="ticket-titulo" className="form-label">Título</label>
          <input
            id="ticket-titulo"
            className="form-control"
            maxLength={200}
            required
            value={datos.titulo}
            onChange={(evento) => actualizar('titulo', evento.target.value)}
          />
        </div>

        <div className="mb-3">
          <label htmlFor="ticket-descripcion" className="form-label">Descripción</label>
          <textarea
            id="ticket-descripcion"
            className="form-control"
            rows={5}
            maxLength={5000}
            required
            value={datos.descripcion}
            onChange={(evento) => actualizar('descripcion', evento.target.value)}
          />
        </div>

        <div className="row g-3 mb-3">
          <div className="col-md-6">
            <label htmlFor="ticket-impacto" className="form-label">Impacto</label>
            <select
              id="ticket-impacto"
              className="form-select"
              value={datos.impacto}
              onChange={(evento) => actualizar('impacto', evento.target.value as Impacto)}
            >
              {IMPACTOS.map((valor) => <option key={valor} value={valor}>{valor}</option>)}
            </select>
          </div>
          <div className="col-md-6">
            <label htmlFor="ticket-urgencia" className="form-label">Urgencia</label>
            <select
              id="ticket-urgencia"
              className="form-select"
              value={datos.urgencia}
              onChange={(evento) => actualizar('urgencia', evento.target.value as Urgencia)}
            >
              {URGENCIAS.map((valor) => <option key={valor} value={valor}>{valor}</option>)}
            </select>
          </div>
        </div>

        {error && <div className="alert alert-danger" role="alert">{error}</div>}

        <button type="submit" className="btn btn-primary" disabled={enviando || cargandoCatalogos || !catalogos || Boolean(errorCatalogos)}>
          {enviando ? <LoaderCircle size={17} className="me-2" aria-hidden="true" /> : <TicketPlus size={17} className="me-2" aria-hidden="true" />}
          {enviando ? 'Registrando…' : cargandoCatalogos ? 'Cargando catálogos…' : 'Crear ticket'}
        </button>
      </form>}
    </section>
  );
}