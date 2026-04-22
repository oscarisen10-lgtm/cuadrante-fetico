import { useMemo } from 'react';
import { getFormattedDate } from '../utils/dateUtils';
import { CONFIG } from '../constants/config';

export const useShifts = (shifts) => {
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

    shifts.forEach(s => {
      if (s.type === 'work') {
        horasTotalesDecimal += s.hours;
        if (s.isHA) contadorHA += 1;
        const [y, m, d] = s.date.split('-');
        const dayOfWeek = new Date(y, m - 1, d).getDay();
        const isHoliday = CONFIG.FESTIVOS?.includes(`${m}-${d}`);
        if (dayOfWeek === 0 || isHoliday) domingosCount += 1;
      }
      if (s.type === 'vacation') vacacionesCount += 1;
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
    return { horasTotales: horasTotalesDecimal, contadorHA, findesCalidad, vacacionesCount, domingosCount };
  }, [shifts, shiftsMap]);

  return { shiftsMap, stats };
};
