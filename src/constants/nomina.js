/**
 * TABLAS del convenio y tipos de cotización. Aquí NO se calcula nada: son los
 * números que hay que revisar cuando cambia el convenio o sube la cotización, y
 * por eso viven separados del motor que los usa (ver nominaCalculo.js).
 *
 * Si hay subida salarial, lo que se toca es este archivo. Los tests de
 * nomina.test.js fijan estos valores contra nóminas reales, así que si alguno se
 * queda sin actualizar, salta ahí antes de que nadie lo vea en su nómina.
 */

import { CONFIG } from './config';

/** Jornada anual del convenio (1770 h). Compartida con el Resumen. */
const { LIMITE_ANUAL_HORAS } = CONFIG;

/**
 * Tablas del convenio para el cálculo de la nómina.
 *
 * Vive aparte de config.js a propósito: config.js son los objetivos del convenio
 * (horas, domingos, findes de calidad) y esto es dinero, con sus propias tablas
 * que se revisan cada vez que hay subida salarial. Separado se actualiza sin
 * tocar nada de lo demás.
 *
 * ⚠️ Todo lo de aquí es BRUTO. Las deducciones (Seguridad Social, IRPF) no se
 * calculan todavía.
 */

/** El convenio reparte el salario anual en 16 pagas, no en 12 ni en 14. */
export const PAGAS_AL_ANIO = 16;

/** La nómina prorratea siempre sobre mes de 30 días, no sobre los días reales. */
export const DIAS_MES_NOMINA = 30;

/**
 * Precio de la hora efectiva: salario anual ÷ jornada anual del convenio.
 *
 * No se guardan los precios/hora como tabla aparte porque saldrían de la misma
 * división y podrían quedarse descolgados del anual en la próxima subida salarial.
 * Comprobado con los cuatro grupos: 17.284,12/1770 = 9,76504 €/h, y así los demás.
 *
 * Las 1770 h salen de CONFIG.LIMITE_ANUAL_HORAS, que ya las usa el Resumen para
 * medir el cómputo anual: es la MISMA jornada, así que se importa en vez de
 * repetir el número y arriesgarse a que un día cambie solo en un sitio.
 */
export const precioHora = (anual) => anual / LIMITE_ANUAL_HORAS;

/**
 * Plus de nocturnidad: recargo del 20% sobre la hora ordinaria, para las horas
 * trabajadas entre las 22:00 y las 06:00.
 *
 * El 20% está comprobado por partida doble: sale exacto (20,000%) en dos nóminas
 * reales de grupos distintos —1,9530 €/h en Personal base y 2,0116 €/h en
 * Profesionales— y coincide con la tabla del convenio. (Ojo: circula por ahí una
 * tabla que dice 25%; no es la buena, no cuadra con ninguna nómina.)
 *
 * No hay que preguntarle nada al usuario: sabiendo su grupo, el precio sale solo.
 */
export const PCT_NOCTURNIDAD = 0.20;
export const plusNocturnidadHora = (anual) =>
  Math.round(precioHora(anual) * PCT_NOCTURNIDAD * 10000) / 10000;

/**
 * Grupos profesionales y su salario base ANUAL bruto. El anual es la fuente de
 * verdad —es lo que fija el convenio— y el mensual se deriva; al revés, redondear
 * el mensual y multiplicar por 16 daría un anual que no cuadra con el papel.
 */
export const GRUPOS_PROFESIONALES = [
  { id: 'base',          label: 'Personal base', anual: 17284.12 },
  { id: 'profesionales', label: 'Profesionales', anual: 17802.65 },
  { id: 'coordinadores', label: 'Coordinadores', anual: 19404.86 },
  { id: 'tecnicos',      label: 'Técnicos',      anual: 21151.32 },
];

/**
 * Antigüedad por cuatrienios. Los importes son ANUALES y se ACUMULAN: quien va
 * por el 2.º cuatrienio cobra el 1.º MÁS el 2.º, no solo el 2.º. A partir del 4.º
 * se repite el mismo importe por cada cuatrienio cumplido.
 *
 * Comprobado contra una nómina real: 2.º cuatrienio = 255,79 + 225,98 = 481,77 €
 * al año → 30,11 € al mes, que es exactamente lo que figura en el papel.
 */
export const CUATRIENIOS = [255.79, 225.98, 201.94];
export const CUATRIENIO_SUCESIVO = 192.32;

