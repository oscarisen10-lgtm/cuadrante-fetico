import { describe, it, expect } from 'vitest';
import {
  GRUPOS_PROFESIONALES, antiguedadAnual, mensualDesdeAnual, precioDia, precioHora,
  plusNocturnidadHora, TIPO_BAJA, tiposCotizacion, IRPF_MAXIMO, CATEGORIA_DEDUCCION,
} from '../../src/constants/nomina';
import {
  calcularNomina, calcularNominaDelMes, calcularDeducciones,
  netoPagaExtra, configDelMes, guardarMes,
} from '../../src/constants/nominaCalculo';
import { porcentajeDiaIT, calcularIT, desgloseMesConBajas } from '../../src/constants/nominaBajas';

// Los valores esperados salen del convenio (los aportó el usuario) y, donde se
// pudo, de una NÓMINA REAL. Sirven de red: si una subida salarial cambia una
// tabla y alguien se deja un número, estos tests lo cazan antes que el usuario.
describe('nómina — salario base por grupo', () => {
  const esperado = {
    base:          { mes: 1080.26, hora: 9.76504 },
    profesionales: { mes: 1112.67, hora: 10.05800 },
    coordinadores: { mes: 1212.80, hora: 10.96320 },
    tecnicos:      { mes: 1321.96, hora: 11.94990 },
  };

  GRUPOS_PROFESIONALES.forEach((g) => {
    it(`${g.label}: mensual y precio/hora`, () => {
      expect(mensualDesdeAnual(g.anual)).toBe(esperado[g.id].mes);
      // Tolerancia de 4 decimales, no de 5, por "Profesionales": 17.802,65/1770 da
      // 10,05799435, que a 5 decimales es 10,05799 y en la tabla del convenio figura
      // como 10,05800. Es una diferencia de una cienmilésima de euro por hora (0,02 €
      // en un año entero de trabajo): la tabla viene redondeada a 4 decimales y
      // rellenada a 5. El anual manda, que es lo que fija el convenio.
      expect(precioHora(g.anual)).toBeCloseTo(esperado[g.id].hora, 4);
    });
  });
});

describe('nómina — antigüedad por cuatrienios', () => {
  it('se ACUMULA: el 2.º cuatrienio incluye el 1.º', () => {
    expect(antiguedadAnual(1)).toBeCloseTo(255.79, 2);
    expect(antiguedadAnual(2)).toBeCloseTo(255.79 + 225.98, 2);
    expect(antiguedadAnual(3)).toBeCloseTo(255.79 + 225.98 + 201.94, 2);
  });

  it('del 4.º en adelante suma 192,32 € por cada cuatrienio', () => {
    expect(antiguedadAnual(4) - antiguedadAnual(3)).toBeCloseTo(192.32, 2);
    expect(antiguedadAnual(6) - antiguedadAnual(5)).toBeCloseTo(192.32, 2);
  });

  it('sin antigüedad no suma nada', () => {
    expect(antiguedadAnual(0)).toBe(0);
    expect(antiguedadAnual(undefined)).toBe(0);
  });

  // Contraste contra el papel: el 2.º cuatrienio figura como 30,11 €/mes y
  // 1,0036 €/día en una nómina real de agosto de 2026.
  it('cuadra con la nómina real del 2.º cuatrienio', () => {
    const mes = mensualDesdeAnual(antiguedadAnual(2));
    expect(mes).toBe(30.11);
    expect(precioDia(mes)).toBe(1.0036);
  });
});

