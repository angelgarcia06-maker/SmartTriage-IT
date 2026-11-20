
export interface ConteoMetrica {
  nombre: string;
  total: number;
}

export type CampoPrecision =
  | 'categoria'
  | 'prioridad'
  | 'grupo'
  | 'tecnico';

export interface PrecisionMetrica {
  total: number;
  aceptadas: number;
  porcentaje: number;
}

export interface PrecisionPorCampo extends PrecisionMetrica {
  campo: CampoPrecision;
}

export interface PrecisionPorCategoria extends PrecisionMetrica {
  categoria_id: number | null;
  categoria: string;
}

export interface EvaluacionMlDashboard {
  disponible: boolean;
  motivo: string | null;
  ejemplos: number;
  aciertos: number;
  porcentaje: number | null;
  metodo: 'validacion-cruzada-dejar-uno-fuera';
}

export interface MetricasDashboard {
  tickets: {
    total: number;
    abiertos: number;
    resueltosYCerrados: number;
    criticos: number;
    porEstado: ConteoMetrica[];
    porCategoria: ConteoMetrica[];
    porPrioridad: ConteoMetrica[];
    porTecnicoAbiertos: Array<{
      tecnico_id: number | null;
      nombre: string;
      total: number;
    }>;
  };
  decisiones: {
    aceptadas: number;
    corregidas: number;
    pendientes: number;
  };
  precision: {
    global: PrecisionMetrica;
    porCampo: PrecisionPorCampo[];
    porCategoriaSugerida: PrecisionPorCategoria[];
  };
  comparacionTriaje: {
    aceptacionReglasCategoria: PrecisionMetrica;
    evaluacionMl: EvaluacionMlDashboard;
  };
}

// ADM-04: Consultar métricas desde el backend
export async function obtenerMetricasDashboard(fechas: { fecha_desde?: string; fecha_hasta?: string } = {}):
  Promise<MetricasDashboard> {
  const parametros = new URLSearchParams();
  if (fechas.fecha_desde) parametros.set('fecha_desde', fechas.fecha_desde);
  if (fechas.fecha_hasta) parametros.set('fecha_hasta', fechas.fecha_hasta);
  const query = parametros.toString();
  const respuesta = await fetch(`/api/admin/metricas${query ? `?${query}` : ''}`, {
    method: 'GET',
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json'
    }
  });

  if (!respuesta.ok) {
    if (respuesta.status === 401) {
      throw new Error(
        'Debes iniciar sesión para consultar las métricas'
      );
    }

    if (respuesta.status === 403) {
      throw new Error(
        'No tienes permisos de administrador'
      );
    }

    throw new Error(
      `No se pudieron cargar las métricas: HTTP ${respuesta.status}`
    );
  }

  return (await respuesta.json()) as MetricasDashboard;
}
