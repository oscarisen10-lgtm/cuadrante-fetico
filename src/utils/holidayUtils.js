import { CONFIG } from '../constants/config';
import { STORES, MUNICIPAL_HOLIDAYS } from '../constants/stores';

/**
 * Checks if a given date is a holiday (Common or Municipal).
 * @param {string} date - Date in YYYY-MM-DD or MM-DD format.
 * @param {string} userStoreName - The name of the user's store.
 * @returns {string|null} - The name of the holiday if it is one, otherwise null.
 */
export const getHolidayName = (date, userStoreName) => {
  const parts = date.split('-');
  let m_d;
  if (parts.length === 3) {
    m_d = `${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
  } else {
    m_d = `${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
  }

  // 1. Check common holidays (Madrid)
  if (CONFIG.FESTIVOS?.[m_d]) {
    return CONFIG.FESTIVOS[m_d];
  }

  // 2. Check municipal holidays
  if (userStoreName) {
    const store = STORES.find(s => s.name === userStoreName);
    if (store && store.city && MUNICIPAL_HOLIDAYS[store.city]?.[m_d]) {
      return MUNICIPAL_HOLIDAYS[store.city][m_d];
    }
  }

  return null;
};

export const isHoliday = (date, userStoreName) => {
  return Boolean(getHolidayName(date, userStoreName));
};

/**
 * Gets all holidays for a specific month, combining common and municipal.
 */
export const getMonthHolidays = (year, month, userStoreName) => {
  const mStr = (month + 1).toString().padStart(2, '0');
  const holidays = [];

  // Common
  Object.entries(CONFIG.FESTIVOS || {}).forEach(([dateStr, name]) => {
    if (dateStr.startsWith(mStr + '-')) {
      holidays.push({ date: dateStr, name, type: 'common' });
    }
  });

  // Municipal
  if (userStoreName) {
    const store = STORES.find(s => s.name === userStoreName);
    if (store && store.city && MUNICIPAL_HOLIDAYS[store.city]) {
      Object.entries(MUNICIPAL_HOLIDAYS[store.city]).forEach(([dateStr, name]) => {
        if (dateStr.startsWith(mStr + '-')) {
          // Avoid duplicates if a municipal holiday overlaps with a common one (unlikely but safe)
          if (!holidays.find(h => h.date === dateStr)) {
            holidays.push({ date: dateStr, name, type: 'local' });
          }
        }
      });
    }
  }

  return holidays.sort((a, b) => parseInt(a.date.split('-')[1]) - parseInt(b.date.split('-')[1]));
};