// Contraste completo contra la NÓMINA REAL de agosto 2026 que sirvió de referencia
// (grupo coordinador, 2.º cuatrienio). Si una subida salarial o un cambio de regla
// descuadra el modelo, salta aquí antes de que lo vea nadie en su nómina.
describe('nómina — cálculo completo contra una nómina real', () => {
  const real = calcularNomina({
    grupo: 'coordinadores',
    cuatrienios: 2,
    complementoPuesto: 166.67,
    compensacionFijaSr: 49.09,
    primaSegVida: 3.72,
  });

  const linea = (c) => real.devengos.find((d) => d.concepto === c);

  it('las pagas prorrateadas son (base + antigüedad) / 12', () => {
    expect(linea('Paga De Beneficios').importe).toBe(103.58);
    expect(linea('Paga De Fomento').importe).toBe(103.58);
  });

  it('verano y navidad son una paga entera cada una', () => {
    // 1.212,80 + 30,11 = 1.242,91  (el papel pone 1.242,92 por su céntimo de base)
    expect(real.pagaVerano).toBeCloseTo(1242.91, 2);
    expect(real.pagaNavidad).toBe(real.pagaVerano);
    // Y una paga entera equivale a 12 mensualidades de la prorrateada.
    expect(real.pagaVerano).toBeCloseTo(linea('Paga De Beneficios').importe * 12, 0);
  });

  it('la prorrata de pagas extra es (verano + navidad) / 12', () => {
    expect(real.prorrataPagas).toBeCloseTo(207.15, 1);
  });

  it('la base de cotización es devengos + prorrata', () => {
    expect(real.baseCotizacion).toBeCloseTo(real.totalDevengos + real.prorrataPagas, 2);
    expect(real.baseCotizacion).toBeCloseTo(1876.71, 0);
  });

  it('el total de devengos cuadra con el papel', () => {
    expect(real.totalDevengos).toBeCloseTo(1669.56, 1);
  });

  it('Complemento Puesto y Compensación Fija SR NO entran en las pagas', () => {
    // Se pagan en 12 mensualidades, así que no generan paga extra: quitarlos no
    // debe mover ni la paga prorrateada ni la de verano.
    const sinEllos = calcularNomina({ grupo: 'coordinadores', cuatrienios: 2 });
    expect(sinEllos.devengos.find((d) => d.concepto === 'Paga De Beneficios').importe)
      .toBe(linea('Paga De Beneficios').importe);
    expect(sinEllos.pagaVerano).toBe(real.pagaVerano);
  });

  it('otros complementos SÍ entran en las pagas', () => {
    const conOtros = calcularNomina({ grupo: 'coordinadores', cuatrienios: 2, otrosComplementos: 120 });
    expect(conOtros.devengos.find((d) => d.concepto === 'Paga De Beneficios').importe)
      .toBeCloseTo(linea('Paga De Beneficios').importe + 10, 2); // 120/12
  });

  it('sin grupo configurado no calcula nada', () => {
    expect(calcularNomina({})).toBeNull();
  });
});

describe('nómina — el precio/día sale del importe SIN redondear', () => {
  // La nómina real pone la Paga de Beneficios a 3,4525 €/día. Ese número es
  // 103,576666…/30 truncado; si se partiera de los 103,58 ya redondeados saldría
  // 3,4526. Es un dígito, pero es el que decide si el papel y la app coinciden.
  const n = calcularNomina({ grupo: 'coordinadores', cuatrienios: 2 });
  it('Paga De Beneficios: 3,4525 €/día como en el papel', () => {
    expect(n.devengos.find((d) => d.concepto === 'Paga De Beneficios').detalle.precio).toBe(3.4525);
  });
  it('Antigüedad: 1,0036 €/día como en el papel', () => {
    expect(n.devengos.find((d) => d.concepto === 'Antigüedad').detalle.precio).toBe(1.0036);
  });
});

// Contraste contra DOS nóminas reales más (mayo y enero de 2026, grupos distintos).
// Se comprueba el precio/día porque es donde el papel usa dos reglas diferentes.
describe('nómina — contraste con otras dos nóminas reales', () => {
  it('PROFESIONALES, 1.er cuatrienio, con complemento que prorratea', () => {
    const n = calcularNomina({
      grupo: 'profesionales', cuatrienios: 1,
      complementos: [{ nombre: 'C.Adecuac.Anged', importe: 76.43 }],
    });
    const l = (c) => n.devengos.find((d) => d.concepto === c);
    expect(l('Sueldo Base Grupo').importe).toBe(1112.67);
    expect(l('Sueldo Base Grupo').detalle.precio).toBe(37.0890);
    expect(l('Antigüedad').importe).toBe(15.99);
    expect(l('Antigüedad').detalle.precio).toBe(0.5330);
    // El complemento entra en la base de las pagas: (1112,67+15,99+76,43)/12
    expect(l('Paga De Beneficios').importe).toBe(100.42);
    expect(l('Paga De Beneficios').detalle.precio).toBe(3.3474);
    expect(n.prorrataPagas).toBe(200.85);
  });

  it('PERSONAL BASE, sin antigüedad ni complementos', () => {
    const n = calcularNomina({ grupo: 'base', cuatrienios: 0 });
    const l = (c) => n.devengos.find((d) => d.concepto === c);
    expect(l('Sueldo Base Grupo').importe).toBe(1080.26);
    expect(l('Sueldo Base Grupo').detalle.precio).toBe(36.0086);
    expect(l('Paga De Beneficios').importe).toBe(90.02);
    expect(l('Paga De Beneficios').detalle.precio).toBe(3.0007);
    expect(n.prorrataPagas).toBe(180.04);
    expect(n.devengos.find((d) => d.concepto === 'Antigüedad')).toBeUndefined();
  });

  it('admite varios complementos con nombre', () => {
    const n = calcularNomina({
      grupo: 'base',
      complementos: [{ nombre: 'Nocturnidad', importe: 50 }, { nombre: 'Idiomas', importe: 30 }],
    });
    expect(n.devengos.find((d) => d.concepto === 'Nocturnidad').importe).toBe(50);
    expect(n.devengos.find((d) => d.concepto === 'Idiomas').importe).toBe(30);
    // Los 80 € extra suben la paga en 80/12 = 6,67
    expect(n.devengos.find((d) => d.concepto === 'Paga De Beneficios').importe)
      .toBe(Math.round(((1080.26 + 80) / 12) * 100) / 100);
  });
});

