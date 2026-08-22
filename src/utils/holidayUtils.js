import { getFestivosComunes, hasKnownConvenio } from '../constants/config';
import { MUNICIPAL_HOLIDAYS, resolveUserCity } from '../constants/stores';

/**
 * Checks if a given date is a holiday (Common or Municipal).
 * @param {string} date - Date in YYYY-MM-DD or MM-DD format.
 * @param {Object} [user] - Perfil del usuario. Los de ANGED tienen festivos de
 *   Madrid + los municipales de su tienda; los de fuera, solo los nacionales.
 * @returns {string|null} - The name of the holiday if it is one, otherwise null.
 */
export const getHolidayName = (date, user) => {
  const parts = date.split('-');
  let m_d;
  if (parts.length === 3) {
    m_d = `${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
  } else {
    m_d = `${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
  }

  // 1. Festivos comunes (todos los de Madrid, o solo los nacionales si el
  //    usuario trabaja en una empresa de la que no sabemos ni la comunidad).
  const comunes = getFestivosComunes(user);
  if (comunes[m_d]) {
    return comunes[m_d];
  }

  // 2. Municipales: solo para quien tiene una tienda de ANGED de la que
  //    heredar el municipio. Los de fuera se quedan con los nacionales.
  if (!hasKnownConvenio(user)) return null;
  const city = resolveUserCity(user);
  if (city && MUNICIPAL_HOLIDAYS[city]?.[m_d]) {
    return MUNICIPAL_HOLIDAYS[city][m_d];
  }

  return null;
};

export const isHoliday = (date, user) => {
  return Boolean(getHolidayName(date, user));
};

/**
 * Gets all holidays for a specific month, combining common and municipal.
 */
export const getMonthHolidays = (year, month, user) => {
  const mStr = (month + 1).toString().padStart(2, '0');
  const holidays = [];

  // Common
  Object.entries(getFestivosComunes(user)).forEach(([dateStr, name]) => {
    if (dateStr.startsWith(mStr + '-')) {
      holidays.push({ date: dateStr, name, type: 'common' });
    }
  });

  // Municipal (solo usuarios de ANGED, ver getHolidayName)
  const city = hasKnownConvenio(user) ? resolveUserCity(user) : null;
  if (city && MUNICIPAL_HOLIDAYS[city]) {
    Object.entries(MUNICIPAL_HOLIDAYS[city]).forEach(([dateStr, name]) => {
      if (dateStr.startsWith(mStr + '-')) {
        // Avoid duplicates if a municipal holiday overlaps with a common one (unlikely but safe)
        if (!holidays.find(h => h.date === dateStr)) {
          holidays.push({ date: dateStr, name, type: 'local' });
        }
      }
    });
  }

  return holidays.sort((a, b) => parseInt(a.date.split('-')[1]) - parseInt(b.date.split('-')[1]));
};
