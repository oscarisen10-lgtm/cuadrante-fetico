import React, { useState, useRef } from 'react';
import { GameShell, clamp, shuffle, fx } from './GameShell';

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
              className={`aspect-square rounded-2xl flex items-center justify-center text-3xl transition-all duration-200 border-b-4 active:scale-95 ${isMatched ? 'opacity-50 border-emerald-900/40' : isUp ? 'border-slate-300' : 'border-pink-900'}`}
              style={isMatched ? fx.tile('#34d399', '#059669', 'rgba(16,185,129,0.4)') : isUp ? fx.tile('#ffffff', '#e2e8f0') : fx.tile('#f472b6', '#be185d', 'rgba(236,72,153,0.5)')}
            >
              {isUp ? card.emoji : <span className="text-white/90 drop-shadow">❓</span>}
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
