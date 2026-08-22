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

// Quien trabaja fuera de ANGED solo tiene festivos NACIONALES: no sabemos ni en
// qué comunidad ni en qué municipio está, así que darle el 2 de mayo o San Isidro
// sería regalarle días que no le corresponden.
describe('festivos según la empresa', () => {
  // MIRASIERRA está en Madrid capital → hereda los municipales de Madrid.
  const ANGED = { company: 'Supercor', rank: 'Personal de fresco', store: 'MIRASIERRA' };
  const OTRA = { company: 'Mercadona', companyVerified: false, store: '' };

  test('el de ANGED tiene el 2 de mayo (Comunidad de Madrid)', () => {
    expect(getHolidayName('2026-05-02', ANGED)).toBe('Fiesta de la Comunidad de Madrid');
  });

  test('el de fuera NO tiene el 2 de mayo', () => {
    expect(getHolidayName('2026-05-02', OTRA)).toBeNull();
  });

  test('el de ANGED tiene San Isidro por su tienda de Madrid', () => {
    expect(getHolidayName('2026-05-15', ANGED)).toBe('San Isidro');
  });

  test('el de fuera no tiene festivos municipales', () => {
    expect(getHolidayName('2026-05-15', OTRA)).toBeNull();
    expect(getHolidayName('2026-11-09', OTRA)).toBeNull();
  });

  test('los nacionales sí los tienen los dos', () => {
    ['2026-01-01', '2026-05-01', '2026-10-12', '2026-12-25'].forEach((d) => {
      expect(isHoliday(d, ANGED)).toBe(true);
      expect(isHoliday(d, OTRA)).toBe(true);
    });
  });

  test('escribir a mano el nombre de una tienda real no cuela sus festivos locales', () => {
    const listillo = { company: 'Mercadona', companyVerified: false, store: 'MIRASIERRA' };
    expect(getHolidayName('2026-05-15', listillo)).toBeNull();
  });
});
