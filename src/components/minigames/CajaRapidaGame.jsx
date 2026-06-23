import React, { useState, useEffect, useRef } from 'react';
import { GameShell, clamp, shuffle, rand, fx , ScoreBurst } from './GameShell';

const DURATION = 60;   // segundos de juego
const MAX_FAILS = 3;   // 3 fallos = eliminado
const fmt = (cents) => (cents / 100).toFixed(2).replace('.', ',') + ' €';

// Dificultad progresiva: los importes crecen con el nivel y, a partir del nivel 4,
// aparecen restas (dar el cambio), siempre con resultado positivo.
const makeQuestion = (level) => {
  const maxCents = Math.min(45 + level * 25, 990); // nivel 1 ≈ 0,70€; va subiendo
  const a = rand(1, Math.floor(maxCents / 5)) * 5;
  const b = rand(1, Math.floor(maxCents / 5)) * 5;
  const isSub = level >= 4 && Math.random() < 0.4;

  let aa = a, bb = b, correct, op;
  if (isSub) {
    aa = Math.max(a, b);
    bb = Math.min(a, b);
    correct = aa - bb;
    op = '−';
  } else {
    correct = a + b;
    op = '+';
  }

  // Opciones cercanas al resultado (distintas y no negativas).
  const opts = new Set([correct]);
  let guard = 0;
  while (opts.size < 3 && guard++ < 60) {
    const cand = correct + rand(1, 12) * 5 * (Math.random() < 0.5 ? -1 : 1);
    if (cand >= 0) opts.add(cand);
  }
  while (opts.size < 3) opts.add(correct + opts.size * 5);

  return { a: aa, b: bb, op, correct, options: shuffle([...opts]) };
};

function Play({ end }) {
  const [timeLeft, setTimeLeft] = useState(DURATION);
  const [q, setQ] = useState(() => makeQuestion(1));
  const [feedback, setFeedback] = useState(null); // 'ok' | 'ko'
  const [fails, setFails] = useState(0);
  const [level, setLevel] = useState(1);

  const okRef = useRef(0);
  const failsRef = useRef(0);
  const levelRef = useRef(1);
  const lockRef = useRef(false);
  const endRef = useRef(end);
  endRef.current = end;

  const finish = () => endRef.current(clamp(okRef.current * 50 + levelRef.current * 10, 0, 1500));

  // Temporizador robusto: se crea UNA sola vez (no depende de 'end').
  useEffect(() => {
    const id = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(id); finish(); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const answer = (val) => {
    if (lockRef.current) return;
    lockRef.current = true;
    const good = val === q.correct;

    if (good) {
      okRef.current += 1;
      levelRef.current += 1;
      setLevel(levelRef.current);
      setFeedback('ok');
    } else {
      failsRef.current += 1;
      setFails(failsRef.current);
      setFeedback('ko');
    }

    setTimeout(() => {
      setFeedback(null);
      lockRef.current = false;
      if (!good && failsRef.current >= MAX_FAILS) { finish(); return; }
      setQ(makeQuestion(levelRef.current));
    }, 350);
  };

  const livesLeft = Math.max(0, MAX_FAILS - fails);

  return (
    <div className={`flex-1 flex flex-col items-center justify-center px-6 pb-8 transition-colors duration-200 ${feedback === 'ok' ? 'bg-emerald-500/10' : feedback === 'ko' ? 'bg-rose-500/20' : ''}`}>
      <div className="flex items-center gap-3 mb-6">
        <span className={`hud-chip font-black px-4 py-1.5 rounded-full text-sm ${timeLeft <= 10 ? 'text-rose-400 animate-pulse' : 'text-white'}`}>⏱ {timeLeft}s</span>
        <span className="hud-chip text-emerald-400 font-black px-4 py-1.5 rounded-full text-sm">✓ {okRef.current}</span>
        <ScoreBurst value={okRef.current} color="#6ee7b7" />
        <span className="hud-chip font-black px-3 py-1.5 rounded-full text-sm">{'❤️'.repeat(livesLeft)}{'🖤'.repeat(fails)}</span>
      </div>
      <p className="text-white/60 font-bold uppercase tracking-widest text-xs mb-3">Nivel {level} · cobra al cliente</p>
      <div className="rounded-3xl px-8 py-6 mb-8 text-center" style={fx.panel}>
        <p className="text-white text-4xl font-black tabular-nums">{fmt(q.a)} <span className="text-amber-400">{q.op}</span> {fmt(q.b)}</p>
      </div>
      <div className="flex flex-col gap-3 w-full max-w-xs">
        {q.options.map(opt => (
          <button
            key={opt}
            onPointerDown={() => answer(opt)}
            className="text-amber-950 font-black text-2xl py-4 rounded-2xl border-b-4 border-amber-800 active:scale-95 transition-transform tabular-nums"
            style={fx.tile('#fde68a', '#f59e0b', 'rgba(245,158,11,0.45)')}
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
        <span key="1">Eres la caja más rápida: resuelve la <strong>operación</strong> y cobra el total correcto.</span>,
        <span key="2">Empieza con <strong>sumas fáciles</strong> y sube de nivel (¡a partir del nivel 4 aparecen restas!).</span>,
        <span key="3"><strong>60 segundos</strong>. Si fallas <strong>3 veces, eliminado</strong>.</span>,
      ]}
    >
      {({ end }) => <Play end={end} />}
    </GameShell>
  );
}
