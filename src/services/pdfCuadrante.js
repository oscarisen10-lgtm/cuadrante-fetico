/**
 * Genera el PDF anual del cuadrante: una página con los 12 meses coloreados igual
 * que la Agenda, y otra con el Resumen del año.
 *
 * TODO ocurre en el dispositivo. No toca Firestore ni Storage: los turnos y las
 * estadísticas ya están cargados en memoria para pintar la app, así que el PDF no
 * cuesta ni una lectura.
 *
 * `jspdf` se importa DINÁMICAMENTE a propósito: son ~350 KB que solo descarga quien
 * pulsa el botón. Meterlo en el bundle principal se lo cobraría a todo el mundo,
 * incluido quien no exporte nunca.
 */
import { getFormattedDate } from '../utils/dateUtils';
import { isHoliday } from '../utils/holidayUtils';

// Los MISMOS colores que pinta CalendarGrid en pantalla. Si allí cambia un tono,
// aquí hay que cambiarlo también: es lo que hace que el PDF se reconozca como "mi
// agenda" y no como una tabla cualquiera.
const COLOR = {
  manana:   [167, 243, 212],  // #a7f3d0
  tarde:    [152, 203,  94],  // #98cb5e
  ha:       [ 76, 184, 204],  // #4cb8cc
  ausencia: [216, 180, 254],  // #d8b4fe  vacaciones y baja
  calidad:  [254, 240, 138],  // #fef08a
  descanso: [251, 191,  36],  // #fbbf24  barra, no relleno
  festivo:  [241, 245, 249],  // #f1f5f9
  verde:    [  4, 120,  87],
  texto:    [ 71,  85, 105],
  suave:    [148, 163, 184],
  borde:    [226, 232, 240],
  domingo:  [225,  29,  72],
};

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const DIAS_SEMANA = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

/** Lunes=0 … Domingo=6, que es como se ordena la cuadrícula (getDay() da domingo=0). */
const diaSemanaLunes = (fecha) => (fecha.getDay() + 6) % 7;

const horasLegibles = (decimal) => {
  const total = Math.round((decimal || 0) * 60);
  return `${Math.floor(total / 60)} h ${String(total % 60).padStart(2, '0')} m`;
};

/**
 * Decide con qué se pinta un día. Réplica de la lógica de DayCell: mismo orden de
 * prioridades (turno por encima de festivo, calidad por encima de descanso normal).
 */
function pintarDia(shiftsMap, anio, mes, dia, user) {
  const fecha = new Date(anio, mes, dia);
  const clave = getFormattedDate(fecha);
  const s = shiftsMap[clave];
  const esFestivo = isHoliday(clave, user);

  if (s?.type === 'work') {
    if (s.isHA) return { relleno: COLOR.ha, festivo: esFestivo };
    if (s.turn === 'afternoon') return { relleno: COLOR.tarde, festivo: esFestivo };
    return { relleno: COLOR.manana, festivo: esFestivo };
  }
  if (s?.type === 'vacation' || s?.type === 'sick') {
    return { relleno: COLOR.ausencia, festivo: esFestivo };
  }
  if (s?.type === 'rest') {
    // Finde de calidad: el mismo criterio que la agenda (sábado+domingo libres, y el
    // lunes cuenta si los dos anteriores lo estaban).
    const libreEn = (offset) => shiftsMap[getFormattedDate(new Date(anio, mes, dia + offset))]?.type === 'rest';
    const dow = fecha.getDay();
    let esCalidad = false;
    if (dow === 6) esCalidad = libreEn(1);
    else if (dow === 0) esCalidad = libreEn(-1);
    else if (dow === 1) esCalidad = libreEn(-1) && libreEn(-2);
    if (esCalidad) return { relleno: COLOR.calidad, festivo: esFestivo };
    return { barra: COLOR.descanso, festivo: esFestivo };
  }
  if (esFestivo) return { festivo: esFestivo, soloFestivo: true };
  return {};
}

