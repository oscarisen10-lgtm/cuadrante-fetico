import React, { useState, useCallback, useMemo } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays, ChevronDown, ChevronUp, Lock } from 'lucide-react';
import { CONFIG } from '../constants/config';
import { STORES, MUNICIPAL_HOLIDAYS } from '../constants/stores';
import { MonthGrid, WeekdayHeader } from './calendar/CalendarGrid';
import { DateDetailPanel } from './calendar/DateDetailPanel';
import { HoursEditor } from './calendar/HoursEditor';
import { TeamView } from './calendar/TeamView';
import { subscribeToMyRequests, addRequest } from '../services/firebaseService';
import { useTeamStatus } from '../hooks/useTeamStatus';
import { toast } from './Toast';

/**
 * getAllYearHolidays — Collects all common + municipal holidays for the year.
 */
function getAllYearHolidays(userStoreName) {
  const holidays = [];

  // Common holidays (Madrid region)
  Object.entries(CONFIG.FESTIVOS || {}).forEach(([dateStr, name]) => {
    holidays.push({ date: dateStr, name, type: 'common' });
  });

  // Municipal holidays based on the user's store city
  if (userStoreName) {
    const store = STORES.find(s => s.name === userStoreName);
    if (store && store.city && MUNICIPAL_HOLIDAYS[store.city]) {
      Object.entries(MUNICIPAL_HOLIDAYS[store.city]).forEach(([dateStr, name]) => {
        if (!holidays.find(h => h.date === dateStr)) {
          holidays.push({ date: dateStr, name, type: 'local' });
        }
      });
    }
  }

  // Sort by month-day
  return holidays.sort((a, b) => {
    const [am, ad] = a.date.split('-').map(Number);
    const [bm, bd] = b.date.split('-').map(Number);
    return am !== bm ? am - bm : ad - bd;
  });
}

const MONTH_NAMES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

/**
 * CalendarView — Main calendar component (refactored).
 * Sub-components: MonthGrid, DayCell, WeekdayHeader, DateDetailPanel, HoursEditor, TeamView
 */
