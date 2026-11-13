import { useMemo, useState } from 'react';
import { BrainCircuit, Check, Pencil } from 'lucide-react';
import type { DecisionTriaje, Prioridad, SugerenciaTriaje } from '../../../../shared/types/triaje.types';
import { enviarDecision, type ResultadoDecision } from './api';

export interface CatalogosTriaje {
  categorias: { id: number; nombre: string }[];
  grupos: { id: number; nombre: string }[];
  tecnicos: { id: number; nombre: string; grupo_id: number | null }[];
}

export interface PanelSugerenciaProps {
  ticketId: number;
  sugerencia: SugerenciaTriaje;
  catalogos: CatalogosTriaje;
  /** Se llama cuando la decisión quedó guardada. */
  onDecision?: (resultado: ResultadoDecision) => void;
  /** Para pruebas o integración: reemplaza la llamada a la API. */
  enviar?: typeof enviarDecision;
}

const PRIORIDADES: Prioridad[] = ['Crítica', 'Alta', 'Media', 'Baja'];
const COLOR_PRIORIDAD: Record<Prioridad, string> = { Crítica: 'danger', Alta: 'warning', Media: 'info', Baja: 'secondary' };

function nombre(lista: { id: number; nombre: string }[], id: number | null): string {
  if (id == null) return 'Sin asignar';
  return lista.find((x) => x.id === id)?.nombre ?? `#${id}`;
}

/**
 * TRI-04: muestra la sugerencia original del triaje frente a la decisión final
 * y permite Aceptar tal cual o Corregir categoría, prioridad, grupo y técnico.
 * Lo integra el detalle de ticket (TICK-02); no se monta en App.tsx desde aquí.
 */
