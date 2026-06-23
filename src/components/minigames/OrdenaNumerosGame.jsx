import React, { useState, useRef } from 'react';
import { GameShell, clamp, shuffle , ScoreBurst } from './GameShell';

function Play({ end }) {
  const [numbers] = useState(() => shuffle(Array.from({ length: 20 }, (_, i) => i + 1)));
  const [next, setNext] = useState(1);
  const [errors, setErrors] = useState(0);
  const [shakeIdx, setShakeIdx] = useState(-1);
  const startRef = useRef(Date.now());

  const tap = (n, i) => {
    if (n < next) return; // ya pulsado
    if (n === next) {
      if (n === 20) {
        const sec = (Date.now() - startRef.current) / 1000;
        end(clamp(Math.round(1000 - sec * 15 - errors * 25), 100, 1000));
        return;
      }
      setNext(n + 1);
    } else {
      setErrors(e => e + 1);
      setShakeIdx(i);
      setTimeout(() => setShakeIdx(-1), 250);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-5 pb-6">
      <div className="flex items-center gap-4 mb-5">
        <span className="hud-chip text-white font-black px-4 py-1.5 rounded-full text-sm">Busca el <span className="text-lime-400">{next}</span></span>
        <ScoreBurst value={next} color="#a3e635" />
        <span className="hud-chip text-rose-400 font-black px-4 py-1.5 rounded-full text-sm">✗ {errors}</span>
      </div>
      <div className="grid grid-cols-4 gap-2.5 w-full max-w-sm">
        {numbers.map((n, i) => {
          const done = n < next;
          return (
            <button
              key={n}
              onPointerDown={() => tap(n, i)}
              className={`aspect-square rounded-2xl font-black text-2xl border-b-4 transition-all flex items-center justify-center ${done ? 'text-lime-500/40 border-transparent' : shakeIdx === i ? 'text-white border-rose-800 animate-pulse' : 'text-white border-black/40 active:scale-90'}`}
              style={done ? { background: 'rgba(132,204,22,0.15)' } : shakeIdx === i ? { background: 'linear-gradient(160deg,#fb7185,#e11d48)' } : { background: 'linear-gradient(160deg, rgba(255,255,255,0.18), rgba(255,255,255,0.05))', boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.22)' }}
            >
              {n}
            </button>
          );
        })}
      </div>
      <p className="text-white/40 text-[10px] font-bold uppercase tracking-wide mt-4">Pulsa del 1 al 20 en orden, ¡a toda velocidad!</p>
    </div>
  );
}

export function OrdenaNumerosGame(props) {
  return (
    <GameShell
      {...props}
      day={27} title="Orden 1-20" emoji="🔢" accent="lime"
      instructions={[
        <span key="1">Los números del 1 al 20 están <strong>desordenados</strong>.</span>,
        <span key="2">Púlsalos <strong>en orden ascendente</strong> lo más rápido posible.</span>,
        <span key="3">Los fallos penalizan 25 puntos. ¡Ojos rápidos!</span>,
      ]}
    >
      {({ end }) => <Play end={end} />}
    </GameShell>
  );
}
