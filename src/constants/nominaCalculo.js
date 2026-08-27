import {
  DIAS_MES_NOMINA, IRPF_MAXIMO, CATEGORIA_DEDUCCION,
  antiguedadAnual, mensualDesdeAnual, precioDia, plusNocturnidadHora,
  grupoPorId, tiposCotizacion, cent,
} from './nomina';
import { desgloseMesConBajas, calcularIT } from './nominaBajas';

/**
 * MOTOR de cálculo de la nómina. Aquí no hay ni un número del convenio: todos
 * salen de nomina.js. Así, una subida salarial se aplica tocando solo aquel
 * archivo, sin riesgo de mover por error una fórmula.
 *
 * Todo son funciones PURAS —mismas entradas, misma salida— para poder
 * contrastarlas contra nóminas reales en los tests sin montar React.
 */


/**
 * Clave de un mes en el archivo de nóminas guardadas: 'YYYY-MM'.
 * `mes` es 0-indexado, como en Date.
 */
export const claveMes = (anio, mes) => `${anio}-${String(mes + 1).padStart(2, '0')}`;

/**
 * configDelMes — la configuración con la que calcular la nómina de UN mes.
 *
 * Cada mes guarda su propia instantánea (`nomina.meses['2026-08']`), porque no
 * todos los meses son iguales: la nocturnidad cambia, la cuota sindical se deja
 * de pagar algún mes, puede aparecer un complemento nuevo. Sin instantáneas, la
 * app enseñaba la MISMA nómina en los doce meses.
 *
 * LAS BAJAS SON LA EXCEPCIÓN y van siempre al nivel de arriba, nunca dentro de la
 * instantánea del mes. Dos razones: el convenio las numera por AÑO natural (la
 * "1.ª baja del año" lo sigue siendo en diciembre), y una sola baja puede ocupar
 * varios meses. Guardarlas por mes rompería las dos cosas.
 *
 * @returns la config del mes, o null si ese mes no se ha guardado todavía.
 */
export const configDelMes = (nomina, anio, mes) => {
  const delMes = nomina?.meses?.[claveMes(anio, mes)];
  if (!delMes) return null;
  return { ...delMes, bajas: nomina.bajas || [] };
};

/**
 * guardarMes — deja la configuración lista para escribir en el perfil.
 *
 * Guarda a la vez tres cosas: la instantánea del mes que se está viendo, los
 * mismos valores en el nivel de arriba (así el mes siguiente abre el formulario
 * con lo último puesto, sin tener que reescribirlo todo) y las bajas, que son
 * comunes a todos los meses.
 */
export const guardarMes = (nominaActual, valores, anio, mes) => {
  const { bajas = [], ...delMes } = valores;
  return {
    ...delMes,                 // plantilla para el mes siguiente
    bajas,                     // comunes a todo el año
    meses: { ...(nominaActual?.meses || {}), [claveMes(anio, mes)]: delMes },
  };
};

/**
 * calcularNomina — cálculo PURO de los devengos brutos del mes.
 *
 * ── LAS 16 PAGAS ────────────────────────────────────────────────────────────
 * El convenio reparte el salario en 16 pagas y encajan así:
 *      12 mensualidades + Beneficios + Fomento + Verano + Navidad = 16
 * Beneficios y Fomento van PRORRATEADAS (se cobra 1/12 cada mes, y por eso
 * aparecen como línea en la nómina mensual). Verano y Navidad se cobran enteras
 * en su mes, así que NO son un devengo mensual.
 *
 * ── QUÉ ENTRA EN LA BASE DE LAS PAGAS ───────────────────────────────────────
 * Sueldo base + antigüedad + complementos, EXCEPTO "Complemento Puesto" y
 * "Compensación Fija SR": esos dos se pagan en 12 mensualidades en vez de en 16,
 * así que no generan paga extra y quedan fuera del cálculo.
 *
 * ── COMPROBADO CONTRA UNA NÓMINA REAL (agosto 2026, coordinador, 2.º cuatrienio) ─
 *   base 1.212,81 + antigüedad 30,11         → /12 = 103,58  (Beneficios y Fomento) ✓
 *   total devengos                            → 1.669,56 ✓
 *   (verano + navidad)/12                     → 207,15  (prorrata) ✓
 *   devengos + prorrata                       → 1.876,71  (base de cotización) ✓
 * Y esa base es justo sobre la que el papel aplica el 4,70% de Seg. Social, que
 * es como la Seguridad Social define la base por contingencias comunes.
 */
