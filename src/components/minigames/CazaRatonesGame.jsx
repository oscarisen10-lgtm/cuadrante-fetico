import React, { useState, useEffect, useRef } from 'react';
import { GameShell, clamp, rand } from './GameShell';

const DURATION = 45;

function Play({ end }) {
  const [moles, setMoles] = useState([]); // [{ id, cell, born, life }]
  const [hits, setHits] = useState(0);
  const [timeLeft, setTimeLeft] = useState(DURATION);
  const [level, setLevel] = useState(1);

  const molesRef = useRef([]);   // fuente de verdad (evita estados obsoletos)
  const hitsRef = useRef(0);
  const idRef = useRef(0);
  const endRef = useRef(end);
  endRef.current = end;

  const finish = () => endRef.current(clamp(hitsRef.current * 30, 0, 1500));

  // Temporizador robusto: se crea una sola vez.
  useEffect(() => {
    const id = setInterval(() => {
      setTimeLeft(t => { if (t <= 1) { clearInterval(id); finish(); return 0; } return t - 1; });
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Generador de ratones: tick fijo; la dificultad escala con las cazas (hitsRef).
  useEffect(() => {
    const tick = setInterval(() => {
      const now = Date.now();
      let next = molesRef.current.filter(m => now - m.born < m.life); // quita los que se escondieron
      const lvl = Math.floor(hitsRef.current / 5);
      const maxSim = Math.min(1 + lvl, 4);                 // de 1 hasta 4 ratones a la vez
      const chance = Math.min(0.32 + lvl * 0.05, 0.65);    // aparecen más a menudo al subir
      if (next.length < maxSim && Math.random() < chance) {
        const occupied = new Set(next.map(m => m.cell));
        const free = [];
        for (let c = 0; c < 9; c++) if (!occupied.has(c)) free.push(c);
        if (free.length) {
          const cell = free[rand(0, free.length - 1)];
          const life = Math.max(650, 1300 - lvl * 90);     // viven menos al subir = más rápidos
          next = [...next, { id: idRef.current++, cell, born: now, life }];
        }
      }
      molesRef.current = next;
      setMoles(next);
    }, 280);
    return () => clearInterval(tick);
  }, []);

  const whack = (cell) => {
    if (!molesRef.current.some(m => m.cell === cell)) return; // no hay ratón ahí
    molesRef.current = molesRef.current.filter(m => m.cell !== cell);
    setMoles(molesRef.current);
    hitsRef.current += 1;
    setHits(hitsRef.current);
    setLevel(1 + Math.floor(hitsRef.current / 5));
  };

  const moleCells = new Set(moles.map(m => m.cell));

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 pb-8">
      <div className="flex items-center gap-3 mb-6">
        <span className={`bg-black/30 font-black px-4 py-1.5 rounded-full text-sm ${timeLeft <= 10 ? 'text-rose-400 animate-pulse' : 'text-white'}`}>⏱ {timeLeft}s</span>
        <span className="bg-black/30 text-orange-400 font-black px-4 py-1.5 rounded-full text-sm">🐭 {hits}</span>
        <span className="bg-black/30 text-amber-300 font-black px-4 py-1.5 rounded-full text-sm">Nivel {level}</span>
      </div>
      <p className="text-white/60 font-bold uppercase tracking-widest text-xs mb-5">¡Échalos del almacén!</p>
      <div className="grid grid-cols-3 gap-3.5 w-full max-w-xs">
        {Array.from({ length: 9 }, (_, i) => {
          const up = moleCells.has(i);
          return (
            <button
              key={i}
              onPointerDown={() => whack(i)}
              className={`aspect-square rounded-3xl flex items-center justify-center text-5xl border-b-[6px] transition-all duration-75 active:scale-95 ${up ? 'border-orange-800 scale-105' : 'border-amber-950'}`}
              style={up
                ? { background: 'radial-gradient(circle at 40% 28%, #fdba74, #f97316)', boxShadow: '0 0 26px rgba(249,115,22,0.7), inset 0 2px 6px rgba(255,255,255,0.45)' }
                : { background: 'linear-gradient(160deg, #c08a4f, #6b4a28)', boxShadow: 'inset 0 2px 5px rgba(255,255,255,0.3), inset 0 -6px 12px rgba(0,0,0,0.4)' }}
            >
              <span className={up ? 'gfx-pop drop-shadow-[0_3px_4px_rgba(0,0,0,0.5)]' : 'drop-shadow-[0_2px_3px_rgba(0,0,0,0.4)]'}>{up ? '🐭' : '📦'}</span>
            </button>
          );
        })}
      </div>
      <p className="text-white/40 text-[10px] font-bold uppercase tracking-wide mt-5 text-center px-6">Cada 5 cazas sube el nivel: más rápidos y más a la vez</p>
    </div>
  );
}

export function CazaRatonesGame(props) {
  return (
    <GameShell
      {...props}
      day={10} title="Caza Ratones" emoji="🐭" accent="orange"
      instructions={[
        <span key="1">¡Hay ratones en el almacén! Salen de entre las <strong>cajas</strong>.</span>,
        <span key="2">Tócalos antes de que se escondan. Cada caza son <strong>30 puntos</strong>.</span>,
        <span key="3"><strong>45 segundos</strong>. Cada 5 cazas <strong>sube el nivel</strong>: van más rápido y salen varios a la vez.</span>,
      ]}
    >
      {({ end }) => <Play end={end} />}
    </GameShell>
  );
}
