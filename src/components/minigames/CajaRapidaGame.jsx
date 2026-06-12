import React, { useState, useEffect, useRef } from 'react';
import { GameShell, clamp, shuffle, rand } from './GameShell';

const DURATION = 30;
const fmt = (cents) => (cents / 100).toFixed(2).replace('.', ',') + ' €';

const makeQuestion = () => {
  const a = rand(1, 199) * 5; // céntimos
  const b = rand(1, 199) * 5;
  const sum = a + b;
  const opts = new Set([sum]);
  while (opts.size < 3) {
    const delta = rand(1, 18) * 5 * (Math.random() < 0.5 ? -1 : 1);
    if (sum + delta > 0) opts.add(sum + delta);
  }
  return { a, b, sum, options: shuffle([...opts]) };
};

function Play({ end }) {
  const [q, setQ] = useState(makeQuestion);
  const [timeLeft, setTimeLeft] = useState(DURATION);
  const [feedback, setFeedback] = useState(null); // 'ok' | 'ko'
  const stats = useRef({ ok: 0, ko: 0 });

  useEffect(() => {
    const id = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(id);
          end(clamp(stats.current.ok * 50 - stats.current.ko * 15, 0, 1000));
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [end]);

  const answer = (val) => {
    const good = val === q.sum;
    if (good) stats.current.ok += 1; else stats.current.ko += 1;
    setFeedback(good ? 'ok' : 'ko');
    setTimeout(() => setFeedback(null), 250);
    setQ(makeQuestion());
  };

  return (
    <div className={`flex-1 flex flex-col items-center justify-center px-6 pb-8 transition-colors duration-200 ${feedback === 'ok' ? 'bg-emerald-500/10' : feedback === 'ko' ? 'bg-rose-500/20' : ''}`}>
      <div className="flex items-center gap-4 mb-6">
        <span className="bg-black/30 text-white font-black px-4 py-1.5 rounded-full text-sm">⏱ {timeLeft}s</span>
        <span className="bg-black/30 text-emerald-400 font-black px-4 py-1.5 rounded-full text-sm">✓ {stats.current.ok}</span>
      </div>
      <p className="text-white/60 font-bold uppercase tracking-widest text-xs mb-3">Cobra al cliente</p>
      <div className="bg-black/40 border border-amber-500/30 rounded-3xl px-8 py-6 mb-8 text-center">
        <p className="text-white text-4xl font-black tabular-nums">{fmt(q.a)} <span className="text-amber-400">+</span> {fmt(q.b)}</p>
      </div>
      <div className="flex flex-col gap-3 w-full max-w-xs">
        {q.options.map(opt => (
          <button
            key={opt}
            onPointerDown={() => answer(opt)}
            className="bg-amber-500 text-amber-950 font-black text-2xl py-4 rounded-2xl border-b-4 border-amber-700 active:scale-95 transition-transform tabular-nums"
          >
            {fmt(opt)}
          </button>
        ))}
      </div>
    </div>
  );
}

export function CajaRapidaGame(props) {
  return (
    <GameShell
      {...props}
      day={8} title="Caja Rápida" emoji="🧮" accent="amber"
      instructions={[
        <span key="1">Eres la caja más rápida de la tienda: <strong>suma los dos precios</strong>.</span>,
        <span key="2">Elige el total correcto entre las 3 opciones.</span>,
        <span key="3">Tienes <strong>30 segundos</strong>. Los fallos restan, ¡no vayas a lo loco!</span>,
      ]}
    >
      {({ end }) => <Play end={end} />}
    </GameShell>
  );
}
