import React from 'react';
import { X } from 'lucide-react';
import { getFormattedDate } from '../../utils/dateUtils';

/**
 * DateDetailPanel — Shows details and action buttons for selected dates.
 */
export function DateDetailPanel({ selectedDates, shiftsMap, setSelectedDates, markMulti, openEditHours, deleteSelectedDates }) {
  if (selectedDates.length === 0) return null;

  let dObj, statusText, statusColor, hoursText;
  
  if (selectedDates.length === 1) {
    const dateStr = selectedDates[0];
    const [y, m, d] = dateStr.split('-');
    dObj = new Date(y, m - 1, d);
    const s = shiftsMap[dateStr];
    const dayOfWeek = dObj.getDay();

    let isQuality = false;
    if (dayOfWeek === 6 || dayOfWeek === 0) {
      const isSat = dayOfWeek === 6;
      const partnerD = new Date(y, m - 1, isSat ? parseInt(d)+1 : parseInt(d)-1);
      const partnerStr = getFormattedDate(partnerD);
      const partnerS = shiftsMap[partnerStr];
      if (s?.type === 'rest' && partnerS?.type === 'rest') isQuality = true;
    }

    statusText = "Sin registro";
    statusColor = "bg-slate-100 text-slate-500";
    hoursText = "--";

    if (s?.type === 'work') {
      statusText = s.isHA ? "DÍA HA" : "TRABAJADO";
      statusColor = s.isHA ? "bg-cyan-100 text-cyan-700 border-cyan-200" : "bg-emerald-100 text-emerald-700 border-emerald-200";
      hoursText = `${Math.floor(s.hours)}h ${Math.round((s.hours % 1) * 60)}m`;
    } else if (s?.type === 'vacation') {
      statusText = "VACACIONES";
      statusColor = "bg-purple-100 text-purple-700 border-purple-200";
      hoursText = "Libre";
    } else if (s?.type === 'sick') {
      statusText = "BAJA LABORAL";
      statusColor = "bg-purple-100 text-purple-700 border-purple-200";
      hoursText = "Baja";
    } else if (s?.type === 'rest') {
      statusText = isQuality ? "CALIDAD" : "DESCANSO";
      statusColor = isQuality ? "bg-green-100 text-green-700 border-green-200" : "bg-amber-100 text-amber-700 border-amber-200";
      hoursText = "Libre";
    }
  } else {
    let sumHours = 0;
    selectedDates.forEach(date => {
      const s = shiftsMap[date];
      if (s?.type === 'work') sumHours += s.hours;
    });
    statusText = "SELECCIÓN MÚLTIPLE";
    statusColor = "bg-indigo-100 text-indigo-700 border-indigo-200";
    hoursText = sumHours > 0 ? `${Math.floor(sumHours)}h ${Math.round((sumHours % 1) * 60)}m` : "Varios";
  }

  const isHoursHighlighted = (selectedDates.length === 1 && shiftsMap[selectedDates[0]]?.type === 'work') || 
                             (selectedDates.length > 1 && hoursText !== "Varios");

  return (
    <div className="bg-white rounded-[2rem] p-6 shadow-2xl border-2 border-emerald-100 flex flex-col shrink-0 animate-in zoom-in-95 duration-300" role="region" aria-label="Detalle de fechas seleccionadas">
      <div className="flex justify-between items-start mb-6 pb-4 border-b border-slate-100">
        <div className="flex flex-col">
          {selectedDates.length === 1 && dObj ? (
            <>
              <span className="text-6xl font-black text-emerald-600 leading-none tracking-tighter">{dObj.getDate()}</span>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest capitalize mt-2">{dObj.toLocaleDateString('es-ES', { weekday: 'long', month: 'long' })}</span>
            </>
          ) : (
            <>
              <span className="text-6xl font-black text-emerald-600 leading-none tracking-tighter">{selectedDates.length}</span>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest capitalize mt-2">Días Seleccionados</span>
            </>
          )}
        </div>
        <button onClick={() => setSelectedDates([])} className="p-2.5 bg-slate-50 text-slate-300 rounded-full hover:bg-slate-200 transition-colors" aria-label="Deseleccionar fechas"><X size={24}/></button>
      </div>
      
      <div className="flex items-center justify-between bg-slate-50 p-5 rounded-2xl mb-6 border border-slate-100">
        <div className={`px-4 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest border ${statusColor}`}>{statusText}</div>
        <div className={`text-3xl font-black font-mono ${isHoursHighlighted ? 'text-slate-800' : 'text-slate-400'}`}>{hoursText}</div>
      </div>

      <div className="grid grid-cols-2 gap-3" role="toolbar" aria-label="Acciones para las fechas seleccionadas">
        <button onClick={() => markMulti('rest')} className="bg-amber-500 text-white py-4 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md active:scale-95 transition-all" aria-label="Marcar como día libre">Marcar Libre</button>
        <select 
           onChange={(e) => { if(e.target.value) { markMulti(e.target.value); e.target.value=""; } }}
           className="bg-purple-500 text-white py-4 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md transition-all text-center appearance-none cursor-pointer outline-none"
           defaultValue=""
           aria-label="Seleccionar tipo de ausencia"
        >
           <option value="" disabled className="text-center hidden">AUSENCIA ▼</option>
           <option value="vacation" className="text-slate-800 bg-white font-bold">Marcar Vacaciones</option>
           <option value="sick" className="text-slate-800 bg-white font-bold">Marcar Baja Laboral</option>
        </select>
        <button onClick={() => openEditHours(selectedDates[0])} className="bg-blue-600 text-white py-4 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md active:scale-95 transition-all" aria-label="Ajustar horas trabajadas">Ajustar Horas</button>
        <button onClick={deleteSelectedDates} className="bg-rose-500 text-white py-4 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md active:scale-95 transition-all" aria-label="Borrar registro de las fechas seleccionadas">Borrar Registro</button>
      </div>
    </div>
  );
}
