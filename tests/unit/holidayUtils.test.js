// Test UNITARIO de los festivos (getHolidayName / isHoliday). Comprueba los festivos
// comunes de Madrid definidos en config, ambos formatos de fecha (YYYY-MM-DD y MM-DD)
// y que un día normal no es festivo. No necesita red ni Firebase. npm test
import { describe, test, expect } from 'vitest';
import { getHolidayName, isHoliday } from '../../src/utils/holidayUtils.js';

describe('getHolidayName / isHoliday', () => {
  test('reconoce un festivo común (Epifanía, 6 de enero)', () => {
    expect(getHolidayName('2026-01-06')).toBe('Epifanía del Señor');
    expect(isHoliday('2026-01-06')).toBe(true);
  });

  test('acepta el formato corto MM-DD (Navidad)', () => {
    expect(getHolidayName('12-25')).toBe('Natividad del Señor');
    expect(isHoliday('12-25')).toBe(true);
  });

  test('un día laborable normal NO es festivo', () => {
    expect(getHolidayName('2026-03-16')).toBeNull();
    expect(isHoliday('2026-03-16')).toBe(false);
  });

  test('el 1 de enero (Año Nuevo) es festivo', () => {
    expect(isHoliday('2026-01-01')).toBe(true);
  });
});
