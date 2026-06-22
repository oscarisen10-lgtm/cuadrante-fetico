import React, { useState, useEffect, useRef } from 'react';
import { GameShell, clamp } from './GameShell';

const GRACE = 1400; // ms de arranque estable (sin viento) para empezar cómodo

function Play({ end }) {
  const [, render] = useState(0);
  const leanRef = useRef(0);          // -100..100 (0 = equilibrio)
  const dvRef = useRef(0);            // velocidad de inclinación (empieza estable)
  const tRef = useRef(0);            // ms de supervivencia
  const aliveRef = useRef(true);
  const endRef = useRef(end);
  endRef.current = end;

  useEffect(() => {
    let raf, last = performance.now();
    const loop = (now) => {
      if (!aliveRef.current) return;
      const dt = Math.min(40, now - last); last = now;
      const f = dt / 16.67;   // nº de frames (~1 a 60fps): física estable e independiente del framerate
      tRef.current += dt;
      // Durante los primeros instantes no hay viento: la carretilla se mantiene recta.
      if (tRef.current > GRACE) {
        const wind = 0.05 + (tRef.current - GRACE) / 120000;      // el viento arrecia poco a poco
        dvRef.current += (Math.random() - 0.5) * wind * f;         // ráfagas aleatorias suaves
        dvRef.current += leanRef.current * 0.0016 * f;            // inestabilidad: cuanto más inclina, más cae
      }
      dvRef.current *= Math.pow(0.95, f);                         // rozamiento
      dvRef.current = clamp(dvRef.current, -3, 3);                // tope de velocidad (evita catapultazos)
      leanRef.current += dvRef.current * f;
      if (Math.abs(leanRef.current) >= 100) {
        aliveRef.current = false;
        endRef.current(clamp(Math.round(tRef.current / 100), 0, 2000)); // ~10 pts por segundo
        return;
      }
      render(n => n + 1);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { aliveRef.current = false; cancelAnimationFrame(raf); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Empuje suave y controlable: frena la caída y endereza poco a poco (antes era brutal).
  const push = (dir) => { dvRef.current = clamp(dvRef.current + dir * 0.45, -3, 3); leanRef.current += dir * 2; };

  const lean = leanRef.current;
  const danger = Math.abs(lean) > 64;
  const calm = tRef.current <= GRACE;

  return (
    <div className="flex-1 flex flex-col items-center px-6 pt-3 select-none">
      <span className={`bg-black/30 font-black px-4 py-1.5 rounded-full text-sm ${danger ? 'text-rose-400 animate-pulse' : 'text-amber-300'}`}>⏱ {(tRef.current / 1000).toFixed(1)}s</span>
      <p className={`font-bold uppercase tracking-widest text-xs mt-3 ${calm ? 'text-emerald-300 animate-pulse' : 'text-white/60'}`}>
        {calm ? '¡Prepárate!' : 'Mantén la carretilla en equilibrio'}
      </p>

      {/* Escena de la carretilla — colocada en la zona alta de la pantalla */}
      <div className="relative w-full flex items-end justify-center" style={{ height: 200, marginTop: 28 }}>
        <div style={{ transform: `rotate(${lean * 0.45}deg)`, transformOrigin: '50% 100%' }}>
          <div className="absolute -top-10 left-1/2 -translate-x-1/2 text-5xl drop-shadow-[0_4px_5px_rgba(0,0,0,0.5)]">📦</div>
          <div className="w-48 h-6 rounded-lg"
            style={{ background: danger ? 'linear-gradient(160deg,#fb7185,#be123c)' : 'linear-gradient(160deg,#fcd34d,#d97706)', boxShadow: danger ? '0 0 26px rgba(225,29,72,0.7)' : '0 6px 16px rgba(0,0,0,0.45), inset 0 2px 4px rgba(255,255,255,0.4)' }} />
        </div>
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0 h-0" style={{ borderLeft: '16px solid transparent', borderRight: '16px solid transparent', borderBottom: '26px solid #475569' }} />
      </div>

      {/* Indicador de inclinación */}
      <div className="w-full max-w-sm h-2.5 bg-black/30 rounded-full relative mt-7">
        <div className="absolute top-0 bottom-0 left-1/2 w-1 bg-white/40 -ml-0.5 rounded" />
        <div className="absolute -top-1 w-4 h-4 rounded-full -ml-2" style={{ left: `${clamp(50 + lean / 2, 2, 98)}%`, background: danger ? '#f43f5e' : '#fbbf24', boxShadow: `0 0 12px ${danger ? '#f43f5e' : '#fbbf24'}` }} />
      </div>

      {/* Botones — algo más arriba (separación inferior con el spacer) */}
      <div className="flex gap-4 w-full max-w-xs mt-8">
        <button onPointerDown={() => push(-1)} className="flex-1 text-amber-950 font-black text-3xl py-6 rounded-2xl border-b-4 border-amber-800 active:scale-95 transition-transform" style={{ background: 'linear-gradient(160deg,#fde68a,#f59e0b)', boxShadow: '0 6px 16px rgba(245,158,11,0.4), inset 0 2px 5px rgba(255,255,255,0.5)' }}>◄</button>
        <button onPointerDown={() => push(1)} className="flex-1 text-amber-950 font-black text-3xl py-6 rounded-2xl border-b-4 border-amber-800 active:scale-95 transition-transform" style={{ background: 'linear-gradient(160deg,#fde68a,#f59e0b)', boxShadow: '0 6px 16px rgba(245,158,11,0.4), inset 0 2px 5px rgba(255,255,255,0.5)' }}>►</button>
      </div>
      <div className="flex-1" />
    </div>
  );
}

export function EquilibrioGame(props) {
  return (
    <GameShell
      {...props}
      day={18} title="Equilibrio" emoji="⚖️" accent="amber"
      instructions={[
        <span key="1">La carretilla cargada <strong>se inclina sola</strong> con el viento (empieza estable un par de segundos).</span>,
        <span key="2">Toca <strong>◄</strong> y <strong>►</strong> para contrarrestar y mantenerla recta.</span>,
        <span key="3">Aguanta lo máximo posible: ¡cada segundo suma! Si vuelca, fin.</span>,
      ]}
    >
      {({ end }) => <Play end={end} />}
    </GameShell>
  );
}