describe('nómina — plus de nocturnidad', () => {
  it('es el 20% de la hora ordinaria, en los cuatro grupos', () => {
    // Tabla del convenio, y coincide con lo que pagan las nóminas reales.
    const esperado = { base: 1.9530, profesionales: 2.0116, coordinadores: 2.1926, tecnicos: 2.3900 };
    GRUPOS_PROFESIONALES.forEach((g) => {
      expect(plusNocturnidadHora(g.anual)).toBeCloseTo(esperado[g.id], 4);
    });
  });

  it('el importe es horas x precio', () => {
    const n = calcularNomina({ grupo: 'base', horasNocturnas: 10 });
    const l = n.devengos.find((d) => d.concepto === 'Nocturnidad Variable');
    expect(l.importe).toBe(19.53);        // 10 h x 1,9530
    expect(l.detalle.precio).toBe(1.9530);
    expect(l.detalle.unidades).toBe('10 h');
  });

  it('NO entra en la base de las pagas', () => {
    // Comprobado con la nómina de mayo: si entrase, la Paga de Beneficios daría
    // 100,50 en vez de los 100,42 que figuran en el papel.
    const sin = calcularNomina({ grupo: 'profesionales', cuatrienios: 1, complementos: [{ nombre: 'C.Adecuac.Anged', importe: 76.43 }] });
    const con = calcularNomina({ grupo: 'profesionales', cuatrienios: 1, complementos: [{ nombre: 'C.Adecuac.Anged', importe: 76.43 }], horasNocturnas: 20 });
    const paga = (x) => x.devengos.find((d) => d.concepto === 'Paga De Beneficios').importe;
    expect(paga(con)).toBe(paga(sin));
    expect(paga(con)).toBe(100.42);
    expect(con.pagaVerano).toBe(sin.pagaVerano);
    // Pero sí suma a los devengos y por tanto a la base de cotización.
    expect(con.totalDevengos).toBeCloseTo(sin.totalDevengos + 40.23, 2); // 20 h x 2,0116
  });

  it('sin horas nocturnas no aparece la línea', () => {
    const n = calcularNomina({ grupo: 'base' });
    expect(n.devengos.find((d) => d.concepto === 'Nocturnidad Variable')).toBeUndefined();
  });
});

