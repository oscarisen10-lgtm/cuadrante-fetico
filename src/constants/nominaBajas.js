import { DIAS_MES_NOMINA, PCT_TERCERA_BAJA_DIA21, TIPO_BAJA, cent } from './nomina';

/**
 * INCAPACIDAD TEMPORAL (bajas). Vive aparte del resto del motor porque es la
 * pieza con reglas propias —tipo de contingencia, número de baja del año, tramo
 * de días— y la única que hace aritmética de fechas.
 *
 * Lo usa nominaCalculo.js para reducir los días de un mes con baja; aquí no se
 * sabe nada de sueldos ni de deducciones.
 */

// ─── INCAPACIDAD TEMPORAL (BAJAS) ────────────────────────────────────────────
//
// Lo que cobra el trabajador durante una baja depende de TRES cosas: el tipo de
// contingencia, qué número de baja del año es, y en qué tramo de días está.
//

/**
 * Porcentaje del salario que se cobra en un día concreto de baja.
 * @param {object} p
 * @param {string} p.tipo            'comun' | 'profesional'
 * @param {number} p.proceso         qué número de baja COMÚN del año es (1, 2, 3…)
 * @param {number} p.dia             día de la baja, empezando en 1
 * @param {boolean} p.hospitalizacion  con hospitalización o cirugía
 */
export const porcentajeDiaIT = ({ tipo, proceso, dia, hospitalizacion }) => {
  // Accidente de trabajo y enfermedad profesional: 100% desde el primer día,
  // sin importar cuántas bajas lleve en el año.
  if (tipo === TIPO_BAJA.PROFESIONAL) return 100;
  // Hospitalización o cirugía: también 100% desde el día 1, aunque sea la cuarta.
  if (hospitalizacion) return 100;

  if (dia <= 3) return 0;                       // los tres primeros, nunca de entrada
  if (proceso <= 2) return 100;                 // 1.ª y 2.ª baja: complemento al 100%
  if (dia <= 20) return 60;                     // 3.ª en adelante: solo el tramo legal
  return proceso === 3 ? PCT_TERCERA_BAJA_DIA21 : 75;
};

/**
 * calcularIT — qué supone económicamente el conjunto de bajas de un año.
 *
 * @param {Array} bajas  [{ inicio:'YYYY-MM-DD', dias, tipo, hospitalizacion }]
 * @param {number} baseDiaria  base reguladora al día (base de cotización / 30)
 * @returns {{ retenido:number, recuperable:boolean, perdido:number, procesos:Array }}
 *   retenido    — los días 1-3 de la PRIMERA baja común, que se descuentan ya.
 *   recuperable — true si aún se pueden recobrar en enero (solo con UNA baja común
 *                 en todo el año; una segunda hace que se pierdan para siempre).
 *   perdido     — lo que no se recupera de ninguna manera.
 */
