import { useMemo } from 'react';
import { getFormattedDate } from '../utils/dateUtils';
import { CONFIG, COMPANY_RULES } from '../constants/config';

export const useShifts = (shifts, user) => {
  const shiftsMap = useMemo(() => {
    const map = {};
    shifts.forEach(s => { map[s.date] = s; });
    return map;
  }, [shifts]);

  const stats = useMemo(() => {
    let horasTotalesDecimal = 0;
    let contadorHA = 0;
    let vacacionesCount = 0;
    let findesCalidad = 0;
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
        const isHoliday = Boolean(CONFIG.FESTIVOS?.[`${m}-${d}`]);
        if (dayOfWeek === 0 || isHoliday) domingosCount += 1;
      }
      if (s.type === 'vacation') vacacionesCount += 1;
      if (s.type === 'rest') diasLibres += 1;
    });

    const year = new Date().getFullYear();
    const start = new Date(year, 0, 1);
    const end = new Date();
    let current = new Date(start);
    while (current <= end) {
      if (current.getDay() === 6) { 
        const satStr = getFormattedDate(current);
        const sunDate = new Date(current);
        sunDate.setDate(current.getDate() + 1);
        const sunStr = getFormattedDate(sunDate);
        const satS = shiftsMap[satStr];
        const sunS = shiftsMap[sunStr];
        if (satS?.type === 'rest' && sunS?.type === 'rest') findesCalidad++;
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
      vacacionesCount, 
      domingosCount, 
      diasTrabajados, 
      diasLibres,
      targets: userRules
    };
  }, [shifts, shiftsMap, user]);

  return { shiftsMap, stats };
};