describe('nómina — bajas (incapacidad temporal)', () => {
  const BR = 53.74; // base reguladora diaria del perfil de mayo (1.612,20 / 30)

  it('accidente de trabajo: 100% desde el día 1, aunque sea la cuarta baja', () => {
    [1, 4, 21, 100].forEach((dia) => {
      expect(porcentajeDiaIT({ tipo: TIPO_BAJA.PROFESIONAL, proceso: 4, dia })).toBe(100);
    });
  });

  it('hospitalización o cirugía: 100% desde el día 1 sea la baja que sea', () => {
    expect(porcentajeDiaIT({ tipo: TIPO_BAJA.COMUN, proceso: 4, dia: 1, hospitalizacion: true })).toBe(100);
  });

  it('los tres primeros días nunca se cobran de entrada', () => {
    [1, 2, 3].forEach((dia) => {
      [1, 2, 3, 4].forEach((proceso) => {
        expect(porcentajeDiaIT({ tipo: TIPO_BAJA.COMUN, proceso, dia })).toBe(0);
      });
    });
  });

  it('la tabla del convenio por proceso y tramo', () => {
    const pct = (proceso, dia) => porcentajeDiaIT({ tipo: TIPO_BAJA.COMUN, proceso, dia });
    expect([pct(1, 10), pct(1, 25)]).toEqual([100, 100]);  // 1.ª baja
    expect([pct(2, 10), pct(2, 25)]).toEqual([100, 100]);  // 2.ª baja
    expect([pct(3, 10), pct(3, 25)]).toEqual([60, 85]);    // 3.ª baja
    expect([pct(4, 10), pct(4, 25)]).toEqual([60, 75]);    // 4.ª y sucesivas
  });

  // Dos bases DISTINTAS, y confundirlas cambia el resultado en decenas de euros:
  //   · SD (salario diario) — lo que de verdad desaparece de la nómina en los
  //     días 1-3, y por tanto lo que se reintegra en enero. NO lleva la prorrata
  //     de las pagas extra: el Complemento 50/53 reintegra retribución ordinaria,
  //     esas pagas se cobran en su propia fecha.
  //   · BR (base reguladora) — de la base de cotización, para la prestación de
  //     los días 4 en adelante. Es más alta porque sí lleva esa prorrata.
  // Con el perfil de la nómina de mayo: SD = 46,8644 €, BR = 53,74 €.
  const SD = 46.8644;
  const bases = { salarioDiario: SD, baseDiaria: BR };

  it('UNA sola baja común: los 3 días quedan retenidos pero recuperables', () => {
    const r = calcularIT([{ inicio: '2026-03-05', dias: 7, tipo: TIPO_BAJA.COMUN }], bases);
    // Confirmado con el usuario contra una nómina real: son 140,59 €, el salario
    // ORDINARIO de 3 días — no 161,22 €, que sería con la base reguladora.
    expect(r.retenido).toBeCloseTo(140.59, 1);
    expect(r.recuperable).toBe(true);
    expect(r.perdido).toBe(0);                   // del día 4 al 7 cobra el 100%
  });

  it('una SEGUNDA baja hace perder también los 3 días de la primera', () => {
    const r = calcularIT([
      { inicio: '2026-03-05', dias: 7, tipo: TIPO_BAJA.COMUN },
      { inicio: '2026-07-10', dias: 5, tipo: TIPO_BAJA.COMUN },
    ], bases);
    expect(r.recuperable).toBe(false);
    expect(r.retenido).toBe(0);
    // 3 días de la 1.ª + 3 días de la 2.ª, todos perdidos, al salario ordinario.
    expect(r.perdido).toBeCloseTo(6 * SD, 1);
  });

  it('tercera baja larga: 60% del 4 al 20 y 85% del 21 en adelante', () => {
    const r = calcularIT([
      { inicio: '2026-01-10', dias: 3, tipo: TIPO_BAJA.COMUN },
      { inicio: '2026-04-10', dias: 3, tipo: TIPO_BAJA.COMUN },
      { inicio: '2026-09-01', dias: 25, tipo: TIPO_BAJA.COMUN },
    ], bases);
    // 3.ª baja: días 1-3 al 0%, días 4-20 (17 días) al 60%, días 21-25 (5) al 85%.
    // Los "días 1-3 perdidos" van al salario ordinario; el tramo con prestación,
    // a la base reguladora.
    const esperado = (3 + 3) * SD                 // los 3 primeros de la 1.ª y la 2.ª
      + 3 * SD                                     // los 3 primeros de la 3.ª
      + 17 * BR * 0.40                             // tramo al 60%
      + 5 * BR * 0.15;                             // tramo al 85%
    expect(r.perdido).toBeCloseTo(esperado, 0);
  });

  it('las bajas profesionales no cuentan para numerar los procesos comunes', () => {
    const r = calcularIT([
      { inicio: '2026-02-01', dias: 30, tipo: TIPO_BAJA.PROFESIONAL },
      { inicio: '2026-05-01', dias: 7, tipo: TIPO_BAJA.COMUN },
    ], bases);
    expect(r.totalComunes).toBe(1);
    expect(r.recuperable).toBe(true);   // la común sigue siendo la 1.ª del año
    expect(r.perdido).toBe(0);
  });

  it('sin bajas no hay nada retenido ni perdido', () => {
    const r = calcularIT([], bases);
    expect(r).toMatchObject({ retenido: 0, perdido: 0, totalComunes: 0 });
  });
});