export const calcularNomina = (cfg) => {
  // Sin `?.`: el valor por defecto `= {}` solo cubre `undefined`, y configDelMes
  // devuelve NULL para un mes que aún no se ha guardado. Con null, esto reventaba.
  const grupo = grupoPorId(cfg?.grupo);
  if (!grupo) return null;

  const sueldoBase = mensualDesdeAnual(grupo.anual);
  const antiguedad = mensualDesdeAnual(antiguedadAnual(cfg.cuatrienios));

  // Complementos que SÍ generan paga extra (van en 16 pagas, como el sueldo).
  // `otrosComplementos` (un número suelto) es el formato viejo: se acepta para no
  // perder lo que ya hubiera guardado quien configurase antes de los nombres.
  const complementos = Array.isArray(cfg.complementos)
    ? cfg.complementos.filter((c) => Number(c.importe) > 0)
        .map((c) => ({ nombre: (c.nombre || '').trim() || 'Complemento', importe: Number(c.importe) }))
    : (Number(cfg.otrosComplementos) > 0
        ? [{ nombre: 'Complemento', importe: Number(cfg.otrosComplementos) }]
        : []);
  const sumaComplementos = complementos.reduce((t, c) => t + c.importe, 0);

  // Y los dos que NO: se cobran en 12 mensualidades, así que no generan paga extra.
  const puesto = Number(cfg.complementoPuesto) || 0;
  const compensacionSr = Number(cfg.compensacionFijaSr) || 0;
  const primaSegVida = Number(cfg.primaSegVida) || 0;

  // Nocturnidad: horas trabajadas de noche x el 20% de la hora ordinaria. Queda
  // FUERA de la base de las pagas —comprobado en la nómina de mayo: incluyéndola,
  // la Paga de Beneficios daría 100,50 y el papel pone 100,42— y tiene sentido,
  // porque es variable cada mes y no forma parte del salario consolidado.
  const horasNocturnas = Number(cfg.horasNocturnas) || 0;
  const precioNocturnidad = plusNocturnidadHora(grupo.anual);
  const importeNocturnidad = cent(horasNocturnas * precioNocturnidad);

  // Base sobre la que se calculan las cuatro pagas del convenio.
  const baseDePagas = sueldoBase + antiguedad + sumaComplementos;
  const pagaExacta = baseDePagas / 12;
  const pagaProrrateada = cent(pagaExacta);

  // ── EL PRECIO/DÍA NO SIGUE UNA REGLA ÚNICA ────────────────────────────────
  // Comprobado contra tres nóminas reales:
  //   · sueldo base, antigüedad y complementos → se divide el importe REDONDEADO
  //     (1.080,26/30 = 36,0086 y 1.112,67/30 = 37,0890, tal cual el papel; partir
  //     del exacto daría 36,0085 y 37,0888).
  //   · las pagas de Beneficios y Fomento → se divide el valor EXACTO
  //     (1.205,09/12 = 100,424166… → 3,3474; desde los 100,42 redondeados
  //     saldría 3,3473).
  // Tiene sentido: los primeros son importes que la empresa fija y paga al
  // céntimo, y la paga es una cantidad derivada que conserva su precisión.
  const conDia = (concepto, importe, exacto) => ({
    concepto,
    importe,
    detalle: { unidades: `${DIAS_MES_NOMINA} Día`, precio: precioDia(exacto ?? importe) },
  });

  const devengos = [
    conDia('Sueldo Base Grupo', sueldoBase),
    ...(antiguedad > 0 ? [conDia('Antigüedad', antiguedad)] : []),
    conDia('Paga De Beneficios', pagaProrrateada, pagaExacta),
    conDia('Paga De Fomento', pagaProrrateada, pagaExacta),
    ...complementos.map((c) => conDia(c.nombre, cent(c.importe))),
    ...(importeNocturnidad > 0 ? [{
      concepto: 'Nocturnidad Variable',
      importe: importeNocturnidad,
      // Este va por HORAS, no por los 30 días del mes: es el único así.
      detalle: { unidades: `${horasNocturnas.toLocaleString('es-ES')} h`, precio: precioNocturnidad },
    }] : []),
    ...(compensacionSr > 0 ? [{ concepto: 'Compensación Fija Sr', importe: compensacionSr, detalle: null }] : []),
    ...(puesto > 0 ? [conDia('Complemento Puesto', puesto)] : []),
    ...(primaSegVida > 0 ? [{ concepto: 'Prima Seg.Vida.C.C.', importe: primaSegVida, detalle: null }] : []),
  ];

  const totalDevengos = cent(devengos.reduce((t, d) => t + d.importe, 0));

  // Verano y Navidad: una paga completa cada una (= Beneficios x 12).
  const pagaExtra = cent(baseDePagas);
  // Aunque se cobren en su mes, cotizan repartidas todo el año: por eso la nómina
  // mensual las suma a la base de cotización aunque no estén en los devengos.
  const prorrataPagas = cent((pagaExtra * 2) / 12);

  // Suma de los precios/día de los conceptos que se cobran POR DÍAS. Es lo que
  // deja de percibirse por cada día de baja, y por tanto la base del Complemento
  // 50/53 que se reintegra en enero. Quedan fuera a propósito la nocturnidad (va
  // por horas, solo las realmente trabajadas) y los conceptos sin precio/día
  // (Prima Seg. Vida, Compensación Fija SR), que se mantienen íntegros.
  const salarioDiario = devengos
    .filter((d) => d.detalle && String(d.detalle.unidades).endsWith('Día'))
    .reduce((t, d) => t + d.detalle.precio, 0);

  return {
    devengos,
    totalDevengos,
    salarioDiario,
    pagaVerano: pagaExtra,
    pagaNavidad: pagaExtra,
    prorrataPagas,
    baseCotizacion: cent(totalDevengos + prorrataPagas),
  };
};

