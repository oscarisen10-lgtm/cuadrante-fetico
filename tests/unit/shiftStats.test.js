// Test UNITARIO del cálculo de estadísticas del convenio (computeShiftStats).
// Es la lógica de negocio más valiosa (horas, HA, domingos/festivos, findes de calidad),
// así que la fijamos con casos deterministas. `now` se inyecta para no depender de la
// fecha real. No necesita red ni Firebase. Se ejecuta con: npm test
import { describe, test, expect } from 'vitest';
import { computeShiftStats } from '../../src/hooks/useShifts.js';

// Construye el índice date -> turno igual que el hook.
const toMap = (shifts) => {
  const m = {};
  shifts.forEach((s) => { m[s.date] = s; });
  return m;
};

// Enero 2026: Jue 1, Vie 2, Sáb 3, Dom 4, Lun 5, ... Sáb 10, 17, 24, 31.
const NOW = new Date(2026, 0, 31);
const USER = { company: 'Supercor', rank: 'Personal de fresco' };

describe('computeShiftStats', () => {
  test('cuenta horas, HA, vacaciones, libres, domingos/festivos y un finde de calidad corto', () => {
    const shifts = [
      { date: '2026-01-02', type: 'work', hours: 8 },              // Viernes normal
      { date: '2026-01-06', type: 'work', hours: 8, isHA: true },  // Epifanía (festivo) + HA
      { date: '2026-01-03', type: 'rest' },                        // Sábado
      { date: '2026-01-04', type: 'rest' },                        // Domingo → finde de calidad corto
      { date: '2026-01-10', type: 'work', hours: 5 },              // Sábado trabajado
      { date: '2026-01-15', type: 'vacation' },
    ];
    const stats = computeShiftStats(shifts, toMap(shifts), USER, NOW);

    expect(stats.diasTrabajados).toBe(3);
    expect(stats.horasTotales).toBe(21);
    expect(stats.contadorHA).toBe(1);
    expect(stats.vacacionesCount).toBe(1);
    expect(stats.diasLibres).toBe(2);
    // Solo el festivo (Epifanía) cuenta como "domingo/festivo trabajado"; el sábado no.
    expect(stats.domingosCount).toBe(1);
    expect(stats.findesCalidad).toBe(1);
    expect(stats.findesCalidadCorto).toBe(1);
    expect(stats.findesCalidadLargo).toBe(0);
  });

  test('un finde Sáb+Dom+Lun de descanso cuenta como finde de calidad LARGO', () => {
    const shifts = [
      { date: '2026-01-17', type: 'rest' }, // Sábado
      { date: '2026-01-18', type: 'rest' }, // Domingo
      { date: '2026-01-19', type: 'rest' }, // Lunes
    ];
    const stats = computeShiftStats(shifts, toMap(shifts), USER, NOW);
    expect(stats.findesCalidad).toBe(1);
    expect(stats.findesCalidadLargo).toBe(1);
    expect(stats.findesCalidadCorto).toBe(0);
    expect(stats.diasLibres).toBe(3);
  });

  test('sin turnos, todo a cero y targets por defecto (Supercor / Personal de fresco)', () => {
    const stats = computeShiftStats([], {}, USER, NOW);
    expect(stats.horasTotales).toBe(0);
    expect(stats.diasTrabajados).toBe(0);
    expect(stats.findesCalidad).toBe(0);
    expect(stats.targets).toEqual({ horas: 1770, domingos: 22, calidad: 10, trabajados: 258, libres: 76, ha: 15 });
  });

  test('los targets dependen de empresa+rango (S. Express / Jefe de tienda)', () => {
    const stats = computeShiftStats([], {}, { company: 'S. Express', rank: 'Jefe de tienda' }, NOW);
    expect(stats.targets.domingos).toBe(33);
    expect(stats.targets.calidad).toBe(12);
    expect(stats.targets.libres).toBe(112);
  });

  test('un rango desconocido cae al target por defecto (no rompe)', () => {
    const stats = computeShiftStats([], {}, { company: 'Supercor', rank: 'Inventado' }, NOW);
    expect(stats.targets).toEqual({ horas: 1770, domingos: 22, calidad: 10, trabajados: 258, libres: 76, ha: 15 });
  });
});