describe('nómina — el mes con baja (calcularNominaDelMes)', () => {
  const cfgProfesional = {
    grupo: 'profesionales', cuatrienios: 1,
    complementos: [{ nombre: 'C.Adecuac.Anged', importe: 76.43 }],
  };

  it('sin bajas, es exactamente igual que calcularNomina', () => {
    const conFecha = calcularNominaDelMes(cfgProfesional, 2026, 4); // mayo
    const sinFecha = calcularNomina(cfgProfesional);
    expect(conFecha.totalDevengos).toBe(sinFecha.totalDevengos);
    expect(conFecha.diasBaja).toBe(0);
    expect(conFecha.diasOrdinarios).toBe(30);
  });

  it('reduce los devengos "por día" a los días ordinarios, como en el papel', () => {
    // El caso que el usuario trabajó a mano: 7 días de baja (1.ª del año) sobre
    // el perfil de la nómina de mayo -> 23 días ordinarios.
    const n = calcularNominaDelMes({
      ...cfgProfesional,
      bajas: [{ inicio: '2026-05-05', dias: 7, tipo: TIPO_BAJA.COMUN }],
    }, 2026, 4);
    const l = (c) => n.devengos.find((d) => d.concepto === c);

    expect(n.diasOrdinarios).toBe(23);
    expect(l('Sueldo Base Grupo').importe).toBeCloseTo(853.05, 1);
    expect(l('Antigüedad').importe).toBeCloseTo(12.26, 1);
    expect(l('C.Adecuac.Anged').importe).toBeCloseTo(58.60, 1);
    expect(l('Paga De Beneficios').importe).toBeCloseTo(77.00, 1);
    expect(l('Sueldo Base Grupo').detalle.unidades).toBe('23 Día');
  });

  it('añade la Prestación SS y el Complemento Empresa de los días 4 en adelante', () => {
    // 1.ª baja del año: días 1-3 al 0% (no aparecen), días 4-7 al 100% —de eso,
    // 60% lo paga la SS y 40% lo complementa la empresa.
    const n = calcularNominaDelMes({
      ...cfgProfesional,
      bajas: [{ inicio: '2026-05-05', dias: 7, tipo: TIPO_BAJA.COMUN }],
    }, 2026, 4);
    const prestacion = n.devengos.find((d) => d.concepto === 'Prestación IT (Seguridad Social)');
    const complemento = n.devengos.find((d) => d.concepto === 'Complemento Convenio IT Empresa');
    const baseDiaria = n.baseCotizacion / 30;
    expect(prestacion.importe).toBeCloseTo(4 * baseDiaria * 0.60, 1);
    expect(complemento.importe).toBeCloseTo(4 * baseDiaria * 0.40, 1);
  });

  it('en una 4.ª baja el legal y el final coinciden: no hay complemento', () => {
    const n = calcularNominaDelMes({
      ...cfgProfesional,
      bajas: [
        { inicio: '2026-01-05', dias: 5, tipo: TIPO_BAJA.COMUN },
        { inicio: '2026-02-05', dias: 5, tipo: TIPO_BAJA.COMUN },
        { inicio: '2026-03-05', dias: 5, tipo: TIPO_BAJA.COMUN },
        { inicio: '2026-05-05', dias: 10, tipo: TIPO_BAJA.COMUN }, // 4.ª del año
      ],
    }, 2026, 4);
    expect(n.devengos.find((d) => d.concepto === 'Complemento Convenio IT Empresa')).toBeUndefined();
    expect(n.devengos.find((d) => d.concepto === 'Prestación IT (Seguridad Social)').importe)
      .toBeCloseTo(7 * (n.baseCotizacion / 30) * 0.60, 1); // días 4-10 de la 4.ª baja: 7 días al 60%
  });

  it('mantiene la base de cotización de un mes completo aunque haya baja', () => {
    // Confirmado por una nómina real: la base de cotización NO baja con la
    // baja, se mantiene como si el mes hubiera sido normal.
    const conBaja = calcularNominaDelMes({
      ...cfgProfesional,
      bajas: [{ inicio: '2026-05-05', dias: 7, tipo: TIPO_BAJA.COMUN }],
    }, 2026, 4);
    const sinBaja = calcularNomina(cfgProfesional);
    expect(conBaja.baseCotizacion).toBe(sinBaja.baseCotizacion);
    expect(conBaja.totalDevengosComputables).toBe(sinBaja.totalDevengos);
    // Pero el total de devengos REAL (lo que se cobra) sí es menor.
    expect(conBaja.totalDevengos).toBeLessThan(conBaja.totalDevengosComputables);
  });

  it('enero regulariza el Complemento 50 si el año anterior tuvo UNA sola baja', () => {
    const n = calcularNominaDelMes({
      ...cfgProfesional,
      bajas: [{ inicio: '2025-06-05', dias: 7, tipo: TIPO_BAJA.COMUN }],
    }, 2026, 0); // enero 2026, mirando 2025
    const linea = n.devengos.find((d) => d.concepto === 'Complemento 50 (Regularización IT)');
    expect(linea).toBeDefined();
    expect(n.complemento5053).toBeCloseTo(3 * n.salarioDiario, 1);
  });

  it('NO regulariza en enero si el año anterior tuvo una segunda baja', () => {
    const n = calcularNominaDelMes({
      ...cfgProfesional,
      bajas: [
        { inicio: '2025-03-05', dias: 7, tipo: TIPO_BAJA.COMUN },
        { inicio: '2025-08-10', dias: 5, tipo: TIPO_BAJA.COMUN },
      ],
    }, 2026, 0);
    expect(n.complemento5053).toBe(0);
    expect(n.devengos.find((d) => d.concepto === 'Complemento 50 (Regularización IT)')).toBeUndefined();
  });

  it('accidente de trabajo: el día 1 lo paga la empresa (0% SS) y desde el día 2 el 75% legal', () => {
    const n = calcularNominaDelMes({
      ...cfgProfesional,
      bajas: [{ inicio: '2026-05-05', dias: 10, tipo: TIPO_BAJA.PROFESIONAL }],
    }, 2026, 4);
    const baseDiaria = n.baseCotizacion / 30;
    // 10 días al 100%: el día 1 entero de complemento empresa, los 9 restantes
    // 75% SS + 25% empresa.
    const prestacion = n.devengos.find((d) => d.concepto === 'Prestación IT (Seguridad Social)').importe;
    const complemento = n.devengos.find((d) => d.concepto === 'Complemento Convenio IT Empresa').importe;
    expect(prestacion).toBeCloseTo(9 * baseDiaria * 0.75, 1);
    expect(complemento).toBeCloseTo(baseDiaria + 9 * baseDiaria * 0.25, 1);
  });
});

