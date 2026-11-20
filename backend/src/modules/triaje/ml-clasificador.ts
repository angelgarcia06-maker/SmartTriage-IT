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
  prediccion: { categoria_id: number; categoria: string; confianza: number } | null;
}

function tokens(texto: string): string[] {
  return normalizarTexto(texto).split(' ').filter((token) => token.length > 1);
}

export function clasificarConNaiveBayes(
  texto: string,
  conexion: Database.Database,
): ResultadoClasificacionMl {
  const ejemplos = conexion.prepare(`
    SELECT t.titulo, t.descripcion, t.categoria_final_id AS categoria_id, c.nombre AS categoria
    FROM tickets t
    JOIN categorias c ON c.id = t.categoria_final_id
    WHERE t.fecha_decision IS NOT NULL AND t.categoria_final_id IS NOT NULL
    ORDER BY t.id
  `).all() as Array<EjemploEntrenamiento & { titulo: string; descripcion: string }>;

  const entrenamiento = ejemplos.map(({ titulo, descripcion, categoria_id, categoria }) => ({
    texto: `${titulo} ${descripcion}`,
    categoria_id,
    categoria,
  }));
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

  const categoriasInsuficientes = [...conteoCategorias.values()].some((categoria) => categoria.total < MINIMO_POR_CATEGORIA);
  if (entrenamiento.length < MINIMO_EJEMPLOS || conteoCategorias.size < 2 || categoriasInsuficientes) {
    return {
      disponible: false,
      motivo: `Se necesitan al menos ${MINIMO_EJEMPLOS} decisiones confirmadas, dos categorías y ${MINIMO_POR_CATEGORIA} ejemplos por categoría.`,
      ejemplos_entrenamiento: entrenamiento.length,
      prediccion: null,
    };
  }

  const palabras = tokens(texto);
  if (palabras.length === 0) {
    return { disponible: false, motivo: 'Escribe una descripción para clasificar.', ejemplos_entrenamiento: entrenamiento.length, prediccion: null };
  }

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

  return {
    disponible: true,
    motivo: null,
    ejemplos_entrenamiento: entrenamiento.length,
    prediccion: {
      categoria_id: puntuaciones[0].categoria_id,
      categoria: puntuaciones[0].categoria,
      confianza: Math.round((pesos[0] / sumaPesos) * 10000) / 100,
    },
  };
}
