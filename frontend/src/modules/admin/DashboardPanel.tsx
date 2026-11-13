
import { useCallback, useEffect, useState } from 'react';

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

function formatear(numero: number): string {
  return new Intl.NumberFormat('es-PE', {
    maximumFractionDigits: 2
  }).format(numero);
}

// Barra visual de porcentaje
function BarraPorcentaje({
  porcentaje
}: {
  porcentaje: number;
}) {
  const valor = Number.isFinite(porcentaje)
    ? Math.max(0, Math.min(100, porcentaje))
    : 0;

  return (
    <div
      className="progress"
      role="progressbar"
      aria-label="Porcentaje de precisión"
      aria-valuenow={valor}
      aria-valuemin={0}
      aria-valuemax={100}
      style={{ height: '22px', minWidth: '110px' }}
    >
      <div
        className="progress-bar bg-success"
        style={{ width: `${valor}%` }}
      />
    </div>
  );
}

// Tabla reutilizable de conteos
function TablaConteos({
  titulo,
  filas
}: {
  titulo: string;
  filas: ConteoMetrica[];
}) {
  return (
    <div className="card h-100">
      <div className="card-body">
        <h3 className="h5 mb-3">{titulo}</h3>

        <div className="table-responsive">
          <table className="table table-striped">
            <thead>
              <tr>
                <th>Descripción</th>
                <th className="text-end">Total</th>
              </tr>
            </thead>

            <tbody>
              {filas.map(fila => (
                <tr key={fila.nombre}>
                  <td>{fila.nombre}</td>
                  <td className="text-end">
                    {formatear(fila.total)}
                  </td>
                </tr>
              ))}

              {filas.length === 0 && (
                <tr>
                  <td colSpan={2}>
                    No hay datos disponibles.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Tabla reutilizable de precisión
function TablaPrecision({
  titulo,
  filas
}: {
  titulo: string;
  filas: FilaPrecision[];
}) {
  return (
    <div className="card mb-4">
      <div className="card-body">
        <h3 className="h5 mb-3">{titulo}</h3>

        <div className="table-responsive">
          <table className="table table-bordered align-middle">
            <thead>
              <tr>
                <th>Campo / Categoría</th>
                <th>Decisiones</th>
                <th>Aceptadas</th>
                <th>Precisión</th>
              </tr>
            </thead>

            <tbody>
              {filas.map(fila => (
                <tr key={fila.nombre}>
                  <td>{fila.nombre}</td>
                  <td>{fila.total}</td>
                  <td>{fila.aceptadas}</td>
                  <td>
                    <strong>
                      {formatear(fila.porcentaje)}%
                    </strong>

                    <BarraPorcentaje
                      porcentaje={fila.porcentaje}
                    />
                  </td>
                </tr>
              ))}

              {filas.length === 0 && (
                <tr>
                  <td colSpan={4}>
                    No hay decisiones confirmadas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Panel principal ADM-04
export function DashboardPanel() {
  const [metricas, setMetricas] =
    useState<MetricasDashboard | null>(null);

  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const cargarDatos = useCallback(async () => {
    setCargando(true);
    setError('');

    try {
      const datos = await obtenerMetricasDashboard();
      setMetricas(datos);
    } catch (err: unknown) {
      setMetricas(null);
      setError(
        err instanceof Error
          ? err.message
          : 'Ocurrió un error al cargar las métricas'
      );
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargarDatos();
  }, [cargarDatos]);

  if (cargando) {
    return (
      <div className="page-section" role="status">
        Cargando métricas del Dashboard...
      </div>
    );
  }

  if (error || !metricas) {
    return (
      <section className="page-section">
        <p className="page-description">Indicadores basados en tickets y decisiones confirmadas.</p>
        <div className="alert alert-danger" role="alert">
          {error || 'No hay métricas disponibles'}
        </div>

        <button
          type="button"
          className="btn btn-primary"
          onClick={() => void cargarDatos()}
        >
          Reintentar
        </button>
      </section>
    );
  }

  const { tickets, precision } = metricas;

  const nombresCampo: Record<string, string> = {
    categoria: 'Categoría',
    prioridad: 'Prioridad',
    grupo: 'Grupo resolutor',
    tecnico: 'Técnico'
  };

  const filasCampos = precision.porCampo.map(campo => ({
    nombre: nombresCampo[campo.campo] ?? campo.campo,
    total: campo.total,
    aceptadas: campo.aceptadas,
    porcentaje: campo.porcentaje
  }));

  const filasCategorias =
    precision.porCategoriaSugerida.map(categoria => ({
      nombre: categoria.categoria,
      total: categoria.total,
      aceptadas: categoria.aceptadas,
      porcentaje: categoria.porcentaje
    }));

  return (
    <section className="page-section">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <p className="page-description mb-0">
            Indicadores basados en tickets y decisiones confirmadas.
          </p>
        </div>

        <button
          type="button"
          className="btn btn-outline-primary"
          onClick={() => void cargarDatos()}
        >
          Actualizar
        </button>
      </div>

      {/* TARJETAS PRINCIPALES */}
      <div className="row g-3 mb-4">
        <div className="col-md-3">
          <div className="card h-100">
            <div className="card-body">
              <p className="text-muted">Total de tickets</p>
              <h3 className="display-6">
                {tickets.total}
              </h3>
            </div>
          </div>
        </div>

        <div className="col-md-3">
          <div className="card h-100">
            <div className="card-body">
              <p className="text-muted">
                Decisiones confirmadas
              </p>
              <h3 className="display-6">
                {precision.global.total}
              </h3>
            </div>
          </div>
        </div>

        <div className="col-md-3">
          <div className="card h-100">
            <div className="card-body">
              <p className="text-muted">
                Aceptadas sin corrección
              </p>
              <h3 className="display-6">
                {precision.global.aceptadas}
              </h3>
            </div>
          </div>
        </div>

        <div className="col-md-3">
          <div className="card h-100 border-success">
            <div className="card-body">
              <p className="text-muted">
                Aceptación global
              </p>
              <h3 className="display-6 text-success">
                {formatear(precision.global.porcentaje)}%
              </h3>
            </div>
          </div>
        </div>
      </div>

      {precision.global.total === 0 && (
        <div className="alert alert-info">
          Todavía no hay decisiones confirmadas.
          La aceptación global se muestra como 0%.
        </div>
      )}

      {/* CONTEOS DE TICKETS */}
      <h3 className="h4 mb-3">Resumen de tickets</h3>

      <div className="row g-3 mb-4">
        <div className="col-lg-4">
          <TablaConteos
            titulo="Tickets por estado"
            filas={tickets.porEstado}
          />
        </div>

        <div className="col-lg-4">
          <TablaConteos
            titulo="Tickets por categoría"
            filas={tickets.porCategoria}
          />
        </div>

        <div className="col-lg-4">
          <TablaConteos
            titulo="Tickets por prioridad"
            filas={tickets.porPrioridad}
          />
        </div>
      </div>

      {/* INDICADORES DE PRECISIÓN */}
      <h3 className="h4 mb-3">
        Indicadores de precisión
      </h3>

      <TablaPrecision
        titulo="Precisión por campo"
        filas={filasCampos}
      />

      <TablaPrecision
        titulo="Precisión por categoría sugerida"
        filas={filasCategorias}
      />

      <p className="text-muted small">
        Los porcentajes consideran únicamente decisiones
        confirmadas. Los tickets sin decisión quedan
        excluidos del cálculo de precisión.
      </p>
    </section>
  );
}
