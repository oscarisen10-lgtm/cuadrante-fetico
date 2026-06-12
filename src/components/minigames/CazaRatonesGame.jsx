import React, { useState, useEffect, useRef } from 'react';
import { GameShell, clamp, rand } from './GameShell';

const DURATION = 30;

function Play({ end }) {
  const [active, setActive] = useState(-1);
  const [hits, setHits] = useState(0);
  const [timeLeft, setTimeLeft] = useState(DURATION);
  const hitsRef = useRef(0);
  const activeRef = useRef(-1);
  const aliveRef = useRef(true);

  // Cronómetro
  useEffect(() => {
    const id = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(id);
          aliveRef.current = false;
          end(clamp(hitsRef.current * 30, 0, 1200));
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => { clearInterval(id); aliveRef.current = false; };
  }, [end]);

  // Bucle de aparición de ratones (acelera con los aciertos)
  useEffect(() => {
    let showT, gapT;
    const cycle = () => {
      if (!aliveRef.current) return;
      let cell = rand(0, 8);
      if (cell === activeRef.current) cell = (cell + rand(1, 8)) % 9;
      activeRef.current = cell;
      setActive(cell);
      const visible = Math.max(450, 850 - hitsRef.current * 18);
      showT = setTimeout(() => {
        if (!aliveRef.current) return;
        activeRef.current = -1;
        setActive(-1);
        gapT = setTimeout(cycle, rand(150, 350));
      }, visible);
    };
    cycle();
    return () => { clearTimeout(showT); clearTimeout(gapT); };
  }, []);

  const whack = (i) => {
    if (i !== activeRef.current) return;
    activeRef.current = -1;
    setActive(-1);
    hitsRef.current += 1;
    setHits(hitsRef.current);
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 pb-8">
      <div className="flex items-center gap-4 mb-6">
        <span className="bg-black/30 text-white font-black px-4 py-1.5 rounded-full text-sm">⏱ {timeLeft}s</span>
        <span className="bg-black/30 text-orange-400 font-black px-4 py-1.5 rounded-full text-sm">🐭 {hits}</span>
      </div>
      <p className="text-white/60 font-bold uppercase tracking-widest text-xs mb-4">¡Échalos del almacén!</p>
      <div className="grid grid-cols-3 gap-3 w-full max-w-xs">
        {Array.from({ length: 9 }, (_, i) => (
          <button
            key={i}
            onPointerDown={() => whack(i)}
            className={`aspect-square rounded-3xl flex items-center justify-center text-5xl border-b-8 transition-all duration-75 active:scale-95 ${
              active === i ? 'bg-orange-400 border-orange-600 scale-105' : 'bg-slate-800 border-slate-900'
            }`}
          >
            {active === i ? '🐭' : '📦'}
          </button>
        ))}
      </div>
    </div>
  );
}

export function CazaRatonesGame(props) {
  return (
    <GameShell
      {...props}
      day={10} title="Caza Ratones" emoji="🐭" accent="orange"
      instructions={[
        <span key="1">¡Hay ratones en el almacén! Saldrán de entre las <strong>cajas</strong>.</span>,
        <span key="2">Tócalos antes de que se escondan. Cada vez van <strong>más rápido</strong>.</span>,
        <span key="3">Tienes 30 segundos. Cada ratón cazado son 30 puntos.</span>,
      ]}
    >
      {({ end }) => <Play end={end} />}
    </GameShell>
  );
}
