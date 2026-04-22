import React from 'react';
import { Play, Square, Timer, Coffee } from 'lucide-react';
import { formatTime, formatCountdown } from '../utils/dateUtils';
import { CONFIG } from '../constants/config';

export function TrackerView({ 
  activeShift, isBreakActive, elapsed, breakTimeLeft, 
  showBreakFinishedMsg, settings, cerrarTurno, toggleDescanso, iniciarTurno 
}) {
  return (
    <div className="flex flex-col items-center justify-center space-y-10 py-6 animate-in fade-in duration-300 pb-24 h-full">
      <div className="text-center">
        <div className={`text-6xl font-black tracking-tighter font-mono ${isBreakActive ? 'text-slate-300' : 'text-slate-800'}`}>{formatTime(elapsed || 0)}</div>
        <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest mt-3">
           {activeShift ? (isBreakActive ? 'Descanso activo' : 'Jornada en curso') : 'Reloj parado'}
        </div>
      </div>

      <button 
        onClick={() => {
          if (activeShift) cerrarTurno((elapsed/60)>=CONFIG.UMBRAL_DIA_HA_MINUTOS);
          else iniciarTurno();
        }} 
        className={`w-44 h-44 rounded-full flex flex-col items-center justify-center shadow-2xl transition-all active:scale-90 border-[8px] shrink-0 ${activeShift ? 'bg-rose-500 border-rose-100 shadow-rose-200' : 'bg-emerald-600 border-emerald-100 shadow-emerald-200'}`}
      >
        {activeShift ? <Square size={36} className="text-white fill-white"/> : <Play size={36} className="text-white fill-white ml-2"/>}
        <span className="text-white font-black text-[10px] mt-2 uppercase tracking-widest">{activeShift ? 'Cerrar' : 'Entrar'}</span>
      </button>

      <div className="w-full flex justify-center pb-4">
          {activeShift ? (
            <div className="w-full max-w-[220px] bg-emerald-50 p-5 rounded-3xl border border-emerald-100 space-y-4 shadow-sm">
              {isBreakActive && (
                <div className="text-center">
                  <div className={`text-3xl font-black leading-none ${showBreakFinishedMsg ? 'text-rose-600 animate-pulse' : 'text-emerald-600'}`}>{formatCountdown(breakTimeLeft)}</div>
                  <p className="text-[10px] font-bold text-emerald-400 uppercase mt-1 tracking-widest">{showBreakFinishedMsg ? '¡TIEMPO AGOTADO!' : 'Restante'}</p>
                </div>
              )}
              <button 
                onClick={toggleDescanso} 
                className={`w-full py-4 rounded-2xl font-black text-[11px] uppercase flex items-center justify-center gap-2 shadow-md active:scale-95 transition-all ${
                  showBreakFinishedMsg ? 'bg-rose-600 text-white animate-bounce' : isBreakActive ? 'bg-slate-800 text-white' : 'bg-emerald-200 text-emerald-800'
                }`}
              >
                {isBreakActive ? <><Timer size={16} /> Volver</> : <><Coffee size={16} /> Descanso {settings.breakDuration}m</>}
              </button>
            </div>
          ) : (
            <div className="p-4 text-center">
                <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest leading-relaxed">Presiona el botón para<br/>iniciar el registro de hoy</p>
            </div>
          )}
      </div>
    </div>
  );
}
