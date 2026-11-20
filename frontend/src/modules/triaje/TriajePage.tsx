import { useEffect, useState, type FormEvent } from 'react';
import type { Impacto, SugerenciaTriaje, Urgencia } from '../../../../shared/types/triaje.types';
import { obtenerCatalogos, pedirSugerencia, pedirSugerenciaMl, type ResultadoSugerenciaMl } from './api';
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
  const [sugerenciaMl, setSugerenciaMl] = useState<ResultadoSugerenciaMl | null>(null);
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
    setSugerenciaMl(null);
    setEnviando(true);
    try {
      const datos = { titulo, descripcion, impacto, urgencia };
      const [resultadoReglas, resultadoMl] = await Promise.all([
        pedirSugerencia(datos),
        pedirSugerenciaMl(datos),
      ]);
      setSugerencia(resultadoReglas);
      setSugerenciaMl(resultadoMl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo obtener la sugerencia.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="page-section">
      <p className="page-description">
        Solicita una recomendación y explora la vista previa original del panel. Esta demostración no crea ni guarda tickets.
      </p>

      <form className="feature-card mb-4" onSubmit={solicitar}>
        <div className="alert alert-info py-2" role="note">
          Modo demostración: los datos se analizan para mostrar una sugerencia, pero no se crea ni persiste un ticket.
        </div>
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
          {sugerenciaMl && (
            <section className="feature-card mb-4" aria-labelledby="comparacion-triaje-titulo">
              <h2 id="comparacion-triaje-titulo" className="h5">Comparación de recomendaciones</h2>
              <p className="small text-body-secondary">Dos métodos analizan el mismo texto. La decisión final sigue siendo del agente.</p>
              <div className="row g-3">
                <article className="col-md-6">
                  <div className="h-100 rounded border p-3">
                    <span className="badge text-bg-primary mb-2">Reglas actuales</span>
                    <h3 className="h6">{sugerencia.categoria}</h3>
                    <p className="small mb-0">{sugerencia.es_otros
                      ? 'Sin coincidencia con el diccionario; requiere revisión.'
                      : <>Palabra del diccionario: «{sugerencia.palabra_activadora}».</>}</p>
                  </div>
                </article>
                <article className="col-md-6">
                  <div className="h-100 rounded border p-3">
                    <span className="badge text-bg-info mb-2">Naive Bayes experimental</span>
                    {sugerenciaMl.disponible && sugerenciaMl.prediccion ? (
                      <>
                        <h3 className="h6">{sugerenciaMl.prediccion.categoria}</h3>
                        <p className="small mb-2">Preferencia estimada: {sugerenciaMl.prediccion.confianza}%</p>
                        <p className="small mb-0">Términos que favorecieron esta categoría: {sugerenciaMl.prediccion.evidencias.length
                          ? sugerenciaMl.prediccion.evidencias.map((palabra) => <code key={palabra} className="me-1">{palabra}</code>)
                          : 'el modelo no encontró términos conocidos que la distingan.'}</p>
                      </>
                    ) : <p className="small mb-0">{sugerenciaMl.motivo}</p>}
                  </div>
                </article>
              </div>
              {sugerenciaMl.disponible && sugerenciaMl.prediccion && (
                <div className={`alert ${sugerenciaMl.prediccion.categoria_id === sugerencia.categoria_id ? 'alert-success' : 'alert-warning'} py-2 mt-3 mb-0`} role="status">
                  {sugerenciaMl.prediccion.categoria_id === sugerencia.categoria_id
                    ? `Ambos métodos coinciden en «${sugerencia.categoria}».`
                    : `Los métodos discrepan: reglas → «${sugerencia.categoria}»; Naive Bayes → «${sugerenciaMl.prediccion.categoria}».`}
                </div>
              )}
            </section>
          )}
          <h2 className="h5 mb-3">Vista previa de la sugerencia</h2>
          <PanelSugerencia
            key={JSON.stringify(sugerencia)}
            ticketId={null}
            sugerencia={sugerencia}
            catalogos={catalogos}
          />
        </>
      )}
      {sugerenciaMl && (
        <section className="feature-card mt-4" aria-labelledby="triaje-ml-titulo">
          <h2 id="triaje-ml-titulo" className="h5">Clasificador experimental de Machine Learning</h2>
          <p>Modelo Naive Bayes entrenado con {sugerenciaMl.ejemplos_entrenamiento} decisiones de categoría confirmadas.</p>
          {sugerenciaMl.disponible && sugerenciaMl.prediccion ? (
            <dl className="row mb-2">
              <dt className="col-sm-4">Categoría sugerida por el modelo</dt>
              <dd className="col-sm-8">{sugerenciaMl.prediccion.categoria}</dd>
              <dt className="col-sm-4">Preferencia estimada del modelo</dt>
              <dd className="col-sm-8">{sugerenciaMl.prediccion.confianza}%</dd>
            </dl>
          ) : <p className="mb-2">{sugerenciaMl.motivo}</p>}
          <p className="small text-body-secondary mb-0">La confianza es una estimación del modelo, no una medición de su precisión. El resultado no modifica ni guarda tickets.</p>
        </section>
      )}
    </div>
  );
}
