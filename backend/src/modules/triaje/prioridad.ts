/** Tipos iguales a shared/types/triaje.types.ts (el backend no puede importar fuera de src/). */
export type Impacto = 'Alto' | 'Medio' | 'Bajo';
export type Urgencia = 'Alta' | 'Media' | 'Baja';
export type Prioridad = 'Crítica' | 'Alta' | 'Media' | 'Baja';

export const IMPACTOS: readonly Impacto[] = ['Alto', 'Medio', 'Bajo'];
export const URGENCIAS: readonly Urgencia[] = ['Alta', 'Media', 'Baja'];
export const PRIORIDADES: readonly Prioridad[] = ['Crítica', 'Alta', 'Media', 'Baja'];

/**
 * Matriz de prioridad Impacto × Urgencia (modelo ITIL 3×3).
 *
 * | Impacto \ Urgencia | Alta    | Media | Baja  |
 * |--------------------|---------|-------|-------|
 * | Alto               | Crítica | Alta  | Media |
 * | Medio              | Alta    | Media | Baja  |
 * | Bajo               | Media   | Baja  | Baja  |
 */
export const MATRIZ_PRIORIDAD: Readonly<Record<Impacto, Readonly<Record<Urgencia, Prioridad>>>> = {
  Alto: { Alta: 'Crítica', Media: 'Alta', Baja: 'Media' },
  Medio: { Alta: 'Alta', Media: 'Media', Baja: 'Baja' },
  Bajo: { Alta: 'Media', Media: 'Baja', Baja: 'Baja' },
};

export function esImpacto(valor: unknown): valor is Impacto {
  return typeof valor === 'string' && (IMPACTOS as readonly string[]).includes(valor);
}
export function esUrgencia(valor: unknown): valor is Urgencia {
  return typeof valor === 'string' && (URGENCIAS as readonly string[]).includes(valor);
}

/**
 * Prioridad según la matriz. Función pura: solo depende de impacto y urgencia,
 * nunca de la descripción ni de la categoría. Lanza error si un valor no es válido.
 */
export function calcularPrioridad(impacto: Impacto, urgencia: Urgencia): Prioridad {
  if (!esImpacto(impacto)) throw new Error(`Impacto inválido: ${String(impacto)}. Usa Alto, Medio o Bajo.`);
  if (!esUrgencia(urgencia)) throw new Error(`Urgencia inválida: ${String(urgencia)}. Usa Alta, Media o Baja.`);
  return MATRIZ_PRIORIDAD[impacto][urgencia];
}
