
import type Database from 'better-sqlite3';
import { CONDICION_DECISION_CONFIRMADA } from '../triaje/decision';
import { evaluarNaiveBayes, type EvaluacionClasificadorMl } from '../triaje/ml-clasificador';

interface Conteo {
  nombre: string;
  total: number;
}

interface Precision {
  total: number;
  aceptadas: number;
  porcentaje: number;
}

type Campo = 'categoria' | 'prioridad' | 'grupo' | 'tecnico';

interface PrecisionCampo extends Precision {
  campo: Campo;
}

interface PrecisionCategoria extends Precision {
  categoria_id: number | null;
  categoria: string;
}

export interface MetricasDashboard {
  tickets: {
    total: number;
    abiertos: number;
    resueltosYCerrados: number;
    criticos: number;
    porEstado: Conteo[];
    porCategoria: Conteo[];
    porPrioridad: Conteo[];
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
    global: Precision;
    porCampo: PrecisionCampo[];
    porCategoriaSugerida: PrecisionCategoria[];
  };
  comparacionTriaje: {
    aceptacionReglasCategoria: Precision;
    evaluacionMl: EvaluacionClasificadorMl;
  };
}

function calcularPorcentaje(
  aceptadas: number,
  total: number
): number {
  if (total === 0) return 0;
  return Math.round((aceptadas / total) * 10000) / 100;
}

