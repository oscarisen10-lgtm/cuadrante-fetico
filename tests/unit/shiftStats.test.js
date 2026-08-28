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

  test('Coordinador de frescos: Sáb+Dom+Lun+Mar de descanso cuenta como finde de calidad LARGO', () => {
    const COORD = { company: 'Supercor', rank: 'Coordinadores de frescos' };
    const shifts = [
      { date: '2026-01-17', type: 'rest' }, // Sábado
      { date: '2026-01-18', type: 'rest' }, // Domingo
      { date: '2026-01-19', type: 'rest' }, // Lunes
      { date: '2026-01-20', type: 'rest' }, // Martes
    ];
    const stats = computeShiftStats(shifts, toMap(shifts), COORD, NOW);
    expect(stats.findesCalidad).toBe(1);
    expect(stats.findesCalidadLargo).toBe(1);
    expect(stats.findesCalidadCorto).toBe(0);
  });

  test('Coordinador de frescos: Sáb+Dom+Lun sin el martes libre NO es largo (cuenta como corto)', () => {
    const COORD = { company: 'Supercor', rank: 'Coordinadores de frescos' };
    const shifts = [
      { date: '2026-01-17', type: 'rest' },            // Sábado
      { date: '2026-01-18', type: 'rest' },            // Domingo
      { date: '2026-01-19', type: 'rest' },            // Lunes
      { date: '2026-01-20', type: 'work', hours: 8 },  // Martes trabajado → no llega a largo
    ];
    const stats = computeShiftStats(shifts, toMap(shifts), COORD, NOW);
    expect(stats.findesCalidad).toBe(1);
    expect(stats.findesCalidadLargo).toBe(0);
    expect(stats.findesCalidadCorto).toBe(1);
  });

  test('Jefes: mismo criterio que coordinadores, el largo exige el martes libre', () => {
    const JEFE = { company: 'Supercor', rank: 'Jefes' };
    const conMartes = [
      { date: '2026-01-17', type: 'rest' }, { date: '2026-01-18', type: 'rest' },
      { date: '2026-01-19', type: 'rest' }, { date: '2026-01-20', type: 'rest' }, // + martes
    ];
    const largo = computeShiftStats(conMartes, toMap(conMartes), JEFE, NOW);
    expect(largo.findesCalidadLargo).toBe(1);
    expect(largo.findesCalidadCorto).toBe(0);

    const sinMartes = [
      { date: '2026-01-17', type: 'rest' }, { date: '2026-01-18', type: 'rest' },
      { date: '2026-01-19', type: 'rest' }, { date: '2026-01-20', type: 'work', hours: 8 },
    ];
    const corto = computeShiftStats(sinMartes, toMap(sinMartes), JEFE, NOW);
    expect(corto.findesCalidadLargo).toBe(0);
    expect(corto.findesCalidadCorto).toBe(1);
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

// BAJA LABORAL. Un día 'sick' guarda la jornada que el cuadrante tenía PROGRAMADA,
// no la que se trabajó: en ANGED esas horas cuentan igual para el cómputo anual
// aunque no se llegaran a trabajar. Estos tests fijan exactamente qué suma y qué no,
// porque es la parte del cálculo donde un error corrompe el control anual de alguien.
describe('computeShiftStats — baja laboral', () => {
  test('una baja con horas suma horas y día trabajado, como si se hubiera trabajado', () => {
    const shifts = [{ date: '2026-01-05', type: 'sick', hours: 8, turn: 'morning' }];
    const stats = computeShiftStats(shifts, toMap(shifts), USER, NOW);
    expect(stats.horasTotales).toBe(8);
    expect(stats.diasTrabajados).toBe(1);
    expect(stats.diasLibres).toBe(0);
  });

  test('una baja marcada como HA cuenta en el contador de HA', () => {
    const shifts = [{ date: '2026-01-05', type: 'sick', hours: 9, turn: 'afternoon', isHA: true }];
    const stats = computeShiftStats(shifts, toMap(shifts), USER, NOW);
    expect(stats.contadorHA).toBe(1);
  });

  // 6 de enero: Epifanía. Si el cuadrante te programaba ese festivo, cuenta.
  test('una baja en domingo o festivo cuenta como domingo/festivo trabajado', () => {
    const shifts = [{ date: '2026-01-06', type: 'sick', hours: 8, turn: 'morning' }];
    const stats = computeShiftStats(shifts, toMap(shifts), USER, NOW);
    expect(stats.domingosCount).toBe(1);
  });

  test('una baja en un día que el cuadrante daba libre suma día libre, no horas', () => {
    const shifts = [{ date: '2026-01-05', type: 'sick', hours: 0, turn: 'rest' }];
    const stats = computeShiftStats(shifts, toMap(shifts), USER, NOW);
    expect(stats.diasLibres).toBe(1);
    expect(stats.diasTrabajados).toBe(0);
    expect(stats.horasTotales).toBe(0);
  });

  // El tipo 'sick' ya existía en el modelo pero ninguna pantalla lo creaba. Los restos
  // que pudiera haber no llevan horas ni turno: contarlos como día trabajado
  // inventaría jornadas que nadie registró.
  test('una baja ANTIGUA (sin horas ni turno) no suma nada', () => {
    const shifts = [{ date: '2026-01-05', type: 'sick' }];
    const stats = computeShiftStats(shifts, toMap(shifts), USER, NOW);
    expect(stats.diasTrabajados).toBe(0);
    expect(stats.diasLibres).toBe(0);
    expect(stats.horasTotales).toBe(0);
  });

  test('las bajas se suman a las jornadas normales, no las sustituyen', () => {
    const shifts = [
      { date: '2026-01-02', type: 'work', hours: 8 },
      { date: '2026-01-05', type: 'sick', hours: 7, turn: 'morning' },
    ];
    const stats = computeShiftStats(shifts, toMap(shifts), USER, NOW);
    expect(stats.horasTotales).toBe(15);
    expect(stats.diasTrabajados).toBe(2);
  });
});

// Empresas de fuera de ANGED: no conocemos su convenio, así que NO se les puede
// colar el de Supercor. O tienen los objetivos que ellos mismos han escrito, o
// no tienen ninguno (el Resumen se pinta entonces como contadores, sin barras).
describe('computeShiftStats — empresa no verificada', () => {
  const OTRA = { company: 'Mercadona', companyVerified: false, rank: 'Reponedor' };

  test('sin objetivos propios, targets es null (nunca los de Supercor)', () => {
    const stats = computeShiftStats([], {}, OTRA, NOW);
    expect(stats.targets).toBeNull();
  });

  test('con objetivos a mano, se usan esos y calidad/HA quedan a 0', () => {
    const stats = computeShiftStats([], {}, { ...OTRA, customTargets: { horas: 1800, trabajados: 240 } }, NOW);
    expect(stats.targets).toEqual({ horas: 1800, trabajados: 240, libres: 0, domingos: 0, calidad: 0, ha: 0, custom: true });
  });

  test('companyVerified manda sobre el nombre: escribir "Supercor" no da su convenio', () => {
    const stats = computeShiftStats([], {}, { company: 'Supercor', companyVerified: false, rank: 'Jefes' }, NOW);
    expect(stats.targets).toBeNull();
  });

  test('los objetivos escritos a mano se sanean (basura, negativos y topes)', () => {
    const stats = computeShiftStats(
      [], {}, { ...OTRA, customTargets: { horas: 99999, trabajados: -5, libres: 'abc', domingos: 12.6 } }, NOW
    );
    expect(stats.targets).toEqual({ horas: 4000, trabajados: 0, libres: 0, domingos: 13, calidad: 0, ha: 0, custom: true });
  });

  test('las horas y los días se siguen contando igual que en ANGED', () => {
    const shifts = [
      { date: '2026-01-02', type: 'work', hours: 8 },
      { date: '2026-01-05', type: 'work', hours: 7 },
      { date: '2026-01-03', type: 'rest' }
    ];
    const stats = computeShiftStats(shifts, toMap(shifts), OTRA, NOW);
    expect(stats.horasTotales).toBe(15);
    expect(stats.diasTrabajados).toBe(2);
    expect(stats.diasLibres).toBe(1);
  });
});

// PRORRATEO POR FECHA DE ALTA. Los objetivos de COMPANY_RULES son de año natural
// completo; quien entra a mitad de año tiene su parte proporcional (el convenio de
// ANGED fija el tope de domingos/festivos en proporción al tiempo de contrato, y el
// resto de figuras anuales se reparte con el mismo criterio). Es dinero y descansos:
// si el recorte se calcula mal, alguien acepta trabajar domingos que no le tocan.
describe('computeShiftStats — prorrateo por fecha de alta', () => {
  // 2026 tiene 365 días. Del 6 de julio al 31 de diciembre van 179.
  const ALTA_6_JULIO = { ...USER, fechaAlta: '2026-07-06' };
  const FIN_2026 = new Date(2026, 11, 31);

  test('el caso del convenio: alta el 6 de julio de 2026 → 11 domingos/festivos, no 22', () => {
    const stats = computeShiftStats([], {}, ALTA_6_JULIO, FIN_2026);
    // 179/365 × 22 = 10,78 → 11
    expect(stats.targets.domingos).toBe(11);
    expect(stats.prorrateo.dias).toBe(179);
    expect(stats.prorrateo.diasAnio).toBe(365);
  });

  test('se prorratean TODAS las figuras anuales, no solo los domingos', () => {
    const stats = computeShiftStats([], {}, ALTA_6_JULIO, FIN_2026);
    const p = 179 / 365;
    expect(stats.targets).toEqual({
      horas: Math.round(1770 * p),        // 868
      trabajados: Math.round(258 * p),    // 127
      libres: Math.round(76 * p),         // 37
      domingos: 11,
      calidad: Math.round(10 * p),        // 5
      ha: Math.round(15 * p),             // 7
    });
  });

  test('los objetivos SIN recortar siguen disponibles (el Resumen los enseña para explicarlo)', () => {
    const stats = computeShiftStats([], {}, ALTA_6_JULIO, FIN_2026);
    expect(stats.targetsAnuales).toEqual({ horas: 1770, domingos: 22, calidad: 10, trabajados: 258, libres: 76, ha: 15 });
  });

  test('quien ya estaba de alta el 1 de enero conserva los objetivos enteros', () => {
    const veterano = { ...USER, fechaAlta: '2019-03-11' };
    const stats = computeShiftStats([], {}, veterano, FIN_2026);
    expect(stats.prorrateo).toBeNull();
    expect(stats.targets.domingos).toBe(22);
  });

  test('un alta el 1 de enero del propio año tampoco recorta nada', () => {
    const stats = computeShiftStats([], {}, { ...USER, fechaAlta: '2026-01-01' }, FIN_2026);
    expect(stats.prorrateo).toBeNull();
    expect(stats.targets.domingos).toBe(22);
  });

  test('sin fecha de alta (o con una ilegible) no se toca nada: objetivos completos', () => {
    expect(computeShiftStats([], {}, USER, FIN_2026).prorrateo).toBeNull();
    expect(computeShiftStats([], {}, { ...USER, fechaAlta: '' }, FIN_2026).prorrateo).toBeNull();
    const basura = computeShiftStats([], {}, { ...USER, fechaAlta: 'ayer' }, FIN_2026);
    expect(basura.prorrateo).toBeNull();
    expect(basura.targets.domingos).toBe(22);
  });

  // El PDF exporta años pasados: si el alta es de 2026, en el cuadrante de 2025 esa
  // persona no estaba en la empresa y no se le pueden enseñar objetivos de nadie.
  test('en un año anterior al alta, todos los objetivos quedan a 0', () => {
    const stats = computeShiftStats([], {}, ALTA_6_JULIO, new Date(2025, 11, 31));
    expect(stats.prorrateo.proporcion).toBe(0);
    expect(stats.targets).toEqual({ horas: 0, domingos: 0, calidad: 0, trabajados: 0, libres: 0, ha: 0 });
  });

  test('un año bisiesto cuenta 366 días', () => {
    const stats = computeShiftStats([], {}, { ...USER, fechaAlta: '2028-07-01' }, new Date(2028, 11, 31));
    expect(stats.prorrateo.diasAnio).toBe(366);
    expect(stats.prorrateo.dias).toBe(184);   // del 1 de julio al 31 de diciembre
  });

  test('el recorte NO toca los objetivos del convenio: el siguiente usuario los ve enteros', () => {
    computeShiftStats([], {}, ALTA_6_JULIO, FIN_2026);
    const otro = computeShiftStats([], {}, USER, FIN_2026);
    expect(otro.targets.domingos).toBe(22);
  });

  test('los objetivos escritos a mano se prorratean igual, y `custom` no se toca', () => {
    const OTRA = {
      company: 'Mercadona', companyVerified: false, rank: 'Reponedor',
      customTargets: { horas: 1800, domingos: 20 }, fechaAlta: '2026-07-06',
    };
    const stats = computeShiftStats([], {}, OTRA, FIN_2026);
    const p = 179 / 365;
    expect(stats.targets.horas).toBe(Math.round(1800 * p));
    expect(stats.targets.domingos).toBe(Math.round(20 * p));
    expect(stats.targets.custom).toBe(true);
  });

  test('sin objetivos que recortar (empresa no verificada sin nada a mano), targets sigue siendo null', () => {
    const OTRA = { company: 'Mercadona', companyVerified: false, fechaAlta: '2026-07-06' };
    const stats = computeShiftStats([], {}, OTRA, FIN_2026);
    expect(stats.targets).toBeNull();
  });
});