export const calcularIT = (bajas = [], bases = {}) => {
  // DOS bases distintas, y confundirlas cambia el resultado en decenas de euros:
  //
  //   · salarioDiario — lo que se deja de cobrar por cada día que desaparece de la
  //     nómina (46,8644 €/día en la nómina de mayo). Es lo que se retiene en los
  //     días 1-3 y lo que se reintegra en enero como Complemento 50/53: reintegra
  //     RETRIBUCIÓN ORDINARIA, no la prorrata de las pagas extra, que se cobran en
  //     su propia fecha de vencimiento.
  //
  //   · baseDiaria — la base reguladora (base de cotización / 30; 53,74 €/día allí
  //     mismo). Sobre ella se calcula la prestación de la Seguridad Social de los
  //     días 4 en adelante. Es MÁS ALTA que el salario diario porque sí incluye esa
  //     prorrata (6,88 €/día de diferencia).
  const salarioDiario = Number(bases.salarioDiario) || 0;
  const baseDiaria = Number(bases.baseDiaria) || 0;

  // Solo las comunes se numeran: las profesionales van al 100% y no cuentan para
  // el contador de procesos del que dependen los porcentajes.
  const comunes = bajas
    .filter((b) => b && Number(b.dias) > 0 && (b.tipo || TIPO_BAJA.COMUN) === TIPO_BAJA.COMUN)
    .sort((a, b) => String(a.inicio || '').localeCompare(String(b.inicio || '')));

  const profesionales = bajas.filter((b) => b && Number(b.dias) > 0 && b.tipo === TIPO_BAJA.PROFESIONAL);

  let retenido = 0;
  let perdido = 0;
  const procesos = [];

  comunes.forEach((b, i) => {
    const proceso = i + 1;
    const dias = Number(b.dias) || 0;
    const hosp = Boolean(b.hospitalizacion);
    let deEsta = 0;
    let tresPrimeros = 0;

    for (let dia = 1; dia <= dias; dia += 1) {
      const pct = porcentajeDiaIT({ tipo: TIPO_BAJA.COMUN, proceso, dia, hospitalizacion: hosp });
      if (dia <= 3) {
        // Estos días simplemente no se pagan: se pierde el salario ordinario.
        if (pct < 100) tresPrimeros += salarioDiario * (100 - pct) / 100;
      } else {
        // Aquí sí hay prestación, y se mide contra la base reguladora.
        deEsta += baseDiaria * (100 - pct) / 100;
      }
    }

    // Los tres primeros de la PRIMERA baja son los únicos que pueden volver.
    if (proceso === 1) retenido = cent(tresPrimeros);
    else perdido = cent(perdido + tresPrimeros);
    perdido = cent(perdido + deEsta);

    procesos.push({
      ...b, proceso, dias,
      importeTresPrimeros: cent(tresPrimeros),
      importeResto: cent(deEsta),
    });
  });

  profesionales.forEach((b) => procesos.push({ ...b, proceso: null, dias: Number(b.dias) || 0, importeTresPrimeros: 0, importeResto: 0 }));

  // Con una sola baja común en el año, los tres días retenidos se abonan en la
  // nómina de enero del año siguiente. En cuanto hay una segunda, se pierden.
  const recuperable = comunes.length === 1;
  if (!recuperable && retenido > 0) {
    perdido = cent(perdido + retenido);
    retenido = 0;
  }

  return { retenido, recuperable, perdido, procesos, totalComunes: comunes.length };
};

/** Milisegundos de un día, para medir distancias entre fechas. */
const MS_DIA = 24 * 60 * 60 * 1000;

/** 'YYYY-MM-DD' -> Date local a mediodía.
 *
 *  A MEDIODÍA y no a medianoche a propósito: al sumar días con aritmética de
 *  milisegundos, un cambio de hora (los domingos de marzo y octubre) mueve la
 *  fecha ±1 hora, y desde las 00:00 eso salta al día anterior o siguiente.
 *  Partiendo de las 12:00 quedan 12 horas de margen a cada lado. */
const aFecha = (iso) => {
  const [y, m, d] = String(iso).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 12, 0, 0, 0);
};

/**
 * diasDeLaBajaEnElMes — qué tramo de una baja cae dentro de un mes concreto.
 *
 * Devuelve `{ primerDia, numDias }` donde `primerDia` es el ordinal DENTRO DE LA
 * BAJA (1 = primer día de la baja) del primer día que cae en ese mes. Ese ordinal
 * es lo que decide el porcentaje: los tres primeros días de la baja no se cobran
 * aunque caigan en el mes siguiente al de su inicio.
 *
 * Ejemplo: baja de 40 días desde el 5 de mayo. En mayo devuelve
 * { primerDia: 1, numDias: 27 } y en junio { primerDia: 28, numDias: 13 }.
 */
const diasDeLaBajaEnElMes = (baja, anio, mes) => {
  const dias = Number(baja.dias) || 0;
  if (!baja.inicio || dias <= 0) return null;

  const inicioBaja = aFecha(baja.inicio);
  if (Number.isNaN(inicioBaja.getTime())) return null;
  const finBaja = new Date(inicioBaja.getTime() + (dias - 1) * MS_DIA);

  const inicioMes = new Date(anio, mes, 1, 12, 0, 0, 0);
  const finMes = new Date(anio, mes + 1, 0, 12, 0, 0, 0);   // día 0 del mes siguiente = último de este

  const desde = inicioBaja > inicioMes ? inicioBaja : inicioMes;
  const hasta = finBaja < finMes ? finBaja : finMes;
  if (desde > hasta) return null;                            // la baja no toca este mes

  return {
    primerDia: Math.round((desde - inicioBaja) / MS_DIA) + 1,
    numDias: Math.round((hasta - desde) / MS_DIA) + 1,
  };
};

