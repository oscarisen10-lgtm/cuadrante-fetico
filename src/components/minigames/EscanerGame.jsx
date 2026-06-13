import React, { useState, useEffect, useRef } from 'react';
import { GameShell, clamp, rand } from './GameShell';

const MAX_FAILS = 3;

function Play({ end }) {
  const [, render] = useState(0);
  const [hits, setHits] = useState(0);
  const [fails, setFails] = useState(0);
  const [level, setLevel] = useState(1);
  const [flash, setFlash] = useState(null); // 'ok' | 'ko'

  const posRef = useRef(8);          // posición del láser (0-100 %)
  const dirRef = useRef(1);
  const speedRef = useRef(0.6);
  const zoneRef = useRef({ start: 40, width: 26 });
  const hitsRef = useRef(0);
  const failsRef = useRef(0);
  const levelRef = useRef(1);
  const lockRef = useRef(false);
  const endRef = useRef(end);
  endRef.current = end;

  const newZone = () => {
    const width = clamp(28 - levelRef.current * 1.5, 7, 28);   // se estrecha al subir
    const start = rand(6, Math.max(7, Math.floor(100 - width - 6)));
    zoneRef.current = { start, width };
    speedRef.current = 0.55 + levelRef.current * 0.07;          // y va más rápido
  };

  // Bucle del láser (rAF, se monta una sola vez).
  useEffect(() => {
    newZone();
    let raf, last = performance.now();
    const loop = (now) => {
      const dt = Math.min(40, now - last); last = now;
      let p = posRef.current + dirRef.current * speedRef.current * (dt / 16);
      if (p >= 100) { p = 100; dirRef.current = -1; }
      if (p <= 0) { p = 0; dirRef.current = 1; }
      posRef.current = p;
      render(n => n + 1);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scan = () => {
    if (lockRef.current) return;
    const { start, width } = zoneRef.current;
    const inZone = posRef.current >= start && posRef.current <= start + width;
    lockRef.current = true;
    if (inZone) {
      hitsRef.current += 1;
      levelRef.current += 1;
      setHits(hitsRef.current);
      setLevel(levelRef.current);
      setFlash('ok');
      setTimeout(() => { setFlash(null); lockRef.current = false; newZone(); }, 180);
    } else {
      failsRef.current += 1;
      setFails(failsRef.current);
      setFlash('ko');
      if (failsRef.current >= MAX_FAILS) {
        setTimeout(() => endRef.current(clamp(hitsRef.current * 80 + levelRef.current * 10, 0, 2000)), 450);
      } else {
        setTimeout(() => { setFlash(null); lockRef.current = false; }, 350);
      }
    }
  };

  const { start, width } = zoneRef.current;
  const livesLeft = Math.max(0, MAX_FAILS - fails);

  return (
    <div
      className={`flex-1 flex flex-col items-center justify-center px-6 pb-8 select-none transition-colors duration-150 ${flash === 'ok' ? 'bg-emerald-500/10' : flash === 'ko' ? 'bg-rose-500/25' : ''}`}
      onPointerDown={scan}
    >
      <div className="flex items-center gap-3 mb-8">
        <span className="bg-black/30 text-cyan-300 font-black px-4 py-1.5 rounded-full text-sm">Nivel {level}</span>
        <span className="bg-black/30 text-emerald-400 font-black px-4 py-1.5 rounded-full text-sm">✓ {hits}</span>
        <span className="bg-black/30 font-black px-3 py-1.5 rounded-full text-sm">{'❤️'.repeat(livesLeft)}{'🖤'.repeat(fails)}</span>
      </div>
      <p className="text-white/70 font-bold uppercase tracking-widest text-xs mb-6 text-center max-w-[280px] leading-relaxed">Pulsa cuando el láser cruce el <strong className="text-cyan-300">código de barras</strong></p>

      {/* Pista del escáner */}
      <div className="relative w-full max-w-sm h-24 rounded-2xl overflow-hidden" style={{ background: 'linear-gradient(160deg, #0f172a, #020617)', boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.6), 0 0 22px rgba(8,145,178,0.3)' }}>
        {/* zona objetivo: código de barras */}
        <div className="absolute top-0 bottom-0 flex items-center justify-center gap-0.5 overflow-hidden" style={{ left: `${start}%`, width: `${width}%`, background: 'rgba(16,185,129,0.18)', borderLeft: '2px solid rgba(16,185,129,0.7)', borderRight: '2px solid rgba(16,185,129,0.7)' }}>
          {Array.from({ length: 8 }, (_, k) => <span key={k} className="h-3/5 bg-white/35" style={{ width: k % 2 ? 2 : 4 }} />)}
        </div>
        {/* láser */}
        <div className="absolute top-0 bottom-0 w-1.5 -ml-[3px]" style={{ left: `${posRef.current}%`, background: 'linear-gradient(180deg, #fb7185, #be123c)', boxShadow: '0 0 14px #f43f5e, 0 0 28px #f43f5e' }} />
      </div>

      <div className="mt-10 text-cyan-950 font-black text-2xl px-16 py-4 rounded-2xl border-b-4 border-cyan-800 pointer-events-none"
        style={{ background: 'linear-gradient(160deg, #67e8f9, #06b6d4)', boxShadow: '0 6px 18px rgba(6,182,212,0.5), inset 0 2px 5px rgba(255,255,255,0.5)' }}>
        ESCANEAR
      </div>
      <p className="text-white/40 text-[10px] font-bold uppercase tracking-wide mt-4">Toca en cualquier sitio para escanear</p>
    </div>
  );
}

export function EscanerGame(props) {
  return (
    <GameShell
      {...props}
      day={12} title="Escáner" emoji="🔦" accent="cyan"
      instructions={[
        <span key="1">El láser barre la pista. Pulsa justo cuando cruce el <strong>código de barras</strong> (zona verde).</span>,
        <span key="2">Cada acierto sube de nivel: el código se <strong>estrecha</strong> y el láser va <strong>más rápido</strong>.</span>,
        <span key="3">Pura <strong>puntería y destreza</strong>. ¡A los 3 fallos, eliminado!</span>,
      ]}
    >
      {({ end }) => <Play end={end} />}
    </GameShell>
  );
}
