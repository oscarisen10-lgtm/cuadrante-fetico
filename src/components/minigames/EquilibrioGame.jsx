import React, { useState, useEffect, useRef } from 'react';
import { GameShell, clamp } from './GameShell';

const GRACE = 1200;     // ms de arranque estable
const CENTER = 50;      // centro de la pista (%)
const BAR_START = 62;   // ancho inicial de la barra (%)
const BAR_MIN = 15;     // ancho mínimo (%)
const BAR_Y = 112;      // posición vertical de la barra dentro de la escena (px)

// Caja de madera (CSS): tablones, aspas en X y esquineras metálicas.
function Crate({ danger }) {
  return (
    <div
      className="relative w-[52px] h-[52px] rounded-[4px] overflow-hidden"
      style={{
        background: 'linear-gradient(180deg,#d9a85c,#7c4a16)',
        border: `2px solid ${danger ? '#9f1239' : '#5b3410'}`,
        boxShadow: danger
          ? '0 5px 12px rgba(0,0,0,0.45), 0 0 18px rgba(225,29,72,0.6), inset 0 2px 3px rgba(255,255,255,0.4)'
          : '0 6px 14px rgba(0,0,0,0.45), inset 0 2px 3px rgba(255,255,255,0.45), inset 0 -5px 9px rgba(0,0,0,0.3)',
      }}
    >
      {/* vetas verticales de los tablones */}
      <div className="absolute inset-0 opacity-40" style={{ background: 'repeating-linear-gradient(90deg, rgba(0,0,0,0.20) 0 1px, transparent 1px 12px)' }} />
      {/* aspas en X */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rotate-45 w-[150%] h-[6px]" style={{ background: 'linear-gradient(180deg,#ecc680,#a9722e)', boxShadow: '0 1px 1px rgba(0,0,0,0.35)' }} />
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-45 w-[150%] h-[6px]" style={{ background: 'linear-gradient(180deg,#ecc680,#a9722e)', boxShadow: '0 1px 1px rgba(0,0,0,0.35)' }} />
      {/* marco superior/inferior (listones) */}
      <div className="absolute top-0 left-0 right-0 h-[6px]" style={{ background: 'linear-gradient(180deg,#e6bd76,#b07e34)' }} />
      <div className="absolute bottom-0 left-0 right-0 h-[6px]" style={{ background: 'linear-gradient(0deg,#6b3f12,#9c6a28)' }} />
      {/* esquineras metálicas */}
      <span className="absolute top-[3px] left-[3px] w-2 h-2 rounded-[2px]" style={{ background: 'linear-gradient(150deg,#9ca3af,#374151)', boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.4)' }} />
      <span className="absolute top-[3px] right-[3px] w-2 h-2 rounded-[2px]" style={{ background: 'linear-gradient(150deg,#9ca3af,#374151)', boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.4)' }} />
      <span className="absolute bottom-[3px] left-[3px] w-2 h-2 rounded-[2px]" style={{ background: 'linear-gradient(150deg,#9ca3af,#374151)', boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.4)' }} />
      <span className="absolute bottom-[3px] right-[3px] w-2 h-2 rounded-[2px]" style={{ background: 'linear-gradient(150deg,#9ca3af,#374151)', boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.4)' }} />
    </div>
  );
}

function Play({ end }) {
  const [, render] = useState(0);
  const offRef = useRef(0);        // posición de la caja relativa al centro de la barra (%)
  const velRef = useRef(0);        // velocidad horizontal de la caja
  const tRef = useRef(0);
  const aliveRef = useRef(true);
  const endRef = useRef(end);
  endRef.current = end;

  const barWidth = () => Math.max(BAR_MIN, BAR_START - (tRef.current / 1000) * 0.78); // se encoge
  const ramp = () => clamp((tRef.current - GRACE) / 4000, 0, 1);                      // arranque suave del movimiento
  const barTiltAt = () => {
    const after = Math.max(0, tRef.current - GRACE);
    const amp = ramp() * Math.min(12, 5 + (after / 1000) * 0.15);
    return Math.sin(tRef.current * 0.00085) * amp;                                    // la viga cabecea
  };
  const barCenterAt = () => {
    const after = Math.max(0, tRef.current - GRACE);
    const amp = ramp() * Math.min(9, 4 + (after / 1000) * 0.1);
    return CENTER + Math.sin(tRef.current * 0.0011) * amp;                            // y oscila de lado
  };

  useEffect(() => {
    let raf, last = performance.now();
    const loop = (now) => {
      if (!aliveRef.current) return;
      const dt = Math.min(40, now - last); last = now;
      const f = dt / 16.67;
      tRef.current += dt;

      if (tRef.current > GRACE) {
        const tSec = (tRef.current - GRACE) / 1000;
        const tilt = barTiltAt();
        velRef.current += Math.sin(tilt * Math.PI / 180) * 0.55 * f;     // la inclinación de la barra hace resbalar la caja
        velRef.current += (Math.random() - 0.5) * (0.04 + tSec * 0.0007) * f; // ráfagas de viento
        velRef.current += offRef.current * 0.0008 * f;                   // ligera inestabilidad
      }
      velRef.current *= Math.pow(0.9, f);
      velRef.current = clamp(velRef.current, -2, 2);
      offRef.current += velRef.current * f;

      if (Math.abs(offRef.current) > barWidth() / 2) {                   // se sale de la barra -> cae
        aliveRef.current = false;
        endRef.current(clamp(Math.round(tRef.current / 100), 0, 2000));
        return;
      }
      render(n => n + 1);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { aliveRef.current = false; cancelAnimationFrame(raf); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const push = (dir) => { velRef.current = clamp(velRef.current + dir * 0.2, -2, 2); offRef.current += dir * 0.7; };

  const off = offRef.current;
  const bw = barWidth();
  const barCenter = barCenterAt();
  const barTilt = barTiltAt();
  const danger = Math.abs(off) > bw / 2 * 0.72;
  const boxWobble = clamp(velRef.current * 7 + off * 0.4, -22, 22);
  const calm = tRef.current <= GRACE;

  return (
    <div className="flex-1 flex flex-col items-center px-6 pt-3 select-none">
      <span className={`bg-black/30 font-black px-4 py-1.5 rounded-full text-sm ${danger ? 'text-rose-400 animate-pulse' : 'text-amber-300'}`}>⏱ {(tRef.current / 1000).toFixed(1)}s</span>
      <p className={`font-bold uppercase tracking-widest text-xs mt-3 ${calm ? 'text-emerald-300 animate-pulse' : 'text-white/60'}`}>
        {calm ? '¡Prepárate!' : 'Mantén la caja sobre la barra'}
      </p>

      {/* Escena centrada verticalmente */}
      <div className="flex-1 w-full flex items-center justify-center">
        <div className="relative w-full max-w-sm" style={{ height: 190 }}>
          {/* GRUPO viga+caja: oscila de lado (translateX) y cabecea (rotate) */}
          <div
            className="absolute inset-x-0 top-0 h-full"
            style={{ transformOrigin: `50% ${BAR_Y}px`, transform: `translateX(${barCenter - CENTER}%) rotate(${barTilt}deg)` }}
          >
            {/* sombra de la caja sobre la barra */}
            <div className="absolute rounded-[50%] bg-black/35" style={{ left: `${CENTER + off}%`, top: BAR_Y - 2, width: 46, height: 10, transform: 'translateX(-50%)' }} />

            {/* Barra estabilizadora (se encoge y se mueve) */}
            <div
              className="absolute left-1/2 -translate-x-1/2 rounded-full"
              style={{
                top: BAR_Y, height: 13, width: `${bw}%`,
                background: danger ? 'linear-gradient(180deg,#fb7185,#be123c)' : 'linear-gradient(180deg,#fde68a,#d97706)',
                boxShadow: danger ? '0 0 26px rgba(225,29,72,0.7), inset 0 2px 3px rgba(255,255,255,0.4)' : '0 8px 18px rgba(0,0,0,0.45), inset 0 2px 4px rgba(255,255,255,0.6), 0 0 18px rgba(245,158,11,0.35)',
              }}
            />
            {/* topes en los extremos de la barra */}
            <div className="absolute rounded-full" style={{ left: `${CENTER - bw / 2}%`, top: BAR_Y - 2, width: 6, height: 17, transform: 'translateX(-50%)', background: '#92400e' }} />
            <div className="absolute rounded-full" style={{ left: `${CENTER + bw / 2}%`, top: BAR_Y - 2, width: 6, height: 17, transform: 'translateX(-50%)', background: '#92400e' }} />
            {/* marca de centro */}
            <div className="absolute left-1/2 -translate-x-1/2 rounded-full bg-white/40" style={{ top: BAR_Y + 1, height: 9, width: 2 }} />

            {/* Caja que se balancea encima */}
            <div
              className="absolute"
              style={{ left: `${CENTER + off}%`, top: BAR_Y, transform: `translateX(-50%) translateY(-100%) rotate(${boxWobble}deg)`, transformOrigin: '50% 100%' }}
            >
              <Crate danger={danger} />
            </div>
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
        <span key="1">Una <strong>viga flotante</strong> se balancea y cabecea, y la <strong>caja resbala</strong> con ella.</span>,
        <span key="2">Toca <strong>◄</strong> y <strong>►</strong> para mantener la caja <strong>centrada sobre la barra</strong>.</span>,
        <span key="3">¡La <strong>barra se va encogiendo</strong>! Aguanta lo máximo: cada segundo suma.</span>,
      ]}
    >
      {({ end }) => <Play end={end} />}
    </GameShell>
  );
}