/** Dibuja un mes en miniatura con su rejilla de días. */
function dibujarMes(doc, x, y, ancho, alto, anio, mes, shiftsMap, user) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...COLOR.verde);
  doc.text(MESES[mes], x, y + 3);

  const celdaW = ancho / 7;
  const celdaH = (alto - 8) / 7;
  const y0 = y + 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5);
  doc.setTextColor(...COLOR.suave);
  DIAS_SEMANA.forEach((d, i) => {
    doc.text(d, x + i * celdaW + celdaW / 2, y0 + 2.2, { align: 'center' });
  });

  const primerDow = diaSemanaLunes(new Date(anio, mes, 1));
  const diasDelMes = new Date(anio, mes + 1, 0).getDate();

  let fila = 0;
  for (let dia = 1; dia <= diasDelMes; dia++) {
    const dow = (primerDow + dia - 1) % 7;
    if (dia > 1 && dow === 0) fila++;

    const cx = x + dow * celdaW;
    const cy = y0 + 3 + fila * celdaH;
    const estilo = pintarDia(shiftsMap, anio, mes, dia, user);

    if (estilo.relleno) {
      doc.setFillColor(...estilo.relleno);
      doc.rect(cx + 0.2, cy + 0.2, celdaW - 0.4, celdaH - 0.4, 'F');
    } else if (estilo.festivo) {
      doc.setFillColor(...COLOR.festivo);
      doc.rect(cx + 0.2, cy + 0.2, celdaW - 0.4, celdaH - 0.4, 'F');
    }

    // Festivo CON turno encima: una diagonal sobre el color, que es como se
    // distingue en pantalla (allí es un rayado; aquí una línea basta al tamaño
    // de la miniatura y no ensucia el número).
    if (estilo.festivo && estilo.relleno) {
      doc.setDrawColor(...COLOR.domingo);
      doc.setLineWidth(0.15);
      doc.line(cx + 0.4, cy + celdaH - 0.4, cx + celdaW - 0.4, cy + 0.4);
    }

    if (estilo.barra) {
      doc.setFillColor(...estilo.barra);
      const ancho70 = (celdaW - 0.4) * 0.7;
      doc.rect(cx + (celdaW - ancho70) / 2, cy + celdaH - 1.1, ancho70, 0.5, 'F');
    }

    const esDomingo = dow === 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.5);
    doc.setTextColor(...(esDomingo ? COLOR.domingo : COLOR.texto));
    doc.text(String(dia), cx + celdaW / 2, cy + celdaH * 0.62, { align: 'center' });
  }
}

/** Cabecera verde de página, la de la app. */
function cabecera(doc, titulo, subtitulo) {
  doc.setFillColor(...COLOR.verde);
  doc.rect(0, 0, 297, 22, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(titulo, 10, 12);
  if (subtitulo) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(subtitulo, 10, 18);
  }
}

