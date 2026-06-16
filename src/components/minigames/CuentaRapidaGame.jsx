import React, { useState, useEffect, useRef } from 'react';
import { GameShell, shuffle, rand } from './GameShell';

const POOL = ['🍎', '🍌', '🥕', '🧀', '🥛', '🍞', '🐟', '🍇'];
const TOTAL_ROUNDS = 6;
const SHOW_MS = 3200;

const makeRound = () => {
  const types = shuffle(POOL).slice(0, 3);
  const target = types[0];
  const targetCount = rand(4, 9);
  const items = [];
  types.forEach((t, ti) => {
    const count = ti === 0 ? targetCount : rand(3, 7);
    for (let i = 0; i < count; i++) {
      items.push({ id: `${ti}-${i}`, emoji: t, x: rand(6, 86), y: rand(8, 80), rot: rand(-26, 26) });
    }
  });
  const opts = new Set([targetCount]);
  while (opts.size < 3) {
    const d = targetCount + rand(1, 2) * (Math.random() < 0.5 ? -1 : 1);
    if (d > 0) opts.add(d);
  }
  return { target, targetCount, items: shuffle(items), options: shuffle([...opts]) };
};

function Play({ end }) {
  const [round, setRound] = useState(1);
  const [data, setData] = useState(makeRound);
  const [phase, setPhase] = useState('show');   // show | ask | feedback
  const [picked, setPicked] = useState(null);    // valor elegido (para feedback)
  const okRef = useRef(0);
  const endRef = useRef(end);
  endRef.current = end;

  useEffect(() => {
    if (phase !== 'show') return;
    const id = setTimeout(() => setPhase('ask'), SHOW_MS);
    return () => clearTimeout(id);
  }, [phase, round]);

  const answer = (val) => {
    if (phase !== 'ask') return;
    const good = val === data.targetCount;
    if (good) okRef.current += 1;
    setPicked(val);
    setPhase('feedback');
    setTimeout(() => {
      if (round >= TOTAL_ROUNDS) {
        endRef.current(okRef.current * 150 + (okRef.current === TOTAL_ROUNDS ? 100 : 0));
      } else {
        setRound(r => r + 1);
        setData(makeRound());
        setPicked(null);
        setPhase('show');
      }
    }, 1000);
  };

  const correct = data.targetCount;

  return (
    <div className="flex-1 flex flex-col px-5 pb-6">
      <div className="flex items-center justify-center gap-3 mb-3">
        <span className="bg-black/30 text-white font-black px-4 py-1.5 rounded-full text-sm">Ronda {round}/{TOTAL_ROUNDS}</span>
        <span className="bg-black/30 text-amber-300 font-black px-4 py-1.5 rounded-full text-sm">✓ {okRef.current}</span>
      </div>

      {phase === 'show' ? (
        <>
          <p className="text-center text-amber-300 font-black uppercase tracking-widest text-xs mb-2 flex items-center justify-center gap-2">
            <span className="animate-pulse">👀</span> ¡Memoriza la estantería!
          </p>
          {/* barra de cuenta atrás */}
          <div className="h-1.5 w-full max-w-sm mx-auto bg-black/30 rounded-full overflow-hidden mb-3">
            <div className="h-full rounded-full gfx-bar" style={{ background: 'linear-gradient(90deg,#fde68a,#f59e0b)', animationDuration: `${SHOW_MS}ms` }} />
          </div>
          <div
            className="flex-1 relative rounded-3xl overflow-hidden"
            style={{ background: 'linear-gradient(165deg, #3a2a12, #1c1408)', boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.5), inset 0 0 0 2px rgba(245,158,11,0.25)' }}
          >
            {/* baldas de madera */}
            {[28, 56, 84].map((ty) => (
              <div key={ty} className="absolute left-0 right-0 h-1.5" style={{ top: `${ty}%`, background: 'linear-gradient(180deg,#a16207,#713f12)', boxShadow: '0 3px 6px rgba(0,0,0,0.45)' }} />
            ))}
            {data.items.map((it, i) => (
              <div
                key={it.id}
                className="absolute text-3xl gfx-pop drop-shadow-[0_2px_3px_rgba(0,0,0,0.5)]"
                style={{ left: `${it.x}%`, top: `${it.y}%`, transform: `rotate(${it.rot}deg)`, animationDelay: `${Math.min(i * 28, 500)}ms` }}
              >
                {it.emoji}
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center">
          <p className="text-white/60 font-bold uppercase tracking-widest text-xs mb-5">
            {phase === 'feedback' ? (picked === correct ? '¡Correcto! 🎉' : `Eran ${correct}`) : '¿Cuántos había de este?'}
          </p>
          <div
            className="rounded-full w-28 h-28 flex items-center justify-center mb-9"
            style={{ background: 'radial-gradient(circle at 38% 28%, rgba(253,230,138,0.35), rgba(0,0,0,0.35))', boxShadow: '0 0 34px rgba(245,158,11,0.4), inset 0 2px 8px rgba(255,255,255,0.25)', border: '2px solid rgba(245,158,11,0.5)' }}
          >
            <span className="text-6xl drop-shadow-[0_3px_4px_rgba(0,0,0,0.5)]">{data.target}</span>
          </div>
          <div className="flex gap-4">
            {data.options.map(o => {
              const isFb = phase === 'feedback';
              const isCorrect = o === correct;
              const isPicked = o === picked;
              let style = { background: 'linear-gradient(160deg, #fde68a, #f59e0b)', boxShadow: '0 5px 14px rgba(245,158,11,0.4), inset 0 2px 5px rgba(255,255,255,0.5)' };
              if (isFb && isCorrect) style = { background: 'linear-gradient(160deg, #6ee7b7, #059669)', boxShadow: '0 0 22px rgba(16,185,129,0.7), inset 0 2px 5px rgba(255,255,255,0.5)' };
              else if (isFb && isPicked && !isCorrect) style = { background: 'linear-gradient(160deg, #fda4af, #be123c)', boxShadow: '0 0 22px rgba(225,29,72,0.6)' };
              return (
                <button
                  key={o}
                  onPointerDown={() => answer(o)}
                  disabled={isFb}
                  className={`w-20 h-20 font-black text-3xl rounded-2xl border-b-4 border-black/25 active:scale-90 transition-all ${isFb && isCorrect ? 'text-white scale-110' : isFb && isPicked ? 'text-white' : 'text-amber-950'}`}
                  style={style}
                >
                  {o}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export function CuentaRapidaGame(props) {
  return (
    <GameShell
      {...props}
      day={29} title="Cuenta Rápida" emoji="🧺" accent="amber"
      instructions={[
        <span key="1">Verás una estantería revuelta durante <strong>3 segundos</strong>.</span>,
        <span key="2">Después te preguntaremos <strong>cuántas unidades</strong> había de un producto.</span>,
        <span key="3">6 rondas, 150 puntos por acierto y bonus por pleno. ¡Ojo de inventario!</span>,
      ]}
    >
      {({ end }) => <Play end={end} />}
    </GameShell>
  );
}
