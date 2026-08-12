import React, { useState, useEffect } from 'react';
import { Play, Square, Timer, Coffee } from 'lucide-react';
import { formatTime, formatCountdown } from '../utils/dateUtils';
import { CONFIG } from '../constants/config';
import { hapticMedium } from '../utils/haptics';

export const TrackerView = React.memo(function TrackerView({ 
  activeShift, isBreakActive, workTimeAccumulated, breakStartTime,
  showBreakFinishedMsg, settings, cerrarTurno, toggleDescanso, iniciarTurno 
}) {
  const [elapsed, setElapsed] = useState(0);
  const [breakTimeLeft, setBreakTimeLeft] = useState(settings?.breakDuration * 60 || 0);

  useEffect(() => {
    let interval;
    if (activeShift && !isBreakActive) {
      const tick = () => {
        const currentSessionSeconds = Math.floor((Date.now() - activeShift.startTime) / 1000);
        const newElapsed = (workTimeAccumulated || 0) + currentSessionSeconds;
        setElapsed(Math.min(newElapsed, 86400)); // Máximo 24 horas (24 * 60 * 60)
      };
      tick();
      interval = setInterval(tick, 1000);
    } else if (activeShift && isBreakActive) {
      setElapsed(workTimeAccumulated || 0);
      const tick = () => {
        const secondsInBreak = Math.floor((Date.now() - breakStartTime) / 1000);
        const totalBreakSeconds = (settings?.breakDuration || 15) * 60;
        setBreakTimeLeft(Math.max(0, totalBreakSeconds - secondsInBreak));
      };
      tick();
      interval = setInterval(tick, 1000);
    } else {
      setElapsed(0);
    }
    return () => clearInterval(interval);
  }, [activeShift, isBreakActive, workTimeAccumulated, breakStartTime, settings?.breakDuration]);

  return (
    <div className="flex flex-col items-center justify-center space-y-8 py-6 animate-in fade-in duration-300 min-h-full">
      {/* data-tour: puntos que ilumina el tutorial (ver constants/screenTips) */}
      <div data-tour="fichar-contador" className="text-center">
        <div className={`text-7xl font-black tracking-tighter font-mono tabular-nums leading-tight ${isBreakActive ? 'text-slate-300' : 'text-slate-800'}`} style={!isBreakActive ? { textShadow: '0 2px 4px rgba(0,0,0,0.08)' } : {}}>{formatTime(elapsed || 0)}</div>
        <div className="inline-flex items-center gap-1.5 mt-3 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest" style={{ background: activeShift ? (isBreakActive ? 'rgba(100,116,139,0.12)' : 'rgba(5,150,105,0.12)') : 'rgba(148,163,184,0.12)', color: activeShift ? (isBreakActive ? '#475569' : '#059669') : '#94a3b8' }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: activeShift ? (isBreakActive ? '#64748b' : '#059669') : '#94a3b8', boxShadow: activeShift && !isBreakActive ? '0 0 6px #059669' : 'none' }} />
          {activeShift ? (isBreakActive ? 'Descanso activo' : 'Jornada en curso') : 'Reloj parado'}
        </div>
      </div>

      <button
        data-tour="fichar-boton"
        onClick={() => {
          hapticMedium();
          if (activeShift) {
             const currentSessionSeconds = isBreakActive ? 0 : Math.floor((Date.now() - activeShift.startTime) / 1000);
             const rawElapsed = (workTimeAccumulated || 0) + currentSessionSeconds;
             const totalElapsed = Math.min(rawElapsed, 86400); // Límite de 24 horas
             cerrarTurno((totalElapsed/60)>=CONFIG.UMBRAL_DIA_HA_MINUTOS, totalElapsed);
          } else {
             iniciarTurno();
          }
        }}
        className="btn3d relative w-44 h-44 rounded-full flex flex-col items-center justify-center shrink-0"
        style={{
          background: activeShift ? 'linear-gradient(180deg,#fb7185,#e11d48 58%,#be123c)' : 'linear-gradient(180deg,#34d399,#059669 58%,#047857)',
          boxShadow: activeShift
            ? '0 18px 38px rgba(225,29,72,0.5), inset 0 5px 7px rgba(255,255,255,0.45), inset 0 -12px 22px rgba(159,18,57,0.5)'
            : '0 18px 38px rgba(5,150,105,0.5), inset 0 5px 7px rgba(255,255,255,0.45), inset 0 -12px 22px rgba(4,120,87,0.5)',
        }}
      >
        <span className="absolute -inset-2 rounded-full pointer-events-none" style={{ border: '2px solid rgba(255,255,255,0.28)' }} />
        {activeShift && !isBreakActive && <span className="absolute -inset-1.5 rounded-full animate-ping pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(225,29,72,0.25), transparent 70%)' }} />}
        {activeShift ? <Square size={36} className="text-white fill-white relative drop-shadow"/> : <Play size={38} className="text-white fill-white ml-2 relative drop-shadow"/>}
        <span className="text-white font-black text-[11px] mt-2 uppercase tracking-widest relative">{activeShift ? 'Cerrar' : 'Entrar'}</span>
      </button>

      {/* El bloque de descanso solo existe con la jornada en marcha; el envoltorio
          está siempre, para que el tutorial tenga algo que iluminar en los dos casos. */}
      <div data-tour="fichar-descanso" className="w-full flex justify-center pb-4">
          {activeShift ? (
            <div className="w-full max-w-[230px] p-5 rounded-3xl space-y-4" style={{ background: 'linear-gradient(180deg,#ecfdf5,#d1fae5)', border: '1px solid rgba(16,185,129,0.2)', boxShadow: '0 10px 22px -10px rgba(5,150,105,0.32), inset 0 1.5px 1px rgba(255,255,255,0.85)' }}>
              {isBreakActive && (
                <div className="text-center">
                  <div className={`text-4xl font-black leading-none font-mono tabular-nums ${showBreakFinishedMsg ? 'text-rose-600 animate-pulse' : 'text-emerald-600'}`}>{formatCountdown(breakTimeLeft)}</div>
                  <p className="text-[10px] font-bold text-emerald-400 uppercase mt-1 tracking-widest">{showBreakFinishedMsg ? '¡TIEMPO AGOTADO!' : 'Restante'}</p>
                </div>
              )}
              <button
                onClick={toggleDescanso}
                className={`btn3d w-full py-4 rounded-2xl font-black text-[11px] uppercase flex items-center justify-center gap-2 ${showBreakFinishedMsg ? 'text-white animate-bounce' : isBreakActive ? 'text-white' : ''}`}
                style={showBreakFinishedMsg
                  ? { background: 'linear-gradient(180deg,#fb7185,#e11d48)', boxShadow: '0 6px 14px rgba(225,29,72,0.4), inset 0 1.5px 1px rgba(255,255,255,0.4)' }
                  : isBreakActive
                  ? { background: 'linear-gradient(180deg,#475569,#1e293b)', boxShadow: '0 6px 14px rgba(15,23,42,0.4), inset 0 1.5px 1px rgba(255,255,255,0.22)' }
                  : { background: 'linear-gradient(180deg,#6ee7b7,#10b981)', color: '#065f46', boxShadow: '0 6px 14px rgba(16,185,129,0.35), inset 0 1.5px 1px rgba(255,255,255,0.55)' }}
              >
                {isBreakActive ? <><Timer size={16} /> Volver</> : <><Coffee size={16} /> Descanso {settings?.breakDuration}m</>}
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
});