/**
 * calcularNominaDelMes — la nómina de un mes CONCRETO, teniendo en cuenta las
 * bajas que caigan en él.
 *
 * Hace tres cosas que calcularNomina (mes "normal", sin bajas) no hace:
 *   1. Reduce los devengos que se cobran POR DÍA a los días ORDINARIOS de este
 *      mes (comprobado contra una nómina real: 23 días trabajados en vez de 30
 *      dan Sueldo Base, Antigüedad y las pagas a 23 × su precio/día).
 *   2. Añade la Prestación de la Seguridad Social y el Complemento de empresa
 *      por los días de baja que sí se cobran (día 4 en adelante).
 *      ⚠️ SIN CONFIRMAR CONTRA PAPEL: repartir esto en DOS líneas es como la
 *      Seguridad Social estructura el pago (ella paga el legal, la empresa
 *      complementa el resto), pero no hay todavía una nómina real de 2026 con
 *      una baja complementada al 100% contra la que contrastar el nombre o el
 *      reparto exacto de estas dos líneas. Revisar en cuanto llegue una.
 *   3. Si el mes es ENERO, sí el año anterior tuvo una única baja común,
 *      reintegra el Complemento 50/53 con sus tres primeros días (confirmado:
 *      140,59 € en el caso real que se usó para verificarlo).
 *
 * La base de cotización (`baseCotizacion`, y por tanto `prorrataPagas`) se deja
 * TAL CUAL la del mes sin bajas, a propósito: la Seguridad Social mantiene la
 * base de cotización anterior a la baja mientras dura, no la recalcula sobre el
 * mes reducido — así lo confirma una nómina real (su "TOTAL DEVENGOS COMPUTABLES"
 * es mayor que su "TOTAL DEVENGOS", la diferencia es justo lo retenido esos días).
 */