export function PanelSugerencia({ ticketId, sugerencia, catalogos, onDecision, enviar = enviarDecision }: PanelSugerenciaProps) {
  const original: DecisionTriaje = {
    categoria_final_id: sugerencia.categoria_id,
    prioridad_final: sugerencia.prioridad,
    grupo_final_id: sugerencia.grupo_id,
    tecnico_id: sugerencia.tecnico_id,
  };
  const [modo, setModo] = useState<'ver' | 'corregir'>('ver');
  const [final, setFinal] = useState<DecisionTriaje>(original);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [resultado, setResultado] = useState<ResultadoDecision | null>(null);

  const tecnicosDelGrupo = useMemo(
    () => catalogos.tecnicos.filter((t) => final.grupo_final_id == null || t.grupo_id === final.grupo_final_id),
    [catalogos.tecnicos, final.grupo_final_id],
  );

  async function confirmar(decision: DecisionTriaje) {
    setEnviando(true);
    setError('');
    try {
      const r = await enviar(ticketId, decision);
      setResultado(r);
      onDecision?.(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar la decisión.');
    } finally {
      setEnviando(false);
    }
  }

  const filas: { campo: string; sugerido: string; final: string }[] = [
    { campo: 'Categoría', sugerido: sugerencia.categoria, final: nombre(catalogos.categorias, final.categoria_final_id) },
    { campo: 'Prioridad', sugerido: sugerencia.prioridad, final: final.prioridad_final },
    { campo: 'Grupo', sugerido: nombre(catalogos.grupos, sugerencia.grupo_id), final: nombre(catalogos.grupos, final.grupo_final_id) },
    { campo: 'Técnico', sugerido: nombre(catalogos.tecnicos, sugerencia.tecnico_id), final: nombre(catalogos.tecnicos, final.tecnico_id) },
  ];

  return (
    <section className="feature-card" aria-labelledby={`triaje-${ticketId}`}>
      <div className="d-flex align-items-center gap-2 mb-3">
        <BrainCircuit color="#2563eb" size={22} />
        <h2 id={`triaje-${ticketId}`} className="h6 mb-0">Sugerencia del triaje</h2>
        <span className={`badge text-bg-${COLOR_PRIORIDAD[sugerencia.prioridad]} ms-auto`}>{sugerencia.prioridad}</span>
      </div>

      <p className="small muted mb-3">
        {sugerencia.es_otros
          ? 'Ninguna palabra clave coincidió: se propone "Otros" para revisión manual.'
          : <>Clasificado como <strong>{sugerencia.categoria}</strong> por la palabra «{sugerencia.palabra_activadora}».</>}
      </p>

      <table className="table table-sm align-middle mb-3">
        <thead>
          <tr><th scope="col">Campo</th><th scope="col">Sugerencia original</th><th scope="col">Decisión final</th></tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.campo} className={f.sugerido !== f.final ? 'table-warning' : undefined}>
              <th scope="row" className="fw-normal">{f.campo}</th>
              <td>{f.sugerido}</td>
              <td>{f.final}{f.sugerido !== f.final && <span className="badge text-bg-warning ms-2">corregido</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {resultado ? (
        <div className="alert alert-success small mb-0" role="status">
          {resultado.aceptada_sin_correccion
            ? 'Sugerencia aceptada sin cambios.'
            : `Decisión guardada con ${resultado.correcciones.length} corrección(es).`}
        </div>
      ) : (
        <>
          {modo === 'corregir' && (
            <div className="row g-2 mb-3">
              <div className="col-sm-6">
                <label className="form-label small" htmlFor="tri-categoria">Categoría</label>
                <select id="tri-categoria" className="form-select form-select-sm" value={final.categoria_final_id}
                  onChange={(e) => setFinal({ ...final, categoria_final_id: Number(e.target.value) })}>
                  {catalogos.categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
              <div className="col-sm-6">
                <label className="form-label small" htmlFor="tri-prioridad">Prioridad</label>
                <select id="tri-prioridad" className="form-select form-select-sm" value={final.prioridad_final}
                  onChange={(e) => setFinal({ ...final, prioridad_final: e.target.value as Prioridad })}>
                  {PRIORIDADES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="col-sm-6">
                <label className="form-label small" htmlFor="tri-grupo">Grupo</label>
                <select id="tri-grupo" className="form-select form-select-sm" value={final.grupo_final_id ?? ''}
                  onChange={(e) => {
                    const grupo = e.target.value ? Number(e.target.value) : null;
                    const tecnicoSigue = catalogos.tecnicos.some((t) => t.id === final.tecnico_id && t.grupo_id === grupo);
                    setFinal({ ...final, grupo_final_id: grupo, tecnico_id: tecnicoSigue ? final.tecnico_id : null });
                  }}>
                  <option value="">Sin asignar</option>
                  {catalogos.grupos.map((g) => <option key={g.id} value={g.id}>{g.nombre}</option>)}
                </select>
              </div>
              <div className="col-sm-6">
                <label className="form-label small" htmlFor="tri-tecnico">Técnico</label>
                <select id="tri-tecnico" className="form-select form-select-sm" value={final.tecnico_id ?? ''}
                  onChange={(e) => setFinal({ ...final, tecnico_id: e.target.value ? Number(e.target.value) : null })}>
                  <option value="">Sin asignar</option>
                  {tecnicosDelGrupo.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                </select>
              </div>
            </div>
          )}

          {error && <div className="alert alert-danger small" role="alert">{error}</div>}

          <div className="d-flex gap-2">
            {modo === 'ver' ? (
              <>
                <button type="button" className="btn btn-primary btn-sm" disabled={enviando} onClick={() => confirmar(original)}>
                  <Check size={16} className="me-1" />Aceptar
                </button>
                <button type="button" className="btn btn-outline-secondary btn-sm" disabled={enviando} onClick={() => setModo('corregir')}>
                  <Pencil size={16} className="me-1" />Corregir
                </button>
              </>
            ) : (
              <>
                <button type="button" className="btn btn-primary btn-sm" disabled={enviando} onClick={() => confirmar(final)}>
                  Guardar corrección
                </button>
                <button type="button" className="btn btn-link btn-sm" disabled={enviando}
                  onClick={() => { setFinal(original); setModo('ver'); }}>
                  Cancelar
                </button>
              </>
            )}
          </div>
        </>
      )}
    </section>
  );
}