function paginaResumen(doc, anio, stats) {
  doc.addPage();
  cabecera(doc, `Resumen del año ${anio}`);

  // Los objetivos son los del convenio (COMPANY_RULES) o los que el usuario escribió
  // a mano. Quien no tenga ninguno —empresa de fuera de ANGED sin rellenarlos— ve el
  // contador a secas, igual que el Resumen de la app hace con StatCounter.
  const objetivos = stats?.targets || {};
  const conObjetivo = (valor, objetivo) => (objetivo ? `${valor} / ${objetivo}` : String(valor));

  const tarjetas = [
    ['Horas totales', objetivos.horas ? `${horasLegibles(stats?.horasTotales)} / ${objetivos.horas} h` : horasLegibles(stats?.horasTotales), COLOR.verde],
    ['Días trabajados', conObjetivo(stats?.diasTrabajados ?? 0, objetivos.trabajados), COLOR.tarde],
    ['Días HA', conObjetivo(stats?.contadorHA ?? 0, objetivos.ha), COLOR.ha],
    ['Días libres', conObjetivo(stats?.diasLibres ?? 0, objetivos.libres), COLOR.descanso],
    ['Domingos y festivos', conObjetivo(stats?.domingosCount ?? 0, objetivos.domingos), COLOR.domingo],
    ['Findes de calidad', conObjetivo(stats?.findesCalidad ?? 0, objetivos.calidad), COLOR.calidad],
    ['Cortos · largos', `${stats?.findesCalidadCorto ?? 0} · ${stats?.findesCalidadLargo ?? 0}`, COLOR.calidad],
    ['Vacaciones', String(stats?.vacacionesCount ?? 0), COLOR.ausencia],
  ];

  const anchoT = 88;
  const altoT = 30;
  tarjetas.forEach(([etiqueta, valor, color], i) => {
    const col = i % 3;
    const fila = Math.floor(i / 3);
    const x = 10 + col * (anchoT + 6);
    const y = 32 + fila * (altoT + 6);

    doc.setDrawColor(...COLOR.borde);
    doc.setLineWidth(0.2);
    doc.rect(x, y, anchoT, altoT, 'D');
    doc.setFillColor(...color);
    doc.rect(x, y, 3, altoT, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...COLOR.suave);
    doc.text(etiqueta.toUpperCase(), x + 8, y + 9);

    doc.setFontSize(16);
    doc.setTextColor(...COLOR.texto);
    doc.text(valor, x + 8, y + 22);
  });

  // Sin esta nota, alguien podría presentarlo como si fuera un parte de la empresa.
  // Las horas de los días editados a mano las declara el propio trabajador.
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.setTextColor(...COLOR.suave);
  doc.text(
    doc.splitTextToSize(
      'Registro personal generado por el usuario a partir de su cuadrante en la app Mi Cuadrante. ' +
      'No sustituye ni equivale a un documento oficial de la empresa.',
      270
    ),
    10, 32 + 3 * (altoT + 6) + 4
  );
}

function leyenda(doc, y) {
  const items = [
    [COLOR.manana, 'Mañana'],
    [COLOR.tarde, 'Tarde'],
    [COLOR.ha, 'Día HA'],
    [COLOR.ausencia, 'Vacaciones / Baja'],
    [COLOR.calidad, 'Finde de calidad'],
    [COLOR.descanso, 'Descanso'],
    [COLOR.festivo, 'Festivo'],
  ];
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  let x = 10;
  items.forEach(([color, texto]) => {
    doc.setFillColor(...color);
    doc.rect(x, y, 3, 3, 'F');
    doc.setTextColor(...COLOR.texto);
    doc.text(texto, x + 4.5, y + 2.4);
    x += 38;
  });
}

/**
 * Construye el PDF y lo devuelve como Blob.
 * @param {number} anio
 * @param {Object} shiftsMap  índice 'YYYY-MM-DD' -> turno
 * @param {Object} user       perfil (para festivos de su centro y objetivos)
 * @param {Object} stats      salida de computeShiftStats para ESE año
 */
export async function construirPdfAnual({ anio, shiftsMap, user, stats }) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  const quien = [user?.fullName, user?.store, user?.rank].filter(Boolean).join('  ·  ');
  cabecera(doc, `Mi Cuadrante · Agenda anual ${anio}`, quien);

  const COLS = 4;
  const FILAS = 3;
  const margenX = 10;
  const margenY = 27;
  const gapX = 4;
  const gapY = 3;
  const anchoMes = (297 - 2 * margenX - (COLS - 1) * gapX) / COLS;
  const altoMes = (210 - margenY - 22 - (FILAS - 1) * gapY) / FILAS;

  for (let mes = 0; mes < 12; mes++) {
    const col = mes % COLS;
    const fila = Math.floor(mes / COLS);
    dibujarMes(
      doc,
      margenX + col * (anchoMes + gapX),
      margenY + fila * (altoMes + gapY),
      anchoMes, altoMes, anio, mes, shiftsMap, user
    );
  }

  leyenda(doc, margenY + FILAS * (altoMes + gapY) - 2);
  paginaResumen(doc, anio, stats);

  return doc.output('blob');
}

export const nombreFichero = (anio, user) => {
  // Solo el nombre de pila y sin acentos: el fichero acaba en WhatsApp, en Drive o
  // en un adjunto de correo, y no todos tratan bien los espacios ni las tildes.
  const pila = (user?.fullName || 'cuadrante').trim().split(/\s+/)[0].toLowerCase();
  const limpio = pila.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '') || 'cuadrante';
  return `mi-cuadrante-${limpio}-${anio}.pdf`;
};
