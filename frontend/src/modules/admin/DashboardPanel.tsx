import { useCallback, useEffect, useState, type ComponentType } from 'react';
import {
  BadgeCheck,
  ChartNoAxesColumnIncreasing,
  CircleCheck,
  CircleDashed,
  Clock3,
  RefreshCw,
  Ticket,
  TriangleAlert
} from 'lucide-react';

import {
  obtenerMetricasDashboard,
  type ConteoMetrica,
  type MetricasDashboard
} from './metricas.api';

interface FilaPrecision {
  nombre: string;
  total: number;
  aceptadas: number;
  porcentaje: number;
}

interface FilaGrafico {
  nombre: string;
  total: number;
  porcentaje?: number;
  detalle?: string;
  tono?: 'success' | 'warning' | 'danger' | 'teal' | 'muted';
}

const NUMERO = new Intl.NumberFormat('es-PE', { maximumFractionDigits: 2 });
const PORCENTAJE = new Intl.NumberFormat('es-PE', { maximumFractionDigits: 2 });

function formatear(numero: number): string {
  return NUMERO.format(numero);
}

function GraficoBarras({
  titulo,
  filas,
  escala = 'conteo',
  leyenda
}: {
  titulo: string;
  filas: FilaGrafico[];
  escala?: 'conteo' | 'porcentaje';
  leyenda?: Array<{ nombre: string; tono: 'success' | 'warning' | 'muted' }>;
}) {
  const maximo = escala === 'porcentaje'
    ? 100
    : Math.max(1, ...filas.map((fila) => fila.total));

  return (
    <section className="dashboard-chart" aria-label={titulo}>
      <h3>{titulo}</h3>
      {filas.length === 0 ? (
        <p className="dashboard-chart-empty">No hay datos para mostrar todavía.</p>
      ) : (
        <ol className="dashboard-bars">
          {filas.map((fila) => {
            const valor = escala === 'porcentaje' ? (fila.porcentaje ?? 0) : fila.total;
            const ancho = Math.max(0, Math.min(100, valor / maximo * 100));
            const detalle = fila.detalle ?? (
              escala === 'porcentaje'
                ? `${PORCENTAJE.format(valor)}%`
                : formatear(fila.total)
            );

            return (
              <li key={fila.nombre} className="dashboard-bar-row" title={`${fila.nombre}: ${detalle}`}>
                <div className="dashboard-bar-heading">
                  <span>{fila.nombre}</span>
                  <strong>{detalle}</strong>
                </div>
                <div
                  className="dashboard-bar-track"
                  role="img"
                  aria-label={`${fila.nombre}: ${detalle}`}
                >
                  <span
                    className={`dashboard-bar-fill is-${fila.tono ?? 'blue'}`}
                    style={{ width: `${ancho}%` }}
                    aria-hidden="true"
                  />
                </div>
              </li>
            );
          })}
        </ol>
      )}
      {leyenda && leyenda.length > 0 && (
        <ul className="dashboard-chart-legend" aria-label={`Leyenda: ${titulo}`}>
          {leyenda.map((item) => (
            <li key={item.nombre}>
              <span className={`dashboard-legend-swatch is-${item.tono}`} aria-hidden="true" />
              {item.nombre}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function TablaConteos({
  titulo,
  filas
}: {
  titulo: string;
  filas: ConteoMetrica[];
}) {
  return (
    <div className="dashboard-detail-card">
      <h3>{titulo}</h3>
      {filas.length === 0 ? (
        <p className="dashboard-chart-empty">No hay datos disponibles.</p>
      ) : (
        <div className="table-responsive">
          <table className="table table-hover">
            <thead>
              <tr><th>Descripción</th><th className="text-end">Total</th></tr>
            </thead>
            <tbody>
              {filas.map((fila) => (
                <tr key={fila.nombre}>
                  <td>{fila.nombre}</td>
                  <td className="text-end">{formatear(fila.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function TablaPrecision({
  titulo,
  filas
}: {
  titulo: string;
  filas: FilaPrecision[];
}) {
  return (
    <div className="dashboard-detail-card">
      <h3>{titulo}</h3>
      {filas.length === 0 ? (
        <p className="dashboard-chart-empty">No hay decisiones confirmadas.</p>
      ) : (
        <div className="table-responsive">
          <table className="table table-hover align-middle">
            <thead>
              <tr>
                <th>Campo / categoría</th>
                <th>Decisiones</th>
                <th>Aceptadas</th>
                <th>Aceptación</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((fila) => (
                <tr key={fila.nombre}>
                  <th scope="row">{fila.nombre}</th>
                  <td>{formatear(fila.total)}</td>
                  <td>{formatear(fila.aceptadas)}</td>
                  <td>
                    <strong>{PORCENTAJE.format(fila.porcentaje)}%</strong>
                    <div className="dashboard-table-progress" aria-hidden="true">
                      <span style={{ width: `${Math.max(0, Math.min(100, fila.porcentaje))}%` }} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function TarjetaIndicador({
  etiqueta,
  valor,
  detalle,
  icono: Icono,
  tono
}: {
  etiqueta: string;
  valor: string;
  detalle: string;
  icono: ComponentType<{ size?: number; 'aria-hidden'?: boolean }>;
  tono: 'blue' | 'teal' | 'amber' | 'red' | 'green';
}) {
  return (
    <article className={`dashboard-kpi is-${tono}`}>
      <span className="dashboard-kpi-icon" aria-hidden="true"><Icono size={20} /></span>
      <span className="dashboard-kpi-label">{etiqueta}</span>
      <strong className="dashboard-kpi-value">{valor}</strong>
      <span className="dashboard-kpi-detail">{detalle}</span>
    </article>
  );
}

function EsqueletoDashboard() {
  return (
    <div className="page-section dashboard-page" role="status" aria-label="Cargando métricas">
      <div className="dashboard-heading">
        <span className="dashboard-skeleton dashboard-skeleton-title" />
        <span className="dashboard-skeleton dashboard-skeleton-copy" />
      </div>
      <div className="dashboard-kpis">
        {Array.from({ length: 6 }, (_, index) => (
          <span key={index} className="dashboard-skeleton dashboard-skeleton-card" />
        ))}
      </div>
      <span className="dashboard-skeleton dashboard-skeleton-panel" />
    </div>
  );
}

export function DashboardPanel() {
  const [metricas, setMetricas] = useState<MetricasDashboard | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [actualizado, setActualizado] = useState<Date | null>(null);

  const cargarDatos = useCallback(async () => {
    setCargando(true);
    setError('');

    try {
      const datos = await obtenerMetricasDashboard();
      setMetricas(datos);
      setActualizado(new Date());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ocurrió un error al cargar las métricas.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargarDatos();
  }, [cargarDatos]);

  if (cargando && !metricas) return <EsqueletoDashboard />;

  if (error || !metricas) {
    return (
      <section className="page-section dashboard-page">
        <div className="dashboard-heading">
          <div>
            <p className="dashboard-eyebrow">Resumen operativo</p>
            <h2>Panel de gestión TI</h2>
            <p>Actividad y decisiones registradas en SmartTriage IT.</p>
          </div>
        </div>
        <div className="alert alert-danger" role="alert">
          {error || 'No hay métricas disponibles.'}
        </div>
        <button type="button" className="btn btn-primary" onClick={() => void cargarDatos()}>
          <RefreshCw size={16} aria-hidden="true" /> Reintentar
        </button>
      </section>
    );
  }

  const { tickets, precision, decisiones } = metricas;
  const nombresCampo: Record<string, string> = {
    categoria: 'Categoría',
    prioridad: 'Prioridad',
    grupo: 'Grupo resolutor',
    tecnico: 'Técnico'
  };
  const filasCampos = precision.porCampo.map((campo) => ({
    nombre: nombresCampo[campo.campo] ?? campo.campo,
    total: campo.total,
    aceptadas: campo.aceptadas,
    porcentaje: campo.porcentaje
  }));
  const filasCategorias = precision.porCategoriaSugerida.map((categoria) => ({
    nombre: categoria.categoria,
    total: categoria.total,
    aceptadas: categoria.aceptadas,
    porcentaje: categoria.porcentaje
  }));
  const fechaActualizacion = actualizado
    ? new Intl.DateTimeFormat('es-MX', { hour: '2-digit', minute: '2-digit' }).format(actualizado)
    : '—';

  return (
    <section className="page-section dashboard-page" aria-labelledby="dashboard-titulo">
      <header className="dashboard-heading">
        <div>
          <p className="dashboard-eyebrow">Resumen operativo</p>
          <h2 id="dashboard-titulo">Panel de gestión TI</h2>
          <p>Tickets, carga de trabajo y decisiones registradas en SmartTriage IT.</p>
        </div>
        <div className="dashboard-update">
          <span>Actualizado a las {fechaActualizacion}</span>
          <button
            type="button"
            className="btn btn-outline-primary"
            onClick={() => void cargarDatos()}
            disabled={cargando}
          >
            <RefreshCw size={16} aria-hidden="true" className={cargando ? 'dashboard-refreshing' : ''} />
            {cargando ? 'Actualizando…' : 'Actualizar'}
          </button>
        </div>
      </header>

      {error && <div className="alert alert-warning" role="alert">{error} Se conservan las últimas métricas cargadas.</div>}

      <div className="dashboard-kpis" aria-label="Indicadores clave">
        <TarjetaIndicador etiqueta="Total de tickets" valor={formatear(tickets.total)} detalle="Incidencias registradas" icono={Ticket} tono="blue" />
        <TarjetaIndicador etiqueta="Tickets abiertos" valor={formatear(tickets.abiertos)} detalle="Nuevo, asignado o en proceso" icono={CircleDashed} tono="teal" />
        <TarjetaIndicador etiqueta="Resueltos y cerrados" valor={formatear(tickets.resueltosYCerrados)} detalle="Atención completada" icono={CircleCheck} tono="green" />
        <TarjetaIndicador etiqueta="Decisiones pendientes" valor={formatear(decisiones.pendientes)} detalle="Sugerencias por revisar" icono={Clock3} tono="amber" />
        <TarjetaIndicador etiqueta="Aceptación del triaje" valor={`${PORCENTAJE.format(precision.global.porcentaje)}%`} detalle={`${formatear(precision.global.aceptadas)} de ${formatear(precision.global.total)} decisiones confirmadas`} icono={BadgeCheck} tono="blue" />
        <TarjetaIndicador etiqueta="Prioridad crítica" valor={formatear(tickets.criticos)} detalle="Según prioridad final o sugerida" icono={TriangleAlert} tono="red" />
      </div>

      {tickets.total === 0 && (
        <div className="empty-state dashboard-empty" role="status">
          <h3>Sin actividad registrada</h3>
          <p>Cuando se registren tickets, aquí aparecerá el resumen operativo.</p>
        </div>
      )}

      <div className="dashboard-chart-heading">
        <div>
          <h2>Distribución y operación</h2>
          <p>Conteos calculados sobre los tickets persistidos.</p>
        </div>
        <span className="dashboard-chart-mark" aria-hidden="true"><ChartNoAxesColumnIncreasing size={19} /></span>
      </div>

      <div className="dashboard-chart-grid">
        <GraficoBarras titulo="Tickets por estado" filas={tickets.porEstado} />
        <GraficoBarras titulo="Distribución por categoría" filas={tickets.porCategoria} />
        <GraficoBarras titulo="Distribución por prioridad" filas={tickets.porPrioridad.map((fila) => ({
          ...fila,
          tono: fila.nombre === 'Crítica' ? 'danger' : undefined
        }))} />
        <GraficoBarras
          titulo="Decisiones de triaje"
          leyenda={[
            { nombre: 'Aceptadas', tono: 'success' },
            { nombre: 'Corregidas', tono: 'warning' },
            { nombre: 'Pendientes', tono: 'muted' }
          ]}
          filas={[
            { nombre: 'Aceptadas', total: decisiones.aceptadas, tono: 'success' },
            { nombre: 'Corregidas', total: decisiones.corregidas, tono: 'warning' },
            { nombre: 'Pendientes', total: decisiones.pendientes, tono: 'muted' }
          ]}
        />
        <GraficoBarras
          titulo="Aceptación por categoría sugerida"
          escala="porcentaje"
          filas={filasCategorias.map((fila) => ({
            nombre: fila.nombre,
            total: fila.total,
            porcentaje: fila.porcentaje,
            detalle: `${PORCENTAJE.format(fila.porcentaje)}% · ${fila.aceptadas}/${fila.total} decisiones`,
            tono: 'teal'
          }))}
        />
        <GraficoBarras
          titulo="Tickets abiertos por técnico"
          filas={tickets.porTecnicoAbiertos}
        />
      </div>

      <div className="dashboard-chart-heading dashboard-details-heading">
        <div>
          <h2>Análisis detallado</h2>
          <p>La aceptación mide decisiones humanas, no precisión estadística de un modelo.</p>
        </div>
      </div>
      <div className="dashboard-detail-grid">
        <TablaPrecision titulo="Aceptación por campo" filas={filasCampos} />
        <TablaPrecision titulo="Aceptación por categoría sugerida" filas={filasCategorias} />
        <TablaConteos titulo="Tickets por categoría final o sugerida" filas={tickets.porCategoria} />
        <TablaConteos titulo="Tickets por prioridad final o sugerida" filas={tickets.porPrioridad} />
      </div>
      <p className="dashboard-footnote">
        Las decisiones pendientes no participan en el porcentaje de aceptación. No se estiman tiempos de resolución ni SLA.
      </p>
    </section>
  );
}
