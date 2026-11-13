
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

export interface MetricasDashboard {
  tickets: {
    total: number;
    porEstado: ConteoMetrica[];
    porCategoria: ConteoMetrica[];
    porPrioridad: ConteoMetrica[];
  };
  precision: {
    global: PrecisionMetrica;
    porCampo: PrecisionPorCampo[];
    porCategoriaSugerida: PrecisionPorCategoria[];
  };
}

// ADM-04: Consultar métricas desde el backend
export async function obtenerMetricasDashboard():
  Promise<MetricasDashboard> {

  const respuesta = await fetch('/api/admin/metricas', {
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
