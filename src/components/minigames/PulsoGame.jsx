import React, { useState, useEffect, useRef } from 'react';
import { GameShell, clamp, rand } from './GameShell';

const R = 80;
const rad = (d) => (d * Math.PI) / 180;
const pt = (ang) => [100 + R * Math.cos(rad(ang)), 100 + R * Math.sin(rad(ang))];
const within = (m, s, sz) => { const d = (((m - s) % 360) + 360) % 360; return d <= sz; };

function Play({ end }) {
  const [, render] = useState(0);
  const angRef = useRef(0);
  const dirRef = useRef(1);
  const speedRef = useRef(0.17);            // deg/ms
  const targetRef = useRef({ start: 200, size: 72 });
  const scoreRef = useRef(0);
  const overRef = useRef(false);
  const flashRef = useRef(0);
  const endRef = useRef(end);
  endRef.current = end;

  useEffect(() => {
    let raf, last = performance.now();
    const loop = (now) => {
      if (overRef.current) return;
      const dt = Math.min(40, now - last); last = now;
      angRef.current = (((angRef.current + dirRef.current * speedRef.current * dt) % 360) + 360) % 360;
      render(n => n + 1);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tap = () => {
    if (overRef.current) return;
    const { start, size } = targetRef.current;
    if (!within(angRef.current, start, size)) {
      overRef.current = true;
      endRef.current(clamp(scoreRef.current * 80, 0, 2000));
      return;
    }
    scoreRef.current += 1;
    flashRef.current = performance.now();
    // sube dificultad
    speedRef.current = Math.min(0.42, speedRef.current + 0.012);
    if (scoreRef.current % 3 === 0) dirRef.current *= -1;
    const newSize = Math.max(26, targetRef.current.size - 5);
    // nueva zona, lejos del marcador actual
    let newStart = rand(0, 359);
    if (within(angRef.current, newStart, newSize) || within(angRef.current, newStart - 30, newSize + 60)) newStart = (angRef.current + 180) % 360;
    targetRef.current = { start: newStart, size: newSize };
  };

  const ang = angRef.current;
  const { start, size } = targetRef.current;
  const [x1, y1] = pt(start);
  const [x2, y2] = pt(start + size);
  const largeArc = size > 180 ? 1 : 0;
  const [mx, my] = pt(ang);
  const flash = flashRef.current && performance.now() - flashRef.current < 220;

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 pb-8 select-none" onPointerDown={tap}>
      <span className="bg-black/30 text-pink-300 font-black px-5 py-1.5 rounded-full text-sm mb-5">🎯 {scoreRef.current}</span>
      <p className="text-white/60 font-bold uppercase tracking-widest text-xs mb-7 text-center max-w-[260px] leading-relaxed">Toca cuando el punto pase por la <strong className="text-emerald-300">zona verde</strong></p>

      <svg viewBox="0 0 200 200" className="w-72 h-72">
        {/* pista */}
        <circle cx="100" cy="100" r={R} fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth="14" />
        {/* zona objetivo */}
        <path d={`M ${x1} ${y1} A ${R} ${R} 0 ${largeArc} 1 ${x2} ${y2}`} fill="none" stroke="url(#pg)" strokeWidth="14" strokeLinecap="round" style={{ filter: 'drop-shadow(0 0 6px rgba(16,185,129,0.8))' }} />
        <defs>
          <linearGradient id="pg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#6ee7b7" />
            <stop offset="1" stopColor="#059669" />
          </linearGradient>
        </defs>
        {/* marcador */}
        <circle cx={mx} cy={my} r={flash ? 11 : 8.5} fill="#fff" style={{ filter: 'drop-shadow(0 0 8px rgba(255,255,255,0.9))' }} />
        {/* centro */}
        <circle cx="100" cy="100" r="34" fill="rgba(0,0,0,0.35)" />
        <text x="100" y="100" textAnchor="middle" dominantBaseline="central" fontSize="34" fontWeight="900" fill="#fff">{scoreRef.current}</text>
      </svg>

      <p className="text-white/40 text-[10px] font-bold uppercase tracking-wide mt-7 text-center px-6">Cada acierto encoge la zona y acelera · un fallo y eliminado</p>
    </div>
  );
}

export function PulsoGame(props) {
  return (
    <GameShell
      {...props}
      day={30} title="Pulso" emoji="🎯" accent="pink"
      instructions={[
        <span key="1">Un punto blanco <strong>gira</strong> alrededor del círculo.</span>,
        <span key="2"><strong>Toca</strong> justo cuando pase por la <strong>zona verde</strong>.</span>,
        <span key="3">Cada acierto la zona se <strong>encoge</strong> y va más rápido (y cambia de sentido). Un fallo y fin. (80 pts cada uno)</span>,
      ]}
    >
      {({ end }) => <Play end={end} />}
    </GameShell>
  );
}
