import React, { useState, useEffect, useRef } from 'react';
import { Play, Info } from 'lucide-react';
import { GameBackground } from './gameFx';

// Utilidades compartidas por los minijuegos
export const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
export const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
export const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

// Temas de color (literales completos para que Tailwind JIT los detecte)
const THEMES = {
  emerald: { text: 'text-emerald-400', soft: 'bg-emerald-500/15', border: 'border-emerald-500/30', grad: 'bg-gradient-to-b from-emerald-400 to-emerald-600', glow: 'shadow-[0_0_20px_rgba(16,185,129,0.4)]', light: 'text-emerald-100' },
  red:     { text: 'text-red-400',     soft: 'bg-red-500/15',     border: 'border-red-500/30',     grad: 'bg-gradient-to-b from-red-400 to-red-600',         glow: 'shadow-[0_0_20px_rgba(239,68,68,0.4)]',   light: 'text-red-100' },
  blue:    { text: 'text-sky-400',     soft: 'bg-sky-500/15',     border: 'border-sky-500/30',     grad: 'bg-gradient-to-b from-sky-400 to-sky-600',         glow: 'shadow-[0_0_20px_rgba(14,165,233,0.4)]',  light: 'text-sky-100' },
  amber:   { text: 'text-amber-400',   soft: 'bg-amber-500/15',   border: 'border-amber-500/30',   grad: 'bg-gradient-to-b from-amber-400 to-amber-600',     glow: 'shadow-[0_0_20px_rgba(245,158,11,0.4)]',  light: 'text-amber-100' },
  violet:  { text: 'text-violet-400',  soft: 'bg-violet-500/15',  border: 'border-violet-500/30',  grad: 'bg-gradient-to-b from-violet-400 to-violet-600',   glow: 'shadow-[0_0_20px_rgba(139,92,246,0.4)]',  light: 'text-violet-100' },
  pink:    { text: 'text-pink-400',    soft: 'bg-pink-500/15',    border: 'border-pink-500/30',    grad: 'bg-gradient-to-b from-pink-400 to-pink-600',       glow: 'shadow-[0_0_20px_rgba(236,72,153,0.4)]',  light: 'text-pink-100' },
  cyan:    { text: 'text-cyan-400',    soft: 'bg-cyan-500/15',    border: 'border-cyan-500/30',    grad: 'bg-gradient-to-b from-cyan-400 to-cyan-600',       glow: 'shadow-[0_0_20px_rgba(34,211,238,0.4)]',  light: 'text-cyan-100' },
  orange:  { text: 'text-orange-400',  soft: 'bg-orange-500/15',  border: 'border-orange-500/30',  grad: 'bg-gradient-to-b from-orange-400 to-orange-600',   glow: 'shadow-[0_0_20px_rgba(249,115,22,0.4)]',  light: 'text-orange-100' },
  lime:    { text: 'text-lime-400',    soft: 'bg-lime-500/15',    border: 'border-lime-500/30',    grad: 'bg-gradient-to-b from-lime-400 to-lime-600',       glow: 'shadow-[0_0_20px_rgba(132,204,22,0.4)]',  light: 'text-lime-100' },
};

/**
 * GameShell — armazón común de los minijuegos: intro con instrucciones,
 * botones Prueba/Jugar con intentos, cuenta atrás 3-2-1, y pantalla final.
 * El juego solo implementa su fase "playing" vía children({ mode, end }).
 */
