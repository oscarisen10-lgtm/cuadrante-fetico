import React, { useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { CONFIG } from '../constants/config';
import { MonthGrid, WeekdayHeader } from './calendar/CalendarGrid';
import { DateDetailPanel } from './calendar/DateDetailPanel';
import { HoursEditor } from './calendar/HoursEditor';

/**
 * CalendarView — Main calendar component (refactored).
 * Sub-components: MonthGrid, DayCell, WeekdayHeader, DateDetailPanel, HoursEditor
 */
export const CalendarView = React.memo(function CalendarView({ shifts, shiftsMap, saveToCloud, user }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState('mensual');
  const [selectedDates, setSelectedDates] = useState([]); 
  const [editingDay, setEditingDay] = useState(null); 
  const [editHH, setEditHH] = useState("0");
  const [editmm, setEditmm] = useState("0");
  const [editTurn, setEditTurn] = useState("morning");

  const userStore = user?.store;

  const openEditHours = useCallback((dateStr) => {
    const s = shiftsMap[dateStr];
    const totalHoursDecimal = (s?.type === 'work' && s.hours > 0) ? s.hours : 6.75;
    setEditingDay(dateStr);
    setEditHH(Math.floor(totalHoursDecimal).toString());
    setEditmm(Math.round((totalHoursDecimal % 1) * 60).toString());
    setEditTurn(s?.turn || 'morning');
  }, [shiftsMap]);

  const saveEditedHours = useCallback(() => {
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
  }, [editHH, editmm, editTurn, selectedDates, editingDay, shifts, saveToCloud]);

  const markMulti = useCallback((type) => {
    const filtered = shifts.filter(s => !selectedDates.includes(s.date));
    const newEntries = selectedDates.map(date => ({ id: Math.random(), date, type, hours: 0, isHA: false }));
    const newShifts = [...filtered, ...newEntries];
    setSelectedDates([]);
    saveToCloud({ shifts: newShifts });
  }, [shifts, selectedDates, saveToCloud]);

  const deleteSelectedDates = useCallback(() => {
    const newShifts = shifts.filter(s => !selectedDates.includes(s.date));
    setSelectedDates([]);
    saveToCloud({ shifts: newShifts });
  }, [shifts, selectedDates, saveToCloud]);

  const handleDayClick = useCallback((dateStr) => {
    setSelectedDates(prev => 
      prev.includes(dateStr) ? prev.filter(d => d !== dateStr) : [...prev, dateStr]
    );
    setEditingDay(null);
  }, []);

  const navigateBack = useCallback(() => {
    if (viewMode === 'mensual') setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    else setCurrentDate(new Date(currentDate.getFullYear() - 1, currentDate.getMonth(), 1));
  }, [viewMode, currentDate]);

  const navigateForward = useCallback(() => {
    if (viewMode === 'mensual') setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    else setCurrentDate(new Date(currentDate.getFullYear() + 1, currentDate.getMonth(), 1));
  }, [viewMode, currentDate]);

  return (
    <>
      <div className="flex flex-col animate-in fade-in duration-300 gap-4 pb-20">
        <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden flex flex-col pb-2" role="region" aria-label="Calendario">
          
          {/* View mode switcher */}
          <div className="flex justify-center p-3 bg-slate-50 border-b border-slate-100 gap-2 shrink-0" role="tablist" aria-label="Modo de vista del calendario">
             <button onClick={() => setViewMode('mensual')} className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'mensual' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-200 bg-white border border-slate-100'}`} role="tab" aria-selected={viewMode === 'mensual'} aria-controls="calendar-grid">Mensual</button>
             <button onClick={() => setViewMode('anual')} className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'anual' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-200 bg-white border border-slate-100'}`} role="tab" aria-selected={viewMode === 'anual'} aria-controls="calendar-grid">Anual</button>
          </div>

          {/* Navigation */}
          <div className="p-4 flex justify-between items-center bg-white border-b border-slate-100 shrink-0">
            <button onClick={navigateBack} className="p-1.5 hover:bg-slate-100 rounded-xl transition-colors text-emerald-600" aria-label="Mes anterior"><ChevronLeft size={22}/></button>
            <span className="text-base sm:text-lg font-black uppercase italic text-emerald-700 tracking-widest" aria-live="polite">
               {viewMode === 'mensual' ? currentDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }) : currentDate.getFullYear()}
            </span>
            <button onClick={navigateForward} className="p-1.5 hover:bg-slate-100 rounded-xl transition-colors text-emerald-600" aria-label="Mes siguiente"><ChevronRight size={22}/></button>
          </div>
          
          {/* Calendar grid */}
          <div id="calendar-grid" role="tabpanel">
            {viewMode === 'mensual' ? (
              <div className="flex flex-col">
                <div className="p-3 grid grid-cols-7 gap-1.5" role="grid" aria-label="Calendario mensual">
                  <WeekdayHeader />
                  <MonthGrid 
                    targetYear={currentDate.getFullYear()} 
                    targetMonth={currentDate.getMonth()} 
                    shiftsMap={shiftsMap} 
                    isSmall={false}
                    selectedDates={selectedDates}
                    onDayClick={handleDayClick}
                    onDayDoubleClick={openEditHours}
                    userStore={userStore}
                  />
                </div>

              </div>
            ) : (
              <div className="p-3 grid grid-cols-3 gap-x-2 gap-y-4 pb-4" role="grid" aria-label="Calendario anual">
                {Array.from({ length: 12 }).map((_, m) => (
                  <div key={m} className="flex flex-col">
                     <h4 className="text-[8px] font-black uppercase text-slate-800 mb-1 text-center tracking-widest">{new Date(currentDate.getFullYear(), m, 1).toLocaleDateString('es-ES', { month: 'short' })}</h4>
                     <div className="grid grid-cols-7 gap-[2px]">
                       <WeekdayHeader isSmall />
                       <MonthGrid 
                         targetYear={currentDate.getFullYear()} 
                         targetMonth={m} 
                         shiftsMap={shiftsMap} 
                         isSmall={true}
                         selectedDates={selectedDates}
                         onDayClick={handleDayClick}
                         onDayDoubleClick={openEditHours}
                         userStore={userStore}
                       />
                     </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DateDetailPanel 
          selectedDates={selectedDates}
          shiftsMap={shiftsMap}
          setSelectedDates={setSelectedDates}
          markMulti={markMulti}
          openEditHours={openEditHours}
          deleteSelectedDates={deleteSelectedDates}
        />
      </div>

      <HoursEditor 
        editingDay={editingDay}
        editHH={editHH}
        editmm={editmm}
        editTurn={editTurn}
        setEditHH={setEditHH}
        setEditmm={setEditmm}
        setEditTurn={setEditTurn}
        setEditingDay={setEditingDay}
        saveEditedHours={saveEditedHours}
      />
    </>
  );
});