/**
 * desgloseMesConBajas — cuánto de un mes CONCRETO (año + mes, 0-indexado como
 * Date) es días ordinarios y cuánto es de baja, con el porcentaje que corresponde
 * a cada día de baja según el proceso al que pertenece.
 *
 * Las bajas se reparten por los meses que REALMENTE ocupan, no solo por el de su
 * fecha de inicio: una baja de 40 días que empieza el 5 de mayo pone 27 días en
 * mayo y 13 en junio. Antes se imputaba entera al mes de inicio, y la nómina del
 * mes siguiente salía como un mes trabajado completo estando el usuario de baja.
 *
 * Los procesos se numeran sobre TODAS las bajas comunes del AÑO, no solo las que
 * tocan este mes: el convenio numera "1.ª, 2.ª baja del año natural", y una baja
 * de marzo sigue siendo la 1.ª aunque se esté mirando la nómina de julio.
 */
export const desgloseMesConBajas = (bajas = [], anio, mes) => {
  // Para numerar los procesos hace falta el año de la BAJA, no el del mes que se
  // mira: una baja de diciembre que se alarga hasta enero sigue siendo un proceso
  // de su propio año, y en enero ya empieza a contar de cero.
  const delAnio = (tipo, anioBaja) => (bajas || [])
    .filter((b) => b && Number(b.dias) > 0 && b.inicio && Number(b.inicio.slice(0, 4)) === anioBaja
      && (b.tipo || TIPO_BAJA.COMUN) === tipo)
    .sort((a, b) => a.inicio.localeCompare(b.inicio));

  // El legal de la Seguridad Social NO depende del proceso, solo del tramo de
  // día — lo que varía por proceso es el complemento que añade el convenio por
  // encima. Es distinto para accidente de trabajo: el día del hecho lo paga la
  // empresa entero (0% de la SS) y desde el día siguiente la SS paga el 75%.
  const pctLegalSS = (tipo, dia) => {
    if (tipo === TIPO_BAJA.PROFESIONAL) return dia === 1 ? 0 : 75;
    return dia <= 3 ? 0 : dia <= 20 ? 60 : 75;
  };

  let diasBaja = 0;
  let pctDiasFinal = 0;   // suma de porcentajeDiaIT() de cada día de baja de este mes
  let pctDiasLegal = 0;   // la parte de esa suma que paga la Seguridad Social

  const acumular = (b, proceso) => {
    const tramo = diasDeLaBajaEnElMes(b, anio, mes);
    if (!tramo) return;
    const tipo = b.tipo || TIPO_BAJA.COMUN;
    for (let k = 0; k < tramo.numDias; k += 1) {
      // Tope de 30: la nómina prorratea siempre sobre mes de 30 días, así que un
      // mes de 31 completamente de baja no puede descontar 31.
      if (diasBaja >= DIAS_MES_NOMINA) return;
      const dia = tramo.primerDia + k;    // ordinal dentro de la baja, no del mes
      const pctFinal = porcentajeDiaIT({ tipo, proceso, dia, hospitalizacion: b.hospitalizacion });
      pctDiasFinal += pctFinal;
      pctDiasLegal += Math.min(pctLegalSS(tipo, dia), pctFinal);
      diasBaja += 1;
    }
  };

  // Una baja puede haber empezado el año anterior y seguir en enero, así que hay
  // que mirar los dos años; cada uno con su propia numeración de procesos.
  [anio - 1, anio].forEach((anioBaja) => {
    delAnio(TIPO_BAJA.COMUN, anioBaja).forEach((b, i) => acumular(b, i + 1));
    delAnio(TIPO_BAJA.PROFESIONAL, anioBaja).forEach((b) => acumular(b, null));
  });

  return { diasOrdinarios: Math.max(0, DIAS_MES_NOMINA - diasBaja), diasBaja, pctDiasFinal, pctDiasLegal };
};
