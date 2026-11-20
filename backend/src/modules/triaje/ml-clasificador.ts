import type Database from 'better-sqlite3';
import { normalizarTexto } from './normalizar';

const MINIMO_EJEMPLOS = 20;
const MINIMO_POR_CATEGORIA = 3;

interface EjemploEntrenamiento {
  texto: string;
  categoria_id: number;
  categoria: string;
}

export interface ResultadoClasificacionMl {
  disponible: boolean;
  motivo: string | null;
  ejemplos_entrenamiento: number;
  prediccion: { categoria_id: number; categoria: string; confianza: number; evidencias: string[] } | null;
}

export interface EvaluacionClasificadorMl {
  disponible: boolean;
  motivo: string | null;
  ejemplos: number;
  aciertos: number;
  porcentaje: number | null;
  metodo: 'validacion-cruzada-dejar-uno-fuera';
}

function tokens(texto: string): string[] {
  return normalizarTexto(texto).split(' ').filter((token) => token.length > 1);
}

function datosEntrenamiento(conexion: Database.Database): EjemploEntrenamiento[] {
  const ejemplos = conexion.prepare(`
    SELECT t.titulo, t.descripcion, t.categoria_final_id AS categoria_id, c.nombre AS categoria
    FROM tickets t
    JOIN categorias c ON c.id = t.categoria_final_id
    WHERE t.fecha_decision IS NOT NULL AND t.categoria_final_id IS NOT NULL
    ORDER BY t.id
  `).all() as Array<EjemploEntrenamiento & { titulo: string; descripcion: string }>;
  return ejemplos.map(({ titulo, descripcion, categoria_id, categoria }) => ({
    texto: `${titulo} ${descripcion}`,
    categoria_id,
    categoria,
  }));
}

function puedeEntrenar(ejemplos: EjemploEntrenamiento[]): boolean {
  const conteos = new Map<number, number>();
  ejemplos.forEach(({ categoria_id }) => conteos.set(categoria_id, (conteos.get(categoria_id) ?? 0) + 1));
  return ejemplos.length >= MINIMO_EJEMPLOS
    && conteos.size >= 2
    && [...conteos.values()].every((total) => total >= MINIMO_POR_CATEGORIA);
}

function predecir(texto: string, entrenamiento: EjemploEntrenamiento[]) {
  const conteoCategorias = new Map<number, { nombre: string; total: number; tokens: Map<string, number>; totalTokens: number }>();
  const vocabulario = new Set<string>();

  for (const ejemplo of entrenamiento) {
    let categoria = conteoCategorias.get(ejemplo.categoria_id);
    if (!categoria) {
      categoria = { nombre: ejemplo.categoria, total: 0, tokens: new Map(), totalTokens: 0 };
      conteoCategorias.set(ejemplo.categoria_id, categoria);
    }
    categoria.total += 1;
    for (const token of tokens(ejemplo.texto)) {
      vocabulario.add(token);
      categoria.tokens.set(token, (categoria.tokens.get(token) ?? 0) + 1);
      categoria.totalTokens += 1;
    }
  }

  const palabras = [...new Set(tokens(texto))];
  const puntuaciones = [...conteoCategorias.entries()].map(([categoriaId, categoria]) => {
    const suavizado = vocabulario.size || 1;
    let logProbabilidad = Math.log(categoria.total / entrenamiento.length);
    for (const token of palabras) {
      logProbabilidad += Math.log(((categoria.tokens.get(token) ?? 0) + 1) / (categoria.totalTokens + suavizado));
    }
    return { categoria_id: categoriaId, categoria: categoria.nombre, logProbabilidad };
  }).sort((a, b) => b.logProbabilidad - a.logProbabilidad);

  const mayor = puntuaciones[0].logProbabilidad;
  const pesos = puntuaciones.map((puntuacion) => Math.exp(puntuacion.logProbabilidad - mayor));
  const sumaPesos = pesos.reduce((suma, peso) => suma + peso, 0);
  const ganadora = conteoCategorias.get(puntuaciones[0].categoria_id)!;
  const segunda = conteoCategorias.get(puntuaciones[1]?.categoria_id);
  const evidencias = palabras
    .filter((token) => vocabulario.has(token) && (ganadora.tokens.get(token) ?? 0) > 0)
    .map((token) => {
      const probGanadora = ((ganadora.tokens.get(token) ?? 0) + 1) / (ganadora.totalTokens + (vocabulario.size || 1));
      const probSegunda = segunda
        ? ((segunda.tokens.get(token) ?? 0) + 1) / (segunda.totalTokens + (vocabulario.size || 1))
        : 0;
      return { token, aporte: probSegunda > 0 ? Math.log(probGanadora / probSegunda) : 0 };
    })
    .filter((item) => item.aporte > 0)
    .sort((a, b) => b.aporte - a.aporte)
    .slice(0, 5)
    .map(({ token }) => token);

  return {
    categoria_id: puntuaciones[0].categoria_id,
    categoria: puntuaciones[0].categoria,
    confianza: Math.round((pesos[0] / sumaPesos) * 10000) / 100,
    evidencias,
  };
}

