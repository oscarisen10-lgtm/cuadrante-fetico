import React, { useState, useEffect, useRef } from 'react';
import { GameShell, clamp, rand } from './GameShell';

const DURATION = 45;
const newNumber = (not) => {
  let n;
  do { n = rand(1, 99); } while (n === not);
  return n;
};

function Play({ end }) {
  const [current, setCurrent] = useState(() => rand(1, 99));
  const [lives, setLives] = useState(3);
  const [streak, setStreak] = useState(0);
  const [timeLeft, setTimeLeft] = useState(DURATION);
  const [reveal, setReveal] = useState(null); // {next, good}
  const okRef = useRef(0);

  useEffect(() => {
    const id = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(id);
          end(clamp(okRef.current * 40, 0, 1000));
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [end]);

  const guess = (higher) => {
    if (reveal) return;
    const next = newNumber(current);
    const good = higher ? next > current : next < current;
    setReveal({ next, good });
    setTimeout(() => {
      setReveal(null);
      setCurrent(next);
      if (good) {
        okRef.current += 1;
        setStreak(s => s + 1);
      } else {
        setStreak(0);
        setLives(l => {
          if (l - 1 <= 0) end(clamp(okRef.current * 40, 0, 1000));
          return l - 1;
        });
      }
    }, 700);
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 pb-8">
      <div className="flex items-center gap-3 mb-6">
        <span className="bg-black/30 text-white font-black px-4 py-1.5 rounded-full text-sm">⏱ {timeLeft}s</span>
        <span className="bg-black/30 text-rose-400 font-black px-4 py-1.5 rounded-full text-sm">{'❤️'.repeat(Math.max(0, lives))}</span>
        <span className="bg-black/30 text-emerald-400 font-black px-4 py-1.5 rounded-full text-sm">✓ {okRef.current}</span>
      </div>
      <p className="text-white/60 font-bold uppercase tracking-widest text-xs mb-3">¿El siguiente será mayor o menor?</p>
      <div className="flex items-center gap-4 mb-8">
        <div className="bg-black/40 border border-blue-500/30 rounded-3xl w-28 h-32 flex items-center justify-center">
          <span className="text-white text-5xl font-black tabular-nums">{current}</span>
        </div>
        <span className="text-white/40 text-3xl font-black">→</span>
        <div className={`rounded-3xl w-28 h-32 flex items-center justify-center border transition-colors ${reveal ? (reveal.good ? 'bg-emerald-500/30 border-emerald-400' : 'bg-rose-500/30 border-rose-400') : 'bg-white/5 border-white/10'}`}>
          <span className="text-white text-5xl font-black tabular-nums">{reveal ? reveal.next : '?'}</span>
        </div>
      </div>
      {streak >= 3 && <p className="text-amber-400 font-black text-sm mb-3 animate-pulse">🔥 Racha de {streak}</p>}
      <div className="flex gap-4 w-full max-w-xs">
        <button onPointerDown={() => guess(true)} className="flex-1 bg-sky-500 text-sky-950 font-black text-xl py-5 rounded-2xl border-b-4 border-sky-700 active:scale-95 transition-transform">⬆ MAYOR</button>
        <button onPointerDown={() => guess(false)} className="flex-1 bg-orange-500 text-orange-950 font-black text-xl py-5 rounded-2xl border-b-4 border-orange-700 active:scale-95 transition-transform">⬇ MENOR</button>
      </div>
    </div>
  );
}

export function MayorMenorGame(props) {
  return (
    <GameShell
      {...props}
      day={17} title="Mayor o Menor" emoji="🎴" accent="blue"
      instructions={[
        <span key="1">Verás un número del 1 al 99. Adivina si el siguiente será <strong>mayor o menor</strong>.</span>,
        <span key="2">Cada acierto suma 40 puntos. Tienes <strong>3 vidas</strong> y 45 segundos.</span>,
        <span key="3">Piensa rápido: con un 80 lo lógico es "menor"… pero la suerte decide. 🍀</span>,
      ]}
    >
      {({ end }) => <Play end={end} />}
    </GameShell>
  );
}
