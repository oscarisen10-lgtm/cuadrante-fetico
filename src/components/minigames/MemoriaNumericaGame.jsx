import React, { useState, useEffect } from 'react';
import { GameShell, clamp, rand } from './GameShell';

const START_DIGITS = 3;
const genNumber = (digits) => {
  let s = String(rand(1, 9));
  for (let i = 1; i < digits; i++) s += String(rand(0, 9));
  return s;
};

function Play({ end }) {
  const [digits, setDigits] = useState(START_DIGITS);
  const [target, setTarget] = useState(() => genNumber(START_DIGITS));
  const [phase, setPhase] = useState('show'); // show | input
  const [input, setInput] = useState('');

  // Muestra el número y lo oculta pasado un tiempo proporcional
  useEffect(() => {
    if (phase !== 'show') return;
    const id = setTimeout(() => { setInput(''); setPhase('input'); }, 1300 + digits * 350);
    return () => clearTimeout(id);
  }, [phase, digits]);

  const press = (k) => {
    if (phase !== 'input') return;
    if (k === '⌫') { setInput(s => s.slice(0, -1)); return; }
    if (k === 'OK') {
      if (input === target) {
        const nd = digits + 1;
        if (nd > 10) { end(1000); return; }
        setDigits(nd);
        setTarget(genNumber(nd));
        setPhase('show');
      } else {
        end(clamp((digits - START_DIGITS) * 125, 0, 1000));
      }
      return;
    }
    if (input.length < 12) setInput(s => s + k);
  };

  const keys = ['1','2','3','4','5','6','7','8','9','⌫','0','OK'];

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 pb-6">
      <p className="text-white/60 font-bold uppercase tracking-widest text-xs mb-4">Nivel: {digits - START_DIGITS + 1} · {digits} cifras</p>
      <div className="bg-black/40 border border-violet-500/30 rounded-3xl px-8 py-8 mb-6 min-w-[260px] text-center">
        {phase === 'show' ? (
          <p className="text-white text-4xl font-black tabular-nums tracking-[0.3em]">{target}</p>
        ) : (
          <p className="text-violet-300 text-4xl font-black tabular-nums tracking-[0.3em] min-h-[40px]">{input || '·'}</p>
        )}
      </div>
      <p className={`font-bold uppercase tracking-widest text-xs mb-5 ${phase === 'show' ? 'text-amber-400' : 'text-emerald-400'}`}>
        {phase === 'show' ? '👀 Memoriza el número...' : '⌨️ Escríbelo de memoria'}
      </p>
      <div className={`grid grid-cols-3 gap-2.5 w-full max-w-[260px] transition-opacity ${phase === 'show' ? 'opacity-30 pointer-events-none' : ''}`}>
        {keys.map(k => (
          <button
            key={k}
            onPointerDown={() => press(k)}
            className={`py-4 rounded-2xl font-black text-xl active:scale-95 transition-transform border-b-4 ${
              k === 'OK' ? 'bg-emerald-500 text-emerald-950 border-emerald-700'
              : k === '⌫' ? 'bg-rose-500/80 text-white border-rose-700'
              : 'bg-white/10 text-white border-black/30'
            }`}
          >
            {k}
          </button>
        ))}
      </div>
    </div>
  );
}

export function MemoriaNumericaGame(props) {
  return (
    <GameShell
      {...props}
      day={13} title="Memoria Numérica" emoji="🔐" accent="violet"
      instructions={[
        <span key="1">Verás un número durante unos segundos. <strong>Memorízalo</strong>.</span>,
        <span key="2">Después escríbelo de memoria con el teclado.</span>,
        <span key="3">Cada acierto añade <strong>una cifra más</strong>. ¡Llega a 10 cifras para 1000 puntos!</span>,
      ]}
    >
      {({ end }) => <Play end={end} />}
    </GameShell>
  );
}