export function clasificarConNaiveBayes(
  texto: string,
  conexion: Database.Database,
): ResultadoClasificacionMl {
  const entrenamiento = datosEntrenamiento(conexion);
  if (!puedeEntrenar(entrenamiento)) {
    return {
      disponible: false,
      motivo: `Se necesitan al menos ${MINIMO_EJEMPLOS} decisiones confirmadas, dos categorías y ${MINIMO_POR_CATEGORIA} ejemplos por categoría.`,
      ejemplos_entrenamiento: entrenamiento.length,
      prediccion: null,
    };
  }

  if (tokens(texto).length === 0) {
    return { disponible: false, motivo: 'Escribe una descripción para clasificar.', ejemplos_entrenamiento: entrenamiento.length, prediccion: null };
  }

  return {
    disponible: true,
    motivo: null,
    ejemplos_entrenamiento: entrenamiento.length,
    prediccion: predecir(texto, entrenamiento),
  };
}

/** Evalúa el clasificador con validación cruzada leave-one-out sobre decisiones confirmadas. */
export function evaluarNaiveBayes(conexion: Database.Database): EvaluacionClasificadorMl {
  const ejemplos = datosEntrenamiento(conexion);
  if (ejemplos.length < MINIMO_EJEMPLOS + 1) {
    return {
      disponible: false,
      motivo: `Se necesitan al menos ${MINIMO_EJEMPLOS + 1} tickets con categoría confirmada para empezar a medir los aciertos con casos apartados.`,
      ejemplos: 0,
      aciertos: 0,
      porcentaje: null,
      metodo: 'validacion-cruzada-dejar-uno-fuera',
    };
  }

  let evaluados = 0;
  let aciertos = 0;
  for (let indice = 0; indice < ejemplos.length; indice += 1) {
    const entrenamiento = ejemplos.filter((_ejemplo, posicion) => posicion !== indice);
    if (!puedeEntrenar(entrenamiento)) continue;
    const prediccion = predecir(ejemplos[indice].texto, entrenamiento);
    evaluados += 1;
    if (prediccion.categoria_id === ejemplos[indice].categoria_id) aciertos += 1;
  }

  if (evaluados === 0) {
    return {
      disponible: false,
      motivo: 'Faltan tickets revisados en algunas categorías para medir los aciertos con casos apartados.',
      ejemplos: 0,
      aciertos: 0,
      porcentaje: null,
      metodo: 'validacion-cruzada-dejar-uno-fuera',
    };
  }
  return {
    disponible: true,
    motivo: null,
    ejemplos: evaluados,
    aciertos,
    porcentaje: Math.round((aciertos / evaluados) * 10000) / 100,
    metodo: 'validacion-cruzada-dejar-uno-fuera',
  };
}
