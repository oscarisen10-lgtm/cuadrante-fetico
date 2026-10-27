// Test UNITARIO del factor de tamaño de letra (src/services/tamanoLetra.js).
// Auditoría 25-oct-2026 (H-29): se respeta la letra grande del sistema, con un tope
// del 130% para que el diseño no se descoloque, y nunca se reduce por debajo de 1.
import { describe, test, expect } from 'vitest';
import { factorAplicable, TOPE_TAMANO_LETRA } from '../../src/services/tamanoLetra.js';

describe('factorAplicable', () => {
  test('quien no ha tocado el tamaño de letra ve la app igual', () => {
    expect(factorAplicable(1)).toBe(1);
  });

  test('letra algo más grande: se respeta', () => {
    expect(factorAplicable(1.15)).toBe(1.15);
    expect(factorAplicable(1.2353)).toBe(1.24);
  });

  test('letra muy grande (accesibilidad): se queda en el tope', () => {
    expect(TOPE_TAMANO_LETRA).toBe(1.3);
    expect(factorAplicable(1.76)).toBe(1.3);
    expect(factorAplicable(3.1)).toBe(1.3);
  });

  test('letra más pequeña que la normal: no se reduce', () => {
    expect(factorAplicable(0.85)).toBe(1);
  });

  test('valores raros no rompen nada', () => {
    expect(factorAplicable(undefined)).toBe(1);
    expect(factorAplicable('abc')).toBe(1);
    expect(factorAplicable(NaN)).toBe(1);
  });
});
