import { X } from 'lucide-react';
import { getFormattedDate } from '../../utils/dateUtils';

/**
 * DateDetailPanel — Shows details and action buttons for selected dates.
 */
export function DateDetailPanel({ selectedDates, shiftsMap, setSelectedDates, markMulti, openEditHours, openBaja, deleteSelectedDates }) {
  if (selectedDates.length === 0) return null;

  let dObj, statusText, statusColor, hoursText;
  
  if (selectedDates.length === 1) {
    const dateStr = selectedDates[0];
    const [y, m, d] = dateStr.split('-');
    dObj = new Date(y, m - 1, d);
    const s = shiftsMap[dateStr];
    const dayOfWeek = dObj.getDay();

    let isQuality = false;
    if (s?.type === 'rest') {
      const restOn = (offset) => shiftsMap[getFormattedDate(new Date(y, m - 1, parseInt(d) + offset))]?.type === 'rest';
      if (dayOfWeek === 6) isQuality = restOn(1);                    // sábado: domingo libre
      else if (dayOfWeek === 0) isQuality = restOn(-1);              // domingo: sábado libre
      else if (dayOfWeek === 1) isQuality = restOn(-1) && restOn(-2); // lunes: sábado y domingo libres
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
      // Una baja guarda la jornada que TENÍAS PROGRAMADA, así que si llevaba horas
      // se enseñan (son las que cuentan para el cómputo anual). Si el cuadrante te
      // daba libre ese día, se dice así en vez de mostrar "0h 0m".
      statusText = s.isHA ? "BAJA · DÍA HA" : "BAJA LABORAL";
      statusColor = "bg-purple-100 text-purple-700 border-purple-200";
      hoursText = s.turn === 'rest' ? "Libre" : `${Math.floor(s.hours || 0)}h ${Math.round(((s.hours || 0) % 1) * 60)}m`;
    } else if (s?.type === 'rest') {
      statusText = isQuality ? "CALIDAD" : "DESCANSO";
      statusColor = isQuality ? "bg-green-100 text-green-700 border-green-200" : "bg-amber-100 text-amber-700 border-amber-200";
      hoursText = "Libre";
    }
  } else {
    let sumHours = 0;
    selectedDates.forEach(date => {
      const s = shiftsMap[date];
      // Las bajas suman igual que las jornadas: sus horas son las que el cuadrante
      // tenía programadas y cuentan para el cómputo anual (ver computeShiftStats).
      if (s?.type === 'work' || s?.type === 'sick') sumHours += (s.hours || 0);
    });
    statusText = "SELECCIÓN MÚLTIPLE";
    statusColor = "bg-indigo-100 text-indigo-700 border-indigo-200";
    hoursText = sumHours > 0 ? `${Math.floor(sumHours)}h ${Math.round((sumHours % 1) * 60)}m` : "Varios";
  }

  const tipoConHoras = (t) => t === 'work' || t === 'sick';
  const isHoursHighlighted = (selectedDates.length === 1 && tipoConHoras(shiftsMap[selectedDates[0]]?.type)) ||
                             (selectedDates.length > 1 && hoursText !== "Varios");

  return (
    <div className="animate-decay-bounce">
      {/* data-tour: lo ilumina el tutorial, que selecciona un día para poder
          enseñar esta ficha (ver constants/screenTips). */}
      <div data-tour="cal-panel" className="rounded-[2rem] p-6 flex flex-col shrink-0 animate-in zoom-in-95 duration-300" role="region" aria-label="Detalle de fechas seleccionadas" style={{ background: 'linear-gradient(180deg,#ffffff,#f6f8fa)', boxShadow: '0 20px 48px -18px rgba(5,80,60,0.35), inset 0 1.5px 1px rgba(255,255,255,0.9)', border: '1px solid rgba(16,185,129,0.18)' }}>
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
        
        <div className="flex items-center justify-between p-5 rounded-2xl mb-6" style={{ background: 'linear-gradient(180deg,#f8fafc,#eef1f5)', boxShadow: 'inset 0 2px 4px rgba(15,23,42,0.06), inset 0 -1px 0 rgba(255,255,255,0.8)', border: '1px solid rgba(15,23,42,0.05)' }}>
          <div className={`px-4 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest border ${statusColor}`}>{statusText}</div>
          <div className={`text-3xl font-black font-mono ${isHoursHighlighted ? 'text-slate-800' : 'text-slate-400'}`}>{hoursText}</div>
        </div>

        {/* "Ajustar Horas" ocupa la fila entera y va la primera: es la acción del
            día a día, la que se usa de verdad. Debajo, en dos columnas, los tipos de
            día que se marcan de golpe (Día Libre / Vacaciones) y, en la última fila,
            Baja y el borrado, que son los casos raros. */}
        <div className="grid grid-cols-2 gap-3 animate-in fade-in duration-300" role="toolbar" aria-label="Acciones para las fechas seleccionadas">
          <button onClick={() => openEditHours(selectedDates[0])} className="btn3d col-span-2 text-white py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest" style={{ background: 'linear-gradient(180deg,#3b82f6,#2563eb)', boxShadow: '0 6px 14px rgba(37,99,235,0.4), inset 0 1.5px 1px rgba(255,255,255,0.4)' }} aria-label="Ajustar horas trabajadas">Ajustar Horas</button>
          <button onClick={() => markMulti('rest')} className="btn3d text-white py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest" style={{ background: 'linear-gradient(180deg,#fbbf24,#d97706)', boxShadow: '0 6px 14px rgba(217,119,6,0.4), inset 0 1.5px 1px rgba(255,255,255,0.45)' }} aria-label="Marcar como día libre">Día Libre</button>
          <button onClick={() => markMulti('vacation')} className="btn3d text-white py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest" style={{ background: 'linear-gradient(180deg,#a855f7,#7c3aed)', boxShadow: '0 6px 14px rgba(124,58,237,0.4), inset 0 1.5px 1px rgba(255,255,255,0.4)' }} aria-label="Marcar como vacaciones">Vacaciones</button>
          {/* Morado SUAVE, hermano del de Vacaciones pero más claro: es una ausencia
              como aquella, pero no la misma cosa, y el texto va en morado oscuro
              porque sobre este tono el blanco no tendría contraste suficiente. */}
          <button onClick={() => openBaja(selectedDates[0])} className="btn3d py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest" style={{ background: 'linear-gradient(180deg,#e9d5ff,#d8b4fe)', color: '#6b21a8', boxShadow: '0 6px 14px rgba(168,85,247,0.25), inset 0 1.5px 1px rgba(255,255,255,0.7)' }} aria-label="Marcar como baja laboral y registrar la jornada programada">Baja</button>
          <button onClick={deleteSelectedDates} className="btn3d text-white py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest" style={{ background: 'linear-gradient(180deg,#fb7185,#e11d48)', boxShadow: '0 6px 14px rgba(225,29,72,0.4), inset 0 1.5px 1px rgba(255,255,255,0.4)' }} aria-label="Borrar registro de las fechas seleccionadas">Borrar Registro</button>
        </div>
      </div>
    </div>
  );
}
