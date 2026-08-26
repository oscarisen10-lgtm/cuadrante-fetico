import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays, ChevronDown, ChevronUp, Lock, FileDown } from 'lucide-react';
import { CONFIG, FESTIVOS_NACIONALES, hasKnownConvenio } from '../constants/config';
import { MUNICIPAL_HOLIDAYS, formatStoreName, resolveUserCity } from '../constants/stores';
import { MonthGrid, WeekdayHeader } from './calendar/CalendarGrid';
import { DateDetailPanel } from './calendar/DateDetailPanel';
import { HoursEditor } from './calendar/HoursEditor';
import { ActivationGateModal } from './LockedView';
import { useActivationGate } from '../hooks/useActivationGate';
import { computeShiftStats } from '../hooks/useShifts';
import { toast } from '../services/toastBus';

/**
 * getAllYearHolidays — Collects all common + municipal holidays for the year.
 * `city` viene ya resuelto de la tienda del usuario (null para quien trabaja
 * fuera de ANGED, que solo ve los nacionales: ver getFestivosComunes).
 */
function getAllYearHolidays(city, festivosComunes) {
  const holidays = [];

  // Common holidays (Madrid region, o solo nacionales si el usuario es de fuera)
  Object.entries(festivosComunes).forEach(([dateStr, name]) => {
    holidays.push({ date: dateStr, name, type: 'common' });
  });

  // Municipal holidays based on the user's city
  if (city && MUNICIPAL_HOLIDAYS[city]) {
    Object.entries(MUNICIPAL_HOLIDAYS[city]).forEach(([dateStr, name]) => {
      if (!holidays.find(h => h.date === dateStr)) {
        holidays.push({ date: dateStr, name, type: 'local' });
      }
    });
  }

  // Sort by month-day
  return holidays.sort((a, b) => {
    const [am, ad] = a.date.split('-').map(Number);
    const [bm, bd] = b.date.split('-').map(Number);
    return am !== bm ? am - bm : ad - bd;
  });
}

const MONTH_NAMES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

// Relieve de la casa (el mismo de los botones de Fichar y del panel del día):
// degradado vertical + sombra proyectada + brillo interior arriba. Al abrirse, el
// botón se hunde: se le quita la sombra de fuera y se le mete sombra dentro.
const BOTON_RELIEVE = {
  background: 'linear-gradient(180deg,#34d399,#059669 58%,#047857)',
  boxShadow: '0 8px 18px rgba(5,150,105,0.4), inset 0 1.5px 1px rgba(255,255,255,0.45)',
};
const BOTON_HUNDIDO = {
  background: 'linear-gradient(180deg,#047857,#065f46)',
  boxShadow: '0 2px 5px rgba(4,120,87,0.28), inset 0 3px 7px rgba(0,0,0,0.32)',
};
// Panel claro con volumen, igual que la tarjeta del Resumen.
const PANEL_CLARO = {
  background: 'linear-gradient(180deg,#ffffff,#f8f9fb)',
  boxShadow: '0 14px 34px -16px rgba(30,41,59,0.25), inset 0 1.5px 1px rgba(255,255,255,0.9)',
  border: '1px solid rgba(15,23,42,0.05)',
};

/**
 * CalendarView — Main calendar component (refactored).
 * Sub-components: MonthGrid, DayCell, WeekdayHeader, DateDetailPanel, HoursEditor
 */
