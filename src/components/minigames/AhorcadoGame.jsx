import React, { useState } from 'react';
import { GameShell, clamp, shuffle } from './GameShell';

const WORDS = [
  'NOMINA', 'CONVENIO', 'DESCANSO', 'VACACIONES', 'TURNO', 'FESTIVO', 'PERMISO',
  'SALARIO', 'PLANTILLA', 'JORNADA', 'CONTRATO', 'CUADRANTE', 'ALMACEN', 'CLIENTE',
  'REPONEDOR', 'HORARIO', 'LICENCIA', 'EMPRESA', 'CARRETILLA', 'INVENTARIO',
];
const LETTERS = 'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ'.split('');
const MAX_LIVES = 6;
const HANGMAN = ['😀', '🙂', '😐', '😟', '😰', '😱', '💀'];

function Play({ end }) {
  const [words] = useState(() => shuffle(WORDS).slice(0, 2));
  const [wordIdx, setWordIdx] = useState(0);
  const [guessed, setGuessed] = useState([]);
  const [lives, setLives] = useState(MAX_LIVES);
  const [banked, setBanked] = useState(0);
  const [msg, setMsg] = useState(null);

  const word = words[wordIdx];
  const revealed = word.split('').every(l => guessed.includes(l));

  const tap = (letter) => {
    if (guessed.includes(letter) || msg) return;
    const ng = [...guessed, letter];
    setGuessed(ng);

    if (!word.includes(letter)) {
      const nl = lives - 1;
      setLives(nl);
      if (nl <= 0) {
        // Derrota en esta palabra: puntos parciales por letras acertadas
        const hits = new Set(word.split('').filter(l => ng.includes(l))).size;
        finishWord(banked + hits * 15, true);
      }
      return;
    }
    if (word.split('').every(l => ng.includes(l))) {
      finishWord(banked + 250 + lives * 40, false);
    }
  };

  const finishWord = (total, failed) => {
    setMsg(failed ? `La palabra era: ${word}` : '¡Conseguida! 🎉');
    setTimeout(() => {
      if (wordIdx >= words.length - 1) {
        end(clamp(total, 0, 1000));
      } else {
        setBanked(total);
        setWordIdx(i => i + 1);
        setGuessed([]);
        setLives(MAX_LIVES);
        setMsg(null);
      }
    }, 1400);
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-5 pb-6">
      <div className="flex items-center gap-3 mb-4">
        <span className="bg-black/30 text-white font-black px-4 py-1.5 rounded-full text-sm">Palabra {wordIdx + 1}/2</span>
        <span className="bg-black/30 font-black px-4 py-1.5 rounded-full text-sm text-rose-400">{'❤️'.repeat(Math.max(0, lives))}</span>
      </div>
      <div className="text-6xl mb-4">{HANGMAN[MAX_LIVES - lives]}</div>
      <div className="flex flex-wrap justify-center gap-1.5 mb-5 px-2">
        {word.split('').map((l, i) => (
          <div key={i} className={`w-8 h-11 rounded-lg flex items-center justify-center font-black text-xl border-b-4 ${guessed.includes(l) ? 'bg-emerald-500 text-emerald-950 border-emerald-700' : 'bg-white/10 text-transparent border-black/30'}`}>
            {guessed.includes(l) ? l : '·'}
          </div>
        ))}
      </div>
      {msg && <p className="text-amber-400 font-black text-base mb-3 animate-bounce">{msg}</p>}
      <div className="flex flex-wrap justify-center gap-1.5 max-w-sm">
        {LETTERS.map(l => {
          const used = guessed.includes(l);
          const good = used && word.includes(l);
          return (
            <button
              key={l}
              onPointerDown={() => tap(l)}
              disabled={used}
              className={`w-9 h-10 rounded-lg font-black text-sm transition-all active:scale-90 ${!used ? 'text-white' : good ? 'bg-emerald-500/40 text-emerald-200' : 'bg-rose-500/30 text-rose-300 opacity-50'}`}
              style={!used ? { background: 'linear-gradient(160deg, rgba(255,255,255,0.22), rgba(255,255,255,0.06))', boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.28)' } : undefined}
            >
              {l}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function AhorcadoGame(props) {
  return (
    <GameShell
      {...props}
      day={14} title="El Ahorcado" emoji="📝" accent="blue"
      instructions={[
        <span key="1">Adivina <strong>2 palabras del mundo laboral</strong>, letra a letra.</span>,
        <span key="2">Cada fallo te quita una de tus <strong>6 vidas</strong>.</span>,
        <span key="3">Completar palabra suma 250 puntos + 40 por vida restante.</span>,
      ]}
    >
      {({ end }) => <Play end={end} />}
    </GameShell>
  );
}
