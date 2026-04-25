import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { getFormattedDate } from '../utils/dateUtils';
import { CONFIG } from '../constants/config';

export function CalendarView({ shifts, shiftsMap, saveToCloud }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState('mensual');
  const [selectedDates, setSelectedDates] = useState([]); 
  const [editingDay, setEditingDay] = useState(null); 
  const [editHH, setEditHH] = useState("0");
  const [editmm, setEditmm] = useState("0");
  const [editTurn, setEditTurn] = useState("morning");

  const openEditHours = (dateStr) => {
    const s = shiftsMap[dateStr];
    const totalHoursDecimal = (s?.type === 'work' && s.hours > 0) ? s.hours : 6.75;
    setEditingDay(dateStr);
    setEditHH(Math.floor(totalHoursDecimal).toString());
    setEditmm(Math.round((totalHoursDecimal % 1) * 60).toString());
    setEditTurn(s?.turn || 'morning');
    // Do not clear selectedDates here so we can apply to all
  };

  const saveEditedHours = () => {
    const hoursDecimal = (parseInt(editHH) || 0) + ((parseInt(editmm) || 0) / 60);
    const targetDates = selectedDates.length > 0 ? selectedDates : (editingDay ? [editingDay] : []);
    
    const filtered = shifts.filter(s => !targetDates.includes(s.date));
    
    const newEntries = targetDates.map((date, idx) => ({
      id: Date.now() + idx, 
      date: date, 
      type: 'work', 
      hours: hoursDecimal, 
      isHA: (hoursDecimal * 60) >= CONFIG.UMBRAL_DIA_HA_MINUTOS, 
      turn: editTurn 
    }));
    
    const newShifts = [...filtered, ...newEntries];
    
    setEditingDay(null);
    setSelectedDates([]);
    saveToCloud({ shifts: newShifts });
  };

  const markMulti = (type) => {
    const filtered = shifts.filter(s => !selectedDates.includes(s.date));
    const newEntries = selectedDates.map(date => ({ id: Math.random(), date, type, hours: 0, isHA: false }));
    const newShifts = [...filtered, ...newEntries];
    setSelectedDates([]);
    saveToCloud({ shifts: newShifts });
  };

  const deleteSelectedDates = () => {
    const newShifts = shifts.filter(s => !selectedDates.includes(s.date));
    setSelectedDates([]);
    saveToCloud({ shifts: newShifts });
  };

  const handleMinutesChange = (val) => {
    let m = parseInt(val) || 0;
    let h = parseInt(editHH) || 0;
    if (m >= 60) {
      setEditHH((h + Math.floor(m / 60)).toString());
      setEditmm((m % 60).toString().padStart(2, '0'));
    } else { setEditmm(val); }
  };

  const handleDayClick = (dateStr) => {
    if (selectedDates.includes(dateStr)) {
      setSelectedDates(selectedDates.filter(d => d !== dateStr));
    } else {
      setSelectedDates([...selectedDates, dateStr]);
    }
    setEditingDay(null);
  };

  const renderMonth = (targetYear, targetMonth, isSmall = false) => {
    const days = [];
    const startOffset = (new Date(targetYear, targetMonth, 1).getDay() || 7) - 1;
    const daysInMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
    for (let i = 0; i < startOffset; i++) days.push(<div key={`e-${i}`}></div>);
    for (let d = 1; d <= daysInMonth; d++) {
      const dStr = getFormattedDate(new Date(targetYear, targetMonth, d));
      const s = shiftsMap[dStr];
      const dayOfWeek = new Date(targetYear, targetMonth, d).getDay();
      let style = isSmall ? "bg-slate-50 text-slate-400" : "bg-slate-50 text-slate-400 hover:bg-slate-100";
      let inlineStyle = {};
      let label = "";
      
      const isHoliday = CONFIG.FESTIVOS?.includes(`${(targetMonth + 1).toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`);
      if (isHoliday) {
        style = isSmall ? "text-rose-600 opacity-100" : "text-rose-600 hover:opacity-80 ring-1 ring-slate-100 ring-inset";
        inlineStyle = { background: isSmall ? "repeating-linear-gradient(45deg, transparent, transparent 2px, #f1f5f9 2px, #f1f5f9 4px)" : "repeating-linear-gradient(45deg, transparent, transparent 4px, #f1f5f9 4px, #f1f5f9 8px)" };
        label = isSmall ? "" : "Fes";
      }
      
      let colorBottom = "";
      let colorTop = "";
      let isQuality = false;
      
      if (s?.type === 'work') { 
        if (s.isHA) {
          colorBottom = colorTop = "#4cb8cc"; // Cyan HA
        } else if (s.turn === 'morning') {
          colorBottom = colorTop = "#a7f3d0"; // Light green
        } else if (s.turn === 'afternoon') {
          colorBottom = colorTop = "#98cb5e"; // Soft green from new image
        } else {
          colorBottom = colorTop = "#a7f3d0"; 
        }
        style = "text-slate-800";
        label = isSmall ? "" : `${Math.floor(s.hours)}h`; 
      }
      else if (s?.type === 'vacation' || s?.type === 'sick') { 
        colorBottom = colorTop = "#d8b4fe"; // Purple
        style = "text-slate-800"; 
        label = isSmall ? "" : (s.type === 'sick' ? "Baj" : "Vac"); 
      }
      else if (s?.type === 'rest') {
        if (dayOfWeek === 6 || dayOfWeek === 0) {
          const isSat = dayOfWeek === 6;
          const partner = shiftsMap[getFormattedDate(new Date(targetYear, targetMonth, isSat ? d+1 : d-1))];
          if (partner?.type === 'rest') { 
            isQuality = true;
            colorBottom = colorTop = "#ffffff"; // White background for Quality
            label = isSmall ? "" : "Cal"; 
          } // Quality
          else { 
            colorBottom = colorTop = "#fef08a"; // New light pastel yellow
            label = isSmall ? "" : "Lib"; 
          } // Normal weekend rest
        } else {
          colorBottom = colorTop = "#fef08a"; // New light pastel yellow
          label = isSmall ? "" : "Lib";
        }
        style = "text-slate-800";
      }

      if (colorBottom && !isHoliday && !isQuality) {
        inlineStyle = { background: `linear-gradient(to top, ${colorBottom} 0%, ${colorTop} 50%, transparent 100%)` };
      } else if (colorBottom && (isHoliday || isQuality)) {
        if (isQuality && !isHoliday) {
          // Soft gray stripes for quality on white background
          const stripeColor = "rgba(0,0,0,0.06)"; // Soft gray
          inlineStyle = { 
            background: `repeating-linear-gradient(45deg, transparent, transparent 4px, ${stripeColor} 4px, ${stripeColor} 8px), linear-gradient(to top, ${colorBottom} 0%, ${colorTop} 50%, transparent 100%)`
          };
          if (isSmall) {
             inlineStyle = { 
              background: `repeating-linear-gradient(45deg, transparent, transparent 2px, ${stripeColor} 2px, ${stripeColor} 4px), linear-gradient(to top, ${colorBottom} 0%, ${colorTop} 50%, transparent 100%)`
            };
          }
        } else {
          // Sharp white stripes for holiday
          const stripeColor = "rgba(255,255,255,0.5)";
          inlineStyle = { 
            background: `repeating-linear-gradient(45deg, transparent, transparent 4px, ${stripeColor} 4px, ${stripeColor} 8px), linear-gradient(to top, ${colorBottom} 0%, ${colorTop} 50%, transparent 100%)`
          };
          if (isSmall) {
             inlineStyle = { 
              background: `repeating-linear-gradient(45deg, transparent, transparent 2px, ${stripeColor} 2px, ${stripeColor} 4px), linear-gradient(to top, ${colorBottom} 0%, ${colorTop} 50%, transparent 100%)`
            };
          }
        }
      }
      days.push(
        isSmall ? (
          <div key={d} className={`flex items-center justify-center rounded-[2px] ${style} ${isHoliday ? 'ring-1 ring-slate-300 ring-inset' : ''} h-3.5 w-full opacity-90 text-[6px]`} style={inlineStyle}>
            {dayOfWeek === 0 ? <span className="text-rose-600">{d}</span> : d}
          </div>
        ) : (
          <button key={d} onClick={() => handleDayClick(dStr)} onDoubleClick={() => openEditHours(dStr)}
            className={`flex flex-col items-center justify-center rounded-xl font-bold relative transition-all active:scale-95 ${selectedDates.includes(dStr) ? 'ring-4 ring-emerald-400 bg-white scale-90 z-10 shadow-lg' : style} ${isHoliday && !selectedDates.includes(dStr) ? 'ring-2 ring-slate-300 ring-inset' : ''} h-11 sm:h-12 w-full text-[11px]`}
            style={selectedDates.includes(dStr) ? {} : inlineStyle}>
            {dayOfWeek === 0 ? <span className="text-rose-600">{d}</span> : d}
            <span className="text-[6px] uppercase leading-none mt-0.5 font-bold">{label}</span>
          </button>
        )
      );
    }
    return days;
  };

  const renderSelectedDatesPanel = () => {
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
      <div className="bg-white rounded-[2rem] p-6 shadow-2xl border-2 border-emerald-100 flex flex-col shrink-0 animate-in zoom-in-95 duration-300">
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
          <button onClick={() => setSelectedDates([])} className="p-2.5 bg-slate-50 text-slate-300 rounded-full hover:bg-slate-200 transition-colors"><X size={24}/></button>
        </div>
        
        <div className="flex items-center justify-between bg-slate-50 p-5 rounded-2xl mb-6 border border-slate-100">
          <div className={`px-4 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest border ${statusColor}`}>{statusText}</div>
          <div className={`text-3xl font-black font-mono ${isHoursHighlighted ? 'text-slate-800' : 'text-slate-400'}`}>{hoursText}</div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => markMulti('rest')} className="bg-amber-500 text-white py-4 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md active:scale-95 transition-all">Marcar Libre</button>
          <select 
             onChange={(e) => { if(e.target.value) { markMulti(e.target.value); e.target.value=""; } }}
             className="bg-purple-500 text-white py-4 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md transition-all text-center appearance-none cursor-pointer outline-none"
             defaultValue=""
          >
             <option value="" disabled className="text-center hidden">AUSENCIA ▼</option>
             <option value="vacation" className="text-slate-800 bg-white font-bold">Marcar Vacaciones</option>
             <option value="sick" className="text-slate-800 bg-white font-bold">Marcar Baja Laboral</option>
          </select>
          <button onClick={() => openEditHours(selectedDates[0])} className="bg-blue-600 text-white py-4 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md active:scale-95 transition-all">Ajustar Horas</button>
          <button onClick={deleteSelectedDates} className="bg-rose-500 text-white py-4 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md active:scale-95 transition-all">Borrar Registro</button>
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="flex flex-col animate-in fade-in duration-300 gap-4 pb-20">
        <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden flex flex-col pb-2">
          
          <div className="flex justify-center p-3 bg-slate-50 border-b border-slate-100 gap-2 shrink-0">
             <button onClick={() => setViewMode('mensual')} className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'mensual' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-200 bg-white border border-slate-100'}`}>Mensual</button>
             <button onClick={() => setViewMode('anual')} className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'anual' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-200 bg-white border border-slate-100'}`}>Anual</button>
          </div>

          <div className="p-4 flex justify-between items-center bg-white border-b border-slate-100 shrink-0">
            <button onClick={() => {
              if (viewMode === 'mensual') setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
              else setCurrentDate(new Date(currentDate.getFullYear() - 1, currentDate.getMonth(), 1));
            }} className="p-1.5 hover:bg-slate-100 rounded-xl transition-colors text-emerald-600"><ChevronLeft size={22}/></button>
            
            <span className="text-base sm:text-lg font-black uppercase italic text-emerald-700 tracking-widest">
               {viewMode === 'mensual' ? currentDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }) : currentDate.getFullYear()}
            </span>
            
            <button onClick={() => {
              if (viewMode === 'mensual') setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
              else setCurrentDate(new Date(currentDate.getFullYear() + 1, currentDate.getMonth(), 1));
            }} className="p-1.5 hover:bg-slate-100 rounded-xl transition-colors text-emerald-600"><ChevronRight size={22}/></button>
          </div>
          
          {viewMode === 'mensual' ? (
            <div className="p-3 grid grid-cols-7 gap-1.5">
              {['L','M','X','J','V','S','D'].map(d=><div key={d} className="text-center text-[10px] font-black text-slate-300 py-1">{d}</div>)}
              {renderMonth(currentDate.getFullYear(), currentDate.getMonth(), false)}
            </div>
          ) : (
            <div className="p-3 grid grid-cols-3 gap-x-2 gap-y-4 pb-4">
              {Array.from({ length: 12 }).map((_, m) => (
                <div key={m} className="flex flex-col">
                   <h4 className="text-[8px] font-black uppercase text-slate-800 mb-1 text-center tracking-widest">{new Date(currentDate.getFullYear(), m, 1).toLocaleDateString('es-ES', { month: 'short' })}</h4>
                   <div className="grid grid-cols-7 gap-[2px]">
                     {['L','M','X','J','V','S','D'].map(d=><div key={`head-${m}-${d}`} className="text-center text-[6px] font-black text-slate-400 mb-0.5">{d}</div>)}
                     {renderMonth(currentDate.getFullYear(), m, true)}
                   </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {renderSelectedDatesPanel()}
      </div>

      {editingDay && (
        <div className="fixed inset-0 z-[110] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in">
          <div className="bg-white rounded-[2.5rem] p-8 shadow-2xl w-full max-w-xs animate-in zoom-in-95 flex flex-col">
            <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-3">
              <span className="text-xs font-black uppercase text-rose-600 italic tracking-widest">Ajuste Manual</span>
              <button onClick={() => setEditingDay(null)} className="p-2 bg-slate-50 rounded-full hover:bg-slate-200 text-slate-300"><X size={20}/></button>
            </div>
            <div className="flex items-center justify-center gap-4 mb-8 bg-slate-50 py-6 rounded-3xl text-slate-800 border border-slate-100 shadow-inner">
              <div className="flex flex-col items-center">
                  <span className="text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">Horas</span>
                  <input type="number" min="0" max="24" value={editHH} onChange={e=>setEditHH(e.target.value)} className="w-20 bg-white border border-slate-200 p-3 rounded-2xl text-center text-3xl font-black outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100 transition-all shadow-sm"/>
              </div>
              <span className="font-black text-4xl text-slate-300 mt-6">:</span>
              <div className="flex flex-col items-center">
                  <span className="text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">Minutos</span>
                  <input type="number" min="0" max="59" value={editmm} onChange={e=>handleMinutesChange(e.target.value)} className="w-20 bg-white border border-slate-200 p-3 rounded-2xl text-center text-3xl font-black outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100 transition-all shadow-sm"/>
              </div>
            </div>
            
            <div className="flex justify-center gap-2 mb-6">
               <button onClick={() => setEditTurn('morning')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${editTurn === 'morning' ? 'bg-emerald-600 text-white shadow-md' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}>Mañana</button>
               <button onClick={() => setEditTurn('afternoon')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${editTurn === 'afternoon' ? 'bg-emerald-600 text-white shadow-md' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}>Tarde</button>
            </div>

            <button onClick={saveEditedHours} className="w-full bg-rose-500 text-white py-4 rounded-2xl font-black text-xs uppercase shadow-xl active:scale-95 transition-all">GUARDAR CAMBIOS</button>
          </div>
        </div>
      )}
    </>
  );
}