export function GameShell({
  day, title, emoji, accent = 'emerald', instructions = [],
  onFinish, onCancel, practiceAttempts, playAttempts, onConsumeAttempt, children,
}) {
  const t = THEMES[accent] || THEMES.emerald;
  const [phase, setPhase] = useState('intro'); // intro | countdown | playing | finished
  const [mode, setMode] = useState(null);
  const [countdown, setCountdown] = useState(3);
  const [score, setScore] = useState(0);
  const endedRef = useRef(false);

  useEffect(() => {
    if (phase !== 'countdown') return;
    if (countdown > 0) {
      const id = setTimeout(() => setCountdown(c => c - 1), 1000);
      return () => clearTimeout(id);
    }
    endedRef.current = false;
    setPhase('playing');
  }, [phase, countdown]);

  const start = (m) => {
    if (m === 'jugar' ? playAttempts <= 0 : practiceAttempts <= 0) return;
    onConsumeAttempt(m);
    setMode(m);
    setCountdown(3);
    setPhase('countdown');
  };

  const end = (s) => {
    if (endedRef.current) return;
    endedRef.current = true;
    setScore(Math.max(0, Math.round(s || 0)));
    setPhase('finished');
  };

  const Header = () => (
    <div className="pt-12 pb-4 px-6 flex items-center justify-between z-10 bg-black/20">
      <div className="flex items-center gap-2 text-white">
        <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-base">{emoji}</div>
        <div>
          <p className="text-[10px] text-white/60 font-bold uppercase tracking-wider">Día {day}</p>
          <p className="text-sm font-black leading-none">{title}</p>
        </div>
      </div>
      <div className="w-10 h-10"></div>
    </div>
  );

  if (phase === 'intro') {
    return (
      <div className="fixed inset-0 z-50 text-white flex flex-col p-6 overflow-y-auto font-sans bg-[#0b0520]">
        <GameBackground theme={accent} />
        <div className="relative z-10 flex items-center justify-between bg-black/25 backdrop-blur-md p-4 rounded-2xl mb-6 border border-white/10">
          <div className="flex items-center gap-2 text-white">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-lg border border-white/10">{emoji}</div>
            <div>
              <p className="text-[10px] text-white/60 font-bold uppercase tracking-wider">Día {day}</p>
              <p className="text-sm font-black leading-none">{title}</p>
            </div>
          </div>
          <div className="w-10 h-10"></div>
        </div>

        <div className="relative z-10 flex flex-col items-center pb-12">
          <div className={`bg-black/40 border ${t.border} p-6 rounded-3xl backdrop-blur-md text-center mb-8 max-w-sm w-full relative`}>
            <div className="absolute inset-0 z-0 flex items-center justify-center opacity-5 pointer-events-none text-[10rem]">{emoji}</div>
            <h2 className="text-white text-2xl font-black mb-4 z-10 relative">{title}</h2>
            <div className={`${t.light} text-sm space-y-4 text-left z-10 relative`}>
              {instructions.map((ins, i) => (
                <p key={i} className="flex items-start gap-3">
                  <span className={`${t.soft} ${t.text} p-1.5 rounded-lg shrink-0 mt-0.5`}><Info size={16} /></span>
                  <span>{ins}</span>
                </p>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3 w-full max-w-sm">
            <div className="flex gap-4">
              <button
                onClick={() => start('prueba')}
                disabled={practiceAttempts <= 0}
                className="flex-1 bg-white/10 text-white font-bold py-4 rounded-2xl disabled:opacity-30 active:scale-95 transition-all flex flex-col items-center justify-center"
              >
                <span className="text-lg mb-1">Prueba</span>
                <span className="text-[10px] text-white/50 bg-black/30 px-2 py-0.5 rounded-full">{practiceAttempts} INTENTOS</span>
              </button>
              <button
                onClick={() => start('jugar')}
                disabled={playAttempts <= 0}
                className={`flex-1 ${t.grad} text-white font-bold py-4 rounded-2xl ${t.glow} disabled:opacity-30 active:scale-95 transition-all flex flex-col items-center justify-center`}
              >
                <span className="text-lg mb-1 flex items-center gap-1"><Play size={18} fill="currentColor" /> Jugar</span>
                <span className="text-[10px] bg-black/20 px-2 py-0.5 rounded-full">{playAttempts} INTENTOS</span>
              </button>
            </div>
            <button
              onClick={onCancel}
              className={`w-full py-4 rounded-2xl font-black uppercase text-sm tracking-widest transition-all border ${t.border} flex items-center justify-center gap-2 ${t.soft} ${t.text} active:scale-95`}
            >
              VOLVER ATRÁS
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col font-sans overflow-hidden bg-[#0b0520]">
      <GameBackground theme={accent} />
      <div className="relative z-10 flex flex-col flex-1 min-h-0">
        <Header />
        {phase === 'playing' && (
          <div className="flex-1 relative overflow-hidden flex flex-col">
            {children({ mode, end })}
          </div>
        )}
      </div>

      {phase === 'countdown' && (
        <div className="absolute inset-0 z-40 bg-black/80 backdrop-blur-sm flex items-center justify-center flex-col">
          <p className={`${t.text} font-bold uppercase tracking-widest mb-4 text-center px-8`}>Modo: {mode === 'jugar' ? 'Ranking' : 'Prueba'}</p>
          <div className="text-9xl font-black text-white animate-bounce drop-shadow-[0_0_30px_rgba(255,255,255,0.5)]">{countdown}</div>
        </div>
      )}

      {phase === 'finished' && (
        <div className="absolute inset-0 z-40 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center px-6">
          <div className="text-7xl mb-6">{emoji}</div>
          <div className={`bg-[#1e1b4b] border ${t.border} p-8 rounded-[2rem] text-center w-full max-w-sm mb-8 shadow-2xl`}>
            <p className="text-white/60 font-bold uppercase tracking-widest text-xs mb-2">Puntuación obtenida</p>
            <p className="text-6xl font-black text-white">{score}</p>
            <p className={`${t.text} text-sm mt-2 font-bold`}>PUNTOS</p>
          </div>
          <button
            onClick={() => onFinish(score, mode)}
            className={`w-full max-w-sm ${t.grad} text-white font-black py-5 rounded-[1.5rem] text-lg ${t.glow} active:scale-95 transition-transform`}
          >
            Continuar
          </button>
        </div>
      )}
    </div>
  );
}
