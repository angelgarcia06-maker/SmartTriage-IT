import { useEffect, useState, type FormEvent } from 'react';
import type { Impacto, SugerenciaTriaje, Urgencia } from '../../../../shared/types/triaje.types';
import { obtenerCatalogos, pedirSugerencia } from './api';
import { PanelSugerencia, type CatalogosTriaje } from './PanelSugerencia';

const IMPACTOS: Impacto[] = ['Alto', 'Medio', 'Bajo'];
const URGENCIAS: Urgencia[] = ['Alta', 'Media', 'Baja'];

function esImpacto(valor: string): valor is Impacto {
  return IMPACTOS.find((opcion) => opcion === valor) !== undefined;
}

function esUrgencia(valor: string): valor is Urgencia {
  return URGENCIAS.find((opcion) => opcion === valor) !== undefined;
}

export default function TriajePage() {
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [impacto, setImpacto] = useState<Impacto>('Medio');
  const [urgencia, setUrgencia] = useState<Urgencia>('Media');
  const [sugerencia, setSugerencia] = useState<SugerenciaTriaje | null>(null);
  const [catalogos, setCatalogos] = useState<CatalogosTriaje | null>(null);
  const [cargandoCatalogos, setCargandoCatalogos] = useState(true);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    obtenerCatalogos()
      .then(setCatalogos)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'No se pudieron cargar los catálogos.'))
      .finally(() => setCargandoCatalogos(false));
    // Los catálogos se cargan una vez al entrar a la pantalla autenticada.
  }, []);

  async function solicitar(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSugerencia(null);
    setEnviando(true);
    try {
      setSugerencia(await pedirSugerencia({ titulo, descripcion, impacto, urgencia }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo obtener la sugerencia.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <h1 className="brand h2">Demostración de Triaje</h1>
      <p className="muted mb-4">
        Solicita una recomendación y explora la vista previa original del panel. Esta demostración no crea ni guarda tickets.
      </p>

      <form className="feature-card mb-4" onSubmit={solicitar}>
        <div className="mb-3">
          <label htmlFor="triaje-titulo" className="form-label">Título</label>
          <input
            id="triaje-titulo"
            className="form-control"
            maxLength={200}
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
          />
        </div>
        <div className="mb-3">
          <label htmlFor="triaje-descripcion" className="form-label">Descripción</label>
          <textarea
            id="triaje-descripcion"
            className="form-control"
            rows={4}
            maxLength={5000}
            required
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
          />
        </div>
        <div className="row g-3 mb-3">
          <div className="col-md-6">
            <label htmlFor="triaje-impacto" className="form-label">Impacto</label>
            <select id="triaje-impacto" className="form-select" value={impacto} onChange={(e) => {
              if (esImpacto(e.target.value)) setImpacto(e.target.value);
            }}>
              {IMPACTOS.map((valor) => <option key={valor}>{valor}</option>)}
            </select>
          </div>
          <div className="col-md-6">
            <label htmlFor="triaje-urgencia" className="form-label">Urgencia</label>
            <select id="triaje-urgencia" className="form-select" value={urgencia} onChange={(e) => {
              if (esUrgencia(e.target.value)) setUrgencia(e.target.value);
            }}>
              {URGENCIAS.map((valor) => <option key={valor}>{valor}</option>)}
            </select>
          </div>
        </div>
        {error && <div className="alert alert-danger" role="alert">{error}</div>}
        <button type="submit" className="btn btn-primary" disabled={enviando || cargandoCatalogos || !catalogos || !descripcion.trim()}>
          {cargandoCatalogos ? 'Cargando catálogos...' : enviando ? 'Analizando...' : 'Obtener sugerencia'}
        </button>
      </form>

      {sugerencia && catalogos && (
        <>
          <h2 className="h5 mb-3">Vista previa del ticket · modo demostración</h2>
          <PanelSugerencia
            key={JSON.stringify(sugerencia)}
            ticketId={null}
            sugerencia={sugerencia}
            catalogos={catalogos}
          />
        </>
      )}
    </>
  );
}
