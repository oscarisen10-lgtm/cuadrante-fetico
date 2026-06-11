// Test UNITARIO: comprueba que funciones puras (sin red ni Firebase) dan el
// resultado esperado. No necesita el emulador. Se ejecuta con: npm test
import { describe, test, expect } from 'vitest';
import {
  getFormattedDate,
  formatTotalTime,
  formatCountdown,
} from '../../src/utils/dateUtils.js';

describe('getFormattedDate', () => {
  test('formatea una fecha como YYYY-MM-DD con ceros a la izquierda', () => {
    // 5 de enero de 2026 (mes 0 = enero)
    expect(getFormattedDate(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  test('maneja diciembre y días de dos cifras', () => {
    expect(getFormattedDate(new Date(2026, 11, 31))).toBe('2026-12-31');
  });
});

describe('formatTotalTime', () => {
  test('6.75 horas decimales = "6h 45m"', () => {
    expect(formatTotalTime(6.75)).toBe('6h 45m');
  });

  test('8 horas exactas = "8h 0m"', () => {
    expect(formatTotalTime(8)).toBe('8h 0m');
  });
});

describe('formatCountdown', () => {
  test('65 segundos = "01:05"', () => {
    expect(formatCountdown(65)).toBe('01:05');
  });
});
