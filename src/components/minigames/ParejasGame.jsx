import React, { useState, useRef } from 'react';
import { GameShell, clamp, shuffle } from './GameShell';

const EMOJIS = ['🍎', '🥖', '🧀', '🥛', '🍫', '🧃', '🥚', '🍌'];

function Play({ end }) {
  const [cards] = useState(() => shuffle([...EMOJIS, ...EMOJIS].map((e, i) => ({ id: i, emoji: e }))));
  const [flipped, setFlipped] = useState([]); // ids boca arriba (temporales)
  const [matched, setMatched] = useState([]); // ids emparejados
  const [moves, setMoves] = useState(0);
  const startRef = useRef(Date.now());
  const lockRef = useRef(false);

  const tap = (card) => {
    if (lockRef.current || flipped.includes(card.id) || matched.includes(card.id)) return;
    const next = [...flipped, card.id];
    setFlipped(next);
    if (next.length === 2) {
      lockRef.current = true;
      setMoves(m => m + 1);
      const [a, b] = next.map(id => cards.find(c => c.id === id));
      if (a.emoji === b.emoji) {
        setTimeout(() => {
          const newMatched = [...matched, a.id, b.id];
          setMatched(newMatched);
          setFlipped([]);
          lockRef.current = false;
          if (newMatched.length === cards.length) {
            const sec = (Date.now() - startRef.current) / 1000;
            end(clamp(Math.round(1000 - sec * 12 - Math.max(0, moves + 1 - 10) * 15), 50, 1000));
          }
        }, 350);
      } else {
        setTimeout(() => { setFlipped([]); lockRef.current = false; }, 750);
      }
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-5 pb-6">
      <p className="text-white/60 font-bold uppercase tracking-widest text-xs mb-4">Movimientos: {moves}</p>
      <div className="grid grid-cols-4 gap-2.5 w-full max-w-sm">
        {cards.map(card => {
          const isUp = flipped.includes(card.id) || matched.includes(card.id);
          const isMatched = matched.includes(card.id);
          return (
            <button
              key={card.id}
              onPointerDown={() => tap(card)}
              className={`aspect-square rounded-2xl flex items-center justify-center text-3xl transition-all duration-200 border-b-4 active:scale-95 ${
                isMatched ? 'bg-emerald-500/30 border-emerald-700/30 opacity-60'
                : isUp ? 'bg-white border-slate-300'
                : 'bg-pink-600 border-pink-800'
              }`}
            >
              {isUp ? card.emoji : '❓'}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ParejasGame(props) {
  return (
    <GameShell
      {...props}
      day={7} title="Parejas" emoji="🃏" accent="pink"
      instructions={[
        <span key="1">Hay <strong>8 parejas de productos</strong> boca abajo.</span>,
        <span key="2">Levanta 2 cartas por turno y <strong>encuentra todas las parejas</strong>.</span>,
        <span key="3">Cuanto más rápido y con menos movimientos, más puntos.</span>,
      ]}
    >
      {({ end }) => <Play end={end} />}
    </GameShell>
  );
}
