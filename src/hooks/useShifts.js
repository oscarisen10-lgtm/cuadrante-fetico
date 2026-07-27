import { useMemo } from 'react';
import { getFormattedDate } from '../utils/dateUtils';
import { CONFIG, COMPANY_RULES, tieneFindeLargoDe4Dias } from '../constants/config';
import { isHoliday } from '../utils/holidayUtils';

/**
 * Cálculo PURO de las estadísticas del convenio a partir de los turnos. Se extrae del
 * hook para poder testearlo sin React (ver tests/unit/shiftStats.test.js). No usa estado
 * ni efectos: mismas entradas → misma salida.
 * @param {Array} shifts   Turnos [{date:'YYYY-MM-DD', type, hours, isHA}]
 * @param {Object} shiftsMap  Índice date -> turno (para los findes de calidad)
 * @param {Object} user     Perfil (company, rank, store)
 * @param {Date} [now]      Fecha de referencia (inyectable para tests deterministas)
 */
export const computeShiftStats = (shifts, shiftsMap, user, now = new Date()) => {
  let horasTotalesDecimal = 0;
  let contadorHA = 0;
  let vacacionesCount = 0;
  let findesCalidad = 0;
  let findesCalidadCorto = 0;
  let findesCalidadLargo = 0;
  let domingosCount = 0;
  let diasTrabajados = 0;
  let diasLibres = 0;

  shifts.forEach(s => {
    if (s.type === 'work') {
      diasTrabajados += 1;
      horasTotalesDecimal += s.hours;
      if (s.isHA) contadorHA += 1;
      const [y, m, d] = s.date.split('-');
      const dayOfWeek = new Date(y, m - 1, d).getDay();
      const isHolidayDay = isHoliday(s.date, user?.store);
      if (dayOfWeek === 0 || isHolidayDay) domingosCount += 1;
    }
    if (s.type === 'vacation') vacacionesCount += 1;
    if (s.type === 'rest') diasLibres += 1;
  });

  const year = now.getFullYear();
  const start = new Date(year, 0, 1);
  const end = now;
  // Algunos puestos (coordinadores de frescos, jefes) tienen finde de calidad largo de
  // 4 días (sábado + domingo + lunes + martes). El resto, de 3 (hasta el lunes).
  const findeLargo4Dias = tieneFindeLargoDe4Dias(user?.rank || "Personal de fresco");
  let current = new Date(start);
  while (current <= end) {
    if (current.getDay() === 6) {
      const satStr = getFormattedDate(current);
      const sunDate = new Date(current);
      sunDate.setDate(current.getDate() + 1);
      const sunStr = getFormattedDate(sunDate);
      const monDate = new Date(current);
      monDate.setDate(current.getDate() + 2);
      const monStr = getFormattedDate(monDate);
      const satS = shiftsMap[satStr];
      const sunS = shiftsMap[sunStr];
      const monS = shiftsMap[monStr];
      if (satS?.type === 'rest' && sunS?.type === 'rest') {
        findesCalidad++;
        const lunesLibre = monS?.type === 'rest';
        let esLargo = lunesLibre;
        if (findeLargo4Dias) {
          // Estos puestos exigen también el martes libre para el finde largo.
          const tueDate = new Date(current);
          tueDate.setDate(current.getDate() + 3);
          const tueS = shiftsMap[getFormattedDate(tueDate)];
          esLargo = lunesLibre && tueS?.type === 'rest';
        }
        if (esLargo) {
          findesCalidadLargo++;
        } else {
          findesCalidadCorto++;
        }
      }
    }
    current.setDate(current.getDate() + 1);
  }

  const company = user?.company || "Supercor";
  const rank = user?.rank || "Personal de fresco";
  const userRules = COMPANY_RULES[company]?.[rank] || COMPANY_RULES["Supercor"]["Personal de fresco"];

  return {
    horasTotales: horasTotalesDecimal,
    contadorHA,
    findesCalidad,
    findesCalidadCorto,
    findesCalidadLargo,
    vacacionesCount,
    domingosCount,
    diasTrabajados,
    diasLibres,
    targets: userRules
  };
};

export const useShifts = (shifts, user) => {
  const shiftsMap = useMemo(() => {
    const map = {};
    shifts.forEach(s => { map[s.date] = s; });
    return map;
  }, [shifts]);

  const stats = useMemo(
    () => computeShiftStats(shifts, shiftsMap, user),
    [shifts, shiftsMap, user]
  );

  return { shiftsMap, stats };
};
