import React, { useState } from 'react';
import { GameShell, rand } from './GameShell';

const WORDS = [
  'TURNO', 'HORAS', 'PAUSA', 'CAJAS', 'EXTRA', 'LIBRE', 'FICHA', 'VENTA',
  'CARRO', 'FRUTA', 'LECHE', 'CARNE', 'DULCE', 'PESCA', 'TIVOL'.replace('TIVOL', 'PANES'),
];
const ROWS_QWERTY = ['QWERTYUIOP', 'ASDFGHJKLÑ', '⌫ZXCVBNM✓'];
const MAX_TRIES = 6;

// Coloreado tipo Wordle teniendo en cuenta letras repetidas
const evaluate = (guess, target) => {
  const res = Array(5).fill('absent');
  const remaining = {};
  for (let i = 0; i < 5; i++) {
    if (guess[i] === target[i]) res[i] = 'correct';
    else remaining[target[i]] = (remaining[target[i]] || 0) + 1;
  }
  for (let i = 0; i < 5; i++) {
    if (res[i] !== 'correct' && remaining[guess[i]] > 0) {
      res[i] = 'present';
      remaining[guess[i]] -= 1;
    }
  }
  return res;
};

const CELL = {
  correct: 'bg-emerald-500 text-white border-emerald-700',
  present: 'bg-amber-500 text-white border-amber-700',
  absent: 'bg-slate-700 text-slate-400 border-slate-800',
  empty: 'bg-white/5 text-white border-white/10',
};

function Play({ end }) {
  const [target] = useState(() => WORDS[rand(0, WORDS.length - 1)]);
  const [tries, setTries] = useState([]); // [{word, marks}]
  const [current, setCurrent] = useState('');
  const [done, setDone] = useState(false);

  const keyState = {};
  tries.forEach(t => t.word.split('').forEach((l, i) => {
    const m = t.marks[i];
    if (m === 'correct' || (m === 'present' && keyState[l] !== 'correct') || (!keyState[l])) keyState[l] = m;
  }));

  const press = (k) => {
    if (done) return;
    if (k === '⌫') { setCurrent(c => c.slice(0, -1)); return; }
    if (k === '✓') {
      if (current.length !== 5) return;
      const marks = evaluate(current, target);
      const nt = [...tries, { word: current, marks }];
      setTries(nt);
      setCurrent('');
      if (current === target) {
        setDone(true);
        setTimeout(() => end((MAX_TRIES + 1 - nt.length) * 150 + 100), 1200);
      } else if (nt.length >= MAX_TRIES) {
        setDone(true);
        const greens = new Set();
        nt.forEach(t => t.marks.forEach((m, i) => { if (m === 'correct') greens.add(i); }));
        setTimeout(() => end(greens.size * 30), 1200);
      }
      return;
    }
    if (current.length < 5) setCurrent(c => c + k);
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-between px-4 pb-5 pt-2">
      <div className="flex flex-col gap-1.5">
        {Array.from({ length: MAX_TRIES }, (_, r) => {
          const t = tries[r];
          const isCurrent = r === tries.length && !done;
          return (
            <div key={r} className="flex gap-1.5">
              {Array.from({ length: 5 }, (_, c) => {
                const letter = t ? t.word[c] : isCurrent ? (current[c] || '') : '';
                const mark = t ? t.marks[c] : 'empty';
                return (
                  <div key={c} className={`w-12 h-12 rounded-xl border-b-4 flex items-center justify-center font-black text-xl ${CELL[mark]}`}>
                    {letter}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
      {done && <p className="text-amber-400 font-black text-base my-2 animate-bounce">{tries[tries.length - 1]?.word === target ? '🎉 ¡Conseguido!' : `Era: ${target}`}</p>}
      <div className="flex flex-col gap-1.5 w-full max-w-sm">
        {ROWS_QWERTY.map((row, ri) => (
          <div key={ri} className="flex gap-1 justify-center">
            {row.split('').map(k => {
              const special = k === '⌫' || k === '✓';
              const state = keyState[k];
              return (
                <button
                  key={k}
                  onPointerDown={() => press(k)}
                  className={`h-11 rounded-lg font-black text-sm active:scale-90 transition-transform ${special ? 'px-3 bg-blue-500 text-white' :
                    state === 'correct' ? 'flex-1 bg-emerald-500 text-white' :
                    state === 'present' ? 'flex-1 bg-amber-500 text-white' :
                    state === 'absent' ? 'flex-1 bg-slate-800 text-slate-500' :
                    'flex-1 bg-white/15 text-white'}`}
                >
                  {k}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

export function PalabraOcultaGame(props) {
  return (
    <GameShell
      {...props}
      day={28} title="Palabra Oculta" emoji="🟩" accent="emerald"
      instructions={[
        <span key="1">Adivina la palabra de <strong>5 letras</strong> en 6 intentos.</span>,
        <span key="2"><span className="text-emerald-400 font-black">Verde</span> = letra y posición correctas. <span className="text-amber-400 font-black">Amarillo</span> = letra correcta, sitio equivocado.</span>,
        <span key="3">Menos intentos = más puntos (1000 si aciertas a la primera).</span>,
      ]}
    >
      {({ end }) => <Play end={end} />}
    </GameShell>
  );
}