/** Cuántos cuatrienios se pueden elegir en el desplegable (0 = sin antigüedad). */
export const MAX_CUATRIENIOS = 8;

/** Importe anual de antigüedad acumulado para `n` cuatrienios cumplidos. */
export const antiguedadAnual = (n) => {
  const tramos = Number(n) || 0;
  if (tramos <= 0) return 0;
  const acumulado = CUATRIENIOS.slice(0, Math.min(tramos, CUATRIENIOS.length))
    .reduce((suma, importe) => suma + importe, 0);
  return acumulado + (tramos > CUATRIENIOS.length
    ? CUATRIENIO_SUCESIVO * (tramos - CUATRIENIOS.length)
    : 0);
};

/** Milisegundos de un día, para medir distancias entre fechas. */
export const MS_DIA = 24 * 60 * 60 * 1000;

/** 'YYYY-MM-DD' -> Date local a mediodía.
 *
 *  A MEDIODÍA y no a medianoche a propósito: al sumar días con aritmética de
 *  milisegundos, un cambio de hora (los domingos de marzo y octubre) mueve la
 *  fecha ±1 hora, y desde las 00:00 eso salta al día anterior o siguiente.
 *  Partiendo de las 12:00 quedan 12 horas de margen a cada lado. */
export const aFecha = (iso) => {
  const [y, m, d] = String(iso).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 12, 0, 0, 0);
};

/** Redondeo a céntimos, como hace la nómina en cada línea. Lo usan los dos
 *  módulos de cálculo, así que vive con el resto de helpers numéricos. */
export const cent = (n) => Math.round(n * 100) / 100;

/** Bruto mensual a partir del anual, redondeado a céntimos como en la nómina. */
export const mensualDesdeAnual = (anual) =>
  Math.round((anual / PAGAS_AL_ANIO) * 100) / 100;

/**
 * Precio del día que aparece en la línea pequeña ("30 Día | 1,0036€").
 *
 * Se TRUNCA a 4 decimales en vez de redondear porque es lo que hace la nómina
 * real: la antigüedad de 30,11 €/mes da 1,00366… y en el papel figura 1,0036,
 * no 1,0037. Es una diferencia de una milésima de céntimo, pero si el objetivo
 * es que el usuario compare esta pantalla con su nómina, tiene que coincidir.
 */
export const precioDia = (mensual) =>
  Math.trunc((mensual / DIAS_MES_NOMINA) * 10000) / 10000;

/** El grupo elegido, o null si aún no ha configurado nada. */
export const grupoPorId = (id) =>
  GRUPOS_PROFESIONALES.find((g) => g.id === id) || null;

/** Etiqueta del desplegable de antigüedad para `n` cuatrienios. */
export const etiquetaCuatrienio = (n) => {
  if (n === 0) return 'Sin antigüedad';
  const anios = n * 4;
  const ordinal = n === 1 ? '1.er' : n === 3 ? '3.er' : `${n}.º`;
  return `${ordinal} cuatrienio (${anios} años)`;
};

// ─── INCAPACIDAD TEMPORAL (BAJAS) ────────────────────────────────────────────
//
// Lo que cobra el trabajador durante una baja depende de TRES cosas: el tipo de
// contingencia, qué número de baja del año es, y en qué tramo de días está.
//
// La idea clave, y la que más sorprende: en la mayoría de los casos NO se cobra
// menos. El convenio complementa hasta el 100% y lo único que cambia es cómo se
// presenta en el papel (el sueldo base pasa de 30 días a los trabajados y
// aparecen las líneas de prestación + complemento). Solo se pierde dinero al
// REINCIDIR, y en los tres primeros días.

export const TIPO_BAJA = { COMUN: 'comun', PROFESIONAL: 'profesional' };

/** Cuota sindical: importe fijo al mes de quien está afiliado. No es del convenio
 *  (lo fija el sindicato), así que se configura en vez de estar aquí clavado; 5 €
 *  es lo que figura en las nóminas de referencia. */
export const CUOTA_SINDICAL_POR_DEFECTO = 5;

/** El 3.er proceso da entre el 85% y el 100% del día 21 en adelante. Se coge el
 *  extremo BAJO a propósito: más vale que la app se quede corta y el usuario
 *  cobre de más, que prometer un dinero que luego no llega. */
export const PCT_TERCERA_BAJA_DIA21 = 85;

