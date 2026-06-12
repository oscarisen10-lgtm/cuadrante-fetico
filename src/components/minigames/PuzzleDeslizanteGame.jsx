import React, { useState, useRef } from 'react';
import { GameShell, clamp, rand } from './GameShell';

// Baraja aplicando movimientos válidos desde el estado resuelto (siempre tiene solución)
const shuffleBoard = () => {
  let b = [1, 2, 3, 4, 5, 6, 7, 8, 0];
  let hole = 8;
  for (let i = 0; i < 120; i++) {
    const candidates = [];
    const r = Math.floor(hole / 3), c = hole % 3;
    if (r > 0) candidates.push(hole - 3);
    if (r < 2) candidates.push(hole + 3);
    if (c > 0) candidates.push(hole - 1);
    if (c < 2) candidates.push(hole + 1);
    const pick = candidates[rand(0, candidates.length - 1)];
    [b[hole], b[pick]] = [b[pick], b[hole]];
    hole = pick;
  }
  return b;
};

const isSolved = (b) => b.every((v, i) => v === ((i + 1) % 9));

function Play({ end }) {
  const [board, setBoard] = useState(shuffleBoard);
  const [moves, setMoves] = useState(0);
  const startRef = useRef(Date.now());

  const tap = (idx) => {
    const hole = board.indexOf(0);
    const r1 = Math.floor(idx / 3), c1 = idx % 3;
    const r2 = Math.floor(hole / 3), c2 = hole % 3;
    if (Math.abs(r1 - r2) + Math.abs(c1 - c2) !== 1) return;
    const nb = [...board];
    [nb[hole], nb[idx]] = [nb[idx], nb[hole]];
    const nm = moves + 1;
    setBoard(nb);
    setMoves(nm);
    if (isSolved(nb)) {
      const sec = (Date.now() - startRef.current) / 1000;
      end(clamp(Math.round(1000 - sec * 8 - nm * 3), 100, 1000));
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 pb-8">
      <p className="text-white/60 font-bold uppercase tracking-widest text-xs mb-4">Movimientos: {moves}</p>
      <div className="grid grid-cols-3 gap-2 w-full max-w-[300px] aspect-square bg-black/40 border-2 border-cyan-500/30 rounded-2xl p-2">
        {board.map((v, i) => (
          v === 0 ? <div key={i} className="rounded-xl bg-white/5" /> : (
            <button
              key={i}
              onPointerDown={() => tap(i)}
              className="rounded-xl bg-cyan-500 text-cyan-950 font-black text-3xl border-b-4 border-cyan-700 active:scale-95 transition-transform flex items-center justify-center"
            >
              {v}
            </button>
          )
        ))}
      </div>
      <p className="text-white/40 text-[10px] font-bold uppercase tracking-wide mt-4">Ordena del 1 al 8 · El hueco es tu aliado</p>
    </div>
  );
}

export function PuzzleDeslizanteGame(props) {
  return (
    <GameShell
      {...props}
      day={15} title="Puzzle Express" emoji="🧩" accent="cyan"
      instructions={[
        <span key="1">Desliza las fichas hacia el hueco para <strong>ordenarlas del 1 al 8</strong>.</span>,
        <span key="2">Toca una ficha junto al hueco para moverla.</span>,
        <span key="3">Menos tiempo y menos movimientos = más puntos.</span>,
      ]}
    >
      {({ end }) => <Play end={end} />}
    </GameShell>
  );
}
