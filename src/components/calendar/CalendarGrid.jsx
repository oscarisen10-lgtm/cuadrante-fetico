import React, { memo } from 'react';
import { getFormattedDate } from '../../utils/dateUtils';
import { isHoliday } from '../../utils/holidayUtils';

/**
 * DayCell — An individual day rendered in the calendar grid.
 * Memoized to prevent re-renders when other days change.
 */
export const DayCell = memo(function DayCell({ d, targetYear, targetMonth, shiftsMap, isSmall, selectedDates, onDayClick, onDayDoubleClick, userStore }) {
  const dStr = getFormattedDate(new Date(targetYear, targetMonth, d));
  const s = shiftsMap[dStr];
  const dayOfWeek = new Date(targetYear, targetMonth, d).getDay();
  
  let style = isSmall ? "bg-slate-50 text-slate-400" : "bg-slate-50 text-slate-400 hover:bg-slate-100";
  let inlineStyle = {};
  let label = "";
  
  const isDayHoliday = isHoliday(`${(targetMonth + 1).toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`, userStore);
  if (isDayHoliday) {
    style = isSmall ? "text-rose-600 opacity-100" : "text-rose-600 hover:opacity-80 ring-1 ring-slate-100 ring-inset";
    inlineStyle = { background: isSmall ? "repeating-linear-gradient(45deg, transparent, transparent 2px, #f1f5f9 2px, #f1f5f9 4px)" : "repeating-linear-gradient(45deg, transparent, transparent 4px, #f1f5f9 4px, #f1f5f9 8px)" };
    label = isSmall ? "" : "Fes";
  }
  
  // --- Determine the shift type and visual representation ---
  let colorBottom = "";
  let colorTop = "";
  let isQuality = false;
  let isRest = false; // NEW: flag to render rest as a bar instead of filled bg
  let restBarColor = ""; // NEW: the color for the rest bar
  
  if (s?.type === 'work') { 
    if (s.isHA) {
      colorBottom = colorTop = "#4cb8cc";
    } else if (s.turn === 'morning') {
      colorBottom = colorTop = "#a7f3d0";
    } else if (s.turn === 'afternoon') {
      colorBottom = colorTop = "#98cb5e";
    } else {
      colorBottom = colorTop = "#a7f3d0"; 
    }
    style = "text-slate-800";
    label = isSmall ? "" : `${Math.floor(s.hours)}h`; 
  }
  else if (s?.type === 'vacation' || s?.type === 'sick') { 
    colorBottom = colorTop = "#d8b4fe";
    style = "text-slate-800"; 
    label = isSmall ? "" : (s.type === 'sick' ? "Baj" : "Vac"); 
  }
  else if (s?.type === 'rest') {
    if (dayOfWeek === 6 || dayOfWeek === 0) {
      const isSat = dayOfWeek === 6;
      const partner = shiftsMap[getFormattedDate(new Date(targetYear, targetMonth, isSat ? d+1 : d-1))];
      if (partner?.type === 'rest') { 
        // QUALITY WEEKEND — solid fill with the old "rest" yellow color, NO stripes
        isQuality = true;
        colorBottom = colorTop = "#fef08a";
        label = isSmall ? "" : "Cal"; 
      }
      else { 
        // Regular rest on weekend — render as bar
        isRest = true;
        restBarColor = "#fbbf24"; // amber bar matching calidad style
        label = isSmall ? "" : "Lib"; 
      }
    } else {
      // Rest on weekday — render as bar
      isRest = true;
      restBarColor = "#fbbf24"; // amber bar matching calidad style
      label = isSmall ? "" : "Lib";
    }
    style = "text-slate-800";
  }

  // --- Build inline styles for filled backgrounds (work, vacation, quality) ---
  if (!isRest && colorBottom && !isDayHoliday && !isQuality) {
    inlineStyle = { background: `linear-gradient(to top, ${colorBottom} 0%, ${colorTop} 50%, transparent 100%)` };
  } else if (!isRest && colorBottom && isDayHoliday) {
    // Holiday + shift overlap: stripes
    const stripeColor = "rgba(255,255,255,0.5)";
    const stripeSize = isSmall ? "2px" : "4px";
    inlineStyle = { 
      background: `repeating-linear-gradient(45deg, transparent, transparent ${stripeSize}, ${stripeColor} ${stripeSize}, ${stripeColor} ${parseInt(stripeSize)*2}px), linear-gradient(to top, ${colorBottom} 0%, ${colorTop} 50%, transparent 100%)`
    };
  } else if (!isRest && colorBottom && isQuality) {
    // Quality weekend: solid fill, NO stripes
    inlineStyle = { background: `linear-gradient(to top, ${colorBottom} 0%, ${colorTop} 50%, transparent 100%)` };
  }

  const isSelected = selectedDates?.includes(dStr);
  const dayNumber = dayOfWeek === 0 ? <span className="text-rose-600">{d}</span> : d;

  // --- SMALL (yearly view) ---
  if (isSmall) {
    return (
      <div 
        className={`flex flex-col items-center justify-center rounded-[2px] ${style} ${isDayHoliday ? 'ring-1 ring-slate-300 ring-inset' : ''} h-3.5 w-full opacity-90 text-[6px] relative`} 
        style={isRest ? {} : inlineStyle}
        aria-label={`Día ${d}, ${s?.type || 'sin registro'}`}
      >
        {dayNumber}
        {/* Rest bar for small view */}
        {isRest && (
          <div 
            className="absolute bottom-0 left-[15%] right-[15%] rounded-full" 
            style={{ height: '1.5px', backgroundColor: restBarColor }}
          />
        )}
      </div>
    );
  }

  // --- NORMAL (monthly view) ---
  return (
    <button 
      onClick={() => onDayClick(dStr)} 
      onDoubleClick={() => onDayDoubleClick(dStr)}
      className={`flex flex-col items-center justify-center rounded-xl font-bold relative transition-all active:scale-95 ${isSelected ? 'ring-4 ring-emerald-400 bg-white scale-90 z-10 shadow-lg' : style} ${isDayHoliday && !isSelected ? 'ring-2 ring-slate-300 ring-inset' : ''} h-11 sm:h-12 w-full text-[11px]`}
      style={isSelected ? {} : (isRest ? {} : inlineStyle)}
      aria-label={`Día ${d}, ${label || 'sin registro'}. ${isSelected ? 'Seleccionado' : ''}`}
      aria-pressed={isSelected}
      role="gridcell"
    >
      {dayNumber}
      {/* Label for non-rest shifts */}
      {!isRest && <span className="text-[6px] uppercase leading-none mt-0.5 font-bold">{label}</span>}
      {/* Rest bar — a colored line below the number */}
      {isRest && !isSelected && (
        <div 
          className="absolute bottom-1.5 left-[12%] right-[12%] rounded-full" 
          style={{ height: '3.5px', backgroundColor: restBarColor }}
        />
      )}
    </button>
  );
});