/**
 * Tope de la retención de IRPF. El 47% es el tipo marginal máximo del IRPF en
 * España; por encima de eso el dato está mal escrito, no es un caso raro.
 *
 * Importa porque el separador decimal despista: quien quiere poner 6,56% y
 * teclea "656" acabaría viendo un líquido absurdamente negativo. Se recorta en
 * `calcularDeducciones` (ver CLAUDE.md: "Validate input at system boundaries").
 */
export const IRPF_MAXIMO = 47;

/** Categoría de cada línea de deducción. Va en el dato en vez de deducirse del
 *  nombre, que es texto de pantalla y puede cambiar. */
export const CATEGORIA_DEDUCCION = {
  COTIZACION: 'cotizacion',   // las cuatro de Seguridad Social
  IRPF: 'irpf',
  OTRA: 'otra',               // cuota sindical, retribución en especie
};


// ─── DEDUCCIONES ─────────────────────────────────────────────────────────────
//
// Comprobado línea a línea contra TRES nóminas reales (enero y mayo de 2026,
// junio de 2025): las 15 deducciones salen exactas al céntimo.
//
// Hay dos bases DISTINTAS, y confundirlas es el error fácil aquí:
//   · La cotización a la Seguridad Social va sobre la BASE DE COTIZACIÓN
//     (devengos + prorrata de pagas extra). Por eso no baja cuando hay baja: la
//     base se mantiene, y el descuento de Seg. Social sale igual que un mes normal.
//   · El IRPF va sobre los DEVENGOS realmente cobrados. Ese sí baja con la baja.

/**
 * Tipos de cotización del TRABAJADOR. Son de ley (iguales para todos), no del
 * convenio, así que no se preguntan.
 *
 * El MEI (Mecanismo de Equidad Intergeneracional) SUBE CADA AÑO, y por eso va
 * por años en vez de como número fijo: en las nóminas está al 0,13% en 2025 y al
 * 0,15% en 2026. Si se dejara clavado, en enero de 2027 la app empezaría a dar
 * un número mal en silencio. Al añadir un año nuevo, basta con una línea aquí.
 *
 * `desempleo` es el 1,55% del contrato INDEFINIDO (el de las tres nóminas). En
 * un temporal es 1,60%; si algún día hace falta, se añade como opción.
 */
export const TIPOS_COTIZACION_POR_ANIO = {
  2025: { contingenciasComunes: 4.70, mei: 0.13, desempleo: 1.55, formacion: 0.10 },
  2026: { contingenciasComunes: 4.70, mei: 0.15, desempleo: 1.55, formacion: 0.10 },
};

/** Tipos del año pedido; si no está, los del año más reciente que se conozca. */
export const tiposCotizacion = (anio) => {
  if (TIPOS_COTIZACION_POR_ANIO[anio]) return TIPOS_COTIZACION_POR_ANIO[anio];
  const conocidos = Object.keys(TIPOS_COTIZACION_POR_ANIO).map(Number).sort((a, b) => a - b);
  return TIPOS_COTIZACION_POR_ANIO[conocidos[conocidos.length - 1]];
};


// ─── FORMATO PARA PANTALLA ───────────────────────────────────────────────────
//
// Viven aquí, y no en un componente, porque los usan tanto la vista de la nómina
// como su modal de configuración, y duplicarlos sería pedir que un día dejen de
// coincidir.

/**
 * Formato español de dinero: 1.334,98 €
 *
 * `useGrouping: true` es OBLIGATORIO, no es redundante: en es-ES el separador de
 * miles NO se pone por defecto en números de 4 cifras (1234 -> "1234", y solo a
 * partir de 5 -> "12.345"). Correcto para un número suelto, pero en una nómina un
 * sueldo de 1.212,67 € saldría como "1212,67 €". Con `style: 'currency'` tampoco
 * se arregla solo: hay que pedirlo explícitamente.
 */
const FORMATO_EUR = new Intl.NumberFormat('es-ES', {
  style: 'currency', currency: 'EUR', useGrouping: true,
});
export const eur = (n) => FORMATO_EUR.format(n);

/** Precios unitarios: 4 decimales (precio/día) y 5 (precio/hora), como el papel. */
export const num4 = (n) => n.toLocaleString('es-ES', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
export const num5 = (n) => n.toLocaleString('es-ES', { minimumFractionDigits: 5, maximumFractionDigits: 5 });