export const CalendarView = React.memo(function CalendarView({ shifts, shiftsMap, saveToCloud, user, permissionState, requestTokenManually, isActive = true }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState('mensual'); // 'mensual' | 'anual'
  const [selectedDates, setSelectedDates] = useState([]);
  const [editingDay, setEditingDay] = useState(null);
  const [editHH, setEditHH] = useState("0");
  const [editmm, setEditmm] = useState("0");
  const [editTurn, setEditTurn] = useState("morning");
  // HA: lo decide el umbral del convenio (8:30) mientras se teclean las horas, igual
  // que hacía la app antes de que existiera el interruptor. El interruptor sigue ahí
  // para corregirlo —hace falta en la baja, donde no hay jornada real de la que
  // deducirlo—, y en cuanto se toca manda él: `haManual` apaga el automático.
  const [editHA, setEditHA] = useState(false);
  const [haManual, setHaManual] = useState(false);
  // 'work' = Ajustar Horas · 'sick' = Baja. El editor es el mismo; cambia lo que se
  // guarda y qué opciones se ofrecen (ver HoursEditor).
  const [editMode, setEditMode] = useState('work');
  const [showFestivos, setShowFestivos] = useState(false);
  // Cuentas PENDIENTES: la agenda SE VE con normalidad; el aviso salta solo al
  // intentar REGISTRAR algo (libre, vacaciones, ajustar horas, borrar). Ver
  // hooks/useActivationGate: `requireActive()` corta la acción y muestra el aviso.
  const { requireActive, gateVisible, closeGate } = useActivationGate(isActive);

  const userStore = user?.store;
  // Los de fuera de ANGED no tienen municipio del que sacar festivos locales, y
  // sus comunes son solo los nacionales (no sabemos ni en qué comunidad están).
  const esANGED = hasKnownConvenio(user);
  const userCity = esANGED ? resolveUserCity(user) : null;
  const festivosComunes = esANGED ? CONFIG.FESTIVOS : FESTIVOS_NACIONALES;
  const holidays = useMemo(() => getAllYearHolidays(userCity, festivosComunes), [userCity, festivosComunes]);
  // Set "MM-DD" precalculado una vez para que las celdas comprueben festivo en O(1)
  // (antes cada celda recorría STORES en su propia llamada a isHoliday()).
  const holidaySet = useMemo(() => new Set(holidays.map(h => h.date)), [holidays]);

  // Abre el editor. `mode` decide si lo que se registra es una jornada trabajada
  // ('work') o la jornada PROGRAMADA durante una baja ('sick'): el formulario es el
  // mismo, así que se comparte en vez de duplicarlo.
  const abrirEditor = useCallback((dateStr, mode) => {
    if (!requireActive()) return;
    const s = shiftsMap[dateStr];
    // Se parte de lo que ya hubiera guardado ese día si es del mismo tipo; si no,
    // de la jornada típica (6h45) para no obligar a teclear desde cero.
    const mismoTipo = s?.type === mode;
    const totalHoursDecimal = (mismoTipo && s.hours > 0) ? s.hours : 6.75;
    setEditMode(mode);
    setEditingDay(dateStr);
    setEditHH(Math.floor(totalHoursDecimal).toString());
    setEditmm(Math.round((totalHoursDecimal % 1) * 60).toString());
    setEditTurn(mismoTipo ? (s.turn || 'morning') : 'morning');
    // HA: se parte de lo que dice el umbral para esas horas. Si el día ya estaba
    // guardado con un HA que CONTRADICE al umbral, es que en su día se corrigió a
    // mano: se respeta esa decisión y el automático no vuelve a pisarla.
    const haPorUmbral = (totalHoursDecimal * 60) >= CONFIG.UMBRAL_DIA_HA_MINUTOS;
    const haInicial = mismoTipo ? !!s.isHA : haPorUmbral;
    setEditHA(haInicial);
    setHaManual(haInicial !== haPorUmbral);
  }, [shiftsMap, requireActive]);

  const openEditHours = useCallback((dateStr) => abrirEditor(dateStr, 'work'), [abrirEditor]);
  const openBaja = useCallback((dateStr) => abrirEditor(dateStr, 'sick'), [abrirEditor]);

  // Auto-HA: mientras no se toque el interruptor, el HA sigue al umbral del convenio
  // según se van tecleando horas y minutos. Poner una jornada de más de 8:30 la marca
  // sola como HA —suma en el contador del Resumen y se pinta con el color HA en la
  // agenda— sin tener que acordarse de darle al botón.
  useEffect(() => {
    if (!editingDay || haManual) return;
    const minutos = (parseInt(editHH) || 0) * 60 + (parseInt(editmm) || 0);
    setEditHA(minutos >= CONFIG.UMBRAL_DIA_HA_MINUTOS);
  }, [editingDay, haManual, editHH, editmm]);

  // Tocar el interruptor deja el HA en manos del usuario para el resto de la edición.
  const cambiarEditHA = useCallback((valor) => {
    setHaManual(true);
    setEditHA(valor);
  }, []);

  const saveEditedHours = useCallback(() => {
    // En una baja marcada como "día libre" el cuadrante no programaba horas: se
    // guardan a 0 y sin HA, aunque el editor tuviera algo escrito de antes.
    const esLibre = editMode === 'sick' && editTurn === 'rest';
    const hoursDecimal = esLibre ? 0 : (parseInt(editHH) || 0) + ((parseInt(editmm) || 0) / 60);
    const targetDates = selectedDates.length > 0 ? selectedDates : (editingDay ? [editingDay] : []);

    const filtered = shifts.filter(s => !targetDates.includes(s.date));

    const newEntries = targetDates.map((date) => ({
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now() + Math.random(),
      date: date,
      type: editMode,
      hours: hoursDecimal,
      isHA: esLibre ? false : editHA,
      turn: editTurn
    }));

    const newShifts = [...filtered, ...newEntries];

    setEditingDay(null);
    setSelectedDates([]);
    saveToCloud({ shifts: newShifts });
  }, [editHH, editmm, editTurn, editHA, editMode, selectedDates, editingDay, shifts, saveToCloud]);

  const markMulti = useCallback((type) => {
    if (!requireActive()) return;
    const filtered = shifts.filter(s => !selectedDates.includes(s.date));
    const newEntries = selectedDates.map(date => ({ id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now() + Math.random(), date, type, hours: 0, isHA: false }));
    const newShifts = [...filtered, ...newEntries];
    setSelectedDates([]);
    saveToCloud({ shifts: newShifts });
  }, [shifts, selectedDates, saveToCloud, requireActive]);

  const deleteSelectedDates = useCallback(() => {
    if (!requireActive()) return;
    const newShifts = shifts.filter(s => !selectedDates.includes(s.date));
    setSelectedDates([]);
    saveToCloud({ shifts: newShifts });
  }, [shifts, selectedDates, saveToCloud, requireActive]);

  // ── Exportar el año a PDF ──
  // El generador y jspdf van en su propio trozo: se descargan al pulsar, no al
  // abrir la app (ver services/pdfCuadrante.js).
  const [exportando, setExportando] = useState(false);
  const exportarAnio = useCallback(async () => {
    const anio = currentDate.getFullYear();
    setExportando(true);
    try {
      const [{ construirPdfAnual, nombreFichero }, { descargarArchivo }] = await Promise.all([
        import('../services/pdfCuadrante'),
        import('../services/descargarArchivo'),
      ]);

      // Las estadísticas se recalculan SOLO para el año que se exporta: las de la
      // app cubren toda la ventana cargada (12-13 meses, que se solapan con el año
      // anterior) y el papel enseñaría una cuadrícula de un año con los totales de
      // otro. Como fecha de corte, hoy si es el año en curso y el 31-dic si ya pasó.
      const turnosDelAnio = shifts.filter((t) => t.date?.startsWith(String(anio)));
      const finDeAnio = new Date(anio, 11, 31);
      const hoy = new Date();
      const stats = computeShiftStats(turnosDelAnio, shiftsMap, user, finDeAnio > hoy ? hoy : finDeAnio);

      const blob = await construirPdfAnual({ anio, shiftsMap, user, stats });
      const resultado = await descargarArchivo(blob, nombreFichero(anio, user), `Mi Cuadrante ${anio}`);
      if (resultado !== 'cancelado') toast(`Cuadrante de ${anio} generado.`, 'success');
    } catch (e) {
      toast('No se pudo generar el PDF: ' + (e?.message || e), 'error');
    } finally {
      setExportando(false);
    }
  }, [currentDate, shifts, shiftsMap, user]);

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
             {/* data-tour: puntos que ilumina el tutorial (ver constants/screenTips) */}
             <button data-tour="cal-mensual" onClick={() => setViewMode('mensual')} className={`flex-1 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'mensual' ? 'bg-gradient-to-b from-emerald-500 to-emerald-700 text-white shadow-[0_4px_10px_rgba(5,150,105,0.4)]' : 'text-slate-400 hover:bg-slate-200 bg-white border border-slate-100'}`} role="tab" aria-selected={viewMode === 'mensual'} aria-controls="calendar-grid">Mensual</button>
             <button data-tour="cal-anual" onClick={() => setViewMode('anual')} className={`flex-1 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'anual' ? 'bg-gradient-to-b from-emerald-500 to-emerald-700 text-white shadow-[0_4px_10px_rgba(5,150,105,0.4)]' : 'text-slate-400 hover:bg-slate-200 bg-white border border-slate-100'}`} role="tab" aria-selected={viewMode === 'anual'} aria-controls="calendar-grid">Anual</button>
          </div>

          {/* Navigation */}
          <div className="p-4 flex justify-between items-center bg-white border-b border-slate-100 shrink-0">
            <button onClick={navigateBack} className="p-1.5 hover:bg-slate-100 rounded-xl transition-colors text-emerald-600" aria-label="Mes anterior"><ChevronLeft size={22}/></button>
            <span className="text-base sm:text-lg font-black uppercase italic text-emerald-700 tracking-widest" aria-live="polite">
               {viewMode === 'anual' ? currentDate.getFullYear() : currentDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
            </span>
            <button onClick={navigateForward} className="p-1.5 hover:bg-slate-100 rounded-xl transition-colors text-emerald-600" aria-label="Mes siguiente"><ChevronRight size={22}/></button>
          </div>
          
          {/* Calendar grid */}
          <div id="calendar-grid" role="tabpanel">
            {viewMode === 'mensual' ? (
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
                          shiftsMap={shiftsMap}
                          isSmall={false}
                          selectedDates={selectedDates}
                          holidaySet={holidaySet}
                          onDayClick={handleDayClick}
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
              <>
              <div className="px-3 pt-3">
                <button
                  onClick={exportarAnio}
                  disabled={exportando}
                  className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest text-white transition-transform active:scale-[0.98] ${exportando ? 'opacity-60' : ''}`}
                  style={{ background: 'linear-gradient(180deg,#34d399,#059669 58%,#047857)', boxShadow: '0 6px 14px rgba(5,150,105,0.4), inset 0 1.5px 1px rgba(255,255,255,0.45)' }}
                  aria-label={`Descargar el cuadrante de ${currentDate.getFullYear()} en PDF`}
                >
                  <FileDown size={14} />
                  {exportando ? 'Generando…' : `Descargar ${currentDate.getFullYear()} en PDF`}
                </button>
              </div>
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
                         shiftsMap={shiftsMap}
                         isSmall={true}
                         selectedDates={selectedDates}
                         holidaySet={holidaySet}
                         onDayClick={handleDayClick}
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
              </>
            )}
          </div>
        </div>

            <DateDetailPanel
              selectedDates={selectedDates}
              shiftsMap={shiftsMap}
              setSelectedDates={setSelectedDates}
              markMulti={markMulti}
              openEditHours={openEditHours}
              openBaja={openBaja}
              deleteSelectedDates={deleteSelectedDates}
              user={user}
            />

            {/* Botón Festivos del Año - Ahora debajo de DateDetailPanel.
                Los de fuera de ANGED solo tienen festivos nacionales, así que el
                tutorial les cuenta otra cosa (ver screenTips.jsx). */}
            <button
              data-tour={esANGED ? "cal-festivos" : "cal-festivos-nacional"}
              onClick={() => setShowFestivos(!showFestivos)}
              className="btn3d w-full flex items-center justify-between p-4 rounded-2xl"
              /* Mismo relieve que el resto de la app: en reposo sobresale (degradado
                 + sombra proyectada + brillo interior arriba) y abierto se hunde. */
              style={showFestivos ? BOTON_HUNDIDO : BOTON_RELIEVE}
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
          <div className="rounded-[2rem] overflow-hidden animate-in slide-in-from-top-4 duration-300 mb-4" style={PANEL_CLARO}>
            <div className="p-4 bg-slate-50/70 border-b border-slate-100">
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest text-center">
                Festivos Nacionales, Regionales y Locales
                {userStore && <span className="text-emerald-600 ml-1">· {formatStoreName(userStore)}</span>}
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

      </div>



      <HoursEditor
        editingDay={editingDay}
        editHH={editHH}
        editmm={editmm}
        editTurn={editTurn}
        editHA={editHA}
        editMode={editMode}
        setEditHH={setEditHH}
        setEditmm={setEditmm}
        setEditTurn={setEditTurn}
        setEditHA={cambiarEditHA}
        setEditingDay={setEditingDay}
        saveEditedHours={saveEditedHours}
      />

      {gateVisible && <ActivationGateModal onClose={closeGate} />}
    </div>
  );
});