/**
 * MonthGrid — Renders the full grid of days for a single month.
 */
export const MonthGrid = memo(function MonthGrid({ targetYear, targetMonth, shiftsMap, isSmall, selectedDates, onDayClick, onDayDoubleClick, userStore }) {
  const days = [];
  const startOffset = (new Date(targetYear, targetMonth, 1).getDay() || 7) - 1;
  const daysInMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
  
  for (let i = 0; i < startOffset; i++) {
    days.push(<div key={`e-${i}`} role="gridcell" aria-hidden="true"></div>);
  }
  
  for (let d = 1; d <= daysInMonth; d++) {
    days.push(
      <DayCell 
        key={d} 
        d={d} 
        targetYear={targetYear} 
        targetMonth={targetMonth} 
        shiftsMap={shiftsMap} 
        isSmall={isSmall}
        selectedDates={selectedDates}
        onDayClick={onDayClick}
        onDayDoubleClick={onDayDoubleClick}
        userStore={userStore}
      />
    );
  }
  
  return <>{days}</>;
});

/**
 * WeekdayHeader — The L M X J V S D header row.
 */
export function WeekdayHeader({ isSmall = false }) {
  const days = ['L','M','X','J','V','S','D'];
  return days.map(d => (
    <div 
      key={d} 
      className={`text-center font-black text-slate-${isSmall ? '400' : '300'} ${isSmall ? 'text-[6px] mb-0.5' : 'text-[10px] py-1'}`}
      role="columnheader"
      aria-label={d === 'L' ? 'Lunes' : d === 'M' ? 'Martes' : d === 'X' ? 'Miércoles' : d === 'J' ? 'Jueves' : d === 'V' ? 'Viernes' : d === 'S' ? 'Sábado' : 'Domingo'}
    >
      {d}
    </div>
  ));
}