export const calcularNominaDelMes = (cfg, anio, mes) => {
  const base = calcularNomina(cfg);
  if (!base) return null;

  const desglose = desgloseMesConBajas(cfg?.bajas, anio, mes);
  const baseDiaria = base.baseCotizacion / DIAS_MES_NOMINA;

  const devengos = base.devengos.map((d) => {
    if (!d.detalle || !String(d.detalle.unidades).endsWith('Día')) return d;
    return {
      ...d,
      importe: cent(d.detalle.precio * desglose.diasOrdinarios),
      detalle: { ...d.detalle, unidades: `${desglose.diasOrdinarios} Día` },
    };
  });

  const prestacionSS = cent(baseDiaria * desglose.pctDiasLegal / 100);
  const complementoEmpresa = cent(baseDiaria * (desglose.pctDiasFinal - desglose.pctDiasLegal) / 100);
  if (prestacionSS > 0) devengos.push({ concepto: 'Prestación IT (Seguridad Social)', importe: prestacionSS, detalle: null });
  if (complementoEmpresa > 0) devengos.push({ concepto: 'Complemento Convenio IT Empresa', importe: complementoEmpresa, detalle: null });

  let complemento5053 = 0;
  if (mes === 0) {
    const bajasAnioAnterior = (cfg?.bajas || []).filter((b) => b?.inicio && Number(b.inicio.slice(0, 4)) === anio - 1);
    const itAnioAnterior = calcularIT(bajasAnioAnterior, { salarioDiario: base.salarioDiario, baseDiaria });
    if (itAnioAnterior.recuperable && itAnioAnterior.retenido > 0) {
      complemento5053 = itAnioAnterior.retenido;
      devengos.push({ concepto: 'Complemento 50 (Regularización IT)', importe: complemento5053, detalle: null });
    }
  }

  const totalDevengos = cent(devengos.reduce((t, d) => t + d.importe, 0));

  return {
    ...base,
    devengos,
    totalDevengos,
    // El de siempre (30 días, sin reducir): es el que va en "Bases de cotización",
    // no el reducido de arriba — ver el porqué en el comentario de la función.
    totalDevengosComputables: base.totalDevengos,
    diasOrdinarios: desglose.diasOrdinarios,
    diasBaja: desglose.diasBaja,
    complemento5053,
  };
};


/**
 * calcularDeducciones — lo que se resta del bruto.
 *
 * Hay dos bases DISTINTAS, y confundirlas es el error fácil aquí:
 *   · La cotización a la Seguridad Social va sobre la BASE DE COTIZACIÓN. Por
 *     eso no baja cuando hay baja: la base se mantiene.
 *   · El IRPF va sobre los DEVENGOS realmente cobrados. Ese sí baja con la baja.
 *
 * @param {object} p
 * @param {number} p.baseCotizacion   base de cotización del mes (con prorrata)
 * @param {number} p.totalDevengos    lo realmente devengado (base del IRPF)
 * @param {number} p.tipoIrpf         % personal de retención (lo pone el usuario)
 * @param {number} p.cuotaSindical    importe fijo, solo si está afiliado
 * @param {number} p.primaSegVida     retribución en especie: se resta igual que suma
 * @param {number} anio               para elegir los tipos de cotización correctos
 */