describe('nómina — Valor Retribución Especie (fuera de nomina.js, en la vista)', () => {
  // Este concepto vive en NominaView, no en nomina.js: comprobado aquí que la
  // regla (mismo importe que Prima Seg. Vida) está documentada y no se ha
  // vuelto a dejar como número suelto por error. Ver DEDUCCIONES_EJEMPLO.
  it('sigue sin existir como concepto fijo en las tablas del convenio', () => {
    const n = calcularNomina({ grupo: 'base', primaSegVida: 6.34 });
    expect(n.devengos.find((d) => d.concepto === 'Valor Retribución Especie')).toBeUndefined();
  });
});

// Las 15 líneas de deducción de las TRES nóminas reales. Este bloque es la red
// de seguridad más importante del archivo: si un tipo de cotización cambia y
// alguien no actualiza la tabla, aquí salta antes de que nadie vea mal su nómina.
describe('nómina — deducciones contra tres nóminas reales', () => {
  const linea = (d, c) => d.lineas.find((l) => l.concepto === c).importe;

  it('MAYO 2026 — profesionales', () => {
    const d = calcularDeducciones({
      baseCotizacion: 1612.20, totalDevengos: 1411.35,
      tipoIrpf: 6.56, cuotaSindical: 5, primaSegVida: 4.56,
    }, 2026);
    expect(linea(d, 'Seg. Social')).toBe(-75.77);
    expect(linea(d, 'Seg. Social Mei')).toBe(-2.42);
    expect(linea(d, 'Desempleo')).toBe(-24.99);
    expect(linea(d, 'Formación')).toBe(-1.61);
    expect(linea(d, 'I.R.P.F.')).toBe(-92.58);
    expect(linea(d, 'Cuota Sindical')).toBe(-5);
    expect(linea(d, 'Valor Retribución Especie')).toBe(-4.56);
    expect(d.total).toBe(-206.93);   // TOTAL DEDUCCIONES del papel
  });

  it('ENERO 2026 — personal base', () => {
    const d = calcularDeducciones({
      baseCotizacion: 1444.12, totalDevengos: 1264.08,
      tipoIrpf: 3.29, cuotaSindical: 5, primaSegVida: 3.64,
    }, 2026);
    expect(linea(d, 'Seg. Social')).toBe(-67.87);
    expect(linea(d, 'Seg. Social Mei')).toBe(-2.17);
    expect(linea(d, 'Desempleo')).toBe(-22.38);
    expect(linea(d, 'Formación')).toBe(-1.44);
    expect(linea(d, 'I.R.P.F.')).toBe(-41.59);
  });

  it('JUNIO 2025 — el MEI era del 0,13%, no del 0,15%', () => {
    const d = calcularDeducciones({
      baseCotizacion: 1611.20, totalDevengos: 1496.39, tipoIrpf: 3.15,
    }, 2025);
    expect(linea(d, 'Seg. Social')).toBe(-75.73);
    expect(linea(d, 'Seg. Social Mei')).toBe(-2.09);   // con el 0,15% daría -2,42
    expect(linea(d, 'Desempleo')).toBe(-24.97);
    expect(linea(d, 'I.R.P.F.')).toBe(-47.14);
  });

  it('un año sin tabla usa los tipos más recientes conocidos', () => {
    expect(tiposCotizacion(2030)).toEqual(tiposCotizacion(2026));
    expect(tiposCotizacion(2025).mei).toBe(0.13);
  });

  it('el IRPF va sobre los DEVENGOS, no sobre la base de cotización', () => {
    // Es la confusión fácil: si fuera sobre la base, con estos números daría
    // -105,76 en vez de -92,58.
    const d = calcularDeducciones({ baseCotizacion: 1612.20, totalDevengos: 1411.35, tipoIrpf: 6.56 }, 2026);
    expect(linea(d, 'I.R.P.F.')).toBe(-92.58);
    expect(linea(d, 'I.R.P.F.')).not.toBe(-cent2(1612.20 * 0.0656));
  });

  it('sin tipo de IRPF configurado, no se inventa una retención', () => {
    const d = calcularDeducciones({ baseCotizacion: 1612.20, totalDevengos: 1411.35 }, 2026);
    expect(d.lineas.find((l) => l.concepto === 'I.R.P.F.')).toBeUndefined();
  });

  it('la cotización total del trabajador es el 6,50% en 2026', () => {
    const d = calcularDeducciones({ baseCotizacion: 1612.20, totalDevengos: 1411.35 }, 2026);
    expect(d.totalCotizacion).toBe(-104.79);
  });
});

