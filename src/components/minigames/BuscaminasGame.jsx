import React, { useState, useRef } from 'react';
import { GameShell, clamp, shuffle } from './GameShell';

const N = 7;          // tablero 7x7
const MINES = 8;
const NUM_COLORS = ['', 'text-sky-400', 'text-emerald-400', 'text-rose-400', 'text-violet-400', 'text-amber-400', 'text-cyan-400', 'text-pink-400', 'text-white'];

const neighbors = (i) => {
  const r = Math.floor(i / N), c = i % N;
  const out = [];
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    if (!dr && !dc) continue;
    const nr = r + dr, nc = c + dc;
    if (nr >= 0 && nr < N && nc >= 0 && nc < N) out.push(nr * N + nc);
  }
  return out;
};

function Play({ end }) {
  const [mines, setMines] = useState(null); // Set de índices (se coloca tras el 1er toque)
  const [revealed, setRevealed] = useState(new Set());
  const [boom, setBoom] = useState(-1);
  const startRef = useRef(Date.now());

  const placeMines = (safe) => {
    const banned = new Set([safe, ...neighbors(safe)]);
    const candidates = shuffle(Array.from({ length: N * N }, (_, i) => i).filter(i => !banned.has(i)));
    return new Set(candidates.slice(0, MINES));
  };

  const countAround = (i, ms) => neighbors(i).filter(n => ms.has(n)).length;

  const tap = (i) => {
    if (revealed.has(i) || boom >= 0) return;
    let ms = mines;
    if (!ms) { ms = placeMines(i); setMines(ms); }

    if (ms.has(i)) {
      setBoom(i);
      setTimeout(() => end(clamp(revealed.size * 12, 0, 1000)), 900);
      return;
    }
    // Revelado con expansión de ceros (BFS)
    const nr = new Set(revealed);
    const queue = [i];
    while (queue.length) {
      const cur = queue.pop();
      if (nr.has(cur) || ms.has(cur)) continue;
      nr.add(cur);
      if (countAround(cur, ms) === 0) neighbors(cur).forEach(n => { if (!nr.has(n)) queue.push(n); });
    }
    setRevealed(nr);
    if (nr.size === N * N - MINES) {
      const sec = (Date.now() - startRef.current) / 1000;
      end(clamp(Math.round(600 + Math.max(0, 400 - sec * 8)), 600, 1000));
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 pb-6">
      <p className="text-white/60 font-bold uppercase tracking-widest text-xs mb-4">💣 {MINES} minas · Casillas seguras: {revealed.size}/{N * N - MINES}</p>
      <div className="grid grid-cols-7 gap-1 w-full max-w-sm aspect-square bg-black/40 border-2 border-slate-500/30 rounded-2xl p-1.5">
        {Array.from({ length: N * N }, (_, i) => {
          const isRevealed = revealed.has(i);
          const count = isRevealed && mines ? countAround(i, mines) : 0;
          return (
            <button
              key={i}
              onPointerDown={() => tap(i)}
              className={`rounded-md flex items-center justify-center font-black text-sm transition-all ${
                boom === i ? 'bg-rose-500 animate-pulse'
                : isRevealed ? 'bg-white/5'
                : 'bg-slate-600 border-b-2 border-slate-800 active:scale-90'
              }`}
            >
              {boom === i ? '💥' : isRevealed && count > 0 ? <span className={NUM_COLORS[count]}>{count}</span> : ''}
            </button>
          );
        })}
      </div>
      <p className="text-white/40 text-[10px] font-bold uppercase tracking-wide mt-4">El primer toque siempre es seguro</p>
    </div>
  );
}

export function BuscaminasGame(props) {
  return (
    <GameShell
      {...props}
      day={16} title="Buscaminas" emoji="💣" accent="red"
      instructions={[
        <span key="1">Destapa todas las casillas <strong>sin pisar las 8 minas</strong>.</span>,
        <span key="2">Cada número te dice <strong>cuántas minas hay alrededor</strong> de esa casilla.</span>,
        <span key="3">Despeja el tablero entero para el bonus. ¡El primer toque es seguro!</span>,
      ]}
    >
      {({ end }) => <Play end={end} />}
    </GameShell>
  );
}
