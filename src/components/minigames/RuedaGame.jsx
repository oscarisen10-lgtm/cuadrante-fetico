import React, { useState, useEffect, useRef } from 'react';
import { GameShell, clamp, rand } from './GameShell';

const SIZE = 270, R = 96, CX = SIZE / 2, CY = SIZE / 2;
const THRESH = 13;            // grados mínimos entre cajas
const LAUNCH_ABS = 90;        // se pegan por abajo de la rueda (90° = abajo)

const angDist = (a, b) => { const d = (((a - b) % 360) + 360) % 360; return d > 180 ? 360 - d : d; };
const rad = (d) => (d * Math.PI) / 180;

function Play({ end }) {
  const [, render] = useState(0);
  const rotRef = useRef(0);
  const dirRef = useRef(1);
  const speedRef = useRef(0.11);      // deg/ms
  const placedRef = useRef([]);       // ángulos relativos (a la rueda)
  const scoreRef = useRef(0);
  const overRef = useRef(false);
  const popRef = useRef(0);
  const endRef = useRef(end);
  endRef.current = end;

  useEffect(() => {
    // dos cajas iniciales para esquivar
    placedRef.current = [rand(0, 359), rand(0, 359)];
    let raf, last = performance.now();
    const loop = (now) => {
      if (overRef.current) return;
      const dt = Math.min(40, now - last); last = now;
      rotRef.current = (rotRef.current + dirRef.current * speedRef.current * dt) % 360;
      render(n => n + 1);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const shoot = () => {
    if (overRef.current) return;
    const rel = (((LAUNCH_ABS - rotRef.current) % 360) + 360) % 360;
    const collide = placedRef.current.some(p => angDist(p, rel) < THRESH);
    if (collide) {
      overRef.current = true;
      endRef.current(clamp(scoreRef.current * 70, 0, 2000));
      return;
    }
    placedRef.current = [...placedRef.current, rel];
    scoreRef.current += 1;
    popRef.current = performance.now();
    // sube dificultad: más rápido y, de vez en cuando, cambia de sentido
    speedRef.current = Math.min(0.27, speedRef.current + 0.006);
    if (scoreRef.current % 4 === 0) dirRef.current *= -1;
  };

  const rot = rotRef.current;
  const justPop = popRef.current && performance.now() - popRef.current < 200;

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 pb-8 select-none" onPointerDown={shoot}>
      <span className="bg-black/30 text-orange-300 font-black px-5 py-1.5 rounded-full text-sm mb-6">📦 {scoreRef.current}</span>
      <p className="text-white/60 font-bold uppercase tracking-widest text-xs mb-6 text-center max-w-[260px] leading-relaxed">Toca para <strong className="text-orange-300">lanzar</strong> una caja a la rueda. ¡Que no choque con otra!</p>

      <div className="relative" style={{ width: SIZE, height: SIZE }}>
        {/* línea de lanzamiento */}
        <div className="absolute left-1/2 -ml-0.5 w-1 rounded-full" style={{ top: CY + R, height: SIZE - (CY + R), background: 'linear-gradient(180deg, rgba(251,146,60,0.9), rgba(251,146,60,0))' }} />

        {/* rueda */}
        <div className="absolute inset-0 rounded-full" style={{ background: 'radial-gradient(circle at 50% 40%, #1f2937, #0b1220)', boxShadow: 'inset 0 0 30px rgba(0,0,0,0.6), 0 0 0 4px rgba(251,146,60,0.25), 0 0 28px rgba(249,115,22,0.35)' }} />
        <div className="absolute rounded-full" style={{ left: CX - R, top: CY - R, width: R * 2, height: R * 2, border: '2px dashed rgba(251,146,60,0.35)' }} />

        {/* cajas pegadas */}
        {placedRef.current.map((relA, i) => {
          const abs = relA + rot;
          const x = CX + R * Math.cos(rad(abs));
          const y = CY + R * Math.sin(rad(abs));
          return (
            <div key={i} className="absolute w-7 h-7 -ml-3.5 -mt-3.5 rounded-md flex items-center justify-center text-sm" style={{ left: x, top: y, background: 'linear-gradient(160deg,#fdba74,#ea580c)', boxShadow: '0 0 10px rgba(249,115,22,0.6), inset 0 2px 3px rgba(255,255,255,0.5)', transform: `rotate(${abs + 90}deg)` }}>📦</div>
          );
        })}

        {/* eje central */}
        <div className="absolute left-1/2 top-1/2 w-14 h-14 -ml-7 -mt-7 rounded-full flex items-center justify-center text-xl font-black text-white" style={{ background: 'radial-gradient(circle at 38% 30%, #fb923c, #c2410c)', boxShadow: '0 0 20px rgba(249,115,22,0.6), inset 0 2px 5px rgba(255,255,255,0.5)' }}>⚙️</div>

        {/* caja lista para disparar */}
        <div className={`absolute left-1/2 -ml-4 w-8 h-8 rounded-md flex items-center justify-center text-base ${justPop ? 'gfx-pop' : ''}`} style={{ top: SIZE - 30, background: 'linear-gradient(160deg,#fde68a,#f59e0b)', boxShadow: '0 0 12px rgba(245,158,11,0.7), inset 0 2px 3px rgba(255,255,255,0.5)' }}>📦</div>
      </div>

      <p className="text-white/40 text-[10px] font-bold uppercase tracking-wide mt-6 text-center px-6">Cada caja colocada suma · choca una y eliminado</p>
    </div>
  );
}

export function RuedaGame(props) {
  return (
    <GameShell
      {...props}
      day={24} title="Rueda" emoji="🎡" accent="orange"
      instructions={[
        <span key="1">Una <strong>rueda gira</strong> con cajas ya pegadas. Tú tienes cajas para lanzar.</span>,
        <span key="2"><strong>Toca</strong> para clavar una caja en la rueda… justo en un <strong>hueco libre</strong>.</span>,
        <span key="3">Si una caja choca con otra, eliminado. Cada vez gira más rápido y cambia de sentido. (70 pts por caja)</span>,
      ]}
    >
      {({ end }) => <Play end={end} />}
    </GameShell>
  );
}