/** Redondeo a céntimos, solo para el test de arriba. */
function cent2(n) { return Math.round(n * 100) / 100; }

describe('nómina — bajas que cruzan de un mes a otro', () => {
  const cfg = (bajas) => ({ grupo: 'profesionales', cuatrienios: 1, bajas });

  it('una baja de 40 días desde el 5 de mayo ocupa mayo Y junio', () => {
    // Antes: junio salía como un mes trabajado entero estando el usuario de baja.
    const bajas = [{ inicio: '2026-05-05', dias: 40, tipo: TIPO_BAJA.COMUN }];
    const mayo = calcularNominaDelMes(cfg(bajas), 2026, 4);
    const junio = calcularNominaDelMes(cfg(bajas), 2026, 5);

    // Del 5 al 31 de mayo son 27 días; del 1 al 13 de junio, los 13 restantes.
    expect(mayo.diasBaja).toBe(27);
    expect(mayo.diasOrdinarios).toBe(3);
    expect(junio.diasBaja).toBe(13);
    expect(junio.diasOrdinarios).toBe(17);
  });

  it('el ordinal de los días sigue contando desde el inicio de la baja', () => {
    // Los 3 primeros días no se cobran. Si la baja empieza el 30 de abril, esos
    // tres días caen a caballo: 30 de abril (día 1) y 1-2 de mayo (días 2 y 3).
    // En mayo el primer día de baja es el día 2 DE LA BAJA, no el día 1.
    const bajas = [{ inicio: '2026-04-30', dias: 10, tipo: TIPO_BAJA.COMUN }];
    expect(calcularNominaDelMes(cfg(bajas), 2026, 3).diasBaja).toBe(1);   // solo el 30
    expect(calcularNominaDelMes(cfg(bajas), 2026, 4).diasBaja).toBe(9);   // del 1 al 9 de mayo

    // `pctDiasFinal` es interno del desglose, así que se comprueba ahí: en mayo,
    // 2 de esos 9 días son del tramo 1-3 (al 0%) y 7 del tramo 4+ (al 100%).
    expect(desgloseMesConBajas(bajas, 2026, 4).pctDiasFinal).toBe(7 * 100);
  });

  it('un mes de 31 días entero de baja se topa en 30, no en 31', () => {
    // La nómina prorratea sobre mes de 30 días: no puede descontar 31.
    const bajas = [{ inicio: '2026-01-01', dias: 31, tipo: TIPO_BAJA.COMUN }];
    const enero = calcularNominaDelMes(cfg(bajas), 2026, 0);
    expect(enero.diasBaja).toBe(30);
    expect(enero.diasOrdinarios).toBe(0);
  });

  it('una baja de diciembre que sigue en enero se refleja en enero', () => {
    const bajas = [{ inicio: '2025-12-20', dias: 30, tipo: TIPO_BAJA.COMUN }];
    const enero = calcularNominaDelMes(cfg(bajas), 2026, 0);
    // Del 20 al 31 de diciembre son 12 días; quedan 18 para enero.
    expect(enero.diasBaja).toBe(18);
    expect(enero.diasOrdinarios).toBe(12);
  });

  it('una baja que no toca el mes no lo afecta', () => {
    const bajas = [{ inicio: '2026-02-10', dias: 5, tipo: TIPO_BAJA.COMUN }];
    const mayo = calcularNominaDelMes(cfg(bajas), 2026, 4);
    expect(mayo.diasBaja).toBe(0);
    expect(mayo.diasOrdinarios).toBe(30);
  });
});

describe('nómina — saneado de lo que teclea el usuario', () => {
  const base = { baseCotizacion: 1612.20, totalDevengos: 1411.35 };

  it('recorta un IRPF absurdo al máximo legal en vez de aplicarlo', () => {
    // El caso real: querer poner 6,56 y teclear 656 por el separador decimal.
    const d = calcularDeducciones({ ...base, tipoIrpf: 656 }, 2026);
    const irpf = d.lineas.find((l) => l.concepto === 'I.R.P.F.');
    expect(irpf.detalle.pct).toBe(IRPF_MAXIMO);
    // Sin el tope serían -9.258,46 €, y el líquido saldría absurdamente negativo.
    expect(irpf.importe).toBe(-Math.round(1411.35 * IRPF_MAXIMO) / 100);
    expect(d.total).toBeGreaterThan(-1000);
  });

  it('ignora valores negativos en vez de convertirlos en un ingreso', () => {
    const d = calcularDeducciones({ ...base, tipoIrpf: -10, cuotaSindical: -5, primaSegVida: -3 }, 2026);
    expect(d.lineas.find((l) => l.concepto === 'I.R.P.F.')).toBeUndefined();
    expect(d.lineas.find((l) => l.concepto === 'Cuota Sindical')).toBeUndefined();
    expect(d.lineas.find((l) => l.concepto === 'Valor Retribución Especie')).toBeUndefined();
  });

  it('un IRPF válido no se toca', () => {
    const d = calcularDeducciones({ ...base, tipoIrpf: 6.56 }, 2026);
    expect(d.lineas.find((l) => l.concepto === 'I.R.P.F.').importe).toBe(-92.58);
  });
});

