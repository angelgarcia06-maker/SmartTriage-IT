import { describe, expect, it } from 'vitest';
import { calcularPrioridad, type Impacto, type Prioridad, type Urgencia } from './prioridad';

describe('calcularPrioridad — los nueve pares de la matriz', () => {
  const casos: [Impacto, Urgencia, Prioridad][] = [
    ['Alto', 'Alta', 'Crítica'],
    ['Alto', 'Media', 'Alta'],
    ['Alto', 'Baja', 'Media'],
    ['Medio', 'Alta', 'Alta'],
    ['Medio', 'Media', 'Media'],
    ['Medio', 'Baja', 'Baja'],
    ['Bajo', 'Alta', 'Media'],
    ['Bajo', 'Media', 'Baja'],
    ['Bajo', 'Baja', 'Baja'],
  ];
  it.each(casos)('Impacto %s + Urgencia %s = %s', (impacto, urgencia, esperada) => {
    expect(calcularPrioridad(impacto, urgencia)).toBe(esperada);
  });
});

describe('calcularPrioridad — validación', () => {
  it('rechaza impacto inválido', () => {
    expect(() => calcularPrioridad('Altísimo' as Impacto, 'Alta')).toThrow(/Impacto inválido/);
  });
  it('rechaza urgencia inválida (distingue mayúsculas)', () => {
    expect(() => calcularPrioridad('Alto', 'alta' as Urgencia)).toThrow(/Urgencia inválida/);
  });
});
