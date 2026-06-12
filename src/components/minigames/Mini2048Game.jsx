import React, { useState, useRef } from 'react';
import { GameShell, rand } from './GameShell';

const COLORS = {
  2: 'bg-slate-200 text-slate-700', 4: 'bg-amber-100 text-amber-800', 8: 'bg-amber-300 text-amber-900',
  16: 'bg-orange-400 text-white', 32: 'bg-orange-500 text-white', 64: 'bg-rose-500 text-white',
  128: 'bg-violet-400 text-white', 256: 'bg-violet-500 text-white', 512: 'bg-indigo-500 text-white',
  1024: 'bg-emerald-500 text-white', 2048: 'bg-emerald-400 text-emerald-950',
};

const emptyBoard = () => Array(16).fill(0);
const addTile = (b) => {
  const empty = b.map((v, i) => (v === 0 ? i : -1)).filter(i => i >= 0);
  if (!empty.length) return b;
  const nb = [...b];
  nb[empty[rand(0, empty.length - 1)]] = Math.random() < 0.9 ? 2 : 4;
  return nb;
};

// Desliza y fusiona una fila hacia la izquierda; devuelve [fila, puntos]
const slideRow = (row) => {
  const vals = row.filter(v => v !== 0);
  const out = [];
  let gained = 0;
  for (let i = 0; i < vals.length; i++) {
    if (vals[i] === vals[i + 1]) {
      out.push(vals[i] * 2);
      gained += vals[i] * 2;
      i++;
    } else out.push(vals[i]);
  }
  while (out.length < 4) out.push(0);
  return [out, gained];
};

const getRow = (b, r) => [b[r * 4], b[r * 4 + 1], b[r * 4 + 2], b[r * 4 + 3]];
const getCol = (b, c) => [b[c], b[c + 4], b[c + 8], b[c + 12]];

const move = (b, dirX, dirY) => {
  const nb = [...b];
  let gained = 0;
  for (let i = 0; i < 4; i++) {
    let line = dirX !== 0 ? getRow(b, i) : getCol(b, i);
    if (dirX > 0 || dirY > 0) line = line.reverse();
    const [slid, g] = slideRow(line);
    gained += g;
    let final = (dirX > 0 || dirY > 0) ? [...slid].reverse() : slid;
    for (let j = 0; j < 4; j++) {
      if (dirX !== 0) nb[i * 4 + j] = final[j];
      else nb[j * 4 + i] = final[j];
    }
  }
  const changed = nb.some((v, i) => v !== b[i]);
  return [nb, gained, changed];
};

const hasMoves = (b) => {
  if (b.includes(0)) return true;
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
    const v = b[r * 4 + c];
    if (c < 3 && b[r * 4 + c + 1] === v) return true;
    if (r < 3 && b[(r + 1) * 4 + c] === v) return true;
  }
  return false;
};

function Play({ end }) {
  const [board, setBoard] = useState(() => addTile(addTile(emptyBoard())));
  const [score, setScore] = useState(0);
  const touchStart = useRef(null);

  const doMove = (dx, dy) => {
    setBoard(prev => {
      const [nb, gained, changed] = move(prev, dx, dy);
      if (!changed) return prev;
      const withTile = addTile(nb);
      setScore(s => {
        const ns = s + gained;
        if (!hasMoves(withTile)) setTimeout(() => end(ns), 350);
        return ns;
      });
      return withTile;
    });
  };

  const onTouchStart = (e) => { const t = e.touches[0]; touchStart.current = { x: t.clientX, y: t.clientY }; };
  const onTouchEnd = (e) => {
    if (!touchStart.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStart.current.x;
    const dy = t.clientY - touchStart.current.y;
    touchStart.current = null;
    if (Math.abs(dx) < 25 && Math.abs(dy) < 25) return;
    if (Math.abs(dx) > Math.abs(dy)) doMove(Math.sign(dx), 0); else doMove(0, Math.sign(dy));
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-5 pb-6 select-none">
      <p className="text-white/60 font-bold uppercase tracking-widest text-xs mb-3">Puntos: <span className="text-amber-400">{score}</span></p>
      <div
        className="grid grid-cols-4 gap-2 w-full max-w-sm aspect-square bg-black/40 border-2 border-amber-500/30 rounded-2xl p-2 touch-none"
        onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}
      >
        {board.map((v, i) => (
          <div key={i} className={`rounded-xl flex items-center justify-center font-black transition-all duration-100 ${v === 0 ? 'bg-white/5' : COLORS[v] || 'bg-emerald-300 text-emerald-950'} ${v >= 100 ? 'text-xl' : 'text-2xl'}`}>
            {v || ''}
          </div>
        ))}
      </div>
      <p className="text-white/40 text-[10px] font-bold uppercase tracking-wide mt-3">Desliza para mover las fichas</p>
      <button onClick={() => end(score)} className="mt-3 bg-white/10 text-white/80 font-black text-xs uppercase px-6 py-2.5 rounded-full active:scale-95">
        Plantarse y guardar puntos
      </button>
    </div>
  );
}

export function Mini2048Game(props) {
  return (
    <GameShell
      {...props}
      day={12} title="Fusión 2048" emoji="🔢" accent="amber"
      instructions={[
        <span key="1"><strong>Desliza</strong> en cualquier dirección para mover todas las fichas.</span>,
        <span key="2">Dos fichas iguales se <strong>fusionan y suman puntos</strong>.</span>,
        <span key="3">Si el tablero se llena sin movimientos, fin. También puedes <strong>plantarte</strong> cuando quieras.</span>,
      ]}
    >
      {({ end }) => <Play end={end} />}
    </GameShell>
  );
}
