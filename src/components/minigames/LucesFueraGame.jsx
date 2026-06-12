import React, { useState, useRef } from 'react';
import { GameShell, clamp, rand } from './GameShell';

const N = 5;

// Conmuta una celda y sus vecinas ortogonales
const toggleAt = (board, i) => {
  const nb = [...board];
  const r = Math.floor(i / N), c = i % N;
  [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([dr, dc]) => {
    const nr = r + dr, nc = c + dc;
    if (nr >= 0 && nr < N && nc >= 0 && nc < N) nb[nr * N + nc] = !nb[nr * N + nc];
  });
  return nb;
};

// Parte del estado resuelto y aplica pulsaciones aleatorias (siempre solucionable)
const makeBoard = () => {
  let b = Array(N * N).fill(false);
  for (let i = 0; i < 8; i++) b = toggleAt(b, rand(0, N * N - 1));
  if (b.every(v => !v)) b = toggleAt(b, rand(0, N * N - 1));
  return b;
};

function Play({ end }) {
  const [board, setBoard] = useState(makeBoard);
  const [moves, setMoves] = useState(0);
  const startRef = useRef(Date.now());

  const tap = (i) => {
    const nb = toggleAt(board, i);
    const nm = moves + 1;
    setBoard(nb);
    setMoves(nm);
    if (nb.every(v => !v)) {
      const sec = (Date.now() - startRef.current) / 1000;
      end(clamp(Math.round(1000 - sec * 8 - nm * 12), 100, 1000));
    }
  };

  const onCount = board.filter(Boolean).length;
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-5 pb-6">
      <div className="flex items-center gap-4 mb-5">
        <span className="bg-black/30 text-white font-black px-4 py-1.5 rounded-full text-sm">Movimientos: {moves}</span>
        <span className="bg-black/30 text-amber-400 font-black px-4 py-1.5 rounded-full text-sm">💡 {onCount}</span>
      </div>
      <div className="grid grid-cols-5 gap-2 w-full max-w-[320px] aspect-square bg-black/40 border-2 border-amber-500/30 rounded-2xl p-2">
        {board.map((on, i) => (
          <button
            key={i}
            onPointerDown={() => tap(i)}
            className={`rounded-xl flex items-center justify-center text-2xl transition-all duration-150 active:scale-90 ${
              on ? 'bg-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.6)]' : 'bg-slate-800'
            }`}
          >
            {on ? '💡' : ''}
          </button>
        ))}
      </div>
      <p className="text-white/40 text-[10px] font-bold uppercase tracking-wide mt-4 text-center px-6">
        Cada toque conmuta esa luz y las 4 de alrededor.<br />Es la hora del cierre: ¡apágalas todas!
      </p>
    </div>
  );
}

export function LucesFueraGame(props) {
  return (
    <GameShell
      {...props}
      day={30} title="Luces Fuera" emoji="💡" accent="amber"
      instructions={[
        <span key="1">Es la hora del cierre y hay que <strong>apagar todas las luces</strong> de la tienda.</span>,
        <span key="2">Cada toque apaga/enciende esa luz <strong>y las 4 vecinas</strong>.</span>,
        <span key="3">Menos movimientos y menos tiempo = más puntos. Siempre tiene solución.</span>,
      ]}
    >
      {({ end }) => <Play end={end} />}
    </GameShell>
  );
}