export function obtenerMetricas(
  db: Database.Database
): MetricasDashboard {

  // Cantidad total de tickets
  const conteo = db.prepare(`
    SELECT COUNT(*) AS total
    FROM tickets
  `).get() as { total: number };

  const resumenOperativo = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN estado IN ('Nuevo', 'Asignado', 'En proceso') THEN 1 ELSE 0 END), 0) AS abiertos,
      COALESCE(SUM(CASE WHEN estado IN ('Resuelto', 'Cerrado') THEN 1 ELSE 0 END), 0) AS resueltosYCerrados,
      COALESCE(SUM(CASE WHEN COALESCE(prioridad_final, prioridad_sugerida) = 'Crítica' THEN 1 ELSE 0 END), 0) AS criticos
    FROM tickets
  `).get() as {
    abiertos: number;
    resueltosYCerrados: number;
    criticos: number;
  };

  const decisiones = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN aceptada_sin_correccion = 1 THEN 1 ELSE 0 END), 0) AS aceptadas,
      COALESCE(SUM(CASE WHEN aceptada_sin_correccion = 0 THEN 1 ELSE 0 END), 0) AS corregidas,
      COALESCE(SUM(CASE
        WHEN fecha_decision IS NULL
          AND (categoria_sugerida_id IS NOT NULL OR prioridad_sugerida IS NOT NULL
            OR grupo_sugerido_id IS NOT NULL OR tecnico_sugerido_id IS NOT NULL)
        THEN 1 ELSE 0
      END), 0) AS pendientes
    FROM tickets
  `).get() as {
    aceptadas: number;
    corregidas: number;
    pendientes: number;
  };

  const porTecnicoAbiertos = db.prepare(`
    SELECT
      t.tecnico_id,
      COALESCE(u.nombre, 'Sin asignar') AS nombre,
      COUNT(*) AS total
    FROM tickets t
    LEFT JOIN usuarios u ON u.id = t.tecnico_id
    WHERE t.estado IN ('Nuevo', 'Asignado', 'En proceso')
    GROUP BY t.tecnico_id, u.nombre
    ORDER BY total DESC, nombre
  `).all() as Array<{
    tecnico_id: number | null;
    nombre: string;
    total: number;
  }>;

  // Tickets agrupados por estado
  const porEstado = db.prepare(`
    SELECT estado AS nombre, COUNT(*) AS total
    FROM tickets
    GROUP BY estado
    ORDER BY estado
  `).all() as Conteo[];

  // Categoría final si existe; de lo contrario, sugerida
  const porCategoria = db.prepare(`
    SELECT
      COALESCE(
        cf.nombre,
        cs.nombre,
        'Sin categoría'
      ) AS nombre,
      COUNT(*) AS total
    FROM tickets t
    LEFT JOIN categorias cf
      ON cf.id = t.categoria_final_id
    LEFT JOIN categorias cs
      ON cs.id = t.categoria_sugerida_id
    GROUP BY
      COALESCE(cf.nombre, cs.nombre, 'Sin categoría')
    ORDER BY total DESC, nombre
  `).all() as Conteo[];

  // Prioridad final si existe; de lo contrario, sugerida
  const porPrioridad = db.prepare(`
    SELECT
      COALESCE(
        prioridad_final,
        prioridad_sugerida,
        'Sin prioridad'
      ) AS nombre,
      COUNT(*) AS total
    FROM tickets
    GROUP BY
      COALESCE(
        prioridad_final,
        prioridad_sugerida,
        'Sin prioridad'
      )
    ORDER BY total DESC, nombre
  `).all() as Conteo[];

  // Aceptación global: solo decisiones confirmadas
  const global = db.prepare(`
    SELECT
      COUNT(*) AS total,
      COALESCE(SUM(
        CASE
          WHEN aceptada_sin_correccion = 1 THEN 1
          ELSE 0
        END
      ), 0) AS aceptadas
    FROM tickets
    WHERE ${CONDICION_DECISION_CONFIRMADA}
  `).get() as {
    total: number;
    aceptadas: number;
  };

  const precisionGlobal: Precision = {
    ...global,
    porcentaje: calcularPorcentaje(
      global.aceptadas,
      global.total
    )
  };

  // Precisión por campo usando las correcciones registradas
  const campos: Campo[] = [
    'categoria',
    'prioridad',
    'grupo',
    'tecnico'
  ];

  const conteosPorCampo = db.prepare(`
    SELECT COUNT(*) AS total,
      COALESCE(SUM(CASE WHEN NOT EXISTS (
        SELECT 1 FROM correcciones c WHERE c.ticket_id = t.id AND c.campo = 'categoria'
      ) THEN 1 ELSE 0 END), 0) AS categoria,
      COALESCE(SUM(CASE WHEN NOT EXISTS (
        SELECT 1 FROM correcciones c WHERE c.ticket_id = t.id AND c.campo = 'prioridad'
      ) THEN 1 ELSE 0 END), 0) AS prioridad,
      COALESCE(SUM(CASE WHEN NOT EXISTS (
        SELECT 1 FROM correcciones c WHERE c.ticket_id = t.id AND c.campo = 'grupo'
      ) THEN 1 ELSE 0 END), 0) AS grupo,
      COALESCE(SUM(CASE WHEN NOT EXISTS (
        SELECT 1 FROM correcciones c WHERE c.ticket_id = t.id AND c.campo = 'tecnico'
      ) THEN 1 ELSE 0 END), 0) AS tecnico
    FROM tickets t
    WHERE ${CONDICION_DECISION_CONFIRMADA}
  `).get() as {
    total: number;
    categoria: number;
    prioridad: number;
    grupo: number;
    tecnico: number;
  };
  const porCampo: PrecisionCampo[] = campos.map((campo) => ({
    campo,
    total: conteosPorCampo.total,
    aceptadas: conteosPorCampo[campo],
    porcentaje: calcularPorcentaje(conteosPorCampo[campo], conteosPorCampo.total),
  }));

  // Agrupar según la categoría SUGERIDA, no la final
  const filasCategoria = db.prepare(`
    SELECT
      c.id AS categoria_id,
      COALESCE(
        c.nombre,
        'Sin categoría sugerida'
      ) AS categoria,
      COUNT(*) AS total,
      COALESCE(SUM(
        CASE
          WHEN t.aceptada_sin_correccion = 1 THEN 1
          ELSE 0
        END
      ), 0) AS aceptadas
    FROM tickets t
    LEFT JOIN categorias c
      ON c.id = t.categoria_sugerida_id
    WHERE ${CONDICION_DECISION_CONFIRMADA}
    GROUP BY c.id, c.nombre
    ORDER BY total DESC, categoria
  `).all() as Array<{
    categoria_id: number | null;
    categoria: string;
    total: number;
    aceptadas: number;
  }>;

  const porCategoriaSugerida: PrecisionCategoria[] =
    filasCategoria.map(fila => ({
      ...fila,
      porcentaje: calcularPorcentaje(
        fila.aceptadas,
        fila.total
      )
    }));

  const aceptacionCategoria = porCampo.find(({ campo }) => campo === 'categoria')!;
  const evaluacionMl = evaluarNaiveBayes(db);

  return {
    tickets: {
      total: conteo.total,
      ...resumenOperativo,
      porEstado,
      porCategoria,
      porPrioridad,
      porTecnicoAbiertos
    },
    decisiones,
    precision: {
      global: precisionGlobal,
      porCampo,
      porCategoriaSugerida
    },
    comparacionTriaje: {
      aceptacionReglasCategoria: {
        total: aceptacionCategoria.total,
        aceptadas: aceptacionCategoria.aceptadas,
        porcentaje: aceptacionCategoria.porcentaje,
      },
      evaluacionMl,
    },
  };
}
