import React, { useState, useEffect, useRef } from 'react';
import { GameShell, clamp } from './GameShell';

const GRACE = 1200;     // ms de arranque estable (sin viento)
const CENTER = 50;      // centro de la pista (%)
const BAR_START = 62;   // ancho inicial de la barra (%)
const BAR_MIN = 15;     // ancho mínimo (%)

function Play({ end }) {
  const [, render] = useState(0);
  const posRef = useRef(CENTER);   // posición horizontal de la caja (%)
  const velRef = useRef(0);        // velocidad horizontal
  const tRef = useRef(0);          // ms de supervivencia
  const aliveRef = useRef(true);
  const endRef = useRef(end);
  endRef.current = end;

  const barWidth = () => Math.max(BAR_MIN, BAR_START - (tRef.current / 1000) * 0.78); // se encoge con el tiempo

  useEffect(() => {
    let raf, last = performance.now();
    const loop = (now) => {
      if (!aliveRef.current) return;
      const dt = Math.min(40, now - last); last = now;
      const f = dt / 16.67;           // nº de frames (~1 a 60fps): estable en cualquier móvil
      tRef.current += dt;

      if (tRef.current > GRACE) {
        const tSec = (tRef.current - GRACE) / 1000;
        const wind = 0.05 + tSec * 0.0009;                          // el viento arrecia poco a poco
        velRef.current += (Math.random() - 0.5) * wind * f;          // ráfagas aleatorias
        velRef.current += (posRef.current - CENTER) * 0.0018 * f;    // inestabilidad: cuanto más desviada, más se va
      }
      velRef.current *= Math.pow(0.9, f);                           // rozamiento
      velRef.current = clamp(velRef.current, -2, 2);
      posRef.current += velRef.current * f;

      // ¿se sale de la barra? -> cae
      if (Math.abs(posRef.current - CENTER) > barWidth() / 2) {
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

  // Empuje suave y controlable para reconducir la caja al centro.
  const push = (dir) => { velRef.current = clamp(velRef.current + dir * 0.2, -2, 2); posRef.current += dir * 0.7; };

  const pos = posRef.current;
  const bw = barWidth();
  const off = pos - CENTER;
  const danger = Math.abs(off) > bw / 2 * 0.72;
  const tilt = clamp(velRef.current * 9 + off * 0.5, -32, 32);   // la caja se inclina según su balanceo
  const calm = tRef.current <= GRACE;

  return (
    <div className="flex-1 flex flex-col items-center px-6 pt-3 select-none">
      <span className={`bg-black/30 font-black px-4 py-1.5 rounded-full text-sm ${danger ? 'text-rose-400 animate-pulse' : 'text-amber-300'}`}>⏱ {(tRef.current / 1000).toFixed(1)}s</span>
      <p className={`font-bold uppercase tracking-widest text-xs mt-3 ${calm ? 'text-emerald-300 animate-pulse' : 'text-white/60'}`}>
        {calm ? '¡Prepárate!' : 'Mantén la caja sobre la barra'}
      </p>

      {/* Escena centrada verticalmente */}
      <div className="flex-1 w-full flex items-center justify-center">
        <div className="relative w-full max-w-sm" style={{ height: 180 }}>
          {/* Barra estabilizadora (se encoge) */}
          <div
            className="absolute left-1/2 -translate-x-1/2 rounded-full"
            style={{
              top: 104, height: 12, width: `${bw}%`,
              background: danger ? 'linear-gradient(180deg,#fb7185,#be123c)' : 'linear-gradient(180deg,#fcd34d,#d97706)',
              boxShadow: danger ? '0 0 26px rgba(225,29,72,0.7)' : '0 6px 16px rgba(0,0,0,0.45), inset 0 2px 4px rgba(255,255,255,0.5)',
            }}
          />
          {/* marca de centro */}
          <div className="absolute left-1/2 -translate-x-1/2 rounded-full bg-white/30" style={{ top: 102, height: 16, width: 2 }} />

          {/* Caja que se balancea encima de la barra */}
          <div
            className="absolute"
            style={{
              left: `${pos}%`, top: 104, transform: `translateX(-50%) translateY(-100%) rotate(${tilt}deg)`,
              transformOrigin: '50% 100%', transition: 'none',
            }}
          >
            <div
              className="w-12 h-12 rounded-md flex items-center justify-center text-2xl"
              style={{ background: 'linear-gradient(150deg,#fde68a,#b45309)', boxShadow: '0 4px 10px rgba(0,0,0,0.45), inset 0 2px 4px rgba(255,255,255,0.5), inset 0 -4px 8px rgba(0,0,0,0.25)', border: '1px solid #92400e' }}
            >📦</div>
          </div>
        </div>
      </div>

      {/* Botones */}
      <div className="flex gap-4 w-full max-w-xs mb-8">
        <button onPointerDown={() => push(-1)} className="flex-1 text-amber-950 font-black text-3xl py-6 rounded-2xl border-b-4 border-amber-800 active:scale-95 transition-transform" style={{ background: 'linear-gradient(160deg,#fde68a,#f59e0b)', boxShadow: '0 6px 16px rgba(245,158,11,0.4), inset 0 2px 5px rgba(255,255,255,0.5)' }}>◄</button>
        <button onPointerDown={() => push(1)} className="flex-1 text-amber-950 font-black text-3xl py-6 rounded-2xl border-b-4 border-amber-800 active:scale-95 transition-transform" style={{ background: 'linear-gradient(160deg,#fde68a,#f59e0b)', boxShadow: '0 6px 16px rgba(245,158,11,0.4), inset 0 2px 5px rgba(255,255,255,0.5)' }}>►</button>
      </div>
    </div>
  );
}

export function EquilibrioGame(props) {
  return (
    <GameShell
      {...props}
      day={18} title="Equilibrio" emoji="⚖️" accent="amber"
      instructions={[
        <span key="1">La <strong>caja se desliza e inclina sola</strong> con el viento sobre una barra.</span>,
        <span key="2">Toca <strong>◄</strong> y <strong>►</strong> para mantenerla <strong>centrada en la barra</strong> y que no se caiga.</span>,
        <span key="3">¡Ojo! La <strong>barra se va haciendo más pequeña</strong>. Aguanta lo máximo: cada segundo suma.</span>,
      ]}
    >
      {({ end }) => <Play end={end} />}
    </GameShell>
  );
}