/**
 * netoPagaExtra — lo que se cobra de verdad de una paga de Verano o Navidad.
 *
 * Solo se le resta el IRPF, NO la Seguridad Social. No es un olvido: estas pagas
 * ya cotizan mes a mes a través de la "prorrata pagas extraordinarias" que suma a
 * la base de cotización de cada nómina —(verano + navidad)/12 cada mes, los 12
 * meses—, así que al cobrarlas cotizarían por segunda vez. El IRPF sí se retiene,
 * porque es renta que se percibe en ese momento.
 *
 * ⚠️ DERIVADO, no contrastado contra papel: no hay todavía ninguna nómina de paga
 * extra entre las de referencia. El razonamiento se sostiene en que la prorrata ya
 * está en la base de cotización de las tres que sí tenemos, pero conviene revisarlo
 * cuando llegue una nómina de julio o diciembre.
 */
export const netoPagaExtra = (bruto, tipoIrpf) => {
  const irpf = Math.min(Math.max(Number(tipoIrpf) || 0, 0), IRPF_MAXIMO);
  const retencion = cent(bruto * irpf / 100);
  return { bruto: cent(bruto), irpf: retencion, neto: cent(bruto - retencion) };
};

export const calcularDeducciones = ({
  baseCotizacion = 0, totalDevengos = 0, tipoIrpf = 0,
  cuotaSindical = 0, primaSegVida = 0,
} = {}, anio) => {
  const t = tiposCotizacion(anio);

  // Saneado de lo que teclea el usuario. Sin esto, un "656" en vez de "6,56" (el
  // separador decimal despista) restaría el 656% de los devengos y la pantalla
  // enseñaría un líquido negativo enorme como si fuera un cálculo válido.
  const irpf = Math.min(Math.max(Number(tipoIrpf) || 0, 0), IRPF_MAXIMO);
  const cuota = Math.max(Number(cuotaSindical) || 0, 0);
  const especie = Math.max(Number(primaSegVida) || 0, 0);

  // Cada línea se redondea a céntimos por separado, como en el papel: sumar los
  // porcentajes y aplicar el total daría diferencias de un céntimo.
  //
  // `categoria` va en el dato, no deducida del nombre: los conceptos son texto de
  // pantalla y pueden reescribirse en cualquier momento. Filtrar por el nombre
  // haría que renombrar "Seg. Social" dejara de sumarlo en el total de cotización
  // sin dar ningún error — un número más bajo, en silencio.
  const porBase = (concepto, pct) => ({
    concepto,
    categoria: CATEGORIA_DEDUCCION.COTIZACION,
    detalle: { pct, base: baseCotizacion },
    importe: -cent(baseCotizacion * pct / 100),
  });

  const lineas = [
    porBase('Seg. Social', t.contingenciasComunes),
    porBase('Seg. Social Mei', t.mei),
    porBase('Desempleo', t.desempleo),
    porBase('Formación', t.formacion),
  ];

  if (irpf > 0) {
    lineas.push({
      concepto: 'I.R.P.F.',
      categoria: CATEGORIA_DEDUCCION.IRPF,
      // OJO: sobre los devengos, NO sobre la base de cotización.
      detalle: { pct: irpf, base: totalDevengos },
      importe: -cent(totalDevengos * irpf / 100),
    });
  }

  if (cuota > 0) {
    lineas.push({
      concepto: 'Cuota Sindical', categoria: CATEGORIA_DEDUCCION.OTRA,
      detalle: null, importe: -cent(cuota),
    });
  }

  // La retribución en especie se suma al bruto (para que cotice y tribute) y se
  // resta aquí, porque no es dinero que llegue a la cuenta. Siempre el mismo
  // importe que la Prima Seg. Vida de los devengos: comprobado en las tres nóminas.
  if (especie > 0) {
    lineas.push({
      concepto: 'Valor Retribución Especie', categoria: CATEGORIA_DEDUCCION.OTRA,
      detalle: null, importe: -cent(especie),
    });
  }

  const totalCotizacion = cent(
    lineas.filter((l) => l.categoria === CATEGORIA_DEDUCCION.COTIZACION)
      .reduce((t2, l) => t2 + l.importe, 0),
  );

  return {
    lineas,
    total: cent(lineas.reduce((t2, l) => t2 + l.importe, 0)),
    totalCotizacion,
  };
};