describe('nómina — la categoría de cada deducción va en el dato', () => {
  it('el total de cotización no depende del NOMBRE de las líneas', () => {
    // Antes se filtraba por texto ('Seg. Social', 'Desempleo'…): renombrar una
    // etiqueta de pantalla la sacaba del total en silencio.
    const d = calcularDeducciones({
      baseCotizacion: 1612.20, totalDevengos: 1411.35, tipoIrpf: 6.56, cuotaSindical: 5, primaSegVida: 4.56,
    }, 2026);
    const cotiz = d.lineas.filter((l) => l.categoria === CATEGORIA_DEDUCCION.COTIZACION);
    expect(cotiz).toHaveLength(4);
    expect(d.totalCotizacion).toBe(-104.79);
    // Y las otras tres están clasificadas, no sueltas.
    expect(d.lineas.find((l) => l.concepto === 'I.R.P.F.').categoria).toBe(CATEGORIA_DEDUCCION.IRPF);
    expect(d.lineas.find((l) => l.concepto === 'Cuota Sindical').categoria).toBe(CATEGORIA_DEDUCCION.OTRA);
  });
});

describe('nómina — cada mes guarda la suya', () => {
  const julio = { grupo: 'profesionales', cuatrienios: 1, horasNocturnas: 10, tipoIrpf: 6.56 };

  it('guardarMes deja la instantánea del mes Y la plantilla para el siguiente', () => {
    const n = guardarMes(null, julio, 2026, 6);          // julio = mes 6
    expect(n.meses['2026-07']).toMatchObject({ horasNocturnas: 10 });
    expect(n.grupo).toBe('profesionales');                // plantilla arriba
  });

  it('meses distintos guardan nocturnidades distintas', () => {
    let n = guardarMes(null, julio, 2026, 6);
    n = guardarMes(n, { ...julio, horasNocturnas: 25 }, 2026, 7);   // agosto
    expect(configDelMes(n, 2026, 6).horasNocturnas).toBe(10);
    expect(configDelMes(n, 2026, 7).horasNocturnas).toBe(25);
    // Y se calculan distinto de verdad, no solo se guardan distinto.
    const nJulio = calcularNominaDelMes(configDelMes(n, 2026, 6), 2026, 6);
    const nAgosto = calcularNominaDelMes(configDelMes(n, 2026, 7), 2026, 7);
    expect(nAgosto.totalDevengos).toBeGreaterThan(nJulio.totalDevengos);
  });

  it('un mes sin guardar devuelve null en vez de la nómina de otro mes', () => {
    const n = guardarMes(null, julio, 2026, 6);
    expect(configDelMes(n, 2026, 8)).toBeNull();          // septiembre, sin guardar
    expect(calcularNominaDelMes(configDelMes(n, 2026, 8), 2026, 8)).toBeNull();
  });

  it('las bajas son comunes a todos los meses, no de cada instantánea', () => {
    // Se numeran por año natural y una sola baja puede ocupar varios meses:
    // guardarlas por mes rompería las dos cosas.
    const bajas = [{ inicio: '2026-05-05', dias: 7, tipo: TIPO_BAJA.COMUN }];
    let n = guardarMes(null, { ...julio, bajas }, 2026, 6);
    n = guardarMes(n, { ...julio, bajas }, 2026, 7);
    expect(n.bajas).toHaveLength(1);
    expect(n.meses['2026-07'].bajas).toBeUndefined();     // no duplicadas dentro
    expect(configDelMes(n, 2026, 7).bajas).toHaveLength(1);
  });
});

describe('nómina — neto de las pagas extra', () => {
  it('solo se resta el IRPF, no la Seguridad Social', () => {
    // Ya cotizan mes a mes por la prorrata: descontarlas aquí sería cotizar dos veces.
    const pe = netoPagaExtra(1205.09, 6.56);
    expect(pe.bruto).toBe(1205.09);
    expect(pe.irpf).toBe(79.05);
    expect(pe.neto).toBe(1126.04);
  });

  it('sin IRPF configurado, el neto es el bruto', () => {
    expect(netoPagaExtra(1205.09, 0)).toMatchObject({ irpf: 0, neto: 1205.09 });
  });

  it('respeta el tope de IRPF igual que las deducciones', () => {
    expect(netoPagaExtra(1000, 656).irpf).toBe(470);   // recortado al 47%
  });
});