export const CalendarView = React.memo(function CalendarView({ shifts, shiftsMap, saveToCloud, user, permissionState, requestTokenManually }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState('mensual'); // 'mensual', 'anual', 'empleados'
  const [selectedDates, setSelectedDates] = useState([]); 
  const [editingDay, setEditingDay] = useState(null); 
  const [editHH, setEditHH] = useState("0");
  const [editmm, setEditmm] = useState("0");
  const [editTurn, setEditTurn] = useState("morning");
  const [showFestivos, setShowFestivos] = useState(false);
  const [myRequests, setMyRequests] = useState([]);

  const userStore = user?.store;
  const isBoss = user?.rank && (user.rank.toLowerCase().includes('jefe') || user.rank.toLowerCase().includes('coordinador'));
  const holidays = useMemo(() => getAllYearHolidays(userStore), [userStore]);
  const { canRequestOff } = useTeamStatus(user);

  React.useEffect(() => {
    if (user?.uid) {
      const unsubscribe = subscribeToMyRequests(user.uid, (data) => {
        setMyRequests(data);
      });
      return () => unsubscribe();
    }
  }, [user?.uid]);

  // Merge requests into shiftsMap so CalendarGrid and DateDetailPanel can see them.
  const combinedShiftsMap = useMemo(() => {
    const map = { ...shiftsMap };
    myRequests.forEach(req => {
      // If a day has a pending request, we override the type just for the view.
      if (req.status === 'pending') {
        map[req.date] = { ...map[req.date], type: 'request', requestData: req };
      }
    });
    return map;
  }, [shiftsMap, myRequests]);

  const openEditHours = useCallback((dateStr) => {
    const s = combinedShiftsMap[dateStr];
    const totalHoursDecimal = (s?.type === 'work' && s.hours > 0) ? s.hours : 6.75;
    setEditingDay(dateStr);
    setEditHH(Math.floor(totalHoursDecimal).toString());
    setEditmm(Math.round((totalHoursDecimal % 1) * 60).toString());
    setEditTurn(s?.turn || 'morning');
  }, [combinedShiftsMap]);

  const saveEditedHours = useCallback(() => {
    const hoursDecimal = (parseInt(editHH) || 0) + ((parseInt(editmm) || 0) / 60);
    const targetDates = selectedDates.length > 0 ? selectedDates : (editingDay ? [editingDay] : []);
    
    const filtered = shifts.filter(s => !targetDates.includes(s.date));
    
    const newEntries = targetDates.map((date, idx) => ({
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now() + Math.random(), 
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
    const newEntries = selectedDates.map(date => ({ id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now() + Math.random(), date, type, hours: 0, isHA: false }));
    const newShifts = [...filtered, ...newEntries];
    setSelectedDates([]);
    saveToCloud({ shifts: newShifts });
  }, [shifts, selectedDates, saveToCloud]);

  const makeRequest = useCallback(async (note = '') => {
    if (!userStore) {
      toast("Debes configurar tu tienda en Ajustes primero.", "error");
      return;
    }
    const storeKey = `${user?.company || "Supercor"}_${userStore}_${user?.section || "Sin especificar"}`;
    
    try {
      for (const date of selectedDates) {
        await addRequest({
          uid: user.uid,
          fullName: user.fullName || "Compañero",
          company: user.company || "Supercor",
          store: userStore,
          section: user.section || "Sin especificar",
          storeKey,
          date,
          status: 'pending',
          note: note
        });
      }
      toast("Solicitud enviada correctamente", "success");
      setSelectedDates([]);
    } catch (e) {
      toast("Error al enviar solicitud", "error");
    }
  }, [selectedDates, user, userStore]);

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
    if (viewMode === 'mensual' || viewMode === 'empleados') setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    else setCurrentDate(new Date(currentDate.getFullYear() - 1, currentDate.getMonth(), 1));
  }, [viewMode, currentDate]);

  const navigateForward = useCallback(() => {
    if (viewMode === 'mensual' || viewMode === 'empleados') setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    else setCurrentDate(new Date(currentDate.getFullYear() + 1, currentDate.getMonth(), 1));
  }, [viewMode, currentDate]);

  const hasNotifications = permissionState === 'granted';

  return (
    <div className="relative min-h-[500px] flex flex-col">
      {!hasNotifications && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-3xl p-4 flex items-center gap-3.5 shadow-sm animate-in slide-in-from-top-3 mb-4">
          <div className="w-9 h-9 bg-amber-500/15 rounded-2xl flex items-center justify-center shrink-0 border border-amber-500/25">
             <span className="text-xl animate-bounce">🔔</span>
          </div>
          <div className="flex-1 min-w-0">
             <h4 className="text-[10px] font-black text-amber-800 uppercase tracking-widest leading-none mb-1">¡Activar Notificaciones!</h4>
             <p className="text-[8px] text-slate-500 font-bold uppercase tracking-tight leading-tight">
               {permissionState === 'denied'
                 ? "Permiso bloqueado. Actívalo en los Ajustes del móvil."
                 : "Es obligatorio para recibir avisos de tus turnos."
               }
             </p>
          </div>
          {permissionState === 'denied' ? (
             <span className="text-[8px] bg-slate-100 text-slate-500 px-2.5 py-1.5 rounded-lg font-black uppercase shrink-0">Bloqueado</span>
          ) : (
             <button onClick={requestTokenManually} className="bg-amber-600 hover:bg-amber-700 text-white px-3.5 py-2 rounded-xl text-[9px] font-black uppercase shadow-md shadow-amber-500/10 active:scale-95 transition-all shrink-0">
                Permitir
             </button>
          )}
        </div>
      )}
      <div className={`flex flex-col animate-in fade-in duration-300 gap-4 pb-20 flex-1`}>
        <div className="rounded-[2rem] overflow-hidden flex flex-col pb-2" role="region" aria-label="Calendario" style={{ background: 'linear-gradient(180deg,#ffffff,#f8f9fb)', boxShadow: '0 14px 34px -16px rgba(30,41,59,0.25), inset 0 1.5px 1px rgba(255,255,255,0.9)', border: '1px solid rgba(15,23,42,0.05)' }}>

          {/* View mode switcher */}
          <div className="flex justify-center p-3 bg-slate-50/70 border-b border-slate-100 gap-2 shrink-0" role="tablist" aria-label="Modo de vista del calendario">
             <button onClick={() => setViewMode('mensual')} className={`flex-1 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'mensual' ? 'bg-gradient-to-b from-emerald-500 to-emerald-700 text-white shadow-[0_4px_10px_rgba(5,150,105,0.4)]' : 'text-slate-400 hover:bg-slate-200 bg-white border border-slate-100'}`} role="tab" aria-selected={viewMode === 'mensual'} aria-controls="calendar-grid">Mensual</button>
             <button onClick={() => setViewMode('anual')} className={`flex-1 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'anual' ? 'bg-gradient-to-b from-emerald-500 to-emerald-700 text-white shadow-[0_4px_10px_rgba(5,150,105,0.4)]' : 'text-slate-400 hover:bg-slate-200 bg-white border border-slate-100'}`} role="tab" aria-selected={viewMode === 'anual'} aria-controls="calendar-grid">Anual</button>
             {/* Ocultado temporalmente a petición del usuario:
             {isBoss && (
               <button onClick={() => setViewMode('empleados')} className={`flex-1 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'empleados' ? 'bg-gradient-to-b from-emerald-500 to-emerald-700 text-white shadow-[0_4px_10px_rgba(5,150,105,0.4)]' : 'text-slate-400 hover:bg-slate-200 bg-white border border-slate-100'}`} role="tab" aria-selected={viewMode === 'empleados'} aria-controls="calendar-grid">Empleados</button>
             )}
             */}
          </div>

          {/* Navigation */}
          <div className="p-4 flex justify-between items-center bg-white border-b border-slate-100 shrink-0">
            <button onClick={navigateBack} className="p-1.5 hover:bg-slate-100 rounded-xl transition-colors text-emerald-600" aria-label="Mes anterior"><ChevronLeft size={22}/></button>
            <span className="text-base sm:text-lg font-black uppercase italic text-emerald-700 tracking-widest" aria-live="polite">
               {viewMode === 'mensual' ? currentDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }) : viewMode === 'anual' ? currentDate.getFullYear() : currentDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
            </span>
            <button onClick={navigateForward} className="p-1.5 hover:bg-slate-100 rounded-xl transition-colors text-emerald-600" aria-label="Mes siguiente"><ChevronRight size={22}/></button>
          </div>
          
          {/* Calendar grid */}
          <div id="calendar-grid" role="tabpanel">
            {viewMode === 'empleados' ? (
               <TeamView user={user} userStore={userStore} currentDate={currentDate} navigateBack={navigateBack} navigateForward={navigateForward} />
            ) : viewMode === 'mensual' ? (
              <div className="flex flex-col relative">
                {(() => {
                  const m = currentDate.getMonth();
                  const isLocked = permissionState !== 'granted' && [0, 7, 9].includes(m);
                  return (
                    <>
                      <div className={`p-3 grid grid-cols-7 gap-1.5 ${isLocked ? 'opacity-30 pointer-events-none' : ''}`} role="grid" aria-label="Calendario mensual">
                        <WeekdayHeader />
                        <MonthGrid 
                          targetYear={currentDate.getFullYear()} 
                          targetMonth={currentDate.getMonth()} 
                          shiftsMap={combinedShiftsMap} 
                          isSmall={false}
                          selectedDates={selectedDates}
                          onDayClick={handleDayClick}
                          onDayDoubleClick={openEditHours}
                          userStore={userStore}
                        />
                      </div>
                      {isLocked && (
                        <div className="absolute inset-0 flex items-center justify-center z-10 pb-8">
                          <div className="bg-slate-800/90 p-5 rounded-3xl backdrop-blur-md text-white flex flex-col items-center gap-3 shadow-2xl mx-6 text-center">
                            <Lock size={36} className="text-emerald-400" />
                            <p className="text-sm font-bold leading-snug">Activa las notificaciones para desbloquear este mes</p>
                            <button onClick={requestTokenManually} className="mt-2 bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-black px-4 py-2 rounded-xl transition-colors shadow-lg active:scale-95">ACTIVAR</button>
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            ) : (
              <div className="p-3 grid grid-cols-3 gap-x-2 gap-y-4 pb-4" role="grid" aria-label="Calendario anual">
                {Array.from({ length: 12 }).map((_, m) => {
                  const isLocked = permissionState !== 'granted' && [0, 7, 9].includes(m);
                  return (
                  <div key={m} className="flex flex-col relative">
                     <h4 className="text-[8px] font-black uppercase text-slate-800 mb-1 text-center tracking-widest">{new Date(currentDate.getFullYear(), m, 1).toLocaleDateString('es-ES', { month: 'short' })}</h4>
                     <div className={`grid grid-cols-7 gap-[2px] ${isLocked ? 'opacity-30 pointer-events-none' : ''}`}>
                       <WeekdayHeader isSmall />
                       <MonthGrid 
                         targetYear={currentDate.getFullYear()} 
                         targetMonth={m} 
                         shiftsMap={combinedShiftsMap} 
                         isSmall={true}
                         selectedDates={selectedDates}
                         onDayClick={handleDayClick}
                         onDayDoubleClick={openEditHours}
                         userStore={userStore}
                       />
                     </div>
                     {isLocked && (
                        <div className="absolute inset-0 flex items-center justify-center z-10 pt-4" onClick={() => setViewMode('mensual')}>
                          <div className="bg-slate-800/90 p-2.5 rounded-2xl backdrop-blur-md text-white shadow-lg shadow-black/20">
                            <Lock size={18} className="text-emerald-400" />
                          </div>
                        </div>
                     )}
                  </div>
                )})}
              </div>
            )}
          </div>
        </div>

        {viewMode !== 'empleados' && (
          <>
            <DateDetailPanel 
              selectedDates={selectedDates}
              shiftsMap={combinedShiftsMap}
              setSelectedDates={setSelectedDates}
              markMulti={markMulti}
              openEditHours={openEditHours}
              deleteSelectedDates={deleteSelectedDates}
              user={user}
              makeRequest={makeRequest}
              canRequestOff={canRequestOff}
            />

            {/* Botón Festivos del Año - Ahora debajo de DateDetailPanel */}
            <button 
              onClick={() => setShowFestivos(!showFestivos)}
          className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all duration-300 ${
            showFestivos ? 'bg-emerald-700 border-emerald-600 shadow-md ring-2 ring-emerald-600/20' : 'bg-emerald-600 border-emerald-700/20 shadow-sm hover:bg-emerald-500'
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className={`shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${showFestivos ? 'bg-white text-emerald-700 shadow-lg' : 'bg-emerald-700/50 text-emerald-100'}`}>
              <CalendarDays size={16} />
            </div>
            <span className="text-[11px] font-black uppercase text-white leading-snug tracking-tight text-left">Calendario de Festivos {new Date().getFullYear()}</span>
          </div>
          <div className={`p-1.5 rounded-lg border transition-all shrink-0 ${showFestivos ? 'bg-white border-white text-emerald-700' : 'bg-emerald-700/50 border-emerald-700/50 text-emerald-100'}`}>
            {showFestivos ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </div>
        </button>

        {/* Lista de Festivos (Condicional) */}
        {showFestivos && (
          <div className="bg-white border border-slate-200 rounded-[2rem] overflow-hidden shadow-xl animate-in slide-in-from-top-4 duration-300 mb-4">
            <div className="p-4 bg-slate-50 border-b border-slate-100">
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest text-center">
                Festivos Nacionales, Regionales y Locales
                {userStore && <span className="text-emerald-600 ml-1">· {userStore}</span>}
              </p>
            </div>
            <div className="divide-y divide-slate-100">
              {holidays.map(({ date, name, type }) => {
                const [m, d] = date.split('-').map(Number);
                return (
                  <div key={date} className="p-3.5 flex items-center gap-3 hover:bg-slate-50/50 transition-colors">
                    <div className={`flex flex-col items-center justify-center min-w-[40px] h-[40px] rounded-xl ${type === 'local' ? 'bg-amber-100' : 'bg-rose-100'}`}>
                      <span className={`font-black text-[15px] leading-none ${type === 'local' ? 'text-amber-700' : 'text-rose-700'}`}>{d}</span>
                      <span className={`text-[7px] uppercase font-bold ${type === 'local' ? 'text-amber-500' : 'text-rose-500'}`}>{MONTH_NAMES[m - 1]}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] text-slate-700 font-bold leading-tight">{name}</p>
                    </div>
                    <span className={`text-[8px] font-black px-2 py-1 rounded-full uppercase tracking-tighter shrink-0 ${type === 'local' ? 'bg-amber-100 text-amber-600' : 'bg-rose-100 text-rose-600'}`}>
                      {type === 'local' ? 'Local' : 'Regional'}
                    </span>
                  </div>
                );
              })}
              {holidays.length === 0 && (
                <div className="p-6 text-center text-xs text-slate-400 font-bold">
                  No hay festivos configurados para tu zona.
                </div>
              )}
            </div>
          </div>
        )}
        </>
      )}

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
    </div>
  );
});
