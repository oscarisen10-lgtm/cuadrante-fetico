import React, { useState, useEffect, useRef } from 'react';
import { GameShell, clamp, rand } from './GameShell';

const WORDS = [
  { name: 'ROJO',     cls: 'text-rose-400' },
  { name: 'VERDE',    cls: 'text-emerald-400' },
  { name: 'AZUL',     cls: 'text-sky-400' },
  { name: 'AMARILLO', cls: 'text-amber-300' },
];
const DURATION = 30;

const makeRound = () => {
  const word = rand(0, 3);
  const matches = Math.random() < 0.5;
  let color = word;
  if (!matches) {
    while (color === word) color = rand(0, 3);
  }
  return { word, color, matches };
};

function Play({ end }) {
  const [round, setRound] = useState(makeRound);
  const [timeLeft, setTimeLeft] = useState(DURATION);
  const [flash, setFlash] = useState(null);
  const stats = useRef({ ok: 0, ko: 0 });

  useEffect(() => {
    const id = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(id);
          end(clamp(stats.current.ok * 40 - stats.current.ko * 20, 0, 1000));
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [end]);

  const answer = (saysMatch) => {
    const good = saysMatch === round.matches;
    if (good) stats.current.ok += 1; else stats.current.ko += 1;
    setFlash(good ? 'ok' : 'ko');
    setTimeout(() => setFlash(null), 200);
    setRound(makeRound());
  };

  return (
    <div className={`flex-1 flex flex-col items-center justify-center px-6 pb-8 transition-colors duration-150 ${flash === 'ok' ? 'bg-emerald-500/10' : flash === 'ko' ? 'bg-rose-500/20' : ''}`}>
      <div className="flex items-center gap-4 mb-8">
        <span className="bg-black/30 text-white font-black px-4 py-1.5 rounded-full text-sm">⏱ {timeLeft}s</span>
        <span className="bg-black/30 text-emerald-400 font-black px-4 py-1.5 rounded-full text-sm">✓ {stats.current.ok}</span>
      </div>
      <p className="text-white/60 font-bold uppercase tracking-widest text-xs mb-4">¿La palabra coincide con su color?</p>
      <div className="bg-black/40 border border-cyan-500/30 rounded-3xl px-10 py-10 mb-10">
        <p className={`text-5xl font-black tracking-tight ${WORDS[round.color].cls}`}>{WORDS[round.word].name}</p>
      </div>
      <div className="flex gap-4 w-full max-w-xs">
        <button onPointerDown={() => answer(true)} className="flex-1 bg-emerald-500 text-emerald-950 font-black text-2xl py-5 rounded-2xl border-b-4 border-emerald-700 active:scale-95 transition-transform">SÍ</button>
        <button onPointerDown={() => answer(false)} className="flex-1 bg-rose-500 text-rose-950 font-black text-2xl py-5 rounded-2xl border-b-4 border-rose-700 active:scale-95 transition-transform">NO</button>
      </div>
    </div>
  );
}

export function ColorTrampaGame(props) {
  return (
    <GameShell
      {...props}
      day={9} title="Color Trampa" emoji="🎨" accent="cyan"
      instructions={[
        <span key="1">Verás una palabra de color escrita <strong>en un color que puede no ser el suyo</strong>.</span>,
        <span key="2">Pulsa <strong>SÍ</strong> si la palabra y su color coinciden, <strong>NO</strong> si no.</span>,
        <span key="3">30 segundos. Tu cerebro intentará engañarte. 😉</span>,
      ]}
    >
      {({ end }) => <Play end={end} />}
    </GameShell>
  );
}
