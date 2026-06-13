import React, { useState, useEffect, useRef } from 'react';
import { GameShell, clamp, rand } from './GameShell';

const HANDS = ['✊', '✋', '✌️'];
const BEATS = { 0: 1, 1: 2, 2: 0 }; // a la piedra le gana el papel, etc.
const DURATION = 30;

function Play({ end }) {
  const [cpu, setCpu] = useState(() => rand(0, 2));
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tap = (hand) => {
    const good = hand === BEATS[cpu];
    if (good) stats.current.ok += 1; else stats.current.ko += 1;
    setFlash(good ? 'ok' : 'ko');
    setTimeout(() => setFlash(null), 180);
    setCpu(rand(0, 2));
  };

  return (
    <div className={`flex-1 flex flex-col items-center justify-center px-6 pb-8 transition-colors duration-150 ${flash === 'ok' ? 'bg-emerald-500/10' : flash === 'ko' ? 'bg-rose-500/20' : ''}`}>
      <div className="flex items-center gap-4 mb-6">
        <span className="bg-black/30 text-white font-black px-4 py-1.5 rounded-full text-sm">⏱ {timeLeft}s</span>
        <span className="bg-black/30 text-emerald-400 font-black px-4 py-1.5 rounded-full text-sm">✓ {stats.current.ok}</span>
        <span className="bg-black/30 text-rose-400 font-black px-4 py-1.5 rounded-full text-sm">✗ {stats.current.ko}</span>
      </div>
      <p className="text-white/60 font-bold uppercase tracking-widest text-xs mb-3">El rival saca...</p>
      <div className="bg-black/40 border border-pink-500/30 rounded-full w-36 h-36 flex items-center justify-center mb-3">
        <span className="text-7xl">{HANDS[cpu]}</span>
      </div>
      <p className="text-pink-400 font-black uppercase tracking-widest text-sm mb-8">¡Toca la mano que LE GANA!</p>
      <div className="flex gap-3 w-full max-w-xs justify-center">
        {HANDS.map((h, i) => (
          <button
            key={i}
            onPointerDown={() => tap(i)}
            className="w-24 h-24 rounded-3xl text-5xl border-b-4 border-black/40 active:scale-90 transition-transform flex items-center justify-center"
            style={{ background: 'linear-gradient(160deg, rgba(255,255,255,0.2), rgba(255,255,255,0.05))', boxShadow: 'inset 0 2px 6px rgba(255,255,255,0.25), 0 6px 16px rgba(0,0,0,0.35)' }}
          >
            {h}
          </button>
        ))}
      </div>
    </div>
  );
}

export function GanaRapidoGame(props) {
  return (
    <GameShell
      {...props}
      day={18} title="Gana Rápido" emoji="✂️" accent="pink"
      instructions={[
        <span key="1">Piedra, papel o tijera… ¡pero al revés! El rival <strong>ya ha sacado su mano</strong>.</span>,
        <span key="2">Toca rápidamente la mano que <strong>le gana</strong> (al ✊ le gana ✋, etc.).</span>,
        <span key="3">30 segundos. Aciertos +40, fallos -20. ¡Velocidad y cabeza!</span>,
      ]}
    >
      {({ end }) => <Play end={end} />}
    </GameShell>
  );
}
