import React, { useState, useEffect, useRef } from 'react';
import { GameShell, clamp, rand } from './GameShell';

const TOTAL_ROUNDS = 5;

function Play({ end }) {
  const [round, setRound] = useState(1);
  const [state, setState] = useState('wait'); // wait | ready | feedback
  const [msg, setMsg] = useState(null);
  const t0 = useRef(0);
  const results = useRef([]);
  const timerRef = useRef(null);

  // Programa el "verde" tras una espera aleatoria
  useEffect(() => {
    if (state !== 'wait') return;
    timerRef.current = setTimeout(() => {
      t0.current = Date.now();
      setState('ready');
    }, rand(1200, 3200));
    return () => clearTimeout(timerRef.current);
  }, [state, round]);

  const nextRound = (rt) => {
    results.current.push(rt);
    if (results.current.length >= TOTAL_ROUNDS) {
      const avg = results.current.reduce((a, b) => a + b, 0) / results.current.length;
      end(clamp(Math.round(1000 - (avg - 150) * 2.5), 0, 1000));
      return;
    }
    setRound(r => r + 1);
    setState('wait');
  };

  const handleTap = () => {
    if (state === 'feedback') return;
    if (state === 'wait') {
      // Demasiado pronto: penalización
      clearTimeout(timerRef.current);
      setMsg({ text: '¡Demasiado pronto! +800ms', color: 'text-red-400' });
      setState('feedback');
      setTimeout(() => { setMsg(null); nextRound(800); }, 900);
      return;
    }
    const rt = Date.now() - t0.current;
    setMsg({ text: `${rt} ms`, color: rt < 300 ? 'text-emerald-400' : 'text-amber-400' });
    setState('feedback');
    setTimeout(() => { setMsg(null); nextRound(rt); }, 900);
  };

  return (
    <button
      onPointerDown={handleTap}
      className={`flex-1 m-6 rounded-[2rem] flex flex-col items-center justify-center transition-colors duration-150 select-none ${
        state === 'ready' ? 'bg-emerald-500' : state === 'feedback' ? 'bg-slate-700' : 'bg-rose-600'
      }`}
    >
      <p className="text-white/70 font-bold uppercase tracking-widest text-xs mb-3">Ronda {round} / {TOTAL_ROUNDS}</p>
      {msg ? (
        <p className={`text-5xl font-black ${msg.color}`}>{msg.text}</p>
      ) : (
        <p className="text-white text-4xl font-black uppercase">{state === 'ready' ? '¡PULSA YA!' : 'Espera...'}</p>
      )}
      <p className="text-white/50 text-xs font-bold mt-4 uppercase tracking-wide">{state === 'ready' ? '' : 'Pulsa cuando se ponga verde'}</p>
    </button>
  );
}

export function ReflejosGame(props) {
  return (
    <GameShell
      {...props}
      day={5} title="Reflejos" emoji="⚡" accent="emerald"
      instructions={[
        <span key="1">La pantalla estará en <strong>rojo</strong>: espera sin tocar.</span>,
        <span key="2">Cuando se ponga <strong>verde</strong>, ¡pulsa lo más rápido que puedas!</span>,
        <span key="3">Son 5 rondas. Si pulsas antes de tiempo, penalizas. Media más baja = más puntos.</span>,
      ]}
    >
      {({ end }) => <Play end={end} />}
    </GameShell>
  );
}
