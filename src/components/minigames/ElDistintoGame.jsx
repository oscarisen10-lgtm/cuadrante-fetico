import React, { useState, useEffect, useRef } from 'react';
import { GameShell, clamp, rand } from './GameShell';

const PAIRS = [
  ['🍎', '🍅'], ['😀', '😄'], ['🐥', '🐤'], ['⭐', '🌟'], ['🍊', '🍑'],
  ['🐶', '🐕'], ['🧀', '🧈'], ['🌰', '🥔'], ['🥐', '🥯'], ['🍪', '🥠'],
];
const DURATION = 45;
const gridForRound = (round) => Math.min(6, 2 + Math.floor(round / 2));

const makeRound = (round) => {
  const size = gridForRound(round);
  const [a, b] = PAIRS[rand(0, PAIRS.length - 1)];
  const swap = Math.random() < 0.5;
  return { size, common: swap ? b : a, odd: swap ? a : b, oddIdx: rand(0, size * size - 1) };
};

function Play({ end }) {
  const [round, setRound] = useState(0);
  const [data, setData] = useState(() => makeRound(0));
  const [timeLeft, setTimeLeft] = useState(DURATION);
  const [flash, setFlash] = useState(null);
  const okRef = useRef(0);

  useEffect(() => {
    const id = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(id);
          end(clamp(okRef.current * 70, 0, 1400));
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [end]);

  const tap = (i) => {
    if (i === data.oddIdx) {
      okRef.current += 1;
      setFlash('ok');
      const nr = round + 1;
      setRound(nr);
      setData(makeRound(nr));
    } else {
      setFlash('ko');
      setTimeLeft(t => Math.max(1, t - 3)); // penalización: -3s
    }
    setTimeout(() => setFlash(null), 200);
  };

  return (
    <div className={`flex-1 flex flex-col items-center justify-center px-5 pb-6 transition-colors ${flash === 'ok' ? 'bg-emerald-500/10' : flash === 'ko' ? 'bg-rose-500/20' : ''}`}>
      <div className="flex items-center gap-4 mb-5">
        <span className="bg-black/30 text-white font-black px-4 py-1.5 rounded-full text-sm">⏱ {timeLeft}s</span>
        <span className="bg-black/30 text-pink-400 font-black px-4 py-1.5 rounded-full text-sm">✓ {okRef.current}</span>
      </div>
      <p className="text-white/60 font-bold uppercase tracking-widest text-xs mb-4">¡Toca el que es diferente!</p>
      <div className="grid gap-2 w-full max-w-sm" style={{ gridTemplateColumns: `repeat(${data.size}, minmax(0, 1fr))` }}>
        {Array.from({ length: data.size * data.size }, (_, i) => (
          <button
            key={`${round}-${i}`}
            onPointerDown={() => tap(i)}
            className="aspect-square rounded-2xl bg-white/10 flex items-center justify-center active:scale-90 transition-transform"
            style={{ fontSize: data.size > 4 ? '1.5rem' : '2.2rem' }}
          >
            {i === data.oddIdx ? data.odd : data.common}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ElDistintoGame(props) {
  return (
    <GameShell
      {...props}
      day={26} title="El Distinto" emoji="🔍" accent="pink"
      instructions={[
        <span key="1">Todos los emojis son iguales… <strong>menos uno</strong>. ¡Encuéntralo!</span>,
        <span key="2">Cada acierto agranda la cuadrícula. Cada fallo te <strong>resta 3 segundos</strong>.</span>,
        <span key="3">45 segundos de ojo de halcón. Cada acierto son 70 puntos.</span>,
      ]}
    >
      {({ end }) => <Play end={end} />}
    </GameShell>
  );
}
